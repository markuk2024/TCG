const express = require('express');
const { body, validationResult } = require('express-validator');
const { query } = require('../config/database');
const { generateTokens, hashPassword, comparePassword } = require('../middleware/auth');
const { ValidationError } = require('../middleware/errorHandler');

const router = express.Router();

// Validation middleware helper
const validate = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    throw new ValidationError('Validation failed', errors.array());
  }
  next();
};

// POST /api/auth/register - User registration
router.post('/register', [
  body('email').isEmail().normalizeEmail().withMessage('Valid email required'),
  body('password').isLength({ min: 8 }).withMessage('Password must be at least 8 characters'),
  body('firstName').trim().isLength({ min: 1 }).withMessage('First name required'),
  body('lastName').trim().isLength({ min: 1 }).withMessage('Last name required'),
  validate
], async (req, res, next) => {
  try {
    const { email, password, firstName, lastName, phone } = req.body;
    
    // Check if user already exists
    const existingUser = await query('SELECT id FROM users WHERE email = $1', [email]);
    if (existingUser.rows.length > 0) {
      return res.status(409).json({ error: 'Email already registered' });
    }
    
    // Hash password
    const passwordHash = await hashPassword(password);
    
    // Create user
    const userResult = await query(
      `INSERT INTO users (email, password_hash, first_name, last_name, phone)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, email, first_name, last_name, created_at`,
      [email, passwordHash, firstName, lastName, phone || null]
    );
    
    const user = userResult.rows[0];
    
    // Create user balance record
    await query(
      'INSERT INTO user_balances (user_id) VALUES ($1)',
      [user.id]
    );
    
    // Generate tokens
    const tokens = generateTokens(user.id);
    
    res.status(201).json({
      message: 'User registered successfully',
      user: {
        id: user.id,
        email: user.email,
        firstName: user.first_name,
        lastName: user.last_name
      },
      ...tokens
    });
  } catch (error) {
    next(error);
  }
});

// POST /api/auth/login - User login
router.post('/login', [
  body('email').isEmail().normalizeEmail().withMessage('Valid email required'),
  body('password').notEmpty().withMessage('Password required'),
  validate
], async (req, res, next) => {
  try {
    const { email, password } = req.body;
    
    // Find user
    const userResult = await query(
      'SELECT id, email, password_hash, first_name, last_name, is_admin, is_active, kyc_status, wallet_address, last_login_at FROM users WHERE email = $1',
      [email]
    );
    
    if (userResult.rows.length === 0) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    
    const user = userResult.rows[0];
    
    // Check if account is active
    if (!user.is_active) {
      return res.status(401).json({ error: 'Account is deactivated' });
    }
    
    // Verify password
    const isValidPassword = await comparePassword(password, user.password_hash);
    if (!isValidPassword) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    
    // Update last login
    await query('UPDATE users SET last_login_at = CURRENT_TIMESTAMP WHERE id = $1', [user.id]);
    
    // Generate tokens
    const tokens = generateTokens(user.id);
    
    res.json({
      user: {
        id: user.id,
        email: user.email,
        firstName: user.first_name,
        lastName: user.last_name,
        isAdmin: user.is_admin,
        kycStatus: user.kyc_status,
        walletAddress: user.wallet_address,
        lastLoginAt: user.last_login_at
      },
      ...tokens
    });
  } catch (error) {
    next(error);
  }
});

// POST /api/auth/refresh - Refresh access token
router.post('/refresh', async (req, res, next) => {
  try {
    const { refreshToken } = req.body;
    
    if (!refreshToken) {
      return res.status(401).json({ error: 'Refresh token required' });
    }
    
    // Verify refresh token
    const jwt = require('jsonwebtoken');
    const decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET);
    
    if (decoded.type !== 'refresh') {
      return res.status(401).json({ error: 'Invalid token type' });
    }
    
    // Generate new tokens
    const tokens = generateTokens(decoded.userId);
    
    res.json(tokens);
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Refresh token expired' });
    }
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({ error: 'Invalid refresh token' });
    }
    next(error);
  }
});

// POST /api/auth/logout - Logout (client-side token removal)
router.post('/logout', (req, res) => {
  // In a stateless JWT system, logout is handled client-side
  // by removing the token. Optionally, you could maintain
  // a token blacklist in Redis for enhanced security.
  res.json({ message: 'Logged out successfully' });
});

// POST /api/auth/change-password - Change password
router.post('/change-password', [
  body('currentPassword').notEmpty().withMessage('Current password required'),
  body('newPassword').isLength({ min: 8 }).withMessage('New password must be at least 8 characters'),
  validate
], async (req, res, next) => {
  try {
    // This would need authentication middleware in production
    const { currentPassword, newPassword, userId } = req.body;
    
    // Get user
    const userResult = await query('SELECT password_hash FROM users WHERE id = $1', [userId]);
    if (userResult.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    // Verify current password
    const isValid = await comparePassword(currentPassword, userResult.rows[0].password_hash);
    if (!isValid) {
      return res.status(401).json({ error: 'Current password is incorrect' });
    }
    
    // Hash new password
    const newHash = await hashPassword(newPassword);
    
    // Update password
    await query('UPDATE users SET password_hash = $1 WHERE id = $2', [newHash, userId]);
    
    res.json({ message: 'Password changed successfully' });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
