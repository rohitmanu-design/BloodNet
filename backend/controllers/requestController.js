const { validationResult } = require('express-validator');
const Request = require('../models/Request');
const User = require('../models/User');
const Notification = require('../models/Notification');
const BloodInventory = require('../models/BloodInventory');
const InventoryLog = require('../models/InventoryLog');
const AuditLog = require('../models/AuditLog');
const { geocodeAddress, reverseGeocode, cleanAddressForMaps } = require('../utils/geocoder');

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

const LOCATION_SHARING_DURATION_MS = 24 * 60 * 60 * 1000; // Exactly 24 hours

const getResponderExpiration = (acceptedAt, expiresAt) => {
  if (expiresAt) {
    const expDate = new Date(expiresAt);
    const now = Date.now();
    return {
      expiresAt: expDate,
      isExpired: now >= expDate.getTime(),
      remainingSeconds: Math.max(0, Math.floor((expDate.getTime() - now) / 1000))
    };
  }
  if (acceptedAt) {
    const expDate = new Date(new Date(acceptedAt).getTime() + LOCATION_SHARING_DURATION_MS);
    const now = Date.now();
    return {
      expiresAt: expDate,
      isExpired: now >= expDate.getTime(),
      remainingSeconds: Math.max(0, Math.floor((expDate.getTime() - now) / 1000))
    };
  }
  return {
    expiresAt: null,
    isExpired: false,
    remainingSeconds: null
  };
};

const createRequest = async (req, res) => {
  try {
    console.log('Request body received:', req.body);
    
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      console.log('Validation errors:', errors.array());
      return res.status(400).json({ errors: errors.array() });
    }

    // Get user profile information
    const user = await User.findById(req.user.id);
    if (!user) {
      console.log('User not found:', req.user.id);
      return res.status(404).json({ message: 'User not found' });
    }

    const {
      bloodGroup,
      location,
      urgency,
      unitsNeeded,
      notes
    } = req.body;

    console.log('Extracted data:', { bloodGroup, location, urgency, unitsNeeded, notes });

    // Location with explicit recipient consent controls and dynamic geocoding
    let reqLat = typeof location?.lat === 'number' ? location.lat : (parseFloat(location?.lat) || 0);
    let reqLng = typeof location?.lng === 'number' ? location.lng : (parseFloat(location?.lng) || 0);
    const reqAddress = location?.address || user.location?.address || 'Location provided upon request';

    // If coordinates are missing or if address differs from user profile address, geocode dynamically
    const isCustomAddress = location?.address && location.address.trim().toLowerCase() !== (user.location?.address || '').trim().toLowerCase();
    if ((reqLat === 0 && reqLng === 0) || isCustomAddress) {
      try {
        const geoResult = await geocodeAddress(reqAddress);
        if (geoResult && geoResult.lat && geoResult.lng) {
          reqLat = geoResult.lat;
          reqLng = geoResult.lng;
        }
      } catch (geoErr) {
        console.warn('Geocoding request address error:', geoErr.message);
      }
    }

    const formattedLocation = {
      address: reqAddress,
      lat: reqLat,
      lng: reqLng,
      accuracy: typeof location?.accuracy === 'number' ? location.accuracy : null,
      lastUpdated: new Date(),
      shareWithHospitals: location?.shareWithHospitals !== false,
      shareWithDonors: location?.shareWithDonors !== false,
      trackingStatus: location?.trackingStatus === 'active' ? 'active' : 'inactive'
    };

    const request = new Request({
      requesterId: req.user.id,
      bloodGroup,
      location: formattedLocation,
      urgency,
      unitsNeeded,
      medicalReason: 'Blood donation request',
      recipientName: user.name || '',
      recipientAge: user.age || null,
      recipientGender: 'other',
      hospitalName: user.role === 'hospital' ? user.name : '',
      contactPerson: user.name || '',
      contactPhone: user.phone || '',
      notes: notes || ''
    });

    await request.save();

    try {
      await AuditLog.create({
        action: 'request_created',
        userId: req.user.id,
        requestId: request._id,
        details: `Blood request created for ${bloodGroup} (${unitsNeeded} units) - Urgency: ${urgency}`
      });
      if (global.io) {
        global.io.emit('adminUpdate', { type: 'new_request', request });
      }
    } catch (e) {
      console.error('AuditLog request error:', e.message);
    }

    try {
      const nearbyDonors = await User.find({
        role: 'donor',
        bloodGroup,
        isAvailable: true,
        'donorHealthDetails.age': { $gte: 18 },
        'donorHealthDetails.weight': { $gte: 50 },
        'donorHealthDetails.hemoglobin': { $gte: 11 }
      });

      const nearbyHospitals = await User.find({
        role: 'hospital'
      });

      const notifications = [];
      const hospitalName = user.role === 'hospital' ? user.name : (request.hospitalName || 'Medical Center');

      nearbyDonors.forEach(donor => {
        if (donor.location && donor.location.lat && donor.location.lng) {
          const distance = calculateDistance(
            location.lat, location.lng,
            donor.location.lat, donor.location.lng
          );

          if (distance <= 50) {
            notifications.push({
              userId: donor._id,
              title: 'Blood Donation Request',
              message: `Urgent: ${unitsNeeded} units of ${bloodGroup} blood needed within ${Math.round(distance)}km`,
              type: 'blood_request',
              relatedRequestId: request._id,
              relatedUserId: req.user.id,
              priority: (urgency === 'emergency' || urgency === 'critical') ? 'urgent' : urgency === 'urgent' ? 'high' : 'medium',
              actionRequired: true,
              actionUrl: `/requests/${request._id}`,
              metadata: { distance, unitsNeeded, bloodGroup }
            });
          }
        }
      });

      nearbyHospitals.forEach(hospital => {
        if (hospital.location && hospital.location.lat && hospital.location.lng) {
          const distance = calculateDistance(
            location.lat, location.lng,
            hospital.location.lat, hospital.location.lng
          );

          if (distance <= 50) {
            notifications.push({
              userId: hospital._id,
              title: 'Blood Request from Nearby',
              message: `${unitsNeeded} units of ${bloodGroup} blood requested within ${Math.round(distance)}km`,
              type: 'blood_request',
              relatedRequestId: request._id,
              relatedUserId: req.user.id,
              priority: (urgency === 'emergency' || urgency === 'critical') ? 'urgent' : urgency === 'urgent' ? 'high' : 'medium',
              actionRequired: true,
              actionUrl: `/requests/${request._id}`,
              metadata: { distance, unitsNeeded, bloodGroup, hospitalName }
            });
          }
        }
      });

      if (notifications.length > 0) {
        await Notification.insertMany(notifications);
        
        // Broadcast new request to all connected donors and hospitals
        if (global.connectedUsers && global.io) {
          const allConnectedUsers = Array.from(global.connectedUsers.keys());
          if (allConnectedUsers.length > 0) {
            const connectedDonorsAndHospitals = await User.find({
              _id: { $in: allConnectedUsers },
              role: { $in: ['donor', 'hospital'] }
            });
            
            connectedDonorsAndHospitals.forEach(user => {
              const socketId = global.connectedUsers.get(user._id.toString());
              if (socketId) {
                global.io.to(socketId).emit('newBloodRequest', {
                  request: request,
                  type: 'new_request',
                  timestamp: new Date()
                });
                
                const userNotification = notifications.find(n => n.userId.toString() === user._id.toString());
                if (userNotification) {
                  global.io.to(socketId).emit('newNotification', userNotification);
                }
              }
            });
          }
        }
      }
    } catch (notifErr) {
      console.error('Notification dispatch error (non-fatal):', notifErr.message);
    }

    res.status(201).json({ request });
  } catch (error) {
    console.error('Create request error:', error);
    res.status(500).json({ message: 'Server error creating request' });
  }
};

const getMyRequests = async (req, res) => {
  try {
    console.log('Getting requests for user:', req.user.id);
    const requests = await Request.find({ requesterId: req.user.id })
      .populate('donorId', 'name phone location')
      .populate('hospitalId', 'hospitalName contactNumber location')
      .sort({ createdAt: -1 });

    console.log('Found requests:', requests);
    console.log('Number of requests:', requests.length);
    
    res.json({ requests });
  } catch (error) {
    console.error('Get my requests error:', error);
    res.status(500).json({ message: 'Server error fetching requests' });
  }
};

