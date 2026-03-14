const express = require('express');
const { body, param } = require('express-validator');
const { query } = require('../config/database');
const { authenticate, requireAdmin } = require('../middleware/auth');
const { NotFoundError } = require('../middleware/errorHandler');

const router = express.Router();

// All user routes require authentication
router.use(authenticate);

// GET /api/users/me - Get current user profile
router.get('/me', async (req, res, next) => {
  try {
    const userResult = await query(
      `SELECT u.id, u.email, u.first_name, u.last_name, u.phone, u.kyc_status, 
              u.wallet_address, u.created_at, u.last_login_at,
              ub.token_balance, ub.staked_balance, ub.pending_rewards, 
              ub.fiat_balance_gbp, ub.fiat_balance_usd
       FROM users u
       LEFT JOIN user_balances ub ON u.id = ub.user_id
       WHERE u.id = $1`,
      [req.user.id]
    );
    
    if (userResult.rows.length === 0) {
      throw new NotFoundError('User not found');
    }
    
    const user = userResult.rows[0];
    
    res.json({
      id: user.id,
      email: user.email,
      firstName: user.first_name,
      lastName: user.last_name,
      phone: user.phone,
      kycStatus: user.kyc_status,
      walletAddress: user.wallet_address,
      createdAt: user.created_at,
      lastLoginAt: user.last_login_at,
      balances: {
        tokens: parseFloat(user.token_balance) || 0,
        staked: parseFloat(user.staked_balance) || 0,
        pendingRewards: parseFloat(user.pending_rewards) || 0,
        fiatGBP: parseFloat(user.fiat_balance_gbp) || 0,
        fiatUSD: parseFloat(user.fiat_balance_usd) || 0
      }
    });
  } catch (error) {
    next(error);
  }
});

