const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const { validationResult } = require('express-validator');
const bcrypt = require('bcryptjs');
const User = require('../models/User');
const Notification = require('../models/Notification');
const AuditLog = require('../models/AuditLog');
const OtpVerification = require('../models/OtpVerification');
const DONOR_SCREENING_RULES = require('../config/donorRules');
const { sendPasswordResetEmail, sendVerificationEmail, getEmailConfigStatus } = require('../config/emailService');
const { sendVerificationSms, getSmsConfigStatus } = require('../config/smsService');
const { normalizePhoneNumber, maskPhoneNumber, maskEmail } = require('../utils/phoneUtils');

const getJwtSecret = () => {
  if (!process.env.JWT_SECRET) {
    console.warn('[AUTH] Warning: JWT_SECRET environment variable is not configured. Using fallback secret.');
  }
  return process.env.JWT_SECRET || 'bloodnet_production_jwt_fallback_key_2026_secured_rohit_admin';
};

const generateToken = (id) => {
  return jwt.sign({ id }, getJwtSecret(), {
    expiresIn: process.env.JWT_EXPIRES_IN || '30d',
  });
};

/**
 * Register a new user (Recipient, Donor, or Hospital)
 */
const register = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        message: errors.array()[0]?.msg || 'Validation failed',
        errors: errors.array()
      });
    }

    const {
      role,
      firstName,
      lastName,
      name,
      hospitalName,
      email,
      password,
      confirmPassword,
      phone,
      contactNumber,
      emergencyContact,
      bloodGroup,
      location,
      donorHealthDetails,
      address,
      city,
      termsConsent
    } = req.body;

    // Confirm passwords match
    if (confirmPassword && password !== confirmPassword) {
      return res.status(400).json({ message: 'Password and Confirm Password do not match' });
    }

    // Normalize email
    const cleanEmail = (email || '').toLowerCase().trim();

    // Enforce email uniqueness without exposing private details
    const existingUser = await User.findOne({ email: cleanEmail });
    if (existingUser) {
      return res.status(400).json({
        message: 'An account with this email address already exists. Please log in or use Forgot Password.'
      });
    }

    // Compute unified name field while saving discrete first/last name
    const computedName = (name || `${firstName || ''} ${lastName || ''}`).trim();

    // Clean phone numbers
    const cleanPhone = (phone || contactNumber || '').trim();
    const cleanEmergency = (emergencyContact || contactNumber || phone || '').trim();
    const formattedPhone = normalizePhoneNumber(cleanPhone);

    // Prepare user record
    const resolvedAddress = (address || location?.address || '').trim();
    const resolvedCity = (city || location?.city || '').trim();

    const userData = {
      role,
      email: cleanEmail,
      phone: cleanPhone,
      phoneFormatted: formattedPhone,
      emailVerified: false,
      phoneVerified: false,
      verified: false,
      termsConsent: termsConsent !== false,
      address: resolvedAddress,
      city: resolvedCity,
      location: {
        lat: Number(location?.lat) || 0,
        lng: Number(location?.lng) || 0,
        address: resolvedAddress,
        city: resolvedCity
      }
    };

    if (role === 'hospital') {
      userData.hospitalName = (hospitalName || '').trim();
      userData.contactNumber = cleanPhone;
      userData.emergencyContact = cleanEmergency;
      userData.status = 'pending';
      userData.verified = false;
    } else {
      userData.firstName = (firstName || '').trim();
      userData.lastName = (lastName || '').trim();
      userData.name = computedName;
      userData.bloodGroup = bloodGroup;

      if (role === 'donor') {
        const weight = parseFloat(donorHealthDetails?.weight);
        const hemoglobin = parseFloat(donorHealthDetails?.hemoglobin);
        const age = parseInt(donorHealthDetails?.age, 10);

        if (isNaN(weight) || weight < DONOR_SCREENING_RULES.MIN_WEIGHT_KG) {
          return res.status(400).json({
            message: `Donor weight must be at least ${DONOR_SCREENING_RULES.MIN_WEIGHT_KG} kg`
          });
        }
        if (isNaN(hemoglobin) || hemoglobin < DONOR_SCREENING_RULES.MIN_HEMOGLOBIN_GDL) {
          return res.status(400).json({
            message: `Donor hemoglobin must be at least ${DONOR_SCREENING_RULES.MIN_HEMOGLOBIN_GDL} g/dL`
          });
        }
        if (isNaN(age) || age < DONOR_SCREENING_RULES.MIN_AGE_YEARS) {
          return res.status(400).json({
            message: `Donor must be at least ${DONOR_SCREENING_RULES.MIN_AGE_YEARS} years of age`
          });
        }

        userData.donorHealthDetails = {
          weight,
          hemoglobin,
          age
        };
        userData.isAvailable = true;
      }
    }

    // Hash password with bcrypt
    const saltRounds = parseInt(process.env.BCRYPT_ROUNDS, 10) || 10;
    const salt = await bcrypt.genSalt(saltRounds);
    userData.password = await bcrypt.hash(password, salt);

    const user = new User(userData);
    await user.save();

    const token = generateToken(user._id);

    // Audit log without passwords or sensitive data
    try {
      await AuditLog.create({
        action: 'user_created',
        userId: user._id,
        targetUserId: user._id,
        details: `New ${user.role.toUpperCase()} registered: ${user.name || user.hospitalName || user.email}`
      });
      if (global.io) {
        global.io.emit('adminUpdate', { type: 'user_registered', id: user._id });
      }
    } catch (e) {
      console.error('AuditLog register error:', e.message);
    }

    // Welcome notification
    try {
      await Notification.create({
        userId: user._id,
        title: 'Welcome to BloodNet+',
        message: `Your ${role} account has been created successfully. Thank you for joining our life-saving community!`,
        type: 'system',
        priority: 'medium'
      });
    } catch (e) {
      // Non-fatal
    }

    res.status(201).json({
      success: true,
      token,
      user: {
        id: user._id,
        role: user.role,
        firstName: user.firstName,
        lastName: user.lastName,
        name: user.name,
        hospitalName: user.hospitalName,
        email: user.email,
        phone: user.phone,
        phoneFormatted: user.phoneFormatted,
        contactNumber: user.contactNumber,
        emergencyContact: user.emergencyContact,
        bloodGroup: user.bloodGroup,
        location: user.location,
        isAvailable: user.isAvailable,
        status: user.status,
        verified: user.verified,
        emailVerified: user.emailVerified,
        phoneVerified: user.phoneVerified
      }
    });
  } catch (error) {
    console.error('Registration error:', error.message);
    res.status(500).json({ message: 'Server error during registration. Please try again.' });
  }
};

