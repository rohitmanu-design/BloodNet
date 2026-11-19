const mongoose = require('mongoose');

const bloodInventorySchema = new mongoose.Schema({
  hospitalId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  bloodGroup: {
    type: String,
    enum: ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'],
    required: true
  },
  unitsAvailable: {
    type: Number,
    required: true,
    min: 0,
    default: 0
  },
  unitsReserved: {
    type: Number,
    required: true,
    min: 0,
    default: 0
  },
  lastUpdated: {
    type: Date,
    default: Date.now
  },
  minThreshold: {
    type: Number,
    required: true,
    default: 5
  },
  maxCapacity: {
    type: Number,
    required: true,
    default: 100
  },
  expiryDates: [{
    units: {
      type: Number,
      required: true,
      min: 1
    },
    expiryDate: {
      type: Date,
      required: true
    },
    batchNumber: {
      type: String,
      required: true
    }
  }],
  location: {
    storageTemperature: {
      type: Number,
      required: true,
      default: 4
    },
    storageConditions: {
      type: String,
      default: 'Standard refrigeration'
    }
  }
}, {
  timestamps: true
});

bloodInventorySchema.index({ hospitalId: 1, bloodGroup: 1 }, { unique: true });
bloodInventorySchema.index({ unitsAvailable: 1 });
bloodInventorySchema.index({ 'expiryDates.expiryDate': 1 });

bloodInventorySchema.pre('save', function(next) {
  this.lastUpdated = new Date();
  next();
});

bloodInventorySchema.methods.getExpiringSoon = function(days = 7) {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() + days);
  
  return this.expiryDates.filter(expiry => 
    expiry.expiryDate <= cutoffDate && expiry.units > 0
  );
};

bloodInventorySchema.methods.getTotalExpiringUnits = function(days = 7) {
  const expiringSoon = this.getExpiringSoon(days);
  return expiringSoon.reduce((total, expiry) => total + expiry.units, 0);
};

bloodInventorySchema.methods.isLowStock = function() {
  return this.unitsAvailable <= this.minThreshold;
};

bloodInventorySchema.methods.isNearCapacity = function() {
  return this.unitsAvailable >= (this.maxCapacity * 0.9);
};

module.exports = mongoose.model('BloodInventory', bloodInventorySchema);
