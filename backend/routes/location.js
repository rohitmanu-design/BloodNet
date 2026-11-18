const express = require('express');
const router = express.Router();
const { geocodeAddress, reverseGeocode } = require('../utils/geocoder');

// GET /api/location/geocode?address=...
router.get('/geocode', async (req, res) => {
  try {
    const { address } = req.query;
    if (!address) {
      return res.status(400).json({ error: 'Address query parameter is required' });
    }
    const result = await geocodeAddress(address);
    if (!result) {
      return res.status(404).json({ error: 'Location coordinates not found for this address' });
    }
    res.json({ success: true, ...result });
  } catch (error) {
    console.error('Geocode route error:', error);
    res.status(500).json({ error: 'Failed to geocode address' });
  }
});

// GET /api/location/reverse?lat=...&lng=...
router.get('/reverse', async (req, res) => {
  try {
    const { lat, lng } = req.query;
    if (!lat || !lng) {
      return res.status(400).json({ error: 'Latitude and Longitude are required' });
    }
    const result = await reverseGeocode(lat, lng);
    if (!result) {
      return res.status(404).json({ error: 'Address not found for coordinates' });
    }
    res.json({ success: true, ...result });
  } catch (error) {
    console.error('Reverse geocode route error:', error);
    res.status(500).json({ error: 'Failed to reverse geocode' });
  }
});

module.exports = router;
