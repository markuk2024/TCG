const express = require('express');
const { query: queryValidator, param } = require('express-validator');
const { query } = require('../config/database');
const { authenticate, requireAdmin } = require('../middleware/auth');
const { NotFoundError } = require('../middleware/errorHandler');

const router = express.Router();

// GET /api/vault/items - List vault items
router.get('/items', [
  queryValidator('status').optional().isIn(['in_vault', 'fractionalized', 'sold', 'removed']),
  queryValidator('category').optional(),
  queryValidator('page').optional().isInt({ min: 1 }),
  queryValidator('limit').optional().isInt({ min: 1, max: 100 })
], async (req, res, next) => {
  try {
    const { status, category, page = 1, limit = 20 } = req.query;
    const offset = (page - 1) * limit;
    
    let whereClause = '';
    const params = [];
    let paramCount = 1;
    
    if (status) {
      whereClause += `WHERE status = $${paramCount++}`;
      params.push(status);
    }
    
    if (category) {
      whereClause += whereClause ? ` AND category = $${paramCount++}` : `WHERE category = $${paramCount++}`;
      params.push(category);
    }
    
    params.push(parseInt(limit), parseInt(offset));
    
    const result = await query(
      `SELECT id, name, card_set, card_number, grade, grading_company, condition,
              category, current_market_value_gbp, current_market_value_usd,
              storage_location, status, images, acquisition_date, created_at
       FROM vault_items
       ${whereClause}
       ORDER BY created_at DESC
       LIMIT $${paramCount++} OFFSET $${paramCount++}`,
      params
    );
    
    // Get total count
    const countResult = await query(
      `SELECT COUNT(*) as total FROM vault_items ${whereClause}`,
      params.slice(0, -2)
    );
    
    // Calculate total value
    const valueResult = await query(
      `SELECT SUM(current_market_value_gbp) as total_value_gbp,
              SUM(current_market_value_usd) as total_value_usd
       FROM vault_items
       WHERE status = 'in_vault' OR status = 'fractionalized'`
    );
    
    res.json({
      items: result.rows,
      totalValue: {
        gbp: parseFloat(valueResult.rows[0].total_value_gbp) || 0,
        usd: parseFloat(valueResult.rows[0].total_value_usd) || 0
      },
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

// GET /api/vault/items/:id - Get single vault item
router.get('/items/:id', [
  param('id').isUUID().withMessage('Valid item ID required')
], async (req, res, next) => {
  try {
    const result = await query(
      `SELECT vi.*,
              fs.total_shares, fs.share_price_gbp, fs.share_price_usd,
              fs.available_shares, fs.trading_enabled, fs.ipo_date
       FROM vault_items vi
       LEFT JOIN fractional_shares fs ON vi.id = fs.vault_item_id
       WHERE vi.id = $1`,
      [req.params.id]
    );
    
    if (result.rows.length === 0) {
      throw new NotFoundError('Vault item not found');
    }
    
    res.json(result.rows[0]);
  } catch (error) {
    next(error);
  }
});

// Admin routes
router.use(requireAdmin);

// POST /api/vault/items - Add new vault item
router.post('/items', async (req, res, next) => {
  try {
    const {
      name, cardSet, cardNumber, grade, gradingCompany, condition,
      category, purchasePriceGBP, purchasePriceUSD, storageLocation,
      acquiredFrom, images, description
    } = req.body;
    
    const result = await query(
      `INSERT INTO vault_items (name, card_set, card_number, grade, grading_company, condition,
                                category, purchase_price_gbp, purchase_price_usd, storage_location,
                                acquired_from, images, description)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
       RETURNING *`,
      [
        name, cardSet, cardNumber, grade, gradingCompany, condition,
        category, purchasePriceGBP, purchasePriceUSD, storageLocation,
        acquiredFrom, images || [], description
      ]
    );
    
    res.status(201).json({
      message: 'Vault item added successfully',
      item: result.rows[0]
    });
  } catch (error) {
    next(error);
  }
});

// PUT /api/vault/items/:id - Update vault item
router.put('/items/:id', [
  param('id').isUUID().withMessage('Valid item ID required')
], async (req, res, next) => {
  try {
    const { id } = req.params;
    const updates = req.body;
    
    const allowedFields = [
      'name', 'card_set', 'card_number', 'grade', 'grading_company', 'condition',
      'current_market_value_gbp', 'current_market_value_usd', 'storage_location',
      'status', 'images', 'description'
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
      `UPDATE vault_items SET ${setClause.join(', ')} WHERE id = $${paramCount} RETURNING *`,
      values
    );
    
    if (result.rows.length === 0) {
      throw new NotFoundError('Vault item not found');
    }
    
    res.json({
      message: 'Vault item updated successfully',
      item: result.rows[0]
    });
  } catch (error) {
    next(error);
  }
});

// POST /api/vault/items/:id/fractionalize - Create fractional shares for item
router.post('/items/:id/fractionalize', [
  param('id').isUUID().withMessage('Valid item ID required')
], async (req, res, next) => {
  try {
    const { id } = req.params;
    const { totalShares, sharePriceGBP, sharePriceUSD } = req.body;
    
    // Check if item exists and is available
    const itemResult = await query(
      'SELECT status FROM vault_items WHERE id = $1',
      [id]
    );
    
    if (itemResult.rows.length === 0) {
      throw new NotFoundError('Vault item not found');
    }
    
    if (itemResult.rows[0].status !== 'in_vault') {
      return res.status(400).json({ error: 'Item is not available for fractionalization' });
    }
    
    // Check if fractional shares already exist
    const existingShares = await query(
      'SELECT id FROM fractional_shares WHERE vault_item_id = $1',
      [id]
    );
    
    if (existingShares.rows.length > 0) {
      return res.status(409).json({ error: 'Fractional shares already exist for this item' });
    }
    
    // Create fractional shares
    const result = await query(
      `INSERT INTO fractional_shares (vault_item_id, total_shares, available_shares, 
                                     share_price_gbp, share_price_usd, trading_enabled)
       VALUES ($1, $2, $2, $3, $4, $5)
       RETURNING *`,
      [id, totalShares, sharePriceGBP, sharePriceUSD, false]
    );
    
    // Update vault item status
    await query(
      "UPDATE vault_items SET status = 'fractionalized' WHERE id = $1",
      [id]
    );
    
    res.status(201).json({
      message: 'Fractional shares created successfully',
      fractionalShares: result.rows[0]
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/vault/treasury - Get treasury overview
router.get('/treasury', async (req, res, next) => {
  try {
    // Get vault value
    const vaultResult = await query(
      `SELECT 
        SUM(current_market_value_gbp) as vault_value_gbp,
        SUM(current_market_value_usd) as vault_value_usd,
        COUNT(*) as total_items
       FROM vault_items
       WHERE status IN ('in_vault', 'fractionalized')`
    );
    
    // Get treasury transactions summary
    const transactionsResult = await query(
      `SELECT 
        type,
        SUM(amount_gbp) as total_gbp,
        SUM(amount_usd) as total_usd
       FROM treasury_transactions
       WHERE created_at >= CURRENT_DATE - INTERVAL '30 days'
       GROUP BY type`
    );
    
    // Get monthly revenue
    const revenueResult = await query(
      `SELECT 
        DATE_TRUNC('month', created_at) as month,
        SUM(amount_gbp) as revenue_gbp
       FROM treasury_transactions
       WHERE type = 'revenue' AND created_at >= CURRENT_DATE - INTERVAL '12 months'
       GROUP BY DATE_TRUNC('month', created_at)
       ORDER BY month DESC`
    );
    
    res.json({
      vault: vaultResult.rows[0],
      recentTransactions: transactionsResult.rows,
      monthlyRevenue: revenueResult.rows
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
