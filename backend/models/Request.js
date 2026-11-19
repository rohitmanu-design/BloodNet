const mongoose = require('mongoose');

const requestSchema = new mongoose.Schema({
  requesterId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  donorId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },
  hospitalId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },
  bloodGroup: {
    type: String,
    enum: ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'],
    required: true
  },
  status: {
    type: String,
    enum: ['pending', 'accepted', 'active', 'fulfilled', 'completed', 'cancelled', 'rejected'],
    default: 'pending'
  },
  location: {
    lat: {
      type: Number,
      default: 0
    },
    lng: {
      type: Number,
      default: 0
    },
    address: {
      type: String,
      required: true
    },
    accuracy: {
      type: Number,
      default: null
    },
    lastUpdated: {
      type: Date,
      default: Date.now
    },
    shareWithHospitals: {
      type: Boolean,
      default: true
    },
    shareWithDonors: {
      type: Boolean,
      default: true
    },
    trackingStatus: {
      type: String,
      enum: ['inactive', 'active', 'paused', 'stopped', 'expired'],
      default: 'inactive'
    }
  },
  urgency: {
    type: String,
    enum: ['normal', 'urgent', 'emergency', 'critical', 'routine'],
    default: 'normal'
  },
  unitsNeeded: {
    type: Number,
    required: true,
    min: 1,
    max: 10
  },
  medicalReason: {
    type: String,
    default: 'Blood donation request'
  },
  recipientName: {
    type: String,
    default: ''
  },
  recipientAge: {
    type: Number,
    default: null
  },
  recipientGender: {
    type: String,
    enum: ['male', 'female', 'other'],
    default: 'other'
  },
  hospitalName: {
    type: String,
    default: ''
  },
  contactPerson: {
    type: String,
    default: ''
  },
  contactPhone: {
    type: String,
    default: ''
  },
  notes: {
    type: String,
    default: ''
  },
  responses: [{
    responderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    responderType: {
      type: String,
      enum: ['donor', 'hospital'],
      required: true
    },
    response: {
      type: String,
      enum: ['accepted', 'rejected'],
      required: true
    },
    // Response fulfillment lifecycle status
    status: {
      type: String,
      enum: ['pending', 'accepted', 'selected', 'cancelled', 'released', 'rejected'],
      default: 'accepted'
    },
    unitsReserved: {
      type: Number,
      default: 0
    },
    inventoryDeducted: {
      type: Boolean,
      default: false
    },
    selectedAt: {
      type: Date,
      default: null
    },
    cancelledAt: {
      type: Date,
      default: null
    },
    cancelledReason: {
      type: String,
      default: ''
    },
    hospitalInfo: {
      hospitalName: { type: String, default: '' },
      address: { type: String, default: '' },
      lat: { type: Number, default: null },
      lng: { type: Number, default: null },
      phone: { type: String, default: '' }
    },
    message: {
      type: String,
      default: ''
    },
    timestamp: {
      type: Date,
      default: Date.now
    },
    acceptedAt: {
      type: Date,
      default: null
    },
    locationSharingExpiresAt: {
      type: Date,
      default: null
    },
    // Donor explicit location sharing preference and location state
    donorShareLocation: {
      type: Boolean,
      default: false
    },
    currentLocation: {
      address: { type: String, default: '', trim: true },
      lat: { type: Number, default: null },
      lng: { type: Number, default: null },
      accuracy: { type: Number, default: null },
      lastUpdated: { type: Date, default: null }
    },
    trackingStatus: {
      type: String,
      enum: ['inactive', 'active', 'paused', 'stopped', 'expired'],
      default: 'inactive'
    }
  }],
  // Coordinated donor selected by recipient when multiple donors accept
  activeDonorId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },
  // Recipient fulfillment selection state
  fulfillmentChosen: {
    type: Boolean,
    default: false
  },
  selectedResponseId: {
    type: mongoose.Schema.Types.ObjectId,
    default: null
  },
  selectedResponderId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },
  selectedResponderType: {
    type: String,
    enum: ['donor', 'hospital', null],
    default: null
  },
  fulfillmentChosenAt: {
    type: Date,
    default: null
  },
  // Detailed accepted hospital record
  acceptedHospitalInfo: {
    hospitalId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null
    },
    hospitalName: { type: String, default: '' },
    address: { type: String, default: '' },
    lat: { type: Number, default: null },
    lng: { type: Number, default: null },
    phone: { type: String, default: '' },
    acceptedAt: { type: Date, default: null },
    locationSharingExpiresAt: { type: Date, default: null },
    verified: { type: Boolean, default: true },
    isLiveLocation: { type: Boolean, default: false } // Hospital is static verified facility
  },
  completedAt: {
    type: Date,
    default: null
  },
  cancelledAt: {
    type: Date,
    default: null
  }
}, {
  timestamps: true
});

requestSchema.index({ requesterId: 1, status: 1 });
requestSchema.index({ bloodGroup: 1, status: 1 });
requestSchema.index({ 'location.lat': 1, 'location.lng': 1 });
requestSchema.index({ urgency: 1, status: 1 });

module.exports = mongoose.model('Request', requestSchema);
