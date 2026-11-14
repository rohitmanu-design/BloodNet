const { validationResult } = require('express-validator');
const User = require('../models/User');
const Request = require('../models/Request');
const Notification = require('../models/Notification');
const OtpVerification = require('../models/OtpVerification');
const { normalizePhoneNumber } = require('../utils/phoneUtils');

const updateProfile = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    // Handle both JSON and FormData requests
    const body = req.body;
    if (!body) {
      return res.status(400).json({ message: 'No data provided' });
    }

    const allowedFields = ['name', 'hospitalName', 'phone', 'contactNumber', 'location', 'address', 'age', 'bloodGroup', 'email'];
    const updates = {};

    allowedFields.forEach(field => {
      if (body[field] !== undefined && body[field] !== '') {
        updates[field] = body[field];
      }
    });

    const currentUser = await User.findById(req.user.id);
    if (!currentUser) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Invalidate phone verification if phone number changes
    if (updates.phone) {
      const normalizedNewPhone = normalizePhoneNumber(updates.phone);
      const normalizedCurrentPhone = normalizePhoneNumber(currentUser.phone || '');
      if (normalizedNewPhone && normalizedNewPhone !== normalizedCurrentPhone) {
        updates.phoneFormatted = normalizedNewPhone;
        updates.phoneVerified = false;
        updates.verified = false;
        await OtpVerification.deleteMany({ userId: req.user.id, contactType: 'phone' });
      }
    }

    // Invalidate email verification if email changes
    if (updates.email) {
      const normalizedNewEmail = updates.email.trim().toLowerCase();
      if (normalizedNewEmail !== (currentUser.email || '').toLowerCase()) {
        updates.email = normalizedNewEmail;
        updates.emailVerified = false;
        updates.verified = false;
        await OtpVerification.deleteMany({ userId: req.user.id, contactType: 'email' });
      }
    }

    // Handle donor health details
    if (req.user.role === 'donor') {
      if (body.weight !== undefined && body.weight !== '') {
        updates['donorHealthDetails.weight'] = body.weight;
      }
      if (body.hemoglobin !== undefined && body.hemoglobin !== '') {
        updates['donorHealthDetails.hemoglobin'] = body.hemoglobin;
      }
      if (body.age !== undefined && body.age !== '') {
        updates['donorHealthDetails.age'] = body.age;
      }
    }

    // Handle profile image upload
    if (req.file) {
      updates.profileImage = `/uploads/profiles/${req.file.filename}`;
      console.log('Profile image uploaded:', req.file.filename);
      console.log('Profile image path set:', updates.profileImage);
    } else {
      console.log('No profile image file received');
    }

    console.log('Request body received:', body);
    console.log('Updates being applied:', updates);

    const user = await User.findByIdAndUpdate(
      req.user.id,
      { $set: updates },
      { returnDocument: 'after', runValidators: true }
    ).select('-password');

    console.log('Updated user object:', user);
    console.log('User blood group after update:', user.bloodGroup);

    res.json({ user });
  } catch (error) {
    console.error('Update profile error:', error);
    res.status(500).json({ message: 'Server error updating profile' });
  }
};

const updateAvailability = async (req, res) => {
  try {
    if (req.user.role !== 'donor') {
      return res.status(403).json({ message: 'Only donors can update availability' });
    }

    const { isAvailable } = req.body;
    
    const user = await User.findByIdAndUpdate(
      req.user.id,
      { isAvailable },
      { new: true }
    ).select('-password');

    res.json({ user });
  } catch (error) {
    console.error('Update availability error:', error);
    res.status(500).json({ message: 'Server error updating availability' });
  }
};

const getDonationHistory = async (req, res) => {
  try {
    if (req.user.role !== 'donor') {
      return res.status(403).json({ message: 'Only donors can view donation history' });
    }

    const donations = await Request.find({
      donorId: req.user.id,
      status: 'completed'
    })
    .populate('requesterId', 'name location')
    .sort({ completedAt: -1 });

    res.json({ donations });
  } catch (error) {
    console.error('Get donation history error:', error);
    res.status(500).json({ message: 'Server error fetching donation history' });
  }
};