const getNearbyRequests = async (req, res) => {
  try {
    const { maxDistance = 250 } = req.query;
    const user = await User.findById(req.user.id);

    // Show open requests awaiting response or awaiting recipient choice, or ones user responded to
    let query = {
      status: { $in: ['pending', 'accepted', 'active'] },
      $or: [
        { fulfillmentChosen: { $ne: true } },
        { 'responses.responderId': req.user.id }
      ]
    };

    // Don't filter by bloodGroup - show all requests for friend referrals
    const requests = await Request.find(query)
      .populate('requesterId', 'name phone')
      .populate('acceptedHospitalInfo.hospitalId', 'hospitalName address contactNumber')
      .sort({ createdAt: -1 });

    const nearbyRequests = requests
      .filter(request => {
        // If user doesn't have GPS coordinates, return all requests
        if (!user?.location?.lat || !user?.location?.lng) return true;
        // If request doesn't have GPS, still show so donors see local addresses
        if (!request.location?.lat || !request.location?.lng) return true;
        const distance = calculateDistance(
          user.location.lat, user.location.lng,
          request.location.lat, request.location.lng
        );
        return distance <= maxDistance;
      })
      .map(request => {
        const plain = request.toObject();
        let distance = null;
        if (user?.location?.lat && user?.location?.lng && plain.location?.lat && plain.location?.lng) {
          distance = Math.round(calculateDistance(
            user.location.lat, user.location.lng,
            plain.location.lat, plain.location.lng
          ) * 10) / 10;
        }

        const myResponse = plain.responses?.find(r => r.responderId?.toString() === req.user.id.toString());
        const hasAccepted = myResponse?.responseStatus === 'accepted' ||
          myResponse?.responseStatus === 'selected' ||
          plain.donorId?.toString() === req.user.id.toString() ||
          plain.selectedResponderId?.toString() === req.user.id.toString();
        const isFulfillmentSelected = plain.selectedResponderId?.toString() === req.user.id.toString();
        const isClosedForMe = plain.fulfillmentChosen && !isFulfillmentSelected;

        return {
          ...plain,
          approxDistanceKm: distance,
          myResponseStatus: myResponse?.responseStatus || (hasAccepted ? 'accepted' : null),
          hasAccepted: Boolean(hasAccepted),
          isFulfillmentSelected: Boolean(isFulfillmentSelected),
          isClosedForMe: Boolean(isClosedForMe),
          location: {
            address: plain.location?.address || 'Location provided upon request',
            lat: plain.location?.lat || 0,
            lng: plain.location?.lng || 0,
            accuracy: plain.location?.accuracy || null
          }
        };
      });

    res.json({ requests: nearbyRequests });
  } catch (error) {
    console.error('Get nearby requests error:', error);
    res.status(500).json({ message: 'Server error fetching nearby requests' });
  }
};

const getDonorActiveDonation = async (req, res) => {
  try {
    const activeRequest = await Request.findOne({
      status: 'accepted',
      'responses.responderId': req.user.id,
      'responses.response': 'accepted'
    })
      .populate('requesterId', 'name phone location')
      .populate('hospitalId', 'hospitalName contactNumber location')
      .sort({ updatedAt: -1 });

    if (!activeRequest) {
      return res.json({ activeDonation: null });
    }

    const myResponse = activeRequest.responses?.find(
      r => r.responderId?.toString() === req.user.id.toString() && r.response === 'accepted'
    );

    res.json({
      activeDonation: {
        _id: activeRequest._id,
        bloodGroup: activeRequest.bloodGroup,
        unitsNeeded: activeRequest.unitsNeeded,
        recipientName: activeRequest.recipientName || activeRequest.requesterId?.name || 'Recipient',
        location: activeRequest.location,
        shareLocation: myResponse?.donorShareLocation || false,
        trackingStatus: myResponse?.trackingStatus || 'active'
      }
    });
  } catch (err) {
    console.error('Get donor active donation error:', err);
    res.status(500).json({ message: 'Server error retrieving donor active donation' });
  }
};

/**
 * Safely release all reserved hospital inventory for a given request.
 * Called when a request is cancelled, expired, or deleted without fulfillment.
 */
const releaseAllReservedInventory = async (request, reason = 'Request closed', performedBy = null) => {
  if (!request.responses || request.responses.length === 0) return;
  for (const resp of request.responses) {
    if (resp.responderType === 'hospital' && resp.inventoryDeducted && resp.unitsReserved > 0) {
      try {
        await BloodInventory.findOneAndUpdate(
          {
            hospitalId: resp.responderId,
            bloodGroup: request.bloodGroup,
            unitsReserved: { $gte: resp.unitsReserved }
          },
          {
            $inc: { unitsAvailable: resp.unitsReserved, unitsReserved: -resp.unitsReserved },
            $set: { lastUpdated: new Date() }
          }
        );

        await InventoryLog.create({
          hospitalId: resp.responderId,
          bloodGroup: request.bloodGroup,
          operation: 'released_reservation',
          units: resp.unitsReserved,
          previousUnits: 0,
          newUnits: 0,
          reason: `${reason} for request #${request._id}`,
          performedBy: performedBy || resp.responderId,
          relatedRequestId: request._id
        });

        resp.unitsReserved = 0;
        resp.inventoryDeducted = false;
        resp.status = 'released';
      } catch (err) {
        console.error('Error releasing inventory reservation:', err.message);
      }
    }
  }
};

