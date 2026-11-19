const express = require('express');
const { body } = require('express-validator');
const { auth, authorize, requireVerifiedContact } = require('../middleware/auth');
const {
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
} = require('../controllers/requestController');

const router = express.Router();

const createRequestValidation = [
  body('bloodGroup').isIn(['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-']).withMessage('Invalid blood group'),
  body('location.lat').optional().isFloat({ min: -90, max: 90 }).withMessage('Invalid latitude'),
  body('location.lng').optional().isFloat({ min: -180, max: 180 }).withMessage('Invalid longitude'),
  body('location.address').notEmpty().withMessage('Address is required'),
  body('urgency').isIn(['normal', 'urgent', 'emergency', 'critical', 'routine']).withMessage('Invalid urgency level'),
  body('unitsNeeded').isInt({ min: 1, max: 10 }).withMessage('Units needed must be between 1 and 10'),
  body('notes').optional().isLength({ max: 500 }).withMessage('Message too long'),
];

const respondValidation = [
  body('response').isIn(['accepted', 'rejected']).withMessage('Response must be accepted or rejected'),
  body('message').optional().isLength({ max: 500 }).withMessage('Message too long'),
  body('shareLocation').optional().isBoolean().withMessage('shareLocation must be boolean'),
];

const locationUpdateValidation = [
  body('lat').isFloat({ min: -90, max: 90 }).withMessage('Valid latitude required (-90 to 90)'),
  body('lng').isFloat({ min: -180, max: 180 }).withMessage('Valid longitude required (-180 to 180)'),
  body('accuracy').optional().isFloat({ min: 0 }).withMessage('Accuracy must be positive'),
];

router.post('/', auth, requireVerifiedContact, authorize('recipient', 'hospital'), createRequestValidation, createRequest);
router.post('/create', auth, requireVerifiedContact, authorize('recipient', 'hospital'), createRequestValidation, createRequest);

router.get('/my', auth, authorize('recipient'), getMyRequests);
router.get('/nearby', auth, authorize('donor', 'hospital'), getNearbyRequests);
router.get('/donor/active', auth, authorize('donor'), getDonorActiveDonation);

// Secure Real-Time Tracking & Consent Endpoints
router.get('/:requestId/tracking', auth, getRequestTracking);
router.post('/:requestId/location-update', auth, locationUpdateValidation, updateLocation);
router.put('/:requestId/location-consent', auth, updateLocationConsent);
router.put('/:requestId/renew-location-sharing', auth, renewLocationSharing);
router.put('/:requestId/select-donor', auth, selectActiveDonor);
router.put('/:requestId/select-fulfillment', auth, selectFulfillmentOption);
router.put('/:requestId/status', auth, updateRequestStatus);

router.put('/:requestId/respond', auth, requireVerifiedContact, authorize('donor', 'hospital'), respondValidation, respondToRequest);

router.get('/:requestId', auth, getRequestDetails);

router.delete('/:requestId', auth, authorize('recipient'), deleteRequest);

module.exports = router;
