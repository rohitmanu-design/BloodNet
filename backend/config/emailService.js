/**
 * Production Email Delivery Service (SMTP via Nodemailer)
 * Strictly verifies provider configuration before attempting delivery.
 * Never logs OTPs, passwords, or tokens.
 */

const getEmailConfigStatus = () => {
  const host = process.env.SMTP_HOST || process.env.EMAIL_HOST;
  const user = process.env.SMTP_USER || process.env.EMAIL_USER;
  const pass = process.env.SMTP_PASS || process.env.EMAIL_PASS;
  const port = parseInt(process.env.SMTP_PORT || process.env.EMAIL_PORT, 10) || 587;
  const secure = (process.env.SMTP_SECURE || process.env.EMAIL_SECURE) === 'true';

  const missingVariables = [];
  if (!host) missingVariables.push('SMTP_HOST (or EMAIL_HOST)');
  if (!user) missingVariables.push('SMTP_USER (or EMAIL_USER)');
  if (!pass) missingVariables.push('SMTP_PASS (or EMAIL_PASS)');

  return {
    isConfigured: missingVariables.length === 0,
    missingVariables,
    host,
    user,
    pass,
    port,
    secure,
    from: process.env.EMAIL_FROM || '"BloodNet+ Security" <noreply@bloodnet.org>'
  };
};

/**
 * Sends a 4-digit verification code via Email to the specified recipient.
 * @param {string} toEmail - Recipient email address
 * @param {string} otpCode - The 4-digit numeric code
 * @returns {Promise<{ delivered: boolean, configured: boolean, messageId?: string, error?: string, missingVariables?: string[] }>}
 */
const sendVerificationEmail = async ({ toEmail, otpCode }) => {
  const config = getEmailConfigStatus();

  if (!config.isConfigured) {
    return {
      delivered: false,
      configured: false,
      error: `Email provider is not configured. Missing required server environment variable(s): ${config.missingVariables.join(', ')}`,
      missingVariables: config.missingVariables
    };
  }

  try {
    const nodemailer = require('nodemailer');
    const transporter = nodemailer.createTransport({
      host: config.host,
      port: config.port,
      secure: config.secure,
      auth: {
        user: config.user,
        pass: config.pass
      }
    });

    const info = await transporter.sendMail({
      from: config.from,
      to: toEmail,
      subject: `BloodNet+ Verification Code: ${otpCode}`,
      text: `Your BloodNet+ verification code is ${otpCode}.\n\nThis 4-digit code is valid for 5 minutes. Please enter this code in the registration verification screen to confirm your email address.\n\nDo not share this code with anyone.`,
      html: `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 540px; margin: 0 auto; padding: 28px; border: 1px solid #fee2e2; border-radius: 16px; background-color: #ffffff;">
          <div style="text-align: center; margin-bottom: 24px;">
            <h1 style="color: #dc2626; margin: 0; font-size: 24px; font-weight: 800;">BloodNet+</h1>
            <p style="color: #6b7280; font-size: 13px; margin-top: 4px;">Contact Verification</p>
          </div>
          <p style="color: #1f2937; font-size: 15px; line-height: 1.5;">Hello,</p>
          <p style="color: #4b5563; font-size: 14px; line-height: 1.6;">
            Please use the 4-digit verification code below to verify your email address for your BloodNet+ account:
          </p>
          <div style="text-align: center; margin: 28px 0;">
            <span style="display: inline-block; font-size: 32px; font-weight: 800; letter-spacing: 10px; color: #dc2626; background: #fef2f2; padding: 14px 28px; border-radius: 12px; border: 1px solid #fecaca;">
              ${otpCode}
            </span>
          </div>
          <p style="color: #6b7280; font-size: 12px; line-height: 1.5; margin-bottom: 0;">
            This code will expire in <strong>5 minutes</strong>. If you did not create an account on BloodNet+, you can safely ignore this message.
          </p>
        </div>
      `
    });

    return {
      delivered: true,
      configured: true,
      messageId: info.messageId
    };
  } catch (error) {
    return {
      delivered: false,
      configured: true,
      error: `Email provider transmission failed: ${error.message || 'Unknown provider error'}`
    };
  }
};

/**
 * Sends a password reset link to the specified recipient.
 */
const sendPasswordResetEmail = async ({ toEmail, resetToken, resetUrl }) => {
  const config = getEmailConfigStatus();

  if (!config.isConfigured) {
    return {
      delivered: false,
      configured: false,
      error: `Email provider is not configured. Missing required server environment variable(s): ${config.missingVariables.join(', ')}`,
      missingVariables: config.missingVariables
    };
  }

  try {
    const nodemailer = require('nodemailer');
    const transporter = nodemailer.createTransport({
      host: config.host,
      port: config.port,
      secure: config.secure,
      auth: {
        user: config.user,
        pass: config.pass
      }
    });

    const info = await transporter.sendMail({
      from: config.from,
      to: toEmail,
      subject: 'BloodNet+ Password Reset Request',
      text: `You have requested to reset your password for BloodNet+.\n\nPlease click the link below to set a new password:\n${resetUrl}\n\nIf you did not request this, please ignore this email. Your password will remain unchanged. This link expires in 1 hour.`,
      html: `
        <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #fee2e2; border-radius: 12px;">
          <h2 style="color: #dc2626;">BloodNet+ Password Reset</h2>
          <p>We received a request to reset your password. Click the button below to choose a new password:</p>
          <p style="margin: 24px 0;">
            <a href="${resetUrl}" style="background-color: #dc2626; color: #ffffff; padding: 12px 24px; text-decoration: none; border-radius: 8px; font-weight: bold; display: inline-block;">Reset Password</a>
          </p>
          <p style="color: #6b7280; font-size: 14px;">This link is valid for 1 hour. If you did not make this request, you can safely ignore this message.</p>
        </div>
      `
    });

    return { delivered: true, configured: true, messageId: info.messageId };
  } catch (error) {
    return { delivered: false, configured: true, error: error.message };
  }
};

module.exports = {
  getEmailConfigStatus,
  sendVerificationEmail,
  sendPasswordResetEmail
};