const respondToRequest = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { requestId } = req.params;
    const { response, message } = req.body;

    const request = await Request.findById(requestId);
    if (!request) {
      return res.status(404).json({ message: 'Request not found' });
    }

    // Only block responses if request is already cancelled, completed, or a fulfillment option was chosen
    const isClosed = ['cancelled', 'completed', 'fulfilled', 'rejected'].includes(request.status);
    if (isClosed || request.fulfillmentChosen) {
      return res.status(400).json({
        message: 'This request is no longer accepting responses (already fulfilled or closed)'
      });
    }

    const existingResponse = request.responses.find(
      r => r.responderId.toString() === req.user.id
    );

    if (existingResponse) {
      return res.status(400).json({ message: 'You have already responded to this request' });
    }

    let hospLat = null;
    let hospLng = null;
    let hospAddress = '';
    const unitsNeeded = request.unitsNeeded || 1;

    if (response === 'accepted') {
      if (req.user.role === 'hospital') {
        const bloodGroup = request.bloodGroup;

        // 1. Initial stock availability check
        const currentStock = await BloodInventory.findOne({
          hospitalId: req.user.id,
          bloodGroup
        });

        const availableUnits = currentStock ? currentStock.unitsAvailable : 0;

        if (availableUnits < unitsNeeded) {
          return res.status(409).json({
            error: 'INSUFFICIENT_STOCK',
            code: 'INSUFFICIENT_STOCK',
            message: `Not enough ${bloodGroup} stock is available to fulfill this request.`,
            availableUnits,
            requestedUnits: unitsNeeded,
            bloodGroup
          });
        }

        // 2. Atomic reservation: hold stock safely so same stock cannot fulfill multiple requests
        const updatedInventory = await BloodInventory.findOneAndUpdate(
          {
            hospitalId: req.user.id,
            bloodGroup,
            unitsAvailable: { $gte: unitsNeeded }
          },
          {
            $inc: { unitsAvailable: -unitsNeeded, unitsReserved: unitsNeeded },
            $set: { lastUpdated: new Date() }
          },
          { new: true }
        );

        if (!updatedInventory) {
          const freshStock = await BloodInventory.findOne({
            hospitalId: req.user.id,
            bloodGroup
          });
          return res.status(409).json({
            error: 'INSUFFICIENT_STOCK',
            code: 'INSUFFICIENT_STOCK',
            message: `Not enough ${bloodGroup} stock is available to fulfill this request.`,
            availableUnits: freshStock ? freshStock.unitsAvailable : 0,
            requestedUnits: unitsNeeded,
            bloodGroup
          });
        }

        // 3. Record reservation in InventoryLog
        try {
          await InventoryLog.create({
            hospitalId: req.user.id,
            bloodGroup,
            operation: 'reserved_for_request',
            units: unitsNeeded,
            previousUnits: updatedInventory.unitsAvailable + unitsNeeded,
            newUnits: updatedInventory.unitsAvailable,
            reason: `Reserved stock for blood request #${request._id} (awaiting recipient confirmation)`,
            performedBy: req.user.id,
            relatedRequestId: request._id
          });
        } catch (logErr) {
          console.error('InventoryLog create error:', logErr.message);
        }

        if (!request.hospitalId) {
          request.hospitalId = req.user.id;
        }
        request.responseDate = new Date();

        hospLat = req.user.location?.lat || null;
        hospLng = req.user.location?.lng || null;
        hospAddress = req.user.location?.address || req.user.address || '';
        if ((!hospLat || !hospLng || (hospLat === 0 && hospLng === 0)) && hospAddress) {
          try {
            const geoHosp = await geocodeAddress(hospAddress);
            if (geoHosp && geoHosp.lat && geoHosp.lng) {
              hospLat = geoHosp.lat;
              hospLng = geoHosp.lng;
            }
          } catch (e) {}
        }

        const acceptanceTime = new Date();
        const locationSharingExpiresAt = new Date(acceptanceTime.getTime() + LOCATION_SHARING_DURATION_MS);

        if (!request.acceptedHospitalInfo?.hospitalId) {
          request.acceptedHospitalInfo = {
            hospitalId: req.user.id,
            hospitalName: req.user.hospitalName || req.user.name || 'Verified Hospital Center',
            address: hospAddress || 'Hospital Center',
            lat: hospLat,
            lng: hospLng,
            phone: req.user.contactNumber || req.user.phone || '',
            acceptedAt: acceptanceTime,
            locationSharingExpiresAt,
            verified: true,
            isLiveLocation: false
          };
        }
      } else if (req.user.role === 'donor') {
        // Donor acceptance does NOT modify hospital inventory
        if (!request.donorId) {
          request.donorId = req.user.id;
        }
        if (!request.activeDonorId) {
          request.activeDonorId = req.user.id;
        }
        request.responseDate = new Date();
      }

      // Keep request open (status 'pending' or 'active') while awaiting recipient's fulfillment choice
      if (request.status === 'pending') {
        request.status = 'pending';
      }
    }

    const acceptanceTime = new Date();
    const locationSharingExpiresAt = response === 'accepted'
      ? new Date(acceptanceTime.getTime() + LOCATION_SHARING_DURATION_MS)
      : null;

    const donorShareLocation = Boolean(req.body.shareLocation);
    let donorCurrentLocation = null;
    if (req.user.role === 'donor') {
      const donorAddress = (req.body.address || req.body.currentLocation?.address || req.user.location?.address || req.user.address || [req.user.city, req.user.state].filter(Boolean).join(', ') || '').trim();
      let donorLat = req.body.currentLocation?.lat !== undefined && req.body.currentLocation?.lat !== null
        ? parseFloat(req.body.currentLocation.lat)
        : (req.user.location?.lat !== undefined && req.user.location?.lat !== null ? parseFloat(req.user.location.lat) : null);
      let donorLng = req.body.currentLocation?.lng !== undefined && req.body.currentLocation?.lng !== null
        ? parseFloat(req.body.currentLocation.lng)
        : (req.user.location?.lng !== undefined && req.user.location?.lng !== null ? parseFloat(req.user.location.lng) : null);

      if ((!donorLat || !donorLng || (donorLat === 0 && donorLng === 0)) && donorAddress) {
        try {
          const geo = await geocodeAddress(donorAddress);
          if (geo && geo.lat && geo.lng) {
            donorLat = geo.lat;
            donorLng = geo.lng;
          }
        } catch (e) {}
      }

      donorCurrentLocation = {
        address: donorAddress,
        lat: (!isNaN(donorLat) && donorLat !== null && donorLat !== 0) ? donorLat : null,
        lng: (!isNaN(donorLng) && donorLng !== null && donorLng !== 0) ? donorLng : null,
        accuracy: parseFloat(req.body.currentLocation?.accuracy) || null,
        lastUpdated: new Date()
      };
    }

    request.responses.push({
      responderId: req.user.id,
      responderType: req.user.role,
      response,
      status: response === 'accepted' ? 'accepted' : 'rejected',
      unitsReserved: (req.user.role === 'hospital' && response === 'accepted') ? unitsNeeded : 0,
      inventoryDeducted: (req.user.role === 'hospital' && response === 'accepted'),
      hospitalInfo: (req.user.role === 'hospital' && response === 'accepted') ? {
        hospitalName: req.user.hospitalName || req.user.name || 'Verified Hospital Center',
        address: hospAddress,
        lat: hospLat,
        lng: hospLng,
        phone: req.user.contactNumber || req.user.phone || ''
      } : undefined,
      message: message || '',
      timestamp: acceptanceTime,
      acceptedAt: response === 'accepted' ? acceptanceTime : null,
      locationSharingExpiresAt,
      donorShareLocation,
      currentLocation: donorCurrentLocation,
      trackingStatus: (response === 'accepted' && donorShareLocation) ? 'active' : 'inactive'
    });

    await request.save();

    try {
      await AuditLog.create({
        action: 'request_status_updated',
        userId: req.user.id,
        requestId: request._id,
        details: `Request #${request._id} response recorded (${response}) by ${req.user.role} ${req.user.name || req.user.id}. 24-hour location sharing timer initiated (expires ${locationSharingExpiresAt ? locationSharingExpiresAt.toISOString() : 'N/A'}).`
      });
      if (global.io) {
        global.io.emit('adminUpdate', { type: 'request_updated', request });
        global.io.to(`request_${request._id}`).emit('newResponseReceived', {
          requestId: request._id,
          responderType: req.user.role,
          responderId: req.user.id,
          responderName: req.user.hospitalName || req.user.name || 'Responder',
          response,
          status: request.status
        });
      }
    } catch (e) {
      console.error('AuditLog request error:', e.message);
    }

    await Notification.create({
      userId: request.requesterId,
      title: `Request ${response === 'accepted' ? 'Accepted' : 'Rejected'}`,
      message: `Your blood request has been ${response === 'accepted' ? 'accepted' : 'rejected'} by ${req.user.role === 'donor' ? 'a donor' : 'a hospital'}`,
      type: response === 'accepted' ? 'request_accepted' : 'request_rejected',
      relatedRequestId: request._id,
      relatedUserId: req.user.id,
      priority: 'high',
      actionRequired: false
    });

    if (global.connectedUsers && global.io) {
      const requesterSocketId = global.connectedUsers.get(request.requesterId.toString());
      if (requesterSocketId) {
        global.io.to(requesterSocketId).emit('requestUpdate', {
          requestId: request._id,
          status: request.status,
          responder: req.user,
          responderType: req.user.role,
          response
        });
      }
    }

    res.json({ request });
  } catch (error) {
    console.error('Respond to request error:', error);
    res.status(500).json({ message: 'Server error responding to request' });
  }
};

const getRequestDetails = async (req, res) => {
  try {
    const { requestId } = req.params;
    
    const request = await Request.findById(requestId)
      .populate('requesterId', 'name phone email location')
      .populate('donorId', 'name phone location')
      .populate('hospitalId', 'hospitalName contactNumber location')
      .populate('responses.responderId', 'name hospitalName phone location');

    if (!request) {
      return res.status(404).json({ message: 'Request not found' });
    }

    res.json({ request });
  } catch (error) {
    console.error('Get request details error:', error);
    res.status(500).json({ message: 'Server error fetching request details' });
  }
};

const deleteRequest = async (req, res) => {
  try {
    console.log('Delete request received');
    console.log('Request params:', req.params);
    console.log('User ID:', req.user.id);
    
    const { requestId } = req.params;
    
    // Find the request and verify it belongs to the user
    const request = await Request.findOne({ _id: requestId, requesterId: req.user.id });
    
    console.log('Found request:', request);
    
    if (!request) {
      console.log('Request not found or unauthorized');
      return res.status(404).json({ message: 'Request not found or you do not have permission to delete it' });
    }
    
    console.log('Request status:', request.status);
    
    // Only allow deletion of pending requests
    if (request.status !== 'pending') {
      console.log('Request not pending, cannot delete');
      return res.status(400).json({ message: 'Cannot delete request that is already processed' });
    }
    
    console.log('Deleting request...');
    // Safely release any reserved hospital stock before deleting
    await releaseAllReservedInventory(request, 'Request deleted by user', req.user.id);
    await Request.findByIdAndDelete(requestId);
    console.log('Request deleted successfully');
    
    try {
      await AuditLog.create({
        action: 'request_deleted',
        userId: req.user.id,
        requestId: request._id,
        details: `Blood request for ${request.bloodGroup} deleted by user`
      });
      if (global.io) global.io.emit('adminUpdate', { type: 'request', id: request._id });
    } catch (e) { console.error('AuditLog error:', e.message); }

    res.json({ message: 'Request deleted successfully' });
  } catch (error) {
    console.error('Delete request error:', error);
    res.status(500).json({ message: 'Server error deleting request' });
  }
};

// ==========================================
// REAL-TIME LOCATION SHARING & TRACKING APIS
// ==========================================

