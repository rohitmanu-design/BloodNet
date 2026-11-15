/**
 * Production Email Delivery Service
 * Supports:
 * 1. Resend REST API (HTTPS port 443 - recommended for Render Free tier where SMTP ports are blocked)
 * 2. Brevo REST API (HTTPS port 443)
 * 3. SMTP via Nodemailer (Port 465 SSL or 587 STARTTLS - works locally or on cloud instances with open SMTP)
 *
 * Strictly verifies provider configuration before attempting delivery.
 * Never logs OTPs, passwords, or tokens.
 */

const path = require('path');
const fs = require('fs');
const https = require('https');
const dotenv = require('dotenv');

// Ensure environment variables are loaded
dotenv.config();
const envPath = path.join(__dirname, '..', '.env');
if (fs.existsSync(envPath)) {
  dotenv.config({ path: envPath });
}

const sendViaHttps = (url, headers, bodyData) => {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    const postData = JSON.stringify(bodyData);
    const req = https.request(
      {
        hostname: urlObj.hostname,
        port: 443,
        path: urlObj.pathname,
        method: 'POST',
        headers: {
          ...headers,
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(postData)
        },
        timeout: 10000
      },
      (res) => {
        let data = '';
        res.on('data', (chunk) => (data += chunk));
        res.on('end', () => {
          if (res.statusCode >= 200 && res.statusCode < 300) {
            resolve({ statusCode: res.statusCode, data });
          } else {
            reject(new Error(`HTTP ${res.statusCode}: ${data}`));
          }
        });
      }
    );
    req.on('error', reject);
    req.on('timeout', () => {
      req.destroy();
      reject(new Error('HTTPS request timed out'));
    });
    req.write(postData);
    req.end();
  });
};

const getEmailConfigStatus = () => {
  const resendApiKey = process.env.RESEND_API_KEY;
  const brevoApiKey = process.env.BREVO_API_KEY;

  const host = process.env.SMTP_HOST || process.env.EMAIL_HOST || 'smtp.gmail.com';
  const user = process.env.SMTP_USER || process.env.EMAIL_USER;
  const pass = process.env.SMTP_PASS || process.env.EMAIL_PASS;
  const rawPort = process.env.SMTP_PORT || process.env.EMAIL_PORT;
  const port = rawPort ? parseInt(rawPort, 10) : 465;
  const secure = process.env.SMTP_SECURE !== undefined
    ? process.env.SMTP_SECURE === 'true'
    : (process.env.EMAIL_SECURE !== undefined ? process.env.EMAIL_SECURE === 'true' : port === 465);

  const hasHttpProvider = Boolean(resendApiKey || brevoApiKey);
  const hasSmtpProvider = Boolean(host && user && pass);

  const missingVariables = [];
  if (!hasHttpProvider && !hasSmtpProvider) {
    missingVariables.push('SMTP_USER / SMTP_PASS (or RESEND_API_KEY for cloud port-443 delivery)');
  }

  return {
    isConfigured: hasHttpProvider || hasSmtpProvider,
    provider: resendApiKey ? 'resend' : brevoApiKey ? 'brevo' : 'smtp',
    missingVariables,
    host,
    user,
    pass,
    port,
    secure,
    resendApiKey,
    brevoApiKey,
    from: process.env.EMAIL_FROM || '"BloodNet+ Security" <noreply@bloodnet.org>'
  };
};

