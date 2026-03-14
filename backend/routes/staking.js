const express = require('express');
const { body, param } = require('express-validator');
const { query, transaction } = require('../config/database');
const { authenticate, requireAdmin } = require('../middleware/auth');
const { NotFoundError, ValidationError } = require('../middleware/errorHandler');

const router = express.Router();

// Public routes

// GET /api/staking/info - Get staking pool info
router.get('/info', async (req, res, next) => {
  try {
    // Get total staked amount
    const stakedResult = await query(
      `SELECT SUM(amount_staked) as total_staked, COUNT(DISTINCT user_id) as total_stakers
       FROM staking_positions
       WHERE is_active = true`
    );
    
    // Get reward pool info
    const rewardResult = await query(
      `SELECT * FROM staking_rewards
       ORDER BY distributed_at DESC
       LIMIT 1`
    );
    
    res.json({
      apy: parseFloat(process.env.STAKING_APY) || 24,
      totalStaked: parseFloat(stakedResult.rows[0].total_staked) || 0,
      totalStakers: parseInt(stakedResult.rows[0].total_stakers) || 0,
      lastDistribution: rewardResult.rows[0] || null,
      minimumStake: parseInt(process.env.MINIMUM_STAKE_AMOUNT) || 100
    });
  } catch (error) {
    next(error);
  }
});

// Protected routes
router.use(authenticate);

// GET /api/staking/my-positions - Get user's staking positions
router.get('/my-positions', async (req, res, next) => {
  try {
    const positionsResult = await query(
      `SELECT sp.*,
              (SELECT SUM(amount) FROM user_staking_rewards 
               WHERE staking_position_id = sp.id AND claimed = false) as pending_rewards
       FROM staking_positions sp
       WHERE sp.user_id = $1
       ORDER BY sp.staked_at DESC`,
      [req.user.id]
    );
    
    // Get user's balance
    const balanceResult = await query(
      'SELECT token_balance, staked_balance FROM user_balances WHERE user_id = $1',
      [req.user.id]
    );
    
    res.json({
      positions: positionsResult.rows,
      availableBalance: parseFloat(balanceResult.rows[0]?.token_balance) || 0,
      totalStaked: parseFloat(balanceResult.rows[0]?.staked_balance) || 0
    });
  } catch (error) {
    next(error);
  }
});

// POST /api/staking/stake - Stake tokens
router.post('/stake', [
  body('amount').isDecimal({ min: 0.01 }).withMessage('Valid amount required')
], async (req, res, next) => {
  try {
    const { amount } = req.body;
    const minStake = parseInt(process.env.MINIMUM_STAKE_AMOUNT) || 100;
    
    if (parseFloat(amount) < minStake) {
      throw new ValidationError(`Minimum stake amount is ${minStake} tokens`);
    }
    
    // Check user balance
    const balanceResult = await query(
      'SELECT token_balance FROM user_balances WHERE user_id = $1',
      [req.user.id]
    );
    
    if (balanceResult.rows.length === 0 || 
        parseFloat(balanceResult.rows[0].token_balance) < parseFloat(amount)) {
      throw new ValidationError('Insufficient token balance');
    }
    
    await transaction(async (client) => {
      // Create staking position
      const positionResult = await client.query(
        `INSERT INTO staking_positions (user_id, amount_staked, is_active)
         VALUES ($1, $2, $3)
         RETURNING *`,
        [req.user.id, amount, true]
      );
      
      // Deduct from available balance, add to staked balance
      await client.query(
        `UPDATE user_balances 
         SET token_balance = token_balance - $1, staked_balance = staked_balance + $1
         WHERE user_id = $2`,
        [amount, req.user.id]
      );
      
      // Log activity
      await client.query(
        `INSERT INTO activity_logs (user_id, action, entity_type, entity_id, metadata)
         VALUES ($1, $2, $3, $4, $5)`,
        [req.user.id, 'STAKE_TOKENS', 'staking_position', positionResult.rows[0].id, 
         JSON.stringify({ amount })]
      );
      
      res.status(201).json({
        message: 'Tokens staked successfully',
        position: positionResult.rows[0]
      });
    });
  } catch (error) {
    next(error);
  }
});