const getRequestTracking = async (req, res) => {
  try {
    const { requestId } = req.params;
    const userId = req.user.id;

    const request = await Request.findById(requestId)
      .populate('requesterId', 'name phone email location')
      .populate('donorId', 'name phone bloodGroup')
      .populate('activeDonorId', 'name phone bloodGroup')
      .populate('hospitalId', 'hospitalName name contactNumber phone location address')
      .populate('acceptedHospitalInfo.hospitalId', 'hospitalName name contactNumber phone location address')
      .populate('responses.responderId', 'name phone bloodGroup hospitalName contactNumber location address city state');

    if (!request) {
      return res.status(404).json({ message: 'Request not found' });
    }

    const isRequester = request.requesterId?._id?.toString() === userId.toString();
    const hospitalResponse = request.responses?.find(
      r => r.responderType === 'hospital' && (r.responderId?._id || r.responderId)?.toString() === userId.toString() && r.response === 'accepted'
    );
    const isHospital = Boolean(hospitalResponse) ||
      request.acceptedHospitalInfo?.hospitalId?.toString() === userId.toString() ||
      request.hospitalId?._id?.toString() === userId.toString();
    const donorResponse = request.responses?.find(
      r => r.responderType === 'donor' && (r.responderId?._id || r.responderId)?.toString() === userId.toString() && r.response === 'accepted'
    );
    const isDonor = Boolean(donorResponse);
    const isAdmin = req.user.role === 'admin';

    // Strict access control: only authorized participants or admin may access tracking
    if (!isRequester && !isHospital && !isDonor && !isAdmin) {
      return res.status(403).json({ message: 'Access denied: You are not an authorized participant in this request' });
    }

    const isRequestClosed = ['completed', 'cancelled', 'rejected'].includes(request.status);

    const checkStaleness = (lastUpdatedDate) => {
      if (!lastUpdatedDate) return true;
      const ageMs = Date.now() - new Date(lastUpdatedDate).getTime();
      return ageMs > 5 * 60 * 1000; // > 5 minutes is considered stale
    };

    let requesterLocation = null;
    let hospitalInfo = null;
    let donorInfo = null;
    let allAcceptedDonors = [];
    let allAcceptedHospitals = [];

    // 24-hour expiration evaluation for each responder role
    const hospAcceptedAt = hospitalResponse?.acceptedAt || request.acceptedHospitalInfo?.acceptedAt || request.responseDate;
    const hospExpiresAt = hospitalResponse?.locationSharingExpiresAt || request.acceptedHospitalInfo?.locationSharingExpiresAt;
    const hospitalExp = getResponderExpiration(hospAcceptedAt, hospExpiresAt);

    const myDonorAcceptedAt = donorResponse ? (donorResponse.acceptedAt || donorResponse.timestamp) : null;
    const myDonorExpiresAt = donorResponse ? donorResponse.locationSharingExpiresAt : null;
    const myDonorExp = getResponderExpiration(myDonorAcceptedAt, myDonorExpiresAt);

    // 1. Recipient location access logic
    if (isRequester || isAdmin) {
      requesterLocation = {
        address: request.location?.address || '',
        lat: request.location?.lat || 0,
        lng: request.location?.lng || 0,
        accuracy: request.location?.accuracy || null,
        lastUpdated: request.location?.lastUpdated || request.updatedAt,
        isStale: checkStaleness(request.location?.lastUpdated),
        trackingStatus: isRequestClosed ? 'stopped' : (request.location?.trackingStatus || 'inactive'),
        shareWithHospitals: request.location?.shareWithHospitals !== false,
        shareWithDonors: request.location?.shareWithDonors !== false
      };
    } else if (isHospital) {
      // Hospital only sees recipient location if recipient consented and 24h window has not expired
      if (request.location?.shareWithHospitals !== false && !isRequestClosed && !hospitalExp.isExpired) {
        requesterLocation = {
          address: request.location?.address || '',
          lat: request.location?.lat || 0,
          lng: request.location?.lng || 0,
          accuracy: request.location?.accuracy || null,
          lastUpdated: request.location?.lastUpdated || request.updatedAt,
          isStale: checkStaleness(request.location?.lastUpdated),
          trackingStatus: request.location?.trackingStatus || 'inactive'
        };
      }
    } else if (isDonor) {
      // Donor only sees recipient location if recipient consented with donors and 24h window has not expired
      if (request.location?.shareWithDonors !== false && !isRequestClosed && !myDonorExp.isExpired) {
        requesterLocation = {
          address: request.location?.address || '',
          lat: request.location?.lat || 0,
          lng: request.location?.lng || 0,
          accuracy: request.location?.accuracy || null,
          lastUpdated: request.location?.lastUpdated || request.updatedAt,
          isStale: checkStaleness(request.location?.lastUpdated),
          trackingStatus: request.location?.trackingStatus || 'inactive'
        };
      }
    }

    // 2. Hospital information (saved verified address, NOT live moving)
    const hasHospital = request.acceptedHospitalInfo?.hospitalId || request.hospitalId;
    if (hasHospital) {
      const hospSub = request.acceptedHospitalInfo || {};
      const hospUser = (hospSub.hospitalId && typeof hospSub.hospitalId === 'object' ? hospSub.hospitalId : null) ||
        (request.hospitalId && typeof request.hospitalId === 'object' ? request.hospitalId : null) || {};
      const hospName = hospSub.hospitalName || hospUser.hospitalName || hospUser.name || request.hospitalName || 'Verified Hospital';
      const hospAddr = hospSub.address || hospUser.location?.address || hospUser.address || '';
      let hospLat = hospSub.lat || hospUser.location?.lat || hospUser.lat || null;
      let hospLng = hospSub.lng || hospUser.location?.lng || hospUser.lng || null;

      if ((!hospLat || !hospLng || (hospLat === 0 && hospLng === 0)) && hospAddr) {
        try {
          const geo = await geocodeAddress(hospAddr);
          if (geo && geo.lat && geo.lng) {
            hospLat = geo.lat;
            hospLng = geo.lng;
          }
        } catch (e) {}
      }

      const hasValidCoords = hospLat && hospLng && !isNaN(hospLat) && !isNaN(hospLng) && (hospLat !== 0 || hospLng !== 0);
      const directionsUrl = hospAddr
        ? `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(cleanAddressForMaps(hospAddr))}`
        : (hasValidCoords ? `https://www.google.com/maps/dir/?api=1&destination=${hospLat},${hospLng}` : null);

      hospitalInfo = {
        hospitalId: hospSub.hospitalId?._id || hospSub.hospitalId || hospUser._id,
        hospitalName: hospName,
        address: hospAddr,
        lat: hospLat,
        lng: hospLng,
        phone: hospSub.phone || hospUser.contactNumber || hospUser.phone || '',
        acceptedAt: hospAcceptedAt || hospSub.acceptedAt || request.responseDate || request.updatedAt,
        expiresAt: hospitalExp.expiresAt,
        isExpired: hospitalExp.isExpired,
        remainingSeconds: hospitalExp.remainingSeconds,
        locationSharingExpired: hospitalExp.isExpired,
        trackingStatus: isRequestClosed ? 'stopped' : (hospitalExp.isExpired ? 'expired' : 'active'),
        verified: true,
        isLiveLocation: false, // Hospital is saved verified facility
        directionsUrl
      };
    }

    // 3. Donor responses handling
    const acceptedResponses = (request.responses || []).filter(
      r => r.responderType === 'donor' && r.response === 'accepted'
    );

    if (isRequester || isAdmin) {
      // Recipient can see all responding donors and their individual 24-hour location sharing state
      allAcceptedDonors = acceptedResponses.map(r => {
        const dAcceptedAt = r.acceptedAt || r.timestamp;
        const dExpiresAt = r.locationSharingExpiresAt;
        const dExp = getResponderExpiration(dAcceptedAt, dExpiresAt);
        const canShare = r.donorShareLocation === true && !isRequestClosed && !dExp.isExpired;
        const respId = r.responderId?._id || r.responderId;
        const isCoord = (request.activeDonorId?._id || request.activeDonorId)?.toString() === respId?.toString();
        const isSelected = request.selectedResponderId?.toString() === respId?.toString();

        const donorUser = r.responderId && typeof r.responderId === 'object' ? r.responderId : {};
        const donorProfileAddress = (donorUser.location?.address ||
          donorUser.address ||
          [donorUser.city, donorUser.state].filter(Boolean).join(', ') ||
          '').trim();
        const donorAddress = donorProfileAddress || (r.currentLocation?.address || '').trim();
        const donorLat = r.currentLocation?.lat ?? donorUser.location?.lat ?? null;
        const donorLng = r.currentLocation?.lng ?? donorUser.location?.lng ?? null;
        const hasValidDonorCoords = donorLat !== null && donorLng !== null && !isNaN(donorLat) && !isNaN(donorLng) && (donorLat !== 0 || donorLng !== 0);
        const directionsUrl = donorAddress
          ? `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(cleanAddressForMaps(donorAddress))}`
          : (hasValidDonorCoords ? `https://www.google.com/maps/dir/?api=1&destination=${donorLat},${donorLng}` : null);

        const hasLocationData = Boolean(donorAddress || hasValidDonorCoords);

        return {
          responseId: r._id,
          responderId: respId,
          responderType: 'donor',
          name: donorUser.name || 'Verified Donor',
          phone: donorUser.phone || '',
          bloodGroup: donorUser.bloodGroup || '',
          address: donorAddress,
          lat: donorLat,
          lng: donorLng,
          directionsUrl,
          unitsReserved: 0,
          status: r.status || 'accepted',
          isSelected,
          acceptedAt: dAcceptedAt,
          expiresAt: dExp.expiresAt,
          isExpired: dExp.isExpired,
          remainingSeconds: dExp.remainingSeconds,
          locationSharingExpired: dExp.isExpired,
          donorShareLocation: r.donorShareLocation || false,
          trackingStatus: isRequestClosed ? 'stopped' : (dExp.isExpired ? 'expired' : (r.trackingStatus || 'inactive')),
          isCoordinating: isCoord,
          currentLocation: canShare && hasLocationData ? {
            address: donorAddress,
            lat: donorLat,
            lng: donorLng,
            accuracy: r.currentLocation?.accuracy || null,
            lastUpdated: r.currentLocation?.lastUpdated || r.acceptedAt || r.timestamp,
            isStale: checkStaleness(r.currentLocation?.lastUpdated)
          } : null
        };
      });

      // Active coordinating donor
      donorInfo = allAcceptedDonors.find(d => d.isCoordinating) || allAcceptedDonors.find(d => d.isSelected) || allAcceptedDonors[0] || null;

      // Hospital responses handling for recipient
      const acceptedHospitalResponses = (request.responses || []).filter(
        r => r.responderType === 'hospital' && r.response === 'accepted'
      );
      allAcceptedHospitals = acceptedHospitalResponses.map(r => {
        const hAcceptedAt = r.acceptedAt || r.timestamp;
        const hExpiresAt = r.locationSharingExpiresAt;
        const hExp = getResponderExpiration(hAcceptedAt, hExpiresAt);
        const respId = r.responderId?._id || r.responderId;
        const hName = r.hospitalInfo?.hospitalName || r.responderId?.hospitalName || r.responderId?.name || 'Verified Hospital';
        const hAddress = r.hospitalInfo?.address || r.responderId?.location?.address || r.responderId?.address || '';
        const hLat = r.hospitalInfo?.lat ?? r.responderId?.location?.lat ?? null;
        const hLng = r.hospitalInfo?.lng ?? r.responderId?.location?.lng ?? null;
        const isSelected = request.selectedResponderId?.toString() === respId?.toString();
        const hasValidCoords = hLat && hLng && !isNaN(hLat) && !isNaN(hLng) && (hLat !== 0 || hLng !== 0);
        const directionsUrl = hAddress
          ? `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(cleanAddressForMaps(hAddress))}`
          : (hasValidCoords ? `https://www.google.com/maps/dir/?api=1&destination=${hLat},${hLng}` : null);

        return {
          responseId: r._id,
          responderId: respId,
          responderType: 'hospital',
          hospitalName: hName,
          name: hName,
          address: hAddress,
          lat: hLat,
          lng: hLng,
          phone: r.hospitalInfo?.phone || r.responderId?.contactNumber || r.responderId?.phone || '',
          unitsReserved: r.unitsReserved || 0,
          status: r.status || 'accepted',
          isSelected,
          acceptedAt: hAcceptedAt,
          expiresAt: hExp.expiresAt,
          isExpired: hExp.isExpired,
          remainingSeconds: hExp.remainingSeconds,
          directionsUrl
        };
      });

      if (!hospitalInfo && allAcceptedHospitals.length > 0) {
        hospitalInfo = allAcceptedHospitals.find(h => h.isSelected) || allAcceptedHospitals[0] || null;
      }
    } else if (isHospital) {
      // Hospital can also see active donor coordination information if present
      const coordinatingDonor = acceptedResponses.find(r => (request.activeDonorId?._id || request.activeDonorId)?.toString() === (r.responderId?._id || r.responderId)?.toString()) ||
        acceptedResponses.find(r => request.selectedResponderId?.toString() === (r.responderId?._id || r.responderId)?.toString()) ||
        acceptedResponses[0];
      if (coordinatingDonor) {
        const dAcceptedAt = coordinatingDonor.acceptedAt || coordinatingDonor.timestamp;
        const dExpiresAt = coordinatingDonor.locationSharingExpiresAt;
        const dExp = getResponderExpiration(dAcceptedAt, dExpiresAt);
        const canShare = coordinatingDonor.donorShareLocation === true && !isRequestClosed && !dExp.isExpired;
        const donorUser = coordinatingDonor.responderId && typeof coordinatingDonor.responderId === 'object' ? coordinatingDonor.responderId : {};
        const donorAddress = (coordinatingDonor.currentLocation?.address || donorUser.location?.address || donorUser.address || '').trim();
        const donorLat = coordinatingDonor.currentLocation?.lat ?? donorUser.location?.lat ?? null;
        const donorLng = coordinatingDonor.currentLocation?.lng ?? donorUser.location?.lng ?? null;
        donorInfo = {
          responderId: coordinatingDonor.responderId?._id || coordinatingDonor.responderId,
          name: donorUser.name || 'Verified Donor',
          phone: donorUser.phone || '',
          bloodGroup: donorUser.bloodGroup || '',
          address: donorAddress,
          lat: donorLat,
          lng: donorLng,
          currentLocation: canShare && (donorAddress || donorLat) ? {
            address: donorAddress,
            lat: donorLat,
            lng: donorLng,
            accuracy: coordinatingDonor.currentLocation?.accuracy || null,
            lastUpdated: coordinatingDonor.currentLocation?.lastUpdated || dAcceptedAt,
            isStale: checkStaleness(coordinatingDonor.currentLocation?.lastUpdated)
          } : null
        };
      }
    } else if (isDonor) {
      // Donor only sees their own response and tracking state, NEVER other donors' data
      const canShare = donorResponse.donorShareLocation === true && !isRequestClosed && !myDonorExp.isExpired;
      const respId = donorResponse.responderId?._id || donorResponse.responderId;
      const isCoord = (request.activeDonorId?._id || request.activeDonorId)?.toString() === req.user.id.toString();
      const donorProfileAddress = (req.user.location?.address ||
        req.user.address ||
        [req.user.city, req.user.state].filter(Boolean).join(', ') ||
        '').trim();
      const donorAddress = donorProfileAddress || (donorResponse.currentLocation?.address || '').trim();
      const donorLat = donorResponse.currentLocation?.lat ?? req.user.location?.lat ?? null;
      const donorLng = donorResponse.currentLocation?.lng ?? req.user.location?.lng ?? null;
      const hasValidDonorCoords = donorLat !== null && donorLng !== null && !isNaN(donorLat) && !isNaN(donorLng) && (donorLat !== 0 || donorLng !== 0);
      const directionsUrl = donorAddress
        ? `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(cleanAddressForMaps(donorAddress))}`
        : (hasValidDonorCoords ? `https://www.google.com/maps/dir/?api=1&destination=${donorLat},${donorLng}` : null);

      donorInfo = {
        responderId: respId,
        name: req.user.name || 'You',
        address: donorAddress,
        lat: donorLat,
        lng: donorLng,
        directionsUrl,
        acceptedAt: myDonorAcceptedAt,
        expiresAt: myDonorExp.expiresAt,
        isExpired: myDonorExp.isExpired,
        remainingSeconds: myDonorExp.remainingSeconds,
        locationSharingExpired: myDonorExp.isExpired,
        donorShareLocation: donorResponse.donorShareLocation || false,
        trackingStatus: isRequestClosed ? 'stopped' : (myDonorExp.isExpired ? 'expired' : (donorResponse.trackingStatus || 'inactive')),
        isCoordinating: isCoord,
        currentLocation: canShare && (donorAddress || hasValidDonorCoords) ? {
          address: donorAddress,
          lat: donorLat,
          lng: donorLng,
          accuracy: donorResponse.currentLocation?.accuracy || null,
          lastUpdated: donorResponse.currentLocation?.lastUpdated || donorResponse.acceptedAt,
          isStale: checkStaleness(donorResponse.currentLocation?.lastUpdated)
        } : null
      };
    }

    // Overall expiration context for current caller
    let userExpiration = null;
    if (isHospital) {
      userExpiration = hospitalExp;
    } else if (isDonor) {
      userExpiration = myDonorExp;
    } else if (isRequester) {
      if (donorInfo) {
        userExpiration = {
          expiresAt: donorInfo.expiresAt,
          isExpired: donorInfo.isExpired,
          remainingSeconds: donorInfo.remainingSeconds
        };
      } else if (hospitalInfo) {
        userExpiration = hospitalExp;
      }
    }

    const trackingData = {
      requestId: request._id,
      status: request.status,
      bloodGroup: request.bloodGroup,
      unitsNeeded: request.unitsNeeded,
      urgency: request.urgency,
      myRole: isRequester ? 'recipient' : (isHospital ? 'hospital' : (isDonor ? 'donor' : 'admin')),
      isRequestClosed,
      requesterLocation,
      hospitalInfo,
      donorInfo,
      activeDonor: donorInfo,
      allDonors: allAcceptedDonors,
      allAcceptedDonors,
      allHospitals: allAcceptedHospitals,
      allAcceptedHospitals,
      fulfillmentChosen: Boolean(request.fulfillmentChosen),
      selectedResponseId: request.selectedResponseId || null,
      selectedResponderId: request.selectedResponderId || null,
      selectedResponderType: request.selectedResponderType || null,
      fulfillmentChosenAt: request.fulfillmentChosenAt || null,
      shareWithHospitals: request.location?.shareWithHospitals !== false,
      shareWithDonors: request.location?.shareWithDonors !== false,
      activeDonorId: request.activeDonorId || request.donorId || null,
      expiresAt: userExpiration?.expiresAt || null,
      isExpired: Boolean(userExpiration?.isExpired),
      remainingSeconds: userExpiration?.remainingSeconds !== undefined ? userExpiration.remainingSeconds : null,
      locationSharingExpired: Boolean(userExpiration?.isExpired)
    };

    res.json({
      success: true,
      tracking: trackingData,
      ...trackingData
    });
  } catch (error) {
    console.error('Get request tracking error:', error);
    res.status(500).json({ message: 'Server error retrieving request tracking' });
  }
};