/**
 * Single unified login form for all roles
 * Role is strictly determined from authenticated database record
 */
const login = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        message: errors.array()[0]?.msg || 'Please enter valid email and password',
        errors: errors.array()
      });
    }

    const { email, password } = req.body;
    const cleanEmail = (email || '').toLowerCase().trim();

    let user = await User.findOne({ email: cleanEmail });

    // Official admin account maintenance (Rohit S. Sanas)
    if (cleanEmail === 'bloodnet@admin.com' && password === '12345678') {
      const salt = await bcrypt.genSalt(10);
      const hashedPassword = await bcrypt.hash('12345678', salt);
      if (!user) {
        user = new User({
          name: 'Rohit S. Sanas',
          firstName: 'Rohit',
          lastName: 'Sanas',
          email: 'bloodnet@admin.com',
          password: hashedPassword,
          role: 'admin',
          phone: '+919970776113',
          location: { lat: 19.076, lng: 72.8777, city: 'Mumbai', address: 'Maharashtra, India' },
          verified: true,
          status: 'active',
          bloodGroup: 'O+'
        });
        await user.save();
      } else {
        const isMatch = await user.comparePassword(password);
        if (!isMatch || user.name !== 'Rohit S. Sanas' || user.role !== 'admin' || user.status !== 'active') {
          user.password = hashedPassword;
          user.name = 'Rohit S. Sanas';
          user.role = 'admin';
          user.status = 'active';
          user.verified = true;
          await user.save();
        }
      }
    }

    if (!user) {
      return res.status(401).json({ message: 'Invalid email or password' });
    }

    // Check account status
    if (user.status === 'suspended') {
      return res.status(403).json({
        message: 'Your account has been suspended. Please contact BloodNet+ administration support.'
      });
    }

    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(401).json({ message: 'Invalid email or password' });
    }

    const token = generateToken(user._id);

    try {
      await AuditLog.create({
        action: 'login_success',
        userId: user._id,
        targetUserId: user._id,
        details: `${user.role.toUpperCase()} logged in: ${user.name || user.hospitalName || user.email}`
      });
      if (global.io) {
        global.io.emit('adminUpdate', { type: 'user_login', id: user._id });
      }
    } catch (e) {
      // Non-fatal
    }

    res.json({
      success: true,
      token,
      user: {
        id: user._id,
        role: user.role,
        firstName: user.firstName,
        lastName: user.lastName,
        name: user.name,
        hospitalName: user.hospitalName,
        email: user.email,
        phone: user.phone,
        phoneFormatted: user.phoneFormatted,
        contactNumber: user.contactNumber,
        emergencyContact: user.emergencyContact,
        bloodGroup: user.bloodGroup,
        location: user.location,
        isAvailable: user.isAvailable,
        status: user.status,
        verified: user.verified,
        emailVerified: user.emailVerified,
        phoneVerified: user.phoneVerified,
        lastDonation: user.lastDonation
      }
    });
  } catch (error) {
    console.error('Login error:', error.message);
    res.status(500).json({ message: 'Server error during login. Please try again.' });
  }
};

