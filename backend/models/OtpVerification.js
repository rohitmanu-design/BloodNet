const mongoose = require('mongoose');

const otpVerificationSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  contactType: {
    type: String,
    enum: ['email', 'phone'],
    required: true,
    index: true
  },
  destination: {
    type: String,
    required: true,
    trim: true,
    lowercase: true
  },
  otpHash: {
    type: String,
    required: true
  },
  salt: {
    type: String,
    required: true
  },
  attempts: {
    type: Number,
    default: 0
  },
  maxAttempts: {
    type: Number,
    default: 5
  },
  isUsed: {
    type: Boolean,
    default: false,
    index: true
  },
  expiresAt: {
    type: Date,
    required: true,
    index: { expires: 0 } // TTL index automatically cleans up expired records from MongoDB
  },
  lastSentAt: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

otpVerificationSchema.index({ userId: 1, contactType: 1, isUsed: 1 });

module.exports = mongoose.model('OtpVerification', otpVerificationSchema);