const updateLocation = async (req, res) => {
  try {
    const { requestId } = req.params;
    let { lat, lng, accuracy, address } = req.body;
    const userId = req.user.id;

    let latNum = (lat !== undefined && lat !== null && lat !== '') ? parseFloat(lat) : null;
    let lngNum = (lng !== undefined && lng !== null && lng !== '') ? parseFloat(lng) : null;
    let accNum = (accuracy !== undefined && accuracy !== null && accuracy !== '') ? parseFloat(accuracy) : null;
    let addressStr = (address || '').trim();

    // If address is provided without valid coordinates, geocode the address
    if ((latNum === null || lngNum === null || isNaN(latNum) || isNaN(lngNum)) && addressStr) {
      try {
        const geo = await geocodeAddress(addressStr);
        if (geo && geo.lat && geo.lng) {
          latNum = geo.lat;
          lngNum = geo.lng;
        }
      } catch (err) {}
    }

    // If address is not provided in body, prioritize the user's verified registered profile address
    const userProfileAddress = (req.user?.location?.address || req.user?.address || '').trim();
    if (!addressStr && userProfileAddress) {
      addressStr = userProfileAddress;
    }

    // Only if coordinates are provided without any known profile address, reverse-geocode to get the readable address
    if (!addressStr && latNum !== null && lngNum !== null && !isNaN(latNum) && !isNaN(lngNum)) {
      try {
        const rev = await reverseGeocode(latNum, lngNum);
        if (rev && rev.address) {
          addressStr = rev.address;
        }
      } catch (err) {}
    }

    const hasValidCoords = latNum !== null && lngNum !== null && !isNaN(latNum) && !isNaN(lngNum) && latNum >= -90 && latNum <= 90 && lngNum >= -180 && lngNum <= 180;
    if (!hasValidCoords && !addressStr) {
      return res.status(400).json({ message: 'Valid address or coordinates are required for location update' });
    }

    const request = await Request.findById(requestId);
    if (!request) {
      return res.status(404).json({ message: 'Request not found' });
    }

    if (['completed', 'cancelled', 'rejected'].includes(request.status)) {
      return res.status(400).json({ message: 'Location sharing has ended because request is no longer active' });
    }

    const isRequester = request.requesterId.toString() === userId.toString();
    const donorResp = request.responses?.find(
      r => r.responderId.toString() === userId.toString() && r.response === 'accepted'
    );
    const isDonor = Boolean(donorResp);

    if (!isRequester && !isDonor) {
      return res.status(403).json({ message: 'You are not authorized to update location for this request' });
    }

    const updateTime = new Date();
    let payload = null;

    if (isRequester) {
      if (request.location.trackingStatus === 'stopped') {
        return res.status(400).json({ message: 'Location sharing is turned off for this request' });
      }

      // Check if all accepted responders have expired 24h windows
      const acceptedResponders = (request.responses || []).filter(r => r.response === 'accepted');
      const hasAcceptedHospital = Boolean(request.acceptedHospitalInfo?.acceptedAt);
      if (acceptedResponders.length > 0 || hasAcceptedHospital) {
        const allRespondersExpired = acceptedResponders.every(r => getResponderExpiration(r.acceptedAt || r.timestamp, r.locationSharingExpiresAt).isExpired) &&
          (!hasAcceptedHospital || getResponderExpiration(request.acceptedHospitalInfo.acceptedAt, request.acceptedHospitalInfo.locationSharingExpiresAt).isExpired);
        if (allRespondersExpired) {
          request.location.trackingStatus = 'expired';
          await request.save();
          return res.status(403).json({
            message: '24-hour location sharing window has expired for all responders on this request.',
            isExpired: true
          });
        }
      }

      if (addressStr) request.location.address = addressStr;
      if (hasValidCoords) {
        request.location.lat = latNum;
        request.location.lng = lngNum;
      }
      if (accNum !== null) request.location.accuracy = accNum;
      request.location.lastUpdated = updateTime;
      request.location.trackingStatus = 'active';

      payload = {
        requestId,
        participantId: userId,
        role: 'recipient',
        address: request.location.address,
        lat: request.location.lat,
        lng: request.location.lng,
        accuracy: accNum,
        lastUpdated: updateTime,
        isStale: false
      };
    } else if (isDonor) {
      const donorExp = getResponderExpiration(donorResp.acceptedAt || donorResp.timestamp, donorResp.locationSharingExpiresAt);
      if (donorExp.isExpired) {
        donorResp.trackingStatus = 'expired';
        donorResp.donorShareLocation = false;
        donorResp.currentLocation = { address: '', lat: null, lng: null, accuracy: null, lastUpdated: null };
        await request.save();

        if (global.io) {
          global.io.to(`request_${requestId}`).emit('locationSharingExpired', {
            requestId,
            userId,
            role: 'donor',
            message: '24-hour location sharing window has expired for this donor.'
          });
        }

        return res.status(403).json({
          message: '24-hour location sharing window has expired for this request. Location updates are no longer permitted.',
          isExpired: true,
          expiredAt: donorExp.expiresAt
        });
      }

      if (!donorResp.donorShareLocation || donorResp.trackingStatus === 'stopped') {
        return res.status(400).json({ message: 'Location sharing is disabled or turned off for your donor account' });
      }

      const finalAddress = (req.user?.location?.address || req.user?.address || donorResp.currentLocation?.address || addressStr || '').trim();
      donorResp.currentLocation = {
        address: finalAddress,
        lat: hasValidCoords ? latNum : (donorResp.currentLocation?.lat || null),
        lng: hasValidCoords ? lngNum : (donorResp.currentLocation?.lng || null),
        accuracy: accNum,
        lastUpdated: updateTime
      };
      donorResp.trackingStatus = 'active';

      payload = {
        requestId,
        participantId: userId,
        role: 'donor',
        address: finalAddress,
        lat: donorResp.currentLocation.lat,
        lng: donorResp.currentLocation.lng,
        accuracy: accNum,
        lastUpdated: updateTime,
        isStale: false,
        expiresAt: donorExp.expiresAt,
        remainingSeconds: donorExp.remainingSeconds
      };
    }

    await request.save();

    // Broadcast real-time location update to request tracking room
    if (global.io && payload) {
      global.io.to(`request_${requestId}`).emit('locationUpdate', payload);
    }

    res.json({ message: 'Location updated', data: payload });
  } catch (error) {
    console.error('Update location error:', error);
    res.status(500).json({ message: 'Server error updating location' });
  }
};

