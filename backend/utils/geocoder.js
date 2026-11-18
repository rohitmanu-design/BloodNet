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
 * Sanitize address strings for Google Maps routing.
 * Strips corrupted or concatenated landmark tokens and extracts clean city/district/pincode.
 * @param {string} addr
 * @returns {string}
 */
function cleanAddressForMaps(addr) {
  if (!addr || typeof addr !== 'string') return '';
  const trimmed = addr.trim();

  // If already clean (no all-caps tokens > 5 chars, no ultra-long tokens > 22 chars), return trimmed
  const hasNoisyTokens = /\b[A-Z]{6,}\b/.test(trimmed) || trimmed.split(/[\s,]+/).some(t => t.length > 22);
  if (!hasNoisyTokens) {
    return trimmed;
  }

  // Address has noisy/corrupted tokens. Clean it using trailing postal segments.
  const parts = trimmed.split(',').map(p => p.trim()).filter(Boolean);
  if (parts.length >= 2) {
    const pinPartIdx = parts.findIndex(p => /\b\d{6}\b/.test(p));
    if (pinPartIdx !== -1) {
      const startIdx = Math.max(0, pinPartIdx - 2);
      const cleanParts = parts.slice(startIdx, pinPartIdx + 1)
        .filter(p => !/[A-Z]{6,}/.test(p) && p.length < 35);
      if (cleanParts.length >= 2) {
        return cleanParts.join(', ');
      }
    }
  }

  return trimmed
    .split(/[\s,]+/)
    .filter(token => token.length < 18 && !/[A-Z]{6,}/.test(token))
    .join(' ')
    .trim();
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
  let data = await fetchJson(url);

  if (Array.isArray(data) && data.length > 0 && data[0].lat && data[0].lon) {
    const result = {
      lat: parseFloat(data[0].lat),
      lng: parseFloat(data[0].lon),
      displayName: data[0].display_name
    };
    geocodeCache.set(cacheKey, result);
    return result;
  }

  // Fallback: If address has corrupted/noisy tokens, sanitize and retry
  const sanitized = cleanAddressForMaps(clean);
  if (sanitized && sanitized !== clean) {
    const fallbackUrl = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(sanitized)}&format=json&limit=1`;
    data = await fetchJson(fallbackUrl);
    if (Array.isArray(data) && data.length > 0 && data[0].lat && data[0].lon) {
      const result = {
        lat: parseFloat(data[0].lat),
        lng: parseFloat(data[0].lon),
        displayName: data[0].display_name
      };
      geocodeCache.set(cacheKey, result);
      return result;
    }
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
  reverseGeocode,
  cleanAddressForMaps
};
