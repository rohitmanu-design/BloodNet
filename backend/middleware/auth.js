const jwt = require('jsonwebtoken');
const User = require('../models/User');

const getJwtSecret = () => {
  return process.env.JWT_SECRET || 'bloodnet_production_jwt_fallback_key_2026_secured_rohit_admin';
};

const auth = async (req, res, next) => {
  try {
    const token = req.header('Authorization')?.replace('Bearer ', '');
    
    if (!token) {
      return res.status(401).json({ message: 'Access denied. No token provided.' });
    }

    const decoded = jwt.verify(token, getJwtSecret());
    const user = await User.findById(decoded.id).select('-password');
    
    if (!user) {
      return res.status(401).json({ message: 'Invalid token. User not found.' });
    }

    req.user = user;
    next();
  } catch (error) {
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({ message: 'Invalid token.' });
    } else if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ message: 'Token expired.' });
    }
    res.status(500).json({ message: 'Server error in authentication.' });
  }
};

const authorize = (...roles) => {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ 
        message: 'Access denied. Insufficient permissions.' 
      });
    }
    next();
  };
};

/**
 * Ensures email address has been verified before accessing protected features.
 * Preserves access for administrator accounts and existing legacy accounts.
 */
const requireVerifiedContact = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ message: 'Authentication required.' });
  }

  // Admin accounts always have full access
  if (req.user.role === 'admin') {
    return next();
  }

  // Preserve compatibility for legacy existing accounts
  const isLegacyAccount = req.user.verified === true && req.user.emailVerified === undefined;
  if (isLegacyAccount) {
    return next();
  }

  const isEmailVerified = Boolean(req.user.emailVerified);

  if (!isEmailVerified) {
    return res.status(403).json({
      code: 'EMAIL_VERIFICATION_REQUIRED',
      message: 'Email address verification is required before you can perform this action.',
      verificationStatus: {
        emailVerified: false,
        isFullyVerified: false,
        email: req.user.email
      }
    });
  }

  next();
};

auth.auth = auth;
auth.authorize = authorize;
auth.requireVerifiedContact = requireVerifiedContact;
module.exports = auth;