const searchDonors = async (req, res) => {
  try {
    const { bloodGroup, lat, lng, maxDistance = 50 } = req.query;

    console.log('Search donors request:', { bloodGroup, lat, lng, maxDistance });

    if (!bloodGroup || !lat || !lng) {
      console.log('Missing required parameters');
      return res.status(400).json({ message: 'Blood group and location coordinates are required' });
    }

    // More flexible search - don't require health details for now
    const donors = await User.find({
      role: 'donor',
      bloodGroup,
      isAvailable: true
    }).select('-password');

    console.log(`Found ${donors.length} donors with blood group ${bloodGroup}`);

    const calculateDistance = (lat1, lon1, lat2, lon2) => {
      const R = 6371;
      const dLat = (lat2 - lat1) * Math.PI / 180;
      const dLon = (lon2 - lon1) * Math.PI / 180;
      const a = 
        Math.sin(dLat/2) * Math.sin(dLat/2) +
        Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
        Math.sin(dLon/2) * Math.sin(dLon/2);
      const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
      return R * c;
    };

    const nearbyDonors = donors.filter(donor => {
      if (!donor.location || !donor.location.lat || !donor.location.lng) {
        console.log('Donor missing location:', donor._id);
        return false;
      }
      
      const distance = calculateDistance(
        parseFloat(lat), parseFloat(lng),
        donor.location.lat, donor.location.lng
      );
      donor.distance = Math.round(distance * 10) / 10;
      
      console.log(`Donor ${donor._id} distance: ${distance}km`);
      return distance <= maxDistance;
    });

    console.log(`Found ${nearbyDonors.length} nearby donors within ${maxDistance}km`);

    nearbyDonors.sort((a, b) => a.distance - b.distance);

    res.json({ donors: nearbyDonors });
  } catch (error) {
    console.error('Search donors error:', error);
    res.status(500).json({ message: 'Server error searching donors' });
  }
};

const getNotifications = async (req, res) => {
  try {
    const { page = 1, limit = 20, unreadOnly = false } = req.query;
    
    let query = { userId: req.user.id };
    if (unreadOnly === 'true') {
      query.isRead = false;
    }

    const notifications = await Notification.find(query)
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .populate('relatedUserId', 'name hospitalName')
      .populate('relatedRequestId', 'bloodGroup status');

    const total = await Notification.countDocuments(query);
    const unread = await Notification.countDocuments({ userId: req.user.id, isRead: false });

    res.json({
      notifications,
      pagination: {
        current: page,
        pages: Math.ceil(total / limit),
        total
      },
      unreadCount: unread
    });
  } catch (error) {
    console.error('Get notifications error:', error);
    res.status(500).json({ message: 'Server error fetching notifications' });
  }
};

const markNotificationRead = async (req, res) => {
  try {
    const { notificationId } = req.params;
    
    const notification = await Notification.findOneAndUpdate(
      { _id: notificationId, userId: req.user.id },
      { isRead: true },
      { new: true }
    );

    if (!notification) {
      return res.status(404).json({ message: 'Notification not found' });
    }

    res.json({ notification });
  } catch (error) {
    console.error('Mark notification read error:', error);
    res.status(500).json({ message: 'Server error marking notification as read' });
  }
};

const markAllNotificationsRead = async (req, res) => {
  try {
    await Notification.updateMany(
      { userId: req.user.id, isRead: false },
      { isRead: true }
    );

    res.json({ message: 'All notifications marked as read' });
  } catch (error) {
    console.error('Mark all notifications read error:', error);
    res.status(500).json({ message: 'Server error marking notifications as read' });
  }
};

module.exports = {
  updateProfile,
  updateAvailability,
  getDonationHistory,
  searchDonors,
  getNotifications,
  markNotificationRead,
  markAllNotificationsRead
};
