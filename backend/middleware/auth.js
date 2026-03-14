const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { query } = require('../config/database');
const { UnauthorizedError, ForbiddenError } = require('./errorHandler');

// JWT Authentication middleware
const authenticate = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new UnauthorizedError('Access token required');
    }
    
    const token = authHeader.substring(7);
    
    // Verify token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    // Check if user exists and is active
    const userResult = await query(
      'SELECT id, email, is_admin, is_active, kyc_status, wallet_address FROM users WHERE id = $1',
      [decoded.userId]
    );
    
    if (userResult.rows.length === 0) {
      throw new UnauthorizedError('User not found');
    }
    
    const user = userResult.rows[0];
    
    if (!user.is_active) {
      throw new UnauthorizedError('Account is deactivated');
    }
    
    // Attach user to request
    req.user = {
      id: user.id,
      email: user.email,
      isAdmin: user.is_admin,
      kycStatus: user.kyc_status,
      walletAddress: user.wallet_address
    };
    
    next();
  } catch (error) {
    if (error.name === 'JsonWebTokenError') {
      return next(new UnauthorizedError('Invalid token'));
    }
    if (error.name === 'TokenExpiredError') {
      return next(new UnauthorizedError('Token expired'));
    }
    next(error);
  }
};

// Admin-only middleware
const requireAdmin = (req, res, next) => {
  if (!req.user || !req.user.isAdmin) {
    return next(new ForbiddenError('Admin access required'));
  }
  next();
};

// KYC verification middleware
const requireKYC = (req, res, next) => {
  if (!req.user || req.user.kycStatus !== 'verified') {
    return next(new ForbiddenError('KYC verification required'));
  }
  next();
};

// Generate JWT tokens
const generateTokens = (userId) => {
  const accessToken = jwt.sign(
    { userId },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
  );
  
  const refreshToken = jwt.sign(
    { userId, type: 'refresh' },
    process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET,
    { expiresIn: '30d' }
  );
  
  return { accessToken, refreshToken };
};

// Hash password
const hashPassword = async (password) => {
  const rounds = parseInt(process.env.BCRYPT_ROUNDS) || 12;
  return bcrypt.hash(password, rounds);
};

// Compare password
const comparePassword = async (password, hash) => {
  return bcrypt.compare(password, hash);
};

module.exports = {
  authenticate,
  requireAdmin,
  requireKYC,
  generateTokens,
  hashPassword,
  comparePassword
};