const updateLocationConsent = async (req, res) => {
  try {
    const { requestId } = req.params;
    const { shareWithHospitals, shareWithDonors, donorShareLocation, trackingStatus } = req.body;
    const userId = req.user.id;

    const request = await Request.findById(requestId);
    if (!request) {
      return res.status(404).json({ message: 'Request not found' });
    }

    const isRequester = request.requesterId.toString() === userId.toString();
    const donorResp = request.responses?.find(
      r => r.responderId.toString() === userId.toString() && r.response === 'accepted'
    );
    const isDonor = Boolean(donorResp);

    if (!isRequester && !isDonor) {
      return res.status(403).json({ message: 'Unauthorized' });
    }

    if (isRequester) {
      if (typeof shareWithHospitals === 'boolean') {
        request.location.shareWithHospitals = shareWithHospitals;
      }
      if (typeof shareWithDonors === 'boolean') {
        request.location.shareWithDonors = shareWithDonors;
      }
      if (trackingStatus && ['active', 'paused', 'stopped'].includes(trackingStatus)) {
        request.location.trackingStatus = trackingStatus;
      }
    } else if (isDonor) {
      const donorExp = getResponderExpiration(donorResp.acceptedAt || donorResp.timestamp, donorResp.locationSharingExpiresAt);
      if (donorExp.isExpired && (donorShareLocation === true || trackingStatus === 'active')) {
        return res.status(400).json({
          message: 'The 24-hour location sharing window for this request has ended and cannot be restarted automatically. A renewed authorization from the recipient is required.',
          code: 'SHARING_EXPIRED',
          isExpired: true
        });
      }

      if (typeof donorShareLocation === 'boolean') {
        donorResp.donorShareLocation = donorShareLocation;
        if (!donorShareLocation) {
          donorResp.trackingStatus = 'stopped';
          donorResp.currentLocation = { lat: null, lng: null, accuracy: null, lastUpdated: null };
        }
      }
      if (trackingStatus && ['active', 'paused', 'stopped'].includes(trackingStatus)) {
        donorResp.trackingStatus = trackingStatus;
      }
    }

    await request.save();

    if (global.io) {
      global.io.to(`request_${requestId}`).emit('trackingStatusChanged', {
        requestId,
        userId,
        role: isRequester ? 'recipient' : 'donor',
        trackingStatus: isRequester ? request.location.trackingStatus : donorResp.trackingStatus,
        shareLocation: isRequester ? (request.location.shareWithDonors && request.location.shareWithHospitals) : donorResp.donorShareLocation
      });
    }

    res.json({ message: 'Location sharing preferences updated', request });
  } catch (error) {
    console.error('Update location consent error:', error);
    res.status(500).json({ message: 'Server error updating consent' });
  }
};