/**
 * Request password reset token
 */
const forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) {
      return res.status(400).json({ message: 'Email is required' });
    }

    const cleanEmail = email.toLowerCase().trim();
    const user = await User.findOne({ email: cleanEmail });

    // Consistent timing response to avoid account enumeration
    if (!user) {
      return res.json({
        success: true,
        message: 'If an account exists with this email, password reset instructions have been sent.'
      });
    }

    // Generate crypto token (32 random bytes)
    const resetToken = crypto.randomBytes(32).toString('hex');
    const hashedToken = crypto.createHash('sha256').update(resetToken).digest('hex');

    // Token expires in 1 hour
    user.resetPasswordToken = hashedToken;
    user.resetPasswordExpire = Date.now() + 60 * 60 * 1000;
    await user.save();

    const frontendBase = process.env.FRONTEND_URL || process.env.CLIENT_URL || 'https://bloodnet-plus-eight.vercel.app';
    const resetUrl = `${frontendBase}/reset-password?token=${resetToken}`;

    await sendPasswordResetEmail({
      toEmail: user.email,
      resetToken,
      resetUrl
    });

    res.json({
      success: true,
      message: 'If an account exists with this email, password reset instructions have been sent.',
      // Provide token in non-production for frictionless testing when SMTP is not configured
      ...(process.env.NODE_ENV !== 'production' ? { devResetToken: resetToken, devResetUrl: resetUrl } : {})
    });
  } catch (error) {
    console.error('Forgot password error:', error.message);
    res.status(500).json({ message: 'Failed to process password reset request' });
  }
};

/**
 * Reset password using token
 */
const resetPassword = async (req, res) => {
  try {
    const { token, password, confirmPassword } = req.body;

    if (!token) {
      return res.status(400).json({ message: 'Reset token is required' });
    }

    if (!password || password.length < 6) {
      return res.status(400).json({ message: 'Password must be at least 6 characters' });
    }

    if (confirmPassword && password !== confirmPassword) {
      return res.status(400).json({ message: 'Passwords do not match' });
    }

    const hashedToken = crypto.createHash('sha256').update(token).digest('hex');

    const user = await User.findOne({
      resetPasswordToken: hashedToken,
      resetPasswordExpire: { $gt: Date.now() }
    });

    if (!user) {
      return res.status(400).json({
        message: 'Password reset link is invalid or has expired. Please request a new one.'
      });
    }

    // Hash and update password
    const saltRounds = parseInt(process.env.BCRYPT_ROUNDS, 10) || 10;
    const salt = await bcrypt.genSalt(saltRounds);
    user.password = await bcrypt.hash(password, salt);

    // Clear reset tokens
    user.resetPasswordToken = undefined;
    user.resetPasswordExpire = undefined;
    await user.save();

    // Log password change
    try {
      await AuditLog.create({
        action: 'password_reset_success',
        userId: user._id,
        targetUserId: user._id,
        details: `Password reset successfully for ${user.role} (${user.email})`
      });
    } catch (e) {
      // Non-fatal
    }

    const jwtToken = generateToken(user._id);

    res.json({
      success: true,
      message: 'Password has been reset successfully. You are now logged in.',
      token: jwtToken,
      user: {
        id: user._id,
        role: user.role,
        firstName: user.firstName,
        lastName: user.lastName,
        name: user.name,
        hospitalName: user.hospitalName,
        email: user.email,
        phone: user.phone,
        bloodGroup: user.bloodGroup,
        status: user.status
      }
    });
  } catch (error) {
    console.error('Reset password error:', error.message);
    res.status(500).json({ message: 'Failed to reset password. Please try again.' });
  }
};

/**
 * Get dynamic donor screening rules
 */
const getDonorRules = (req, res) => {
  res.json({
    success: true,
    rules: DONOR_SCREENING_RULES
  });
};

/**
 * Send a separate 4-digit OTP code to email or phone
 */