// PUT /api/users/me - Update current user profile
router.put('/me', [
  body('firstName').optional().trim().isLength({ min: 1 }),
  body('lastName').optional().trim().isLength({ min: 1 }),
  body('phone').optional().trim()
], async (req, res, next) => {
  try {
    const { firstName, lastName, phone } = req.body;
    
    const updates = [];
    const values = [];
    let paramCount = 1;
    
    if (firstName) {
      updates.push(`first_name = $${paramCount++}`);
      values.push(firstName);
    }
    if (lastName) {
      updates.push(`last_name = $${paramCount++}`);
      values.push(lastName);
    }
    if (phone !== undefined) {
      updates.push(`phone = $${paramCount++}`);
      values.push(phone);
    }
    
    if (updates.length === 0) {
      return res.status(400).json({ error: 'No fields to update' });
    }
    
    values.push(req.user.id);
    
    const result = await query(
      `UPDATE users SET ${updates.join(', ')} WHERE id = $${paramCount} RETURNING id, first_name, last_name, phone`,
      values
    );
    
    const user = result.rows[0];
    
    res.json({
      message: 'Profile updated successfully',
      user: {
        id: user.id,
        firstName: user.first_name,
        lastName: user.last_name,
        phone: user.phone
      }
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/users/me/activity - Get user activity history
router.get('/me/activity', async (req, res, next) => {
  try {
    const { limit = 20, offset = 0 } = req.query;
    
    const result = await query(
      `SELECT action, entity_type, entity_id, metadata, created_at
       FROM activity_logs
       WHERE user_id = $1
       ORDER BY created_at DESC
       LIMIT $2 OFFSET $3`,
      [req.user.id, parseInt(limit), parseInt(offset)]
    );
    
    res.json(result.rows);
  } catch (error) {
    next(error);
  }
});

// GET /api/users/me/breaks - Get user's break purchases
router.get('/me/breaks', async (req, res, next) => {
  try {
    const result = await query(
      `SELECT bs.id, bs.spot_number, bs.pack_numbers, bs.price_paid_gbp, 
              bs.price_paid_usd, bs.payment_status, bs.pulled_cards, bs.created_at,
              b.name as break_name, b.product_name, b.status as break_status,
              b.scheduled_at, b.stream_url
       FROM break_spots bs
       JOIN breaks b ON bs.break_id = b.id
       WHERE bs.user_id = $1
       ORDER BY bs.created_at DESC`,
      [req.user.id]
    );
    
    res.json(result.rows);
  } catch (error) {
    next(error);
  }
});

// GET /api/users/me/shares - Get user's fractional share holdings
router.get('/me/shares', async (req, res, next) => {
  try {
    const result = await query(
      `SELECT us.id, us.shares_owned, us.purchase_price_avg_gbp, us.purchase_price_avg_usd,
              fs.total_shares, fs.share_price_gbp as current_price_gbp, 
              fs.share_price_usd as current_price_usd,
              vi.name as card_name, vi.grade, vi.current_market_value_gbp
       FROM user_shares us
       JOIN fractional_shares fs ON us.fractional_share_id = fs.id
       JOIN vault_items vi ON fs.vault_item_id = vi.id
       WHERE us.user_id = $1 AND us.shares_owned > 0`,
      [req.user.id]
    );
    
    res.json(result.rows);
  } catch (error) {
    next(error);
  }
});

// GET /api/users/me/staking - Get user's staking positions
router.get('/me/staking', async (req, res, next) => {
  try {
    const result = await query(
      `SELECT sp.id, sp.amount_staked, sp.staked_at, sp.last_reward_at, 
              sp.total_rewards_earned, sp.is_active
       FROM staking_positions sp
       WHERE sp.user_id = $1 AND sp.is_active = true`,
      [req.user.id]
    );
    
    const positions = result.rows;
    
    // Get pending rewards
    const rewardsResult = await query(
      `SELECT SUM(amount) as pending_rewards
       FROM user_staking_rewards
       WHERE user_id = $1 AND claimed = false`,
      [req.user.id]
    );
    
    res.json({
      positions,
      pendingRewards: parseFloat(rewardsResult.rows[0]?.pending_rewards) || 0
    });
  } catch (error) {
    next(error);
  }
});

// Admin routes
// GET /api/users - List all users (admin only)
router.get('/', requireAdmin, async (req, res, next) => {
  try {
    const { page = 1, limit = 20, search, kycStatus } = req.query;
    const offset = (page - 1) * limit;
    
    let whereClause = '';
    const params = [];
    let paramCount = 1;
    
    if (search) {
      whereClause += `WHERE (email ILIKE $${paramCount} OR first_name ILIKE $${paramCount} OR last_name ILIKE $${paramCount})`;
      params.push(`%${search}%`);
      paramCount++;
    }
    
    if (kycStatus) {
      whereClause += whereClause ? ` AND kyc_status = $${paramCount}` : `WHERE kyc_status = $${paramCount}`;
      params.push(kycStatus);
      paramCount++;
    }
    
    params.push(parseInt(limit), parseInt(offset));
    
    const result = await query(
      `SELECT id, email, first_name, last_name, kyc_status, is_active, 
              wallet_address, created_at, last_login_at
       FROM users
       ${whereClause}
       ORDER BY created_at DESC
       LIMIT $${paramCount++} OFFSET $${paramCount++}`,
      params
    );
    
    // Get total count for pagination
    const countResult = await query(
      `SELECT COUNT(*) as total FROM users ${whereClause}`,
      params.slice(0, -2)
    );
    
    res.json({
      users: result.rows,
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

// GET /api/users/:id - Get specific user (admin only)
router.get('/:id', requireAdmin, [
  param('id').isUUID().withMessage('Valid user ID required')
], async (req, res, next) => {
  try {
    const result = await query(
      `SELECT u.*, ub.token_balance, ub.staked_balance, ub.fiat_balance_gbp, ub.fiat_balance_usd
       FROM users u
       LEFT JOIN user_balances ub ON u.id = ub.user_id
       WHERE u.id = $1`,
      [req.params.id]
    );
    
    if (result.rows.length === 0) {
      throw new NotFoundError('User not found');
    }
    
    const user = result.rows[0];
    delete user.password_hash; // Remove sensitive data
    
    res.json(user);
  } catch (error) {
    next(error);
  }
});

// PUT /api/users/:id/kyc - Update KYC status (admin only)
router.put('/:id/kyc', requireAdmin, [
  param('id').isUUID().withMessage('Valid user ID required'),
  body('status').isIn(['pending', 'verified', 'rejected', 'required']).withMessage('Invalid KYC status')
], async (req, res, next) => {
  try {
    const { status } = req.body;
    
    const result = await query(
      `UPDATE users 
       SET kyc_status = $1, kyc_verified_at = CASE WHEN $1 = 'verified' THEN CURRENT_TIMESTAMP ELSE kyc_verified_at END
       WHERE id = $2
       RETURNING id, email, kyc_status, kyc_verified_at`,
      [status, req.params.id]
    );
    
    if (result.rows.length === 0) {
      throw new NotFoundError('User not found');
    }
    
    res.json({
      message: 'KYC status updated successfully',
      user: result.rows[0]
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
