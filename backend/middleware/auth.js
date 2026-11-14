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
 * Ensures both email and phone number have been verified before accessing protected features.
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

  // Preserve compatibility for legacy existing accounts (created before phone verification was introduced)
  const isLegacyAccount = req.user.verified === true && req.user.phoneVerified === undefined;
  if (isLegacyAccount) {
    return next();
  }

  const isEmailVerified = Boolean(req.user.emailVerified);
  const isPhoneVerified = Boolean(req.user.phoneVerified);

  if (!isEmailVerified || !isPhoneVerified) {
    return res.status(403).json({
      code: 'CONTACT_VERIFICATION_REQUIRED',
      message: 'Both email address and phone number verification are required before you can perform this action.',
      verificationStatus: {
        emailVerified: isEmailVerified,
        phoneVerified: isPhoneVerified,
        isFullyVerified: false,
        email: req.user.email,
        phone: req.user.phone
      }
    });
  }

  next();
};

auth.auth = auth;
auth.authorize = authorize;
auth.requireVerifiedContact = requireVerifiedContact;
module.exports = auth;