const renewLocationSharing = async (req, res) => {
  try {
    const { requestId } = req.params;
    const { responderId } = req.body;
    const userId = req.user.id;

    const request = await Request.findById(requestId);
    if (!request) {
      return res.status(404).json({ message: 'Request not found' });
    }

    const isRequester = request.requesterId.toString() === userId.toString();
    const isAdmin = req.user.role === 'admin';
    if (!isRequester && !isAdmin) {
      return res.status(403).json({ message: 'Only the request recipient can authorize renewed location sharing.' });
    }

    if (['completed', 'cancelled', 'rejected'].includes(request.status)) {
      return res.status(400).json({ message: 'Cannot renew location sharing on a closed request.' });
    }

    const renewalTime = new Date();
    const newExpiresAt = new Date(renewalTime.getTime() + LOCATION_SHARING_DURATION_MS);
    let renewedTarget = null;

    if (responderId) {
      const dResp = request.responses?.find(
        r => r.responderId.toString() === responderId.toString() && r.response === 'accepted'
      );
      if (dResp) {
        dResp.acceptedAt = renewalTime;
        dResp.locationSharingExpiresAt = newExpiresAt;
        dResp.trackingStatus = 'active';
        dResp.donorShareLocation = true;
        renewedTarget = { id: responderId, type: 'donor' };
      }

      if (request.acceptedHospitalInfo?.hospitalId?.toString() === responderId.toString()) {
        request.acceptedHospitalInfo.acceptedAt = renewalTime;
        request.acceptedHospitalInfo.locationSharingExpiresAt = newExpiresAt;
        renewedTarget = { id: responderId, type: 'hospital' };
      }
    } else {
      if (request.activeDonorId) {
        const dResp = request.responses?.find(
          r => r.responderId.toString() === request.activeDonorId.toString() && r.response === 'accepted'
        );
        if (dResp) {
          dResp.acceptedAt = renewalTime;
          dResp.locationSharingExpiresAt = newExpiresAt;
          dResp.trackingStatus = 'active';
          dResp.donorShareLocation = true;
          renewedTarget = { id: request.activeDonorId, type: 'donor' };
        }
      }
      if (request.acceptedHospitalInfo?.hospitalId) {
        request.acceptedHospitalInfo.acceptedAt = renewalTime;
        request.acceptedHospitalInfo.locationSharingExpiresAt = newExpiresAt;
        renewedTarget = renewedTarget || { id: request.acceptedHospitalInfo.hospitalId, type: 'hospital' };
      }
    }

    if (!renewedTarget) {
      return res.status(404).json({ message: 'No accepted responder found to renew.' });
    }

    request.location.trackingStatus = 'active';
    request.location.lastUpdated = renewalTime;
    await request.save();

    try {
      await AuditLog.create({
        action: 'location_sharing_renewed',
        userId,
        requestId: request._id,
        details: `Explicit 24-hour location sharing renewed by recipient for ${renewedTarget.type} ${renewedTarget.id}. New expiry: ${newExpiresAt.toISOString()}`
      });
    } catch (e) {
      console.warn('AuditLog error on location renew:', e.message);
    }

    if (global.io) {
      global.io.to(`request_${requestId}`).emit('locationSharingRenewed', {
        requestId,
        renewedBy: userId,
        responderId: renewedTarget.id,
        responderType: renewedTarget.type,
        expiresAt: newExpiresAt,
        remainingSeconds: Math.floor(LOCATION_SHARING_DURATION_MS / 1000),
        message: 'A fresh 24-hour location sharing window has been authorized by the recipient.'
      });
    }

    res.json({
      success: true,
      message: 'Location sharing renewed for 24 hours with fresh authorization recorded.',
      expiresAt: newExpiresAt,
      remainingSeconds: Math.floor(LOCATION_SHARING_DURATION_MS / 1000),
      renewedTarget
    });
  } catch (error) {
    console.error('Renew location sharing error:', error);
    res.status(500).json({ message: 'Server error renewing location sharing' });
  }
};

