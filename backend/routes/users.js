const express = require('express');
const { body } = require('express-validator');
const { auth } = require('../middleware/auth');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const {
  updateProfile,
  updateAvailability,
  getDonationHistory,
  searchDonors,
  getNotifications,
  markNotificationRead,
  markAllNotificationsRead
} = require('../controllers/userController');

// Create uploads directory if it doesn't exist
const uploadsDir = path.join(__dirname, '../uploads/profiles');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Configure multer for profile image uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadsDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB limit
  },
  fileFilter: (req, file, cb) => {
    console.log('Multer processing file:', file.originalname, file.mimetype);
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed'), false);
    }
  }
});

const router = express.Router();

const updateProfileValidation = [
  body('name').optional().trim(),
  body('firstName').optional().trim(),
  body('lastName').optional().trim(),
  body('hospitalName').optional().trim(),
  body('phone').optional().trim(),
  body('contactNumber').optional().trim(),
  body('emergencyContact').optional().trim(),
  body('city').optional().trim(),
  body('address').optional().trim(),
  body('age').optional(),
  body('weight').optional(),
  body('hemoglobin').optional()
];

const updateAvailabilityValidation = [
  body('isAvailable').isBoolean().withMessage('isAvailable must be a boolean'),
];

router.put('/profile', auth, upload.single('profileImage'), updateProfileValidation, updateProfile);

router.put('/availability', auth, updateAvailabilityValidation, updateAvailability);

router.get('/donation-history', auth, getDonationHistory);

router.get('/search', auth, searchDonors);

router.get('/notifications', auth, getNotifications);

router.put('/notifications/:notificationId/read', auth, markNotificationRead);

router.put('/notifications/read-all', auth, markAllNotificationsRead);

// Add missing endpoints for BloodNet+ dashboard
router.get('/donation-camps', auth, async (req, res) => {
  try {
    // Mock data for donation camps - replace with actual database query
    const mockCamps = [
      {
        _id: 'camp1',
        name: 'Community Blood Drive',
        organizer: 'City Hospital',
        location: '123 Main St, City',
        date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
        time: '9:00 AM - 5:00 PM',
        expectedDonors: 50,
        bloodTypesNeeded: ['O+', 'A+', 'B+'],
        additionalInfo: 'Free health checkup included',
        distance: 2.5
      },
      {
        _id: 'camp2',
        name: 'Emergency Blood Camp',
        organizer: 'Red Cross',
        location: '456 Park Ave, City',
        date: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString(),
        time: '10:00 AM - 4:00 PM',
        expectedDonors: 30,
        bloodTypesNeeded: ['O-', 'A-', 'B-', 'AB-'],
        additionalInfo: 'Urgent need for rare blood types',
        distance: 5.2
      }
    ];
    
    res.json({ camps: mockCamps });
  } catch (error) {
    console.error('Error fetching donation camps:', error);
    res.status(500).json({ message: 'Failed to fetch donation camps' });
  }
});

router.get('/blood-stocks', auth, async (req, res) => {
  try {
    // Mock data for blood stocks - replace with actual database query
    const mockStocks = [
      {
        _id: 'bank1',
        name: 'Central Blood Bank',
        type: 'Blood Bank',
        location: '789 Medical Center Dr, City',
        phone: '+1-234-567-8900',
        operatingHours: '24/7 Emergency',
        distance: 3.1,
        bloodStock: {
          'A+': 25,
          'A-': 8,
          'B+': 18,
          'B-': 5,
          'O+': 42,
          'O-': 15,
          'AB+': 12,
          'AB-': 3
        },
        lastUpdated: new Date().toISOString()
      },
      {
        _id: 'hospital1',
        name: 'General Hospital',
        type: 'Hospital',
        location: '321 Hospital Rd, City',
        phone: '+1-234-567-8901',
        operatingHours: '8:00 AM - 8:00 PM',
        distance: 4.7,
        bloodStock: {
          'A+': 15,
          'A-': 4,
          'B+': 12,
          'B-': 2,
          'O+': 28,
          'O-': 8,
          'AB+': 6,
          'AB-': 1
        },
        lastUpdated: new Date().toISOString()
      }
    ];
    
    res.json({ stocks: mockStocks });
  } catch (error) {
    console.error('Error fetching blood stocks:', error);
    res.status(500).json({ message: 'Failed to fetch blood stocks' });
  }
});

router.post('/donation-camps/:campId/register', auth, async (req, res) => {
  try {
    const { campId } = req.params;
    const userId = req.user.id;
    
    // Mock registration logic - replace with actual database operation
    console.log(`User ${userId} registered for camp ${campId}`);
    
    // In a real implementation, you would:
    // 1. Check if the camp exists
    // 2. Check if user is already registered
    // 3. Add user to camp's registered donors list
    // 4. Create a notification for the user
    // 5. Update user's donation history or registration status
    
    // For now, just simulate successful registration
    res.json({ 
      message: 'Successfully registered for donation camp',
      campId: campId,
      userId: userId,
      registrationDate: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error registering for camp:', error);
    res.status(500).json({ message: 'Failed to register for camp' });
  }
});

module.exports = router;
