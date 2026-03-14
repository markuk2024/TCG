const { RateLimiterMemory } = require('rate-limiter-flexible');

// Rate limiter configuration
const rateLimiter = new RateLimiterMemory({
  keyPrefix: 'middleware',
  points: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 100,
  duration: parseInt(process.env.RATE_LIMIT_WINDOW_MS) / 1000 || 900, // 15 minutes
});

// Rate limiting middleware
const rateLimiterMiddleware = async (req, res, next) => {
  try {
    // Skip rate limiting for health checks
    if (req.path === '/api/health') {
      return next();
    }

    // Use IP address as key
    const key = req.ip || req.connection.remoteAddress || 'anonymous';
    
    await rateLimiter.consume(key);
    next();
  } catch (rejRes) {
    // Rate limit exceeded
    const retryAfter = Math.round(rejRes.msBeforeNext / 1000) || 1;
    
    res.set('Retry-After', String(retryAfter));
    res.status(429).json({
      error: 'Too many requests',
      message: 'Rate limit exceeded. Please try again later.',
      retryAfter
    });
  }
};

module.exports = {
  rateLimiter: rateLimiterMiddleware
};
