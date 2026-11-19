const mongoose = require('mongoose');

const certificateSchema = new mongoose.Schema({
  donorId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  donationId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Request',
    required: true
  },
  certificateNumber: {
    type: String,
    required: true,
    unique: true
  },
  certificateTitle: {
    type: String,
    default: 'Certificate of Appreciation'
  },
  donorName: {
    type: String,
    required: true
  },
  bloodGroup: {
    type: String,
    required: true
  },
  donationDate: {
    type: Date,
    required: true
  },
  donationLocation: {
    type: String,
    required: true
  },
  hospitalName: {
    type: String,
    required: true
  },
  livesSaved: {
    type: Number,
    default: 3
  },
  unitsDonated: {
    type: Number,
    default: 1
  },
  certificateType: {
    type: String,
    enum: ['first-time', 'regular', 'milestone', 'emergency'],
    default: 'regular'
  },
  milestoneBadge: {
    type: String,
    default: null
  },
  totalDonations: {
    type: Number,
    required: true
  },
  impactMessage: {
    type: String,
    default: "Thank you for your life-saving donation!"
  },
  qrCode: {
    type: String,
    default: null
  },
  certificateUrl: {
    type: String,
    default: null
  },
  isPublic: {
    type: Boolean,
    default: false
  },
  sharedOn: {
    type: Date,
    default: null
  },
  downloadCount: {
    type: Number,
    default: 0
  },
  viewCount: {
    type: Number,
    default: 0
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Generate unique certificate number
certificateSchema.pre('save', async function() {
  if (!this.certificateNumber) {
    const year = new Date().getFullYear();
    const random = Math.floor(100000 + Math.random() * 900000);
    this.certificateNumber = `BLOOD-${year}-${random}`;
  }
  if (!this.certificateTitle) {
    switch(this.certificateType) {
      case 'first-time':
        this.certificateTitle = 'First Blood Donation Certificate';
        break;
      case 'milestone':
        this.certificateTitle = `${this.totalDonations}th Donation Milestone Certificate`;
        break;
      case 'emergency':
        this.certificateTitle = 'Emergency Life Saver Certificate';
        break;
      default:
        this.certificateTitle = 'Certificate of Appreciation';
    }
  }
});

// Virtual for formatted donation date
certificateSchema.virtual('formattedDonationDate').get(function() {
  return this.donationDate ? new Date(this.donationDate).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  }) : '';
});

// Virtual for issuedDate
certificateSchema.virtual('issuedDate').get(function() {
  return this.donationDate || this.createdAt || new Date();
});

module.exports = mongoose.model('Certificate', certificateSchema);