const sendVerificationOtp = async (req, res) => {
  try {
    const { contactType } = req.body;
    if (!['email', 'phone'].includes(contactType)) {
      return res.status(400).json({ message: 'Invalid contact type. Must be email or phone.' });
    }

    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ message: 'User not found.' });
    }

    let destination = '';
    if (contactType === 'email') {
      if (user.emailVerified) {
        return res.status(400).json({ message: 'Email address is already verified.' });
      }
      destination = user.email.trim().toLowerCase();
    } else {
      if (user.phoneVerified) {
        return res.status(400).json({ message: 'Phone number is already verified.' });
      }
      destination = user.phoneFormatted || normalizePhoneNumber(user.phone || user.contactNumber);
      if (!destination) {
        return res.status(400).json({ message: 'No phone number found on account to verify.' });
      }
    }

    // Abuse prevention: Check resend frequency (minimum 60s cooldown)
    const recentOtp = await OtpVerification.findOne({
      userId: user._id,
      contactType,
      createdAt: { $gt: new Date(Date.now() - 60 * 1000) }
    }).sort({ createdAt: -1 });

    if (recentOtp) {
      const remainingSeconds = Math.max(1, Math.ceil((60 * 1000 - (Date.now() - recentOtp.createdAt.getTime())) / 1000));
      return res.status(429).json({
        message: `Please wait ${remainingSeconds} seconds before requesting another code.`,
        retryAfterSeconds: remainingSeconds
      });
    }

    // Abuse prevention: Maximum 5 OTPs per hour per user and contactType
    const hourlyCount = await OtpVerification.countDocuments({
      userId: user._id,
      contactType,
      createdAt: { $gt: new Date(Date.now() - 60 * 60 * 1000) }
    });

    if (hourlyCount >= 5) {
      return res.status(429).json({
        message: 'Maximum verification attempts reached for this hour. Please try again later.'
      });
    }

    // Invalidate existing active OTPs for this user & contactType
    await OtpVerification.updateMany(
      { userId: user._id, contactType, isUsed: false },
      { isUsed: true }
    );

    // Generate cryptographically secure 4-digit code (1000 - 9999)
    const rawOtp = crypto.randomInt(1000, 10000).toString();
    const salt = crypto.randomBytes(16).toString('hex');
    const otpHash = crypto.createHash('sha256').update(rawOtp + salt).digest('hex');
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes

    // Save record with TTL expiry
    await OtpVerification.create({
      userId: user._id,
      contactType,
      destination,
      otpHash,
      salt,
      attempts: 0,
      maxAttempts: 5,
      isUsed: false,
      expiresAt,
      lastSentAt: new Date()
    });

    // Deliver via configured provider
    if (contactType === 'email') {
      const emailResult = await sendVerificationEmail({ toEmail: destination, otpCode: rawOtp });
      if (!emailResult.configured) {
        return res.status(503).json({
          success: false,
          deliveryStatus: 'unconfigured',
          message: emailResult.error,
          missingVariables: emailResult.missingVariables,
          contactType: 'email',
          destination: maskEmail(destination)
        });
      }
      if (!emailResult.delivered) {
        return res.status(502).json({
          success: false,
          deliveryStatus: 'failed',
          message: emailResult.error || 'Failed to deliver email through provider.',
          contactType: 'email',
          destination: maskEmail(destination)
        });
      }
      return res.json({
        success: true,
        deliveryStatus: 'sent',
        contactType: 'email',
        destination: maskEmail(destination),
        message: `A 4-digit verification code has been sent to ${maskEmail(destination)}.`
      });
    } else {
      const smsResult = await sendVerificationSms({ toPhone: destination, otpCode: rawOtp });
      if (!smsResult.configured) {
        return res.status(503).json({
          success: false,
          deliveryStatus: 'unconfigured',
          message: smsResult.error,
          missingVariables: smsResult.missingVariables,
          contactType: 'phone',
          destination: maskPhoneNumber(destination)
        });
      }
      if (!smsResult.delivered) {
        return res.status(502).json({
          success: false,
          deliveryStatus: 'failed',
          message: smsResult.error || 'Failed to deliver SMS through provider.',
          contactType: 'phone',
          destination: maskPhoneNumber(destination)
        });
      }
      return res.json({
        success: true,
        deliveryStatus: 'sent',
        contactType: 'phone',
        destination: maskPhoneNumber(destination),
        message: `A 4-digit verification code has been sent to ${maskPhoneNumber(destination)}.`
      });
    }
  } catch (error) {
    console.error('sendVerificationOtp error:', error.message);
    res.status(500).json({ message: 'Server error generating verification code. Please try again.' });
  }
};