/**
 * Sends a 4-digit verification code via Email to the specified recipient.
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

  const subject = `BloodNet+ Verification Code: ${otpCode}`;
  const text = `Your BloodNet+ verification code is ${otpCode}.\n\nThis 4-digit code is valid for 5 minutes. Please enter this code in the registration verification screen to confirm your email address.\n\nDo not share this code with anyone.`;
  const html = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 540px; margin: 0 auto; padding: 28px; border: 1px solid #fee2e2; border-radius: 16px; background-color: #ffffff;">
      <div style="text-align: center; margin-bottom: 24px;">
        <h1 style="color: #dc2626; margin: 0; font-size: 24px; font-weight: 800;">BloodNet+</h1>
        <p style="color: #6b7280; font-size: 13px; margin-top: 4px;">Email Verification</p>
      </div>
      <p style="color: #1f2937; font-size: 15px; line-height: 1.5;">Hello,</p>
      <p style="color: #4b5563; font-size: 14px; line-height: 1.6;">
        Please use the 4-digit verification code below to verify your email address and complete your registration for BloodNet+:
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
  `;

  // 1. Prioritize HTTP REST APIs (works on Render free tier over HTTPS port 443)
  if (config.provider === 'resend') {
    try {
      const from = process.env.EMAIL_FROM || 'BloodNet+ <onboarding@resend.dev>';
      const res = await sendViaHttps(
        'https://api.resend.com/emails',
        { Authorization: `Bearer ${config.resendApiKey}` },
        { from, to: [toEmail], subject, html, text }
      );
      return { delivered: true, configured: true, messageId: res.data };
    } catch (err) {
      return { delivered: false, configured: true, error: `Resend API error: ${err.message}` };
    }
  }

  if (config.provider === 'brevo') {
    try {
      const senderEmail = config.user || 'rohitsanas295@gmail.com';
      const res = await sendViaHttps(
        'https://api.brevo.com/v3/smtp/email',
        { 'api-key': config.brevoApiKey },
        {
          sender: { name: 'BloodNet+', email: senderEmail },
          to: [{ email: toEmail }],
          subject,
          htmlContent: html,
          textContent: text
        }
      );
      return { delivered: true, configured: true, messageId: res.data };
    } catch (err) {
      return { delivered: false, configured: true, error: `Brevo API error: ${err.message}` };
    }
  }

  // 2. Fall back to SMTP via Nodemailer (Port 465 SSL or 587 STARTTLS)
  try {
    const nodemailer = require('nodemailer');
    const transporter = nodemailer.createTransport({
      host: config.host,
      port: config.port,
      secure: config.secure,
      auth: {
        user: config.user,
        pass: config.pass
      },
      connectionTimeout: 8000,
      greetingTimeout: 8000,
      socketTimeout: 10000
    });

    const info = await transporter.sendMail({
      from: config.from,
      to: toEmail,
      subject,
      text,
      html
    });

    return {
      delivered: true,
      configured: true,
      messageId: info.messageId
    };
  } catch (error) {
    const msg = error.message || '';
    if (msg.includes('timeout') || msg.includes('ETIMEDOUT') || msg.includes('ECONNREFUSED')) {
      return {
        delivered: false,
        configured: true,
        error: `SMTP connection timed out. If hosted on a cloud free tier (such as Render Free Tier) which blocks outbound SMTP ports 465/587, configure RESEND_API_KEY or BREVO_API_KEY to deliver emails over HTTPS (port 443).`
      };
    }
    return {
      delivered: false,
      configured: true,
      error: `Email provider transmission failed: ${msg}`
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

  const subject = 'BloodNet+ Password Reset Request';
  const text = `You requested a password reset for your BloodNet+ account.\n\nPlease reset your password using the following link:\n${resetUrl}\n\nThis link is valid for 1 hour. If you did not request this, please ignore this email.`;
  const html = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 540px; margin: 0 auto; padding: 28px; border: 1px solid #fee2e2; border-radius: 16px; background-color: #ffffff;">
      <div style="text-align: center; margin-bottom: 24px;">
        <h1 style="color: #dc2626; margin: 0; font-size: 24px; font-weight: 800;">BloodNet+</h1>
        <p style="color: #6b7280; font-size: 13px; margin-top: 4px;">Security & Account Recovery</p>
      </div>
      <p style="color: #1f2937; font-size: 15px; line-height: 1.5;">Hello,</p>
      <p style="color: #4b5563; font-size: 14px; line-height: 1.6;">
        We received a request to reset the password for your BloodNet+ account. Click the button below to choose a new password:
      </p>
      <div style="text-align: center; margin: 28px 0;">
        <a href="${resetUrl}" style="display: inline-block; background-color: #dc2626; color: #ffffff; text-decoration: none; font-weight: 700; font-size: 15px; padding: 12px 28px; border-radius: 10px; box-shadow: 0 4px 6px -1px rgba(220, 38, 38, 0.2);">
          Reset Password
        </a>
      </div>
      <p style="color: #6b7280; font-size: 12px; line-height: 1.5; margin-bottom: 0;">
        This link will expire in <strong>1 hour</strong>. If you did not request a password reset, you can safely ignore this email.
      </p>
    </div>
  `;

  if (config.provider === 'resend') {
    try {
      const from = process.env.EMAIL_FROM || 'BloodNet+ <onboarding@resend.dev>';
      const res = await sendViaHttps(
        'https://api.resend.com/emails',
        { Authorization: `Bearer ${config.resendApiKey}` },
        { from, to: [toEmail], subject, html, text }
      );
      return { delivered: true, configured: true, messageId: res.data };
    } catch (err) {
      return { delivered: false, configured: true, error: `Resend API error: ${err.message}` };
    }
  }

  if (config.provider === 'brevo') {
    try {
      const senderEmail = config.user || 'rohitsanas295@gmail.com';
      const res = await sendViaHttps(
        'https://api.brevo.com/v3/smtp/email',
        { 'api-key': config.brevoApiKey },
        {
          sender: { name: 'BloodNet+', email: senderEmail },
          to: [{ email: toEmail }],
          subject,
          htmlContent: html,
          textContent: text
        }
      );
      return { delivered: true, configured: true, messageId: res.data };
    } catch (err) {
      return { delivered: false, configured: true, error: `Brevo API error: ${err.message}` };
    }
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
      },
      connectionTimeout: 8000,
      greetingTimeout: 8000,
      socketTimeout: 10000
    });

    const info = await transporter.sendMail({
      from: config.from,
      to: toEmail,
      subject,
      text,
      html
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

module.exports = {
  getEmailConfigStatus,
  sendVerificationEmail,
  sendPasswordResetEmail
};
