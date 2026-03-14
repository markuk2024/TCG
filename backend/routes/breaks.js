const express = require('express');
const { body, param, query: queryValidator } = require('express-validator');
const { query } = require('../config/database');
const { authenticate, requireAdmin } = require('../middleware/auth');
const { NotFoundError, ValidationError } = require('../middleware/errorHandler');

const router = express.Router();

// Public routes - Get all breaks
// GET /api/breaks - List breaks with filters
router.get('/', [
  queryValidator('status').optional().isIn(['upcoming', 'live', 'completed', 'cancelled']),
  queryValidator('productType').optional(),
  queryValidator('page').optional().isInt({ min: 1 }),
  queryValidator('limit').optional().isInt({ min: 1, max: 100 })
], async (req, res, next) => {
  try {
    const { status, productType, page = 1, limit = 20 } = req.query;
    const offset = (page - 1) * limit;
    
    let whereClause = '';
    const params = [];
    let paramCount = 1;
    
    if (status) {
      whereClause += `WHERE status = $${paramCount++}`;
      params.push(status);
    }
    
    if (productType) {
      whereClause += whereClause ? ` AND product_type = $${paramCount++}` : `WHERE product_type = $${paramCount++}`;
      params.push(productType);
    }
    
    params.push(parseInt(limit), parseInt(offset));
    
    const result = await query(
      `SELECT id, name, description, product_type, product_name, total_packs, 
              packs_available, pack_price_gbp, pack_price_usd, break_type, status,
              scheduled_at, started_at, stream_url, created_at
       FROM breaks
       ${whereClause}
       ORDER BY 
         CASE status 
           WHEN 'live' THEN 1 
           WHEN 'upcoming' THEN 2 
           ELSE 3 
         END,
         scheduled_at ASC NULLS LAST
       LIMIT $${paramCount++} OFFSET $${paramCount++}`,
      params
    );
    
    // Get total count
    const countResult = await query(
      `SELECT COUNT(*) as total FROM breaks ${whereClause}`,
      params.slice(0, -2)
    );
    
    res.json({
      breaks: result.rows,
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

// GET /api/breaks/:id - Get single break details
router.get('/:id', [
  param('id').isUUID().withMessage('Valid break ID required')
], async (req, res, next) => {
  try {
    // Get break details
    const breakResult = await query(
      `SELECT b.*, 
              u.email as created_by_email
       FROM breaks b
       LEFT JOIN users u ON b.created_by = u.id
       WHERE b.id = $1`,
      [req.params.id]
    );
    
    if (breakResult.rows.length === 0) {
      throw new NotFoundError('Break not found');
    }
    
    const breakData = breakResult.rows[0];
    
    // Get spots for this break
    const spotsResult = await query(
      `SELECT bs.id, bs.spot_number, bs.pack_numbers, bs.payment_status,
              u.email as user_email, u.first_name, u.last_name
       FROM break_spots bs
       LEFT JOIN users u ON bs.user_id = u.id
       WHERE bs.break_id = $1
       ORDER BY bs.spot_number`,
      [req.params.id]
    );
    
    res.json({
      ...breakData,
      spots: spotsResult.rows
    });
  } catch (error) {
    next(error);
  }
});

// Protected routes - Purchase spots
router.use(authenticate);

// POST /api/breaks/:id/purchase - Purchase break spots
router.post('/:id/purchase', [
  param('id').isUUID().withMessage('Valid break ID required'),
  body('spotNumbers').isArray({ min: 1 }).withMessage('At least one spot number required'),
  body('spotNumbers.*').isInt({ min: 1 }).withMessage('Invalid spot number')
], async (req, res, next) => {
  try {
    const { id } = req.params;
    const { spotNumbers } = req.body;
    
    // Check if break exists and is available
    const breakResult = await query(
      'SELECT * FROM breaks WHERE id = $1',
      [id]
    );
    
    if (breakResult.rows.length === 0) {
      throw new NotFoundError('Break not found');
    }
    
    const breakData = breakResult.rows[0];
    
    if (breakData.status !== 'upcoming') {
      return res.status(400).json({ error: 'Break is not available for purchase' });
    }
    
    // Check if spots are available
    for (const spotNumber of spotNumbers) {
      if (spotNumber > breakData.total_packs) {
        return res.status(400).json({ error: `Spot ${spotNumber} does not exist` });
      }
      
      const existingSpot = await query(
        'SELECT id FROM break_spots WHERE break_id = $1 AND spot_number = $2 AND payment_status != $3',
        [id, spotNumber, 'failed']
      );
      
      if (existingSpot.rows.length > 0) {
        return res.status(409).json({ error: `Spot ${spotNumber} is already taken` });
      }
    }
    
    // Calculate total price
    const totalPriceGBP = breakData.pack_price_gbp * spotNumbers.length;
    const totalPriceUSD = breakData.pack_price_usd * spotNumbers.length;
    
    // Create payment intent with Stripe
    const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
    
    const paymentIntent = await stripe.paymentIntents.create({
      amount: Math.round(totalPriceGBP * 100), // Convert to pence
      currency: 'gbp',
      metadata: {
        breakId: id,
        userId: req.user.id,
        spotNumbers: spotNumbers.join(','),
        type: 'break_purchase'
      }
    });
    
    // Reserve spots (create pending records)
    const createdSpots = [];
    for (const spotNumber of spotNumbers) {
      const spotResult = await query(
        `INSERT INTO break_spots (break_id, user_id, spot_number, price_paid_gbp, price_paid_usd, payment_status, stripe_payment_intent_id)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         RETURNING id, spot_number, payment_status`,
        [id, req.user.id, spotNumber, breakData.pack_price_gbp, breakData.pack_price_usd, 'pending', paymentIntent.id]
      );
      createdSpots.push(spotResult.rows[0]);
    }
    
    // Update available packs count
    await query(
      'UPDATE breaks SET packs_available = packs_available - $1 WHERE id = $2',
      [spotNumbers.length, id]
    );
    
    res.json({
      message: 'Spots reserved successfully',
      spots: createdSpots,
      paymentIntent: {
        clientSecret: paymentIntent.client_secret,
        amount: totalPriceGBP,
        currency: 'gbp'
      }
    });
  } catch (error) {
    next(error);
  }
});

// Admin routes
router.use(requireAdmin);

// POST /api/breaks - Create new break
router.post('/', [
  body('name').trim().isLength({ min: 3 }).withMessage('Name must be at least 3 characters'),
  body('description').optional().trim(),
  body('productType').notEmpty().withMessage('Product type required'),
  body('productName').notEmpty().withMessage('Product name required'),
  body('totalPacks').isInt({ min: 1 }).withMessage('Total packs must be at least 1'),
  body('packPriceGBP').isDecimal().withMessage('Valid GBP price required'),
  body('packPriceUSD').isDecimal().withMessage('Valid USD price required'),
  body('breakType').optional().isIn(['pack', 'box', 'case']),
  body('scheduledAt').optional().isISO8601().withMessage('Valid datetime required')
], async (req, res, next) => {
  try {
    const {
      name, description, productType, productName, totalPacks,
      packPriceGBP, packPriceUSD, breakType, scheduledAt, streamUrl
    } = req.body;
    
    const result = await query(
      `INSERT INTO breaks (name, description, product_type, product_name, total_packs, 
                          packs_available, pack_price_gbp, pack_price_usd, break_type, 
                          status, scheduled_at, stream_url, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
       RETURNING *`,
      [
        name, description, productType, productName, totalPacks, totalPacks,
        packPriceGBP, packPriceUSD, breakType || 'pack', 'upcoming',
        scheduledAt || null, streamUrl || null, req.user.id
      ]
    );
    
    res.status(201).json({
      message: 'Break created successfully',
      break: result.rows[0]
    });
  } catch (error) {
    next(error);
  }
});

// PUT /api/breaks/:id - Update break
router.put('/:id', [
  param('id').isUUID().withMessage('Valid break ID required')
], async (req, res, next) => {
  try {
    const { id } = req.params;
    const updates = req.body;
    
    // Build dynamic update query
    const allowedFields = [
      'name', 'description', 'status', 'scheduled_at', 'started_at',
      'completed_at', 'stream_url', 'total_revenue', 'platform_fee'
    ];
    
    const setClause = [];
    const values = [];
    let paramCount = 1;
    
    for (const [key, value] of Object.entries(updates)) {
      if (allowedFields.includes(key)) {
        setClause.push(`${key} = $${paramCount++}`);
        values.push(value);
      }
    }
    
    if (setClause.length === 0) {
      return res.status(400).json({ error: 'No valid fields to update' });
    }
    
    values.push(id);
    
    const result = await query(
      `UPDATE breaks SET ${setClause.join(', ')} WHERE id = $${paramCount} RETURNING *`,
      values
    );
    
    if (result.rows.length === 0) {
      throw new NotFoundError('Break not found');
    }
    
    res.json({
      message: 'Break updated successfully',
      break: result.rows[0]
    });
  } catch (error) {
    next(error);
  }
});

// POST /api/breaks/:id/record-pulls - Record card pulls for break spots
router.post('/:id/record-pulls', [
  param('id').isUUID().withMessage('Valid break ID required'),
  body('pulls').isArray().withMessage('Pulls array required'),
  body('pulls.*.spotId').isUUID().withMessage('Valid spot ID required'),
  body('pulls.*.cards').isArray().withMessage('Cards array required')
], async (req, res, next) => {
  try {
    const { id } = req.params;
    const { pulls } = req.body;
    
    // Verify break exists
    const breakResult = await query('SELECT status FROM breaks WHERE id = $1', [id]);
    if (breakResult.rows.length === 0) {
      throw new NotFoundError('Break not found');
    }
    
    // Update each spot with pulled cards
    const updatedSpots = [];
    for (const pull of pulls) {
      const result = await query(
        `UPDATE break_spots 
         SET pulled_cards = $1 
         WHERE id = $2 AND break_id = $3
         RETURNING id, spot_number, pulled_cards`,
        [JSON.stringify(pull.cards), pull.spotId, id]
      );
      
      if (result.rows.length > 0) {
        updatedSpots.push(result.rows[0]);
      }
    }
    
    res.json({
      message: 'Card pulls recorded successfully',
      spots: updatedSpots
    });
  } catch (error) {
    next(error);
  }
});

// DELETE /api/breaks/:id - Delete break
router.delete('/:id', [
  param('id').isUUID().withMessage('Valid break ID required')
], async (req, res, next) => {
  try {
    const result = await query(
      'DELETE FROM breaks WHERE id = $1 RETURNING id',
      [req.params.id]
    );
    
    if (result.rows.length === 0) {
      throw new NotFoundError('Break not found');
    }
    
    res.json({ message: 'Break deleted successfully' });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