// POST /api/staking/unstake/:id - Unstake tokens
router.post('/unstake/:id', [
  param('id').isUUID().withMessage('Valid staking position ID required')
], async (req, res, next) => {
  try {
    const { id } = req.params;
    
    // Get staking position
    const positionResult = await query(
      `SELECT * FROM staking_positions WHERE id = $1 AND user_id = $2 AND is_active = true`,
      [id, req.user.id]
    );
    
    if (positionResult.rows.length === 0) {
      throw new NotFoundError('Staking position not found');
    }
    
    const position = positionResult.rows[0];
    
    await transaction(async (client) => {
      // Update position to inactive
      await client.query(
        `UPDATE staking_positions 
         SET is_active = false, unstaked_at = CURRENT_TIMESTAMP
         WHERE id = $1`,
        [id]
      );
      
      // Return tokens to available balance, deduct from staked
      await client.query(
        `UPDATE user_balances 
         SET token_balance = token_balance + $1, staked_balance = staked_balance - $1
         WHERE user_id = $2`,
        [position.amount_staked, req.user.id]
      );
      
      // Claim any pending rewards for this position
      await client.query(
        `UPDATE user_staking_rewards 
         SET claimed = true, claimed_at = CURRENT_TIMESTAMP
         WHERE staking_position_id = $1 AND claimed = false`,
        [id]
      );
      
      // Log activity
      await client.query(
        `INSERT INTO activity_logs (user_id, action, entity_type, entity_id, metadata)
         VALUES ($1, $2, $3, $4, $5)`,
        [req.user.id, 'UNSTAKE_TOKENS', 'staking_position', id, 
         JSON.stringify({ amount: position.amount_staked })]
      );
      
      res.json({
        message: 'Tokens unstaked successfully',
        amountReturned: position.amount_staked
      });
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/staking/rewards - Get user's reward history
router.get('/rewards', async (req, res, next) => {
  try {
    const result = await query(
      `SELECT usr.*, sr.apy_rate, sr.distribution_period_start, sr.distribution_period_end
       FROM user_staking_rewards usr
       JOIN staking_rewards sr ON usr.staking_reward_id = sr.id
       WHERE usr.user_id = $1
       ORDER BY usr.created_at DESC`,
      [req.user.id]
    );
    
    // Get unclaimed rewards total
    const unclaimedResult = await query(
      `SELECT SUM(amount) as total_unclaimed
       FROM user_staking_rewards
       WHERE user_id = $1 AND claimed = false`,
      [req.user.id]
    );
    
    res.json({
      rewards: result.rows,
      totalUnclaimed: parseFloat(unclaimedResult.rows[0].total_unclaimed) || 0
    });
  } catch (error) {
    next(error);
  }
});

// POST /api/staking/claim-rewards - Claim pending rewards
router.post('/claim-rewards', async (req, res, next) => {
  try {
    await transaction(async (client) => {
      // Get unclaimed rewards
      const rewardsResult = await client.query(
        `SELECT SUM(amount) as total_amount
         FROM user_staking_rewards
         WHERE user_id = $1 AND claimed = false`,
        [req.user.id]
      );
      
      const totalAmount = parseFloat(rewardsResult.rows[0].total_amount) || 0;
      
      if (totalAmount <= 0) {
        throw new ValidationError('No rewards to claim');
      }
      
      // Mark rewards as claimed
      await client.query(
        `UPDATE user_staking_rewards
         SET claimed = true, claimed_at = CURRENT_TIMESTAMP
         WHERE user_id = $1 AND claimed = false`,
        [req.user.id]
      );
      
      // Add to user token balance
      await client.query(
        `UPDATE user_balances
         SET token_balance = token_balance + $1, pending_rewards = 0
         WHERE user_id = $2`,
        [totalAmount, req.user.id]
      );
      
      // Log activity
      await client.query(
        `INSERT INTO activity_logs (user_id, action, entity_type, metadata)
         VALUES ($1, $2, $3, $4)`,
        [req.user.id, 'CLAIM_REWARDS', 'staking_reward', 
         JSON.stringify({ amount: totalAmount })]
      );
      
      res.json({
        message: 'Rewards claimed successfully',
        amountClaimed: totalAmount
      });
    });
  } catch (error) {
    next(error);
  }
});

// Admin routes
router.use(requireAdmin);

// POST /api/staking/distribute - Distribute rewards to all stakers
router.post('/distribute', [
  body('totalRewardPool').isDecimal({ min: 0 }).withMessage('Valid reward pool amount required'),
  body('apyRate').optional().isDecimal()
], async (req, res, next) => {
  try {
    const { totalRewardPool, apyRate } = req.body;
    const apy = apyRate || parseFloat(process.env.STAKING_APY) || 24;
    
    await transaction(async (client) => {
      // Get total staked amount
      const totalStakedResult = await client.query(
        `SELECT SUM(amount_staked) as total FROM staking_positions WHERE is_active = true`
      );
      
      const totalStaked = parseFloat(totalStakedResult.rows[0].total) || 0;
      
      if (totalStaked === 0) {
        throw new ValidationError('No active staking positions');
      }
      
      // Create staking reward distribution record
      const periodStart = new Date();
      periodStart.setMonth(periodStart.getMonth() - 1);
      const periodEnd = new Date();
      
      const rewardRecord = await client.query(
        `INSERT INTO staking_rewards (distribution_period_start, distribution_period_end, 
                                      total_reward_pool, total_staked_amount, apy_rate)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING *`,
        [periodStart, periodEnd, totalRewardPool, totalStaked, apy]
      );
      
      const rewardId = rewardRecord.rows[0].id;
      
      // Get all active staking positions
      const positionsResult = await client.query(
        `SELECT id, user_id, amount_staked FROM staking_positions WHERE is_active = true`
      );
      
      // Calculate and distribute rewards proportionally
      const distributions = [];
      for (const position of positionsResult.rows) {
        const share = parseFloat(position.amount_staked) / totalStaked;
        const reward = share * parseFloat(totalRewardPool);
        
        if (reward > 0) {
          const userReward = await client.query(
            `INSERT INTO user_staking_rewards (user_id, staking_reward_id, staking_position_id, amount)
             VALUES ($1, $2, $3, $4)
             RETURNING *`,
            [position.user_id, rewardId, position.id, reward]
          );
          
          // Update pending rewards in user balance
          await client.query(
            `UPDATE user_balances 
             SET pending_rewards = pending_rewards + $1
             WHERE user_id = $2`,
            [reward, position.user_id]
          );
          
          distributions.push(userReward.rows[0]);
        }
      }
      
      res.json({
        message: 'Rewards distributed successfully',
        distribution: rewardRecord.rows[0],
        totalRecipients: distributions.length,
        totalDistributed: totalRewardPool
      });
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
