const https = require('https');

// In-memory cache to prevent redundant external queries
const geocodeCache = new Map();
const reverseCache = new Map();

function fetchJson(url) {
  return new Promise((resolve) => {
    const req = https.get(
      url,
      {
        headers: {
          'User-Agent': 'BloodNet-App/1.0 (https://bloodnet.onrender.com; contact@bloodnet.org)'
        },
        timeout: 4000
      },
      (res) => {
        if (res.statusCode < 200 || res.statusCode >= 300) {
          return resolve(null);
        }
        let data = '';
        res.on('data', (chunk) => { data += chunk; });
        res.on('end', () => {
          try {
            resolve(JSON.parse(data));
          } catch (e) {
            resolve(null);
          }
        });
      }
    );
    req.on('error', () => resolve(null));
    req.on('timeout', () => {
      req.destroy();
      resolve(null);
    });
  });
}

/**
 * Geocode an address to latitude and longitude
 * @param {string} address - Freeform address string
 * @returns {Promise<{lat: number, lng: number, displayName: string}|null>}
 */
async function geocodeAddress(address) {
  if (!address || typeof address !== 'string' || !address.trim()) {
    return null;
  }

  const clean = address.trim();
  const cacheKey = clean.toLowerCase();
  if (geocodeCache.has(cacheKey)) {
    return geocodeCache.get(cacheKey);
  }

  const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(clean)}&format=json&limit=1`;
  const data = await fetchJson(url);

  if (Array.isArray(data) && data.length > 0 && data[0].lat && data[0].lon) {
    const result = {
      lat: parseFloat(data[0].lat),
      lng: parseFloat(data[0].lon),
      displayName: data[0].display_name
    };
    geocodeCache.set(cacheKey, result);
    return result;
  }

  return null;
}

/**
 * Reverse geocode latitude and longitude to a human-readable address
 * @param {number} lat
 * @param {number} lng
 * @returns {Promise<{address: string, displayName: string}|null>}
 */
async function reverseGeocode(lat, lng) {
  const nLat = parseFloat(lat);
  const nLng = parseFloat(lng);
  if (isNaN(nLat) || isNaN(nLng) || (nLat === 0 && nLng === 0)) {
    return null;
  }

  const cacheKey = `${nLat.toFixed(4)},${nLng.toFixed(4)}`;
  if (reverseCache.has(cacheKey)) {
    return reverseCache.get(cacheKey);
  }

  const url = `https://nominatim.openstreetmap.org/reverse?lat=${nLat}&lon=${nLng}&format=json`;
  const data = await fetchJson(url);

  if (data && data.display_name) {
    const result = {
      address: data.display_name,
      displayName: data.display_name,
      details: data.address || {}
    };
    reverseCache.set(cacheKey, result);
    return result;
  }

  return null;
}

module.exports = {
  geocodeAddress,
  reverseGeocode
};
