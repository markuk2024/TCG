const express = require('express');
const { body } = require('express-validator');
const { query, transaction } = require('../config/database');
const { authenticate, requireAdmin } = require('../middleware/auth');
const { ValidationError } = require('../middleware/errorHandler');

const router = express.Router();

// Initialize Stripe
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

// Protected routes
router.use(authenticate);

// POST /api/payments/create-intent - Create payment intent
router.post('/create-intent', [
  body('amount').isDecimal({ min: 1 }).withMessage('Valid amount required'),
  body('currency').optional().isIn(['gbp', 'usd']),
  body('type').notEmpty().withMessage('Payment type required'),
  body('metadata').optional().isObject()
], async (req, res, next) => {
  try {
    const { amount, currency = 'gbp', type, metadata = {} } = req.body;
    
    // Convert amount to smallest currency unit (pence/cents)
    const amountInSmallestUnit = Math.round(parseFloat(amount) * 100);
    
    // Create payment intent
    const paymentIntent = await stripe.paymentIntents.create({
      amount: amountInSmallestUnit,
      currency: currency.toLowerCase(),
      metadata: {
        userId: req.user.id,
        type,
        ...metadata
      },
      automatic_payment_methods: {
        enabled: true
      }
    });
    
    // Record payment in database
    await query(
      `INSERT INTO payments (user_id, stripe_payment_intent_id, amount_gbp, amount_usd, 
                            currency, type, status, metadata)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [
        req.user.id,
        paymentIntent.id,
        currency === 'gbp' ? parseFloat(amount) : null,
        currency === 'usd' ? parseFloat(amount) : null,
        currency.toUpperCase(),
        type,
        'pending',
        JSON.stringify(metadata)
      ]
    );
    
    res.json({
      clientSecret: paymentIntent.client_secret,
      paymentIntentId: paymentIntent.id
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/payments/history - Get user's payment history
router.get('/history', async (req, res, next) => {
  try {
    const { page = 1, limit = 20 } = req.query;
    const offset = (page - 1) * limit;
    
    const result = await query(
      `SELECT id, amount_gbp, amount_usd, currency, type, status, 
              metadata, receipt_url, created_at, updated_at
       FROM payments
       WHERE user_id = $1
       ORDER BY created_at DESC
       LIMIT $2 OFFSET $3`,
      [req.user.id, parseInt(limit), parseInt(offset)]
    );
    
    // Get total count
    const countResult = await query(
      'SELECT COUNT(*) as total FROM payments WHERE user_id = $1',
      [req.user.id]
    );
    
    res.json({
      payments: result.rows,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: parseInt(countResult.rows[0].total)
      }
    });
  } catch (error) {
    next(error);
  }
});

// POST /api/payments/webhook - Stripe webhook handler (public)
// This route doesn't require authentication - it uses Stripe signature verification
router.post('/webhook', express.raw({ type: 'application/json' }), async (req, res, next) => {
  try {
    const sig = req.headers['stripe-signature'];
    const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET;
    
    let event;
    
    try {
      event = stripe.webhooks.constructEvent(req.body, sig, endpointSecret);
    } catch (err) {
      console.log(`Webhook signature verification failed: ${err.message}`);
      return res.status(400).send(`Webhook Error: ${err.message}`);
    }
    
    // Handle the event
    switch (event.type) {
      case 'payment_intent.succeeded': {
        const paymentIntent = event.data.object;
        
        await transaction(async (client) => {
          // Update payment status
          await client.query(
            `UPDATE payments 
             SET status = 'completed', receipt_url = $1, updated_at = CURRENT_TIMESTAMP
             WHERE stripe_payment_intent_id = $2`,
            [paymentIntent.charges.data[0]?.receipt_url, paymentIntent.id]
          );
          
          // Get payment details
          const paymentResult = await client.query(
            'SELECT * FROM payments WHERE stripe_payment_intent_id = $1',
            [paymentIntent.id]
          );
          
          if (paymentResult.rows.length > 0) {
            const payment = paymentResult.rows[0];
            
            // Handle different payment types
            if (payment.type === 'break_purchase') {
              // Update break spot payment status
              await client.query(
                `UPDATE break_spots 
                 SET payment_status = 'completed'
                 WHERE stripe_payment_intent_id = $1`,
                [paymentIntent.id]
              );
              
              // Record revenue
              await client.query(
                `INSERT INTO treasury_transactions (type, category, amount_gbp, amount_usd, 
                                                     description, related_payment_id)
                 VALUES ($1, $2, $3, $4, $5, $6)`,
                [
                  'revenue', 
                  'break_sales', 
                  payment.amount_gbp, 
                  payment.amount_usd,
                  `Break purchase ${paymentIntent.id}`,
                  payment.id
                ]
              );
            } else if (payment.type === 'token_purchase') {
              // Add tokens to user balance
              const metadata = JSON.parse(payment.metadata || '{}');
              const tokenAmount = metadata.tokenAmount || 0;
              
              await client.query(
                `UPDATE user_balances 
                 SET token_balance = token_balance + $1
                 WHERE user_id = $2`,
                [tokenAmount, payment.user_id]
              );
              
              // Record revenue
              await client.query(
                `INSERT INTO treasury_transactions (type, category, amount_gbp, amount_usd, 
                                                     description, related_payment_id)
                 VALUES ($1, $2, $3, $4, $5, $6)`,
                [
                  'revenue',
                  'token_sales',
                  payment.amount_gbp,
                  payment.amount_usd,
                  `Token purchase ${paymentIntent.id}`,
                  payment.id
                ]
              );
            }
          }
        });
        
        break;
      }
      
      case 'payment_intent.payment_failed': {
        const paymentIntent = event.data.object;
        
        await query(
          `UPDATE payments 
           SET status = 'failed', updated_at = CURRENT_TIMESTAMP
           WHERE stripe_payment_intent_id = $1`,
          [paymentIntent.id]
        );
        
        // Update break spot status if applicable
        await query(
          `UPDATE break_spots 
           SET payment_status = 'failed'
           WHERE stripe_payment_intent_id = $1`,
          [paymentIntent.id]
        );
        
        break;
      }
      
      case 'charge.refunded': {
        const charge = event.data.object;
        
        await query(
          `UPDATE payments 
           SET status = 'refunded', updated_at = CURRENT_TIMESTAMP
           WHERE stripe_payment_intent_id = $1`,
          [charge.payment_intent]
        );
        
        break;
      }
      
      default:
        console.log(`Unhandled event type: ${event.type}`);
    }
    
    res.json({ received: true });
  } catch (error) {
    next(error);
  }
});

// Admin routes
router.use(requireAdmin);

// GET /api/payments/all - Get all payments (admin)
router.get('/all', async (req, res, next) => {
  try {
    const { status, type, page = 1, limit = 50 } = req.query;
    const offset = (page - 1) * limit;
    
    let whereClause = '';
    const params = [];
    let paramCount = 1;
    
    if (status) {
      whereClause += `WHERE status = $${paramCount++}`;
      params.push(status);
    }
    
    if (type) {
      whereClause += whereClause ? ` AND type = $${paramCount++}` : `WHERE type = $${paramCount++}`;
      params.push(type);
    }
    
    params.push(parseInt(limit), parseInt(offset));
    
    const result = await query(
      `SELECT p.*, u.email as user_email, u.first_name, u.last_name
       FROM payments p
       JOIN users u ON p.user_id = u.id
       ${whereClause}
       ORDER BY p.created_at DESC
       LIMIT $${paramCount++} OFFSET $${paramCount++}`,
      params
    );
    
    const countResult = await query(
      `SELECT COUNT(*) as total FROM payments ${whereClause}`,
      params.slice(0, -2)
    );
    
    res.json({
      payments: result.rows,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: parseInt(countResult.rows[0].total)
      }
    });
  } catch (error) {
    next(error);
  }
});

// POST /api/payments/refund - Process refund (admin)
router.post('/refund', [
  body('paymentId').notEmpty().withMessage('Payment ID required'),
  body('reason').optional().trim()
], async (req, res, next) => {
  try {
    const { paymentId, reason } = req.body;
    
    // Get payment details
    const paymentResult = await query(
      'SELECT stripe_payment_intent_id FROM payments WHERE id = $1',
      [paymentId]
    );
    
    if (paymentResult.rows.length === 0) {
      throw new ValidationError('Payment not found');
    }
    
    const stripePaymentIntentId = paymentResult.rows[0].stripe_payment_intent_id;
    
    // Get charges for this payment intent
    const charges = await stripe.charges.list({
      payment_intent: stripePaymentIntentId
    });
    
    if (charges.data.length === 0) {
      throw new ValidationError('No charges found for this payment');
    }
    
    // Create refund
    const refund = await stripe.refunds.create({
      charge: charges.data[0].id,
      reason: reason || 'requested_by_customer'
    });
    
    res.json({
      message: 'Refund processed successfully',
      refundId: refund.id,
      status: refund.status
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
