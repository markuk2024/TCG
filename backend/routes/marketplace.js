const express = require('express');
const { body, param, query: queryValidator } = require('express-validator');
const { query, transaction } = require('../config/database');
const { authenticate, requireAdmin } = require('../middleware/auth');
const { NotFoundError, ValidationError } = require('../middleware/errorHandler');

const router = express.Router();

// Public routes

// GET /api/marketplace/listings - Get active marketplace listings
router.get('/listings', [
  queryValidator('page').optional().isInt({ min: 1 }),
  queryValidator('limit').optional().isInt({ min: 1, max: 100 }),
  queryValidator('sortBy').optional().isIn(['price', 'newest', 'popular'])
], async (req, res, next) => {
  try {
    const { page = 1, limit = 20, sortBy = 'newest' } = req.query;
    const offset = (page - 1) * limit;
    
    let orderBy = 'ml.listed_at DESC';
    if (sortBy === 'price') orderBy = 'ml.price_per_share_gbp ASC';
    
    const result = await query(
      `SELECT ml.id, ml.shares_amount, ml.price_per_share_gbp, ml.price_per_share_usd,
              ml.listed_at, u.email as seller_email,
              fs.total_shares, fs.available_shares,
              vi.name as card_name, vi.card_set, vi.grade, vi.images
       FROM marketplace_listings ml
       JOIN users u ON ml.seller_id = u.id
       JOIN fractional_shares fs ON ml.fractional_share_id = fs.id
       JOIN vault_items vi ON fs.vault_item_id = vi.id
       WHERE ml.status = 'active'
       ORDER BY ${orderBy}
       LIMIT $1 OFFSET $2`,
      [parseInt(limit), parseInt(offset)]
    );
    
    // Get total count
    const countResult = await query(
      `SELECT COUNT(*) as total FROM marketplace_listings WHERE status = 'active'`
    );
    
    res.json({
      listings: result.rows,
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

// GET /api/marketplace/listings/:id - Get single listing details
router.get('/listings/:id', [
  param('id').isUUID().withMessage('Valid listing ID required')
], async (req, res, next) => {
  try {
    const result = await query(
      `SELECT ml.*, u.email as seller_email, u.first_name as seller_first_name,
              fs.total_shares, fs.share_price_gbp as original_price_gbp,
              vi.name as card_name, vi.card_set, vi.card_number, vi.grade,
              vi.grading_company, vi.condition, vi.images, vi.current_market_value_gbp
       FROM marketplace_listings ml
       JOIN users u ON ml.seller_id = u.id
       JOIN fractional_shares fs ON ml.fractional_share_id = fs.id
       JOIN vault_items vi ON fs.vault_item_id = vi.id
       WHERE ml.id = $1`,
      [req.params.id]
    );
    
    if (result.rows.length === 0) {
      throw new NotFoundError('Listing not found');
    }
    
    res.json(result.rows[0]);
  } catch (error) {
    next(error);
  }
});

// Protected routes - Buying/Selling
router.use(authenticate);

// POST /api/marketplace/listings - Create new listing
router.post('/listings', [
  body('fractionalShareId').isUUID().withMessage('Valid fractional share ID required'),
  body('sharesAmount').isInt({ min: 1 }).withMessage('Shares amount must be at least 1'),
  body('pricePerShareGBP').isDecimal().withMessage('Valid GBP price required'),
  body('pricePerShareUSD').isDecimal().withMessage('Valid USD price required')
], async (req, res, next) => {
  try {
    const { fractionalShareId, sharesAmount, pricePerShareGBP, pricePerShareUSD } = req.body;
    
    // Verify user owns enough shares
    const sharesResult = await query(
      'SELECT shares_owned FROM user_shares WHERE user_id = $1 AND fractional_share_id = $2',
      [req.user.id, fractionalShareId]
    );
    
    if (sharesResult.rows.length === 0 || sharesResult.rows[0].shares_owned < sharesAmount) {
      return res.status(400).json({ error: 'Insufficient shares to list' });
    }
    
    // Verify fractional shares are trading enabled
    const fsResult = await query(
      'SELECT trading_enabled FROM fractional_shares WHERE id = $1',
      [fractionalShareId]
    );
    
    if (fsResult.rows.length === 0) {
      throw new NotFoundError('Fractional shares not found');
    }
    
    if (!fsResult.rows[0].trading_enabled) {
      return res.status(400).json({ error: 'Trading not yet enabled for these shares' });
    }
    
    // Create listing
    const result = await query(
      `INSERT INTO marketplace_listings (seller_id, fractional_share_id, shares_amount, 
                                         price_per_share_gbp, price_per_share_usd, status)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [req.user.id, fractionalShareId, sharesAmount, pricePerShareGBP, pricePerShareUSD, 'active']
    );
    
    res.status(201).json({
      message: 'Listing created successfully',
      listing: result.rows[0]
    });
  } catch (error) {
    next(error);
  }
});

// POST /api/marketplace/listings/:id/buy - Buy shares from listing
router.post('/listings/:id/buy', [
  param('id').isUUID().withMessage('Valid listing ID required'),
  body('sharesAmount').isInt({ min: 1 }).withMessage('Shares amount must be at least 1')
], async (req, res, next) => {
  try {
    const { id } = req.params;
    const { sharesAmount } = req.body;
    
    // Get listing details
    const listingResult = await query(
      `SELECT ml.*, fs.id as fs_id, fs.vault_item_id
       FROM marketplace_listings ml
       JOIN fractional_shares fs ON ml.fractional_share_id = fs.id
       WHERE ml.id = $1 AND ml.status = 'active'`,
      [id]
    );
    
    if (listingResult.rows.length === 0) {
      throw new NotFoundError('Listing not found or not active');
    }
    
    const listing = listingResult.rows[0];
    
    // Check if buyer is not seller
    if (listing.seller_id === req.user.id) {
      return res.status(400).json({ error: 'Cannot buy your own listing' });
    }
    
    // Check if enough shares available
    if (sharesAmount > listing.shares_amount) {
      return res.status(400).json({ error: 'Not enough shares available' });
    }
    
    // Calculate total cost
    const totalCostGBP = sharesAmount * listing.price_per_share_gbp;
    const totalCostUSD = sharesAmount * listing.price_per_share_usd;
    
    // Check buyer balance
    const balanceResult = await query(
      'SELECT fiat_balance_gbp FROM user_balances WHERE user_id = $1',
      [req.user.id]
    );
    
    if (balanceResult.rows.length === 0 || balanceResult.rows[0].fiat_balance_gbp < totalCostGBP) {
      return res.status(400).json({ error: 'Insufficient balance' });
    }
    
    // Execute trade in transaction
    await transaction(async (client) => {
      // Deduct from buyer
      await client.query(
        'UPDATE user_balances SET fiat_balance_gbp = fiat_balance_gbp - $1 WHERE user_id = $2',
        [totalCostGBP, req.user.id]
      );
      
      // Add to seller
      await client.query(
        'UPDATE user_balances SET fiat_balance_gbp = fiat_balance_gbp + $1 WHERE user_id = $2',
        [totalCostGBP, listing.seller_id]
      );
      
      // Update seller's shares (deduct)
      await client.query(
        `UPDATE user_shares 
         SET shares_owned = shares_owned - $1 
         WHERE user_id = $2 AND fractional_share_id = $3`,
        [sharesAmount, listing.seller_id, listing.fractional_share_id]
      );
      
      // Update or create buyer's shares (add)
      const existingShares = await client.query(
        'SELECT id, shares_owned FROM user_shares WHERE user_id = $1 AND fractional_share_id = $2',
        [req.user.id, listing.fractional_share_id]
      );
      
      if (existingShares.rows.length > 0) {
        await client.query(
          'UPDATE user_shares SET shares_owned = shares_owned + $1 WHERE id = $2',
          [sharesAmount, existingShares.rows[0].id]
        );
      } else {
        await client.query(
          `INSERT INTO user_shares (user_id, fractional_share_id, shares_owned, purchase_price_avg_gbp, purchase_price_avg_usd)
           VALUES ($1, $2, $3, $4, $5)`,
          [req.user.id, listing.fractional_share_id, sharesAmount, listing.price_per_share_gbp, listing.price_per_share_usd]
        );
      }
      
      // Update fractional shares available
      await client.query(
        'UPDATE fractional_shares SET available_shares = available_shares - $1 WHERE id = $2',
        [sharesAmount, listing.fractional_share_id]
      );
      
      // Update or close listing
      if (sharesAmount === listing.shares_amount) {
        await client.query(
          `UPDATE marketplace_listings 
           SET status = 'sold', sold_at = CURRENT_TIMESTAMP, buyer_id = $1
           WHERE id = $2`,
          [req.user.id, id]
        );
      } else {
        await client.query(
          'UPDATE marketplace_listings SET shares_amount = shares_amount - $1 WHERE id = $2',
          [sharesAmount, id]
        );
      }
      
      // Record treasury transaction (platform fee: 2.5%)
      const platformFee = totalCostGBP * 0.025;
      await client.query(
        `INSERT INTO treasury_transactions (type, category, amount_gbp, description, related_payment_id)
         VALUES ($1, $2, $3, $4, $5)`,
        ['revenue', 'marketplace_fee', platformFee, `Marketplace fee for trade ${id}`, null]
      );
    });
    
    res.json({
      message: 'Purchase successful',
      sharesBought: sharesAmount,
      totalCostGBP,
      totalCostUSD
    });
  } catch (error) {
    next(error);
  }
});

// DELETE /api/marketplace/listings/:id - Cancel listing
router.delete('/listings/:id', [
  param('id').isUUID().withMessage('Valid listing ID required')
], async (req, res, next) => {
  try {
    const result = await query(
      `UPDATE marketplace_listings 
       SET status = 'cancelled'
       WHERE id = $1 AND seller_id = $2 AND status = 'active'
       RETURNING id`,
      [req.params.id, req.user.id]
    );
    
    if (result.rows.length === 0) {
      throw new NotFoundError('Listing not found or not authorized');
    }
    
    res.json({ message: 'Listing cancelled successfully' });
  } catch (error) {
    next(error);
  }
});

// Admin routes
router.use(requireAdmin);

// PUT /api/marketplace/shares/:id/enable-trading - Enable trading for fractional shares
router.put('/shares/:id/enable-trading', [
  param('id').isUUID().withMessage('Valid fractional share ID required')
], async (req, res, next) => {
  try {
    const result = await query(
      `UPDATE fractional_shares 
       SET trading_enabled = true, ipo_date = CURRENT_TIMESTAMP
       WHERE id = $1
       RETURNING *`,
      [req.params.id]
    );
    
    if (result.rows.length === 0) {
      throw new NotFoundError('Fractional shares not found');
    }
    
    res.json({
      message: 'Trading enabled successfully',
      fractionalShares: result.rows[0]
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