const selectFulfillmentOption = async (req, res) => {
  try {
    const { requestId } = req.params;
    const { responderId, responseId, responderType } = req.body;
    const userId = req.user.id;

    const request = await Request.findById(requestId);
    if (!request) {
      return res.status(404).json({ message: 'Request not found' });
    }

    const isRequester = request.requesterId.toString() === userId.toString();
    const isAdmin = req.user.role === 'admin';
    if (!isRequester && !isAdmin) {
      return res.status(403).json({ message: 'Only the request creator can choose a fulfillment option' });
    }

    if (request.fulfillmentChosen) {
      return res.status(400).json({
        message: 'A fulfillment option has already been selected for this request. Additional choices are locked.'
      });
    }

    const isClosed = ['cancelled', 'completed', 'fulfilled', 'rejected'].includes(request.status);
    if (isClosed) {
      return res.status(400).json({ message: `Cannot select fulfillment for a ${request.status} request` });
    }

    // Find the chosen response
    const selectedResp = request.responses?.find(r => {
      if (responseId && r._id.toString() === responseId.toString()) return true;
      if (responderId && r.responderId.toString() === responderId.toString()) {
        if (responderType) return r.responderType === responderType && r.response === 'accepted';
        return r.response === 'accepted';
      }
      return false;
    });

    if (!selectedResp || selectedResp.response !== 'accepted') {
      return res.status(404).json({ message: 'The selected responder has not accepted this request' });
    }

    // 1. Mark selected response
    selectedResp.status = 'selected';
    selectedResp.selectedAt = new Date();

    // 2. Mark request fulfillment fields
    request.fulfillmentChosen = true;
    request.selectedResponseId = selectedResp._id;
    request.selectedResponderId = selectedResp.responderId;
    request.selectedResponderType = selectedResp.responderType;
    request.fulfillmentChosenAt = new Date();
    request.status = 'accepted';

    if (selectedResp.responderType === 'donor') {
      request.donorId = selectedResp.responderId;
      request.activeDonorId = selectedResp.responderId;
    } else if (selectedResp.responderType === 'hospital') {
      request.hospitalId = selectedResp.responderId;
      if (selectedResp.hospitalInfo?.hospitalName) {
        request.acceptedHospitalInfo = {
          hospitalId: selectedResp.responderId,
          hospitalName: selectedResp.hospitalInfo.hospitalName,
          address: selectedResp.hospitalInfo.address || '',
          lat: selectedResp.hospitalInfo.lat || null,
          lng: selectedResp.hospitalInfo.lng || null,
          phone: selectedResp.hospitalInfo.phone || '',
          acceptedAt: selectedResp.acceptedAt || new Date(),
          locationSharingExpiresAt: selectedResp.locationSharingExpiresAt,
          verified: true,
          isLiveLocation: false
        };
      }
      // Confirm inventory reservation as fulfilled
      try {
        await InventoryLog.create({
          hospitalId: selectedResp.responderId,
          bloodGroup: request.bloodGroup,
          operation: 'fulfilled_request',
          units: selectedResp.unitsReserved || request.unitsNeeded || 1,
          previousUnits: 0,
          newUnits: 0,
          reason: `Fulfillment confirmed by recipient for request #${request._id}`,
          performedBy: userId,
          relatedRequestId: request._id
        });
        await BloodInventory.findOneAndUpdate(
          { hospitalId: selectedResp.responderId, bloodGroup: request.bloodGroup, unitsReserved: { $gte: selectedResp.unitsReserved } },
          { $inc: { unitsReserved: -selectedResp.unitsReserved }, $set: { lastUpdated: new Date() } }
        );
      } catch (err) {
        console.error('Inventory fulfill log error:', err.message);
      }
    }

    // 3. Cancel and close all OTHER responses and safely release their inventory
    const otherResponses = request.responses.filter(
      r => r._id.toString() !== selectedResp._id.toString()
    );

    for (const other of otherResponses) {
      if (other.response === 'accepted') {
        other.status = 'cancelled';
        other.cancelledAt = new Date();
        other.cancelledReason = 'Recipient selected another fulfillment option';
        other.trackingStatus = 'stopped';

        // If this other response was a hospital with reserved inventory, release it safely!
        if (other.responderType === 'hospital' && other.inventoryDeducted && other.unitsReserved > 0) {
          try {
            await BloodInventory.findOneAndUpdate(
              {
                hospitalId: other.responderId,
                bloodGroup: request.bloodGroup,
                unitsReserved: { $gte: other.unitsReserved }
              },
              {
                $inc: { unitsAvailable: other.unitsReserved, unitsReserved: -other.unitsReserved },
                $set: { lastUpdated: new Date() }
              }
            );

            await InventoryLog.create({
              hospitalId: other.responderId,
              bloodGroup: request.bloodGroup,
              operation: 'released_reservation',
              units: other.unitsReserved,
              previousUnits: 0,
              newUnits: 0,
              reason: `Released reservation: recipient selected another fulfillment option for request #${request._id}`,
              performedBy: userId,
              relatedRequestId: request._id
            });

            other.unitsReserved = 0;
            other.inventoryDeducted = false;
          } catch (relErr) {
            console.error('Error releasing hospital inventory reservation:', relErr.message);
          }
        }
      }
    }

    await request.save();

    // 4. Real-time Socket.IO events
    if (global.io) {
      global.io.to(`request_${requestId}`).emit('fulfillmentSelected', {
        requestId,
        selectedResponderId: selectedResp.responderId,
        selectedResponderType: selectedResp.responderType,
        selectedResponseId: selectedResp._id
      });
      global.io.emit('adminUpdate', { type: 'request_updated', request });
    }

    // Notify selected responder
    await Notification.create({
      userId: selectedResp.responderId,
      title: 'Fulfillment Selected!',
      message: `The recipient has selected your ${selectedResp.responderType} response to fulfill blood request #${request._id}.`,
      type: 'request_accepted',
      relatedRequestId: request._id,
      priority: 'high'
    });

    // Notify other unselected responders
    for (const other of otherResponses) {
      if (other.response === 'accepted') {
        await Notification.create({
          userId: other.responderId,
          title: 'Request Assigned to Another Responder',
          message: `The recipient chose another fulfillment option for blood request #${request._id}. Any reserved stock has been released.`,
          type: 'request_rejected',
          relatedRequestId: request._id,
          priority: 'medium'
        });
      }
    }

    res.json({
      message: 'Fulfillment option selected successfully',
      request,
      activeDonorId: request.activeDonorId,
      selectedResponder: {
        id: selectedResp.responderId,
        type: selectedResp.responderType
      }
    });
  } catch (error) {
    console.error('Select fulfillment option error:', error);
    res.status(500).json({ message: 'Server error selecting fulfillment option' });
  }
};

const selectActiveDonor = async (req, res) => {
  req.body.responderId = req.body.donorId;
  req.body.responderType = 'donor';
  return selectFulfillmentOption(req, res);
};

const updateRequestStatus = async (req, res) => {
  try {
    const { requestId } = req.params;
    const { status } = req.body;
    const userId = req.user.id;

    const normalizedStatus = status === 'fulfilled' ? 'completed' : status;
    if (!['completed', 'cancelled'].includes(normalizedStatus)) {
      return res.status(400).json({ message: 'Status must be completed or cancelled' });
    }

    const request = await Request.findById(requestId);
    if (!request) {
      return res.status(404).json({ message: 'Request not found' });
    }

    const isRequester = request.requesterId.toString() === userId.toString();
    const isAdmin = req.user.role === 'admin';
    const isAcceptedHospital = request.acceptedHospitalInfo?.hospitalId?.toString() === userId.toString() ||
      request.hospitalId?.toString() === userId.toString();
    const isAcceptedDonor = request.donorId?.toString() === userId.toString() ||
      request.selectedResponderId?.toString() === userId.toString() ||
      request.responses?.some(r => r.responderId?.toString() === userId.toString() && r.responderRole === 'donor' && ['accepted', 'selected'].includes(r.responseStatus));

    if (!isRequester && !isAdmin && !isAcceptedHospital && !isAcceptedDonor) {
      return res.status(403).json({ message: 'You do not have permission to update this request status' });
    }

    request.status = normalizedStatus;
    if (normalizedStatus === 'completed') {
      request.completedAt = new Date();
      if (isAcceptedDonor) {
        request.donorId = userId;
        request.selectedResponderId = userId;
        request.selectedResponderType = 'donor';
        request.fulfillmentChosen = true;
        // Release any reserved hospital inventory if a donor fulfilled the request
        await releaseAllReservedInventory(request, 'Fulfilled by donor', userId);
      }
    }
    if (normalizedStatus === 'cancelled') {
      request.cancelledAt = new Date();
      // Safely release any unfulfilled hospital reservations
      await releaseAllReservedInventory(request, 'Request cancelled', userId);
    }

    // Immediately stop and revoke location sharing
    request.location.trackingStatus = 'stopped';
    if (request.responses) {
      request.responses.forEach(r => {
        r.trackingStatus = 'stopped';
        // Clear sensitive real-time moving coordinates
        if (r.currentLocation) {
          r.currentLocation.lat = null;
          r.currentLocation.lng = null;
        }
      });
    }

    await request.save();

    if (global.io) {
      global.io.to(`request_${requestId}`).emit('trackingStopped', {
        requestId,
        status: normalizedStatus,
        reason: `Request has been marked as ${normalizedStatus}`
      });
      global.io.emit('bloodRequestUpdate', {
        type: 'status_update',
        requestId,
        status: normalizedStatus,
        request
      });
      global.io.emit('adminUpdate', { type: 'request_updated', request });
    }

    res.json({ message: `Request successfully marked as ${normalizedStatus}`, request });
  } catch (error) {
    console.error('Update request status error:', error);
    res.status(500).json({ message: 'Server error updating request status' });
  }
};

module.exports = {
  createRequest,
  getMyRequests,
  getNearbyRequests,
  getDonorActiveDonation,
  respondToRequest,
  getRequestDetails,
  deleteRequest,
  getRequestTracking,
  updateLocation,
  updateLocationConsent,
  renewLocationSharing,
  selectActiveDonor,
  selectFulfillmentOption,
  updateRequestStatus
};
