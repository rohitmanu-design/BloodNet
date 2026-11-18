/**
 * Sanitize address strings for Google Maps routing.
 * Strips noisy, corrupted or concatenated landmark tokens and extracts clean city/district/pincode.
 * @param {string} addr
 * @returns {string}
 */
export function cleanAddressForMaps(addr) {
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
 * Builds a reliable Google Maps directions URL.
 * Prioritizes numerical coordinates (lat, lng) for 100% routing success,
 * and falls back to a sanitized address query if coordinates are missing.
 * @param {number|string|null} lat
 * @param {number|string|null} lng
 * @param {string} [fallbackAddress]
 * @returns {string|null}
 */
export function buildDirectionsUrl(lat, lng, fallbackAddress) {
  const nLat = parseFloat(lat);
  const nLng = parseFloat(lng);
  if (!isNaN(nLat) && !isNaN(nLng) && (nLat !== 0 || nLng !== 0)) {
    return `https://www.google.com/maps/dir/?api=1&destination=${nLat},${nLng}`;
  }
  if (fallbackAddress && typeof fallbackAddress === 'string') {
    const clean = cleanAddressForMaps(fallbackAddress);
    if (clean) {
      return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(clean)}`;
    }
  }
  return null;
}
