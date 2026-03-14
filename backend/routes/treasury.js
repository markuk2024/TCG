const express = require('express');
const { body, param, query: queryValidator } = require('express-validator');
const { query } = require('../config/database');
const { authenticate, requireAdmin } = require('../middleware/auth');
const { NotFoundError, ValidationError } = require('../middleware/errorHandler');

const router = express.Router();

// Public routes

// GET /api/treasury/overview - Get treasury overview
router.get('/overview', async (req, res, next) => {
  try {
    // Get total vault value (physical assets)
    const vaultResult = await query(
      `SELECT 
        SUM(current_market_value_gbp) as total_value_gbp,
        SUM(current_market_value_usd) as total_value_usd,
        COUNT(*) as total_items
       FROM vault_items
       WHERE status IN ('in_vault', 'fractionalized')`
    );
    
    // Get treasury balance (cash/tokens)
    const treasuryResult = await query(
      `SELECT 
        SUM(CASE WHEN type = 'revenue' THEN amount_gbp ELSE -amount_gbp END) as balance_gbp,
        SUM(CASE WHEN type = 'revenue' THEN amount_usd ELSE -amount_usd END) as balance_usd
       FROM treasury_transactions`
    );
    
    // Get monthly stats
    const monthlyResult = await query(
      `SELECT 
        DATE_TRUNC('month', created_at) as month,
        SUM(CASE WHEN type = 'revenue' THEN amount_gbp ELSE 0 END) as revenue_gbp,
        SUM(CASE WHEN type = 'expense' THEN amount_gbp ELSE 0 END) as expenses_gbp,
        SUM(CASE WHEN type = 'buyback' THEN amount_gbp ELSE 0 END) as buybacks_gbp
       FROM treasury_transactions
       WHERE created_at >= CURRENT_DATE - INTERVAL '12 months'
       GROUP BY DATE_TRUNC('month', created_at)
       ORDER BY month DESC`
    );
    
    // Get allocation breakdown
    const allocationResult = await query(
      `SELECT 
        category,
        SUM(amount_gbp) as total_gbp,
        COUNT(*) as transaction_count
       FROM treasury_transactions
       WHERE created_at >= CURRENT_DATE - INTERVAL '30 days'
       GROUP BY category`
    );
    
    // Get recent token buybacks
    const buybacksResult = await query(
      `SELECT * FROM token_buybacks
       ORDER BY buyback_date DESC
       LIMIT 10`
    );
    
    res.json({
      vault: {
        physicalAssets: {
          gbp: parseFloat(vaultResult.rows[0].total_value_gbp) || 0,
          usd: parseFloat(vaultResult.rows[0].total_value_usd) || 0,
          itemCount: parseInt(vaultResult.rows[0].total_items) || 0
        },
        treasuryBalance: {
          gbp: parseFloat(treasuryResult.rows[0].balance_gbp) || 0,
          usd: parseFloat(treasuryResult.rows[0].balance_usd) || 0
        }
      },
      monthlyStats: monthlyResult.rows,
      recentAllocations: allocationResult.rows,
      recentBuybacks: buybacksResult.rows,
      allocationConfig: {
        treasury: parseInt(process.env.TREASURY_ALLOCATION_PERCENT) || 50,
        buybacks: parseInt(process.env.TOKEN_BUYBACK_PERCENT) || 30,
        operations: parseInt(process.env.OPERATIONS_PERCENT) || 20
      }
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/treasury/transactions - Get treasury transactions
router.get('/transactions', [
  queryValidator('type').optional().isIn(['revenue', 'expense', 'buyback', 'staking_rewards', 'operations']),
  queryValidator('page').optional().isInt({ min: 1 }),
  queryValidator('limit').optional().isInt({ min: 1, max: 100 })
], async (req, res, next) => {
  try {
    const { type, page = 1, limit = 20 } = req.query;
    const offset = (page - 1) * limit;
    
    let whereClause = '';
    const params = [];
    let paramCount = 1;
    
    if (type) {
      whereClause += `WHERE type = $${paramCount++}`;
      params.push(type);
    }
    
    params.push(parseInt(limit), parseInt(offset));
    
    const result = await query(
      `SELECT tt.*, b.name as break_name
       FROM treasury_transactions tt
       LEFT JOIN breaks b ON tt.related_break_id = b.id
       ${whereClause}
       ORDER BY tt.created_at DESC
       LIMIT $${paramCount++} OFFSET $${paramCount++}`,
      params
    );
    
    const countResult = await query(
      `SELECT COUNT(*) as total FROM treasury_transactions ${whereClause}`,
      params.slice(0, -2)
    );
    
    res.json({
      transactions: result.rows,
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

// Admin routes
router.use(requireAdmin);

// POST /api/treasury/transaction - Record treasury transaction
router.post('/transaction', [
  body('type').isIn(['revenue', 'expense', 'buyback', 'staking_rewards', 'operations']).withMessage('Valid type required'),
  body('category').notEmpty().withMessage('Category required'),
  body('amountGBP').optional().isDecimal(),
  body('amountUSD').optional().isDecimal(),
  body('description').optional().trim()
], async (req, res, next) => {
  try {
    const { type, category, amountGBP, amountUSD, description, relatedBreakId, relatedPaymentId, blockchainTxHash } = req.body;
    
    const result = await query(
      `INSERT INTO treasury_transactions (type, category, amount_gbp, amount_usd, description,
                                          related_break_id, related_payment_id, blockchain_tx_hash)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING *`,
      [type, category, amountGBP, amountUSD, description, relatedBreakId, relatedPaymentId, blockchainTxHash]
    );
    
    res.status(201).json({
      message: 'Transaction recorded successfully',
      transaction: result.rows[0]
    });
  } catch (error) {
    next(error);
  }
});

// POST /api/treasury/execute-buyback - Execute token buyback
router.post('/execute-buyback', [
  body('amountGBP').isDecimal({ min: 0.01 }).withMessage('Valid GBP amount required'),
  body('amountTokens').isDecimal({ min: 0.01 }).withMessage('Valid token amount required'),
  body('pricePerTokenGBP').isDecimal().withMessage('Valid price required'),
  body('dexUsed').optional().isIn(['uniswap', 'sushiswap', 'oneinch']),
  body('transactionHash').notEmpty().withMessage('Blockchain transaction hash required')
], async (req, res, next) => {
  try {
    const { amountGBP, amountTokens, pricePerTokenGBP, dexUsed, transactionHash } = req.body;
    
    // Record buyback
    const buybackResult = await query(
      `INSERT INTO token_buybacks (amount_tokens, price_per_token_gbp, total_cost_gbp, 
                                   dex_used, transaction_hash)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [amountTokens, pricePerTokenGBP, amountGBP, dexUsed || 'uniswap', transactionHash]
    );
    
    // Record as treasury transaction
    await query(
      `INSERT INTO treasury_transactions (type, category, amount_gbp, amount_token, 
                                          token_price_at_tx, description, blockchain_tx_hash)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [
        'buyback',
        'token_buyback',
        amountGBP,
        amountTokens,
        pricePerTokenGBP,
        `Token buyback: ${amountTokens} tokens at £${pricePerTokenGBP}`,
        transactionHash
      ]
    );
    
    res.status(201).json({
      message: 'Buyback executed and recorded successfully',
      buyback: buybackResult.rows[0]
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/treasury/allocation-settings - Get allocation percentages
router.get('/allocation-settings', (req, res) => {
  res.json({
    treasury: parseInt(process.env.TREASURY_ALLOCATION_PERCENT) || 50,
    buybacks: parseInt(process.env.TOKEN_BUYBACK_PERCENT) || 30,
    operations: parseInt(process.env.OPERATIONS_PERCENT) || 20
  });
});

// PUT /api/treasury/allocation-settings - Update allocation percentages
router.put('/allocation-settings', [
  body('treasury').isInt({ min: 0, max: 100 }),
  body('buybacks').isInt({ min: 0, max: 100 }),
  body('operations').isInt({ min: 0, max: 100 })
], async (req, res, next) => {
  try {
    const { treasury, buybacks, operations } = req.body;
    
    // Validate that percentages add up to 100
    if (treasury + buybacks + operations !== 100) {
      throw new ValidationError('Allocation percentages must add up to 100%');
    }
    
    // In production, this would update the database or config
    // For now, we'll just return the new settings
    res.json({
      message: 'Allocation settings updated successfully',
      settings: {
        treasury,
        buybacks,
        operations
      },
      note: 'To persist these changes, update your .env file'
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/treasury/performance - Get treasury performance metrics
router.get('/performance', async (req, res, next) => {
  try {
    // Calculate revenue for last 30 days
    const revenue30d = await query(
      `SELECT SUM(amount_gbp) as total
       FROM treasury_transactions
       WHERE type = 'revenue' AND created_at >= CURRENT_DATE - INTERVAL '30 days'`
    );
    
    // Calculate revenue for last 90 days
    const revenue90d = await query(
      `SELECT SUM(amount_gbp) as total
       FROM treasury_transactions
       WHERE type = 'revenue' AND created_at >= CURRENT_DATE - INTERVAL '90 days'`
    );
    
    // Calculate total buybacks
    const buybacksResult = await query(
      `SELECT SUM(total_cost_gbp) as total_gbp, SUM(amount_tokens) as total_tokens
       FROM token_buybacks`
    );
    
    // Calculate staking rewards distributed
    const stakingResult = await query(
      `SELECT SUM(total_reward_pool) as total_rewards
       FROM staking_rewards`
    );
    
    // Get revenue by source
    const bySourceResult = await query(
      `SELECT category, SUM(amount_gbp) as total
       FROM treasury_transactions
       WHERE type = 'revenue'
       GROUP BY category`
    );
    
    res.json({
      revenue: {
        last30Days: parseFloat(revenue30d.rows[0].total) || 0,
        last90Days: parseFloat(revenue90d.rows[0].total) || 0
      },
      buybacks: {
        totalGBP: parseFloat(buybacksResult.rows[0].total_gbp) || 0,
        totalTokens: parseFloat(buybacksResult.rows[0].total_tokens) || 0
      },
      stakingRewards: {
        totalDistributed: parseFloat(stakingResult.rows[0].total_rewards) || 0
      },
      revenueBySource: bySourceResult.rows
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
