/**
 * Phone and Contact Normalization Utilities
 */

/**
 * Normalizes phone number into E.164 international format where practical.
 * @param {string} rawPhone - Raw phone string (e.g. "+91 98765 43210" or "9876543210")
 * @param {string} defaultCountryCode - Optional fallback country code (e.g. "+91")
 * @returns {string} E.164 normalized phone number
 */
const normalizePhoneNumber = (rawPhone, defaultCountryCode = '+91') => {
  if (!rawPhone || typeof rawPhone !== 'string') return '';

  const trimmed = rawPhone.trim();
  const digitsOnly = trimmed.replace(/\D/g, '');

  // If already starts with '+'
  if (trimmed.startsWith('+')) {
    return `+${digitsOnly}`;
  }

  const cleanCountryCode = defaultCountryCode.replace(/\D/g, '');

  // If starts with country code without +
  if (cleanCountryCode && digitsOnly.startsWith(cleanCountryCode) && digitsOnly.length > cleanCountryCode.length) {
    return `+${digitsOnly}`;
  }

  // Strip leading 0 if present (common local trunk prefix)
  const strippedDigits = digitsOnly.startsWith('0') ? digitsOnly.slice(1) : digitsOnly;
  return `+${cleanCountryCode}${strippedDigits}`;
};

/**
 * Validates E.164 international phone number format.
 * Must start with + and have 8 to 15 digits.
 */
const isValidInternationalPhone = (phone) => {
  if (!phone || typeof phone !== 'string') return false;
  return /^\+[1-9]\d{7,14}$/.test(phone);
};

/**
 * Safely masks a phone number for user interface display without exposing full digits.
 * Example: "+919876543210" -> "+91 ******3210"
 */
const maskPhoneNumber = (phone) => {
  if (!phone || typeof phone !== 'string') return '';
  const clean = phone.trim();
  if (clean.length <= 5) return clean;
  const start = clean.slice(0, 3);
  const end = clean.slice(-4);
  return `${start} ******${end}`;
};

/**
 * Safely masks an email address for display.
 * Example: "john.doe@example.com" -> "j***e@example.com"
 */
const maskEmail = (email) => {
  if (!email || typeof email !== 'string') return '';
  const [localPart, domain] = email.split('@');
  if (!domain) return email;
  if (localPart.length <= 2) {
    return `${localPart[0]}*@${domain}`;
  }
  const first = localPart[0];
  const last = localPart[localPart.length - 1];
  return `${first}***${last}@${domain}`;
};

module.exports = {
  normalizePhoneNumber,
  isValidInternationalPhone,
  maskPhoneNumber,
  maskEmail
};