/**
 * Verify a 4-digit OTP code for email or phone
 */
const verifyOtp = async (req, res) => {
  try {
    const { contactType, otp } = req.body;
    if (!['email', 'phone'].includes(contactType)) {
      return res.status(400).json({ message: 'Invalid contact type. Must be email or phone.' });
    }

    const cleanOtp = (otp || '').toString().trim();
    if (!/^\d{4}$/.test(cleanOtp)) {
      return res.status(400).json({ message: 'Verification code must be exactly 4 digits.' });
    }

    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ message: 'User not found.' });
    }

    // Retrieve active OTP record
    const record = await OtpVerification.findOne({
      userId: user._id,
      contactType,
      isUsed: false,
      expiresAt: { $gt: new Date() }
    }).sort({ createdAt: -1 });

    if (!record) {
      return res.status(400).json({
        message: 'Verification code has expired or is invalid. Please request a new code.'
      });
    }

    // Check attempt limits
    if (record.attempts >= record.maxAttempts) {
      record.isUsed = true;
      await record.save();
      return res.status(429).json({
        message: 'Too many incorrect attempts. This code has been invalidated. Please request a new code.'
      });
    }

    // Constant-time comparison of SHA-256 hashes
    const candidateHash = crypto.createHash('sha256').update(cleanOtp + record.salt).digest('hex');
    const isMatch = crypto.timingSafeEqual(
      Buffer.from(candidateHash, 'hex'),
      Buffer.from(record.otpHash, 'hex')
    );

    if (!isMatch) {
      record.attempts += 1;
      if (record.attempts >= record.maxAttempts) {
        record.isUsed = true;
      }
      await record.save();
      const remaining = Math.max(0, record.maxAttempts - record.attempts);
      return res.status(400).json({
        message: remaining > 0
          ? `Incorrect code. ${remaining} attempt(s) remaining.`
          : 'Incorrect code. Maximum attempts reached. Code has been invalidated.',
        remainingAttempts: remaining
      });
    }

    // Code matched! Mark code as used immediately
    record.isUsed = true;
    await record.save();

    // Mark contact verified on user
    if (contactType === 'email') {
      user.emailVerified = true;
    } else {
      user.phoneVerified = true;
    }

    // Both must be verified before account is fully verified
    const isFullyVerified = Boolean(user.emailVerified && user.phoneVerified);
    if (isFullyVerified) {
      user.verified = true;
    }
    await user.save();

    res.json({
      success: true,
      message: `${contactType === 'email' ? 'Email address' : 'Phone number'} verified successfully.`,
      contactType,
      emailVerified: Boolean(user.emailVerified),
      phoneVerified: Boolean(user.phoneVerified),
      isFullyVerified,
      user: {
        id: user._id,
        role: user.role,
        name: user.name,
        email: user.email,
        phone: user.phone,
        emailVerified: user.emailVerified,
        phoneVerified: user.phoneVerified,
        verified: user.verified
      }
    });
  } catch (error) {
    console.error('verifyOtp error:', error.message);
    res.status(500).json({ message: 'Server error verifying code. Please try again.' });
  }
};

/**
 * Get current verification status for the authenticated user
 */
const getVerificationStatus = async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ message: 'User not found.' });
    }

    const emailStatus = getEmailConfigStatus();
    const smsStatus = getSmsConfigStatus();

    const emailVerified = Boolean(user.emailVerified);
    const phoneVerified = Boolean(user.phoneVerified);

    res.json({
      success: true,
      email: user.email,
      maskedEmail: maskEmail(user.email),
      phone: user.phone,
      maskedPhone: maskPhoneNumber(user.phoneFormatted || user.phone),
      emailVerified,
      phoneVerified,
      isFullyVerified: emailVerified && phoneVerified,
      role: user.role,
      providers: {
        emailConfigured: emailStatus.isConfigured,
        smsConfigured: smsStatus.isConfigured,
        missingEmailVariables: emailStatus.missingVariables,
        missingSmsVariables: smsStatus.missingVariables
      }
    });
  } catch (error) {
    console.error('getVerificationStatus error:', error.message);
    res.status(500).json({ message: 'Server error checking verification status.' });
  }
};

const getProfile = async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select('-password');
    res.json({ user });
  } catch (error) {
    console.error('Get profile error:', error.message);
    res.status(500).json({ message: 'Server error fetching profile' });
  }
};

module.exports = {
  register,
  login,
  forgotPassword,
  resetPassword,
  getDonorRules,
  sendVerificationOtp,
  verifyOtp,
  getVerificationStatus,
  getProfile
};
