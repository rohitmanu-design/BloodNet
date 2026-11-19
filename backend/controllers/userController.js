const { validationResult } = require('express-validator');
const User = require('../models/User');
const Request = require('../models/Request');
const Notification = require('../models/Notification');
const OtpVerification = require('../models/OtpVerification');
const { normalizePhoneNumber } = require('../utils/phoneUtils');
const { geocodeAddress } = require('../utils/geocoder');

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

    const allowedFields = [
      'name', 'firstName', 'lastName', 'hospitalName', 'phone', 'contactNumber',
      'emergencyContact', 'location', 'address', 'city', 'age', 'gender',
      'bloodGroup', 'email', 'isAvailable', 'lastDonation'
    ];
    const updates = {};

    allowedFields.forEach(field => {
      if (body[field] !== undefined && body[field] !== '') {
        if (field === 'isAvailable') {
          updates[field] = body[field] === true || body[field] === 'true';
        } else if (field === 'age') {
          const numAge = parseInt(body[field], 10);
          if (!isNaN(numAge)) updates[field] = numAge;
        } else {
          updates[field] = body[field];
        }
      }
    });

    const currentUser = await User.findById(req.user.id);
    if (!currentUser) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Synchronize first/last name with unified name
    if (updates.firstName || updates.lastName) {
      const fName = updates.firstName !== undefined ? updates.firstName.trim() : (currentUser.firstName || '');
      const lName = updates.lastName !== undefined ? updates.lastName.trim() : (currentUser.lastName || '');
      updates.firstName = fName;
      updates.lastName = lName;
      updates.name = `${fName} ${lName}`.trim();
    } else if (updates.name && (!updates.firstName && !updates.lastName)) {
      const parts = updates.name.trim().split(/\s+/);
      updates.firstName = parts[0] || '';
      updates.lastName = parts.slice(1).join(' ') || '';
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
        updates['donorHealthDetails.weight'] = parseFloat(body.weight);
      }
      if (body.hemoglobin !== undefined && body.hemoglobin !== '') {
        updates['donorHealthDetails.hemoglobin'] = parseFloat(body.hemoglobin);
      }
      if (body.age !== undefined && body.age !== '') {
        const dAge = parseInt(body.age, 10);
        updates['donorHealthDetails.age'] = dAge;
        updates.age = dAge;
      }
    }

    // Update location and geocode if address or city changed
    const newAddress = updates.address !== undefined ? updates.address.trim() : (currentUser.address || '');
    const newCity = updates.city !== undefined ? updates.city.trim() : (currentUser.city || '');
    const addressChanged = (updates.address !== undefined && updates.address !== currentUser.address) ||
                          (updates.city !== undefined && updates.city !== currentUser.city);

    if (addressChanged || (currentUser.location?.lat === 0 && currentUser.location?.lng === 0)) {
      let lat = currentUser.location?.lat || 0;
      let lng = currentUser.location?.lng || 0;
      const fullSearch = `${newAddress} ${newCity}`.trim();
      if (fullSearch) {
        try {
          const geo = await geocodeAddress(fullSearch);
          if (geo && geo.lat && geo.lng) {
            lat = geo.lat;
            lng = geo.lng;
          }
        } catch (e) {
          console.warn('Geocoding updated profile address error:', e.message);
        }
      }
      updates.location = {
        lat,
        lng,
        address: newAddress,
        city: newCity
      };
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
      $or: [
        { donorId: req.user.id },
        { selectedResponderId: req.user.id },
        { 'responses.responderId': req.user.id, 'responses.responderRole': 'donor' }
      ],
      status: 'completed'
    })
    .populate('requesterId', 'name location')
    .sort({ completedAt: -1, createdAt: -1 });

    const formattedDonations = donations.map(d => {
      const obj = d.toObject ? d.toObject() : { ...d };
      return {
        _id: obj._id,
        date: obj.completedAt || obj.updatedAt || obj.createdAt,
        completedAt: obj.completedAt || obj.updatedAt || obj.createdAt,
        location: obj.location?.address || 'Medical Facility',
        bloodGroup: obj.bloodGroup,
        unitsNeeded: obj.unitsNeeded,
        status: obj.status,
        requesterId: obj.requesterId
      };
    });

    res.json({ donations: formattedDonations });
  } catch (error) {
    console.error('Get donation history error:', error);
    res.status(500).json({ message: 'Server error fetching donation history' });
  }
};

const searchDonors = async (req, res) => {
  try {
    let { bloodGroup, lat, lng, maxDistance = 50 } = req.query;

    console.log('Search donors request:', { bloodGroup, lat, lng, maxDistance });

    // Fall back to authenticated user's location if lat/lng not provided
    if ((!lat || !lng) && req.user?.id) {
      try {
        const currentUser = await User.findById(req.user.id).select('location');
        if (currentUser?.location?.lat && currentUser?.location?.lng) {
          lat = currentUser.location.lat;
          lng = currentUser.location.lng;
        }
      } catch (err) {
        console.warn('Could not retrieve user location for search fallback:', err.message);
      }
    }

    const query = {
      role: 'donor',
      isAvailable: true
    };

    if (bloodGroup && bloodGroup !== 'all' && bloodGroup !== '') {
      query.bloodGroup = bloodGroup;
    }

    const donors = await User.find(query).select('-password');
    console.log(`Found ${donors.length} donors matching query:`, query);

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

    let resultDonors = donors.map(d => (d.toObject ? d.toObject() : { ...d }));

    const numLat = parseFloat(lat);
    const numLng = parseFloat(lng);
    const hasCoordinates = !isNaN(numLat) && !isNaN(numLng) && (numLat !== 0 || numLng !== 0);

    if (hasCoordinates) {
      resultDonors = resultDonors.map(donor => {
        if (donor.location && donor.location.lat && donor.location.lng) {
          const distance = calculateDistance(numLat, numLng, donor.location.lat, donor.location.lng);
          return { ...donor, distance: Math.round(distance * 10) / 10 };
        }
        return { ...donor, distance: null };
      });

      const maxDistNum = parseFloat(maxDistance) || 50;
      resultDonors = resultDonors.filter(donor => donor.distance === null || donor.distance <= maxDistNum);
      resultDonors.sort((a, b) => {
        if (a.distance === null) return 1;
        if (b.distance === null) return -1;
        return a.distance - b.distance;
      });
    }

    console.log(`Returning ${resultDonors.length} donors to client`);
    res.json({ donors: resultDonors });
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
