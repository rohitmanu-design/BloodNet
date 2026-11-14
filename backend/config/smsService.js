/**
 * Production SMS Delivery Service (Twilio)
 * Strictly verifies provider configuration before attempting delivery.
 * Never logs OTPs, passwords, or secrets.
 */

const getSmsConfigStatus = () => {
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  const fromNumber = process.env.TWILIO_PHONE_NUMBER || process.env.TWILIO_MESSAGING_SERVICE_SID;

  const missingVariables = [];
  if (!accountSid) missingVariables.push('TWILIO_ACCOUNT_SID');
  if (!authToken) missingVariables.push('TWILIO_AUTH_TOKEN');
  if (!fromNumber) missingVariables.push('TWILIO_PHONE_NUMBER (or TWILIO_MESSAGING_SERVICE_SID)');

  return {
    isConfigured: missingVariables.length === 0,
    missingVariables,
    accountSid,
    authToken,
    fromNumber
  };
};

/**
 * Sends a 4-digit verification code via SMS to the specified recipient phone number.
 * @param {string} toPhone - Recipient phone in E.164 format
 * @param {string} otpCode - The 4-digit numeric code
 * @returns {Promise<{ delivered: boolean, configured: boolean, messageId?: string, error?: string, missingVariables?: string[] }>}
 */
const sendVerificationSms = async ({ toPhone, otpCode }) => {
  const config = getSmsConfigStatus();

  if (!config.isConfigured) {
    return {
      delivered: false,
      configured: false,
      error: `SMS provider is not configured. Missing required server environment variable(s): ${config.missingVariables.join(', ')}`,
      missingVariables: config.missingVariables
    };
  }

  try {
    const twilio = require('twilio');
    const client = twilio(config.accountSid, config.authToken);

    const messagePayload = {
      to: toPhone,
      body: `Your BloodNet+ verification code is ${otpCode}. Valid for 5 minutes. Never share this code with anyone.`
    };

    if (process.env.TWILIO_MESSAGING_SERVICE_SID) {
      messagePayload.messagingServiceSid = process.env.TWILIO_MESSAGING_SERVICE_SID;
    } else {
      messagePayload.from = config.fromNumber;
    }

    const message = await client.messages.create(messagePayload);

    return {
      delivered: true,
      configured: true,
      messageId: message.sid
    };
  } catch (error) {
    return {
      delivered: false,
      configured: true,
      error: `SMS provider transmission failed: ${error.message || 'Unknown provider error'}`
    };
  }
};

module.exports = {
  getSmsConfigStatus,
  sendVerificationSms
};
