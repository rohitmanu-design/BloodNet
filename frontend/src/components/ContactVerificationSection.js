import React, { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { authAPI } from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import {
  EnvelopeIcon,
  CheckCircleIcon,
  ExclamationCircleIcon,
  ExclamationTriangleIcon,
  ArrowPathIcon,
  ArrowRightIcon,
  ShieldCheckIcon
} from '@heroicons/react/24/solid';
import Button from './ui/Button';
import Card from './ui/Card';

const RESEND_COOLDOWN_SECONDS = 60;

const ContactVerificationSection = ({
  initialEmail = '',
  initialPhone = '',
  userRole = 'recipient',
  onFullyVerified = null
}) => {
  const { updateUser, user } = useAuth();
  const navigate = useNavigate();

  // Verification status
  const [emailVerified, setEmailVerified] = useState(Boolean(user?.emailVerified));
  const [maskedEmail, setMaskedEmail] = useState(initialEmail || user?.email || '');

  // OTP inputs
  const [emailOtp, setEmailOtp] = useState('');

  // Loading states
  const [emailSending, setEmailSending] = useState(false);
  const [emailVerifying, setEmailVerifying] = useState(false);

  // Cooldown countdown timers (seconds)
  const [emailCooldown, setEmailCooldown] = useState(0);

  // Feedback states
  const [emailError, setEmailError] = useState('');
  const [emailSetupError, setEmailSetupError] = useState(null);
  const [emailSuccess, setEmailSuccess] = useState('');

  // Initial load ref
  const hasTriggeredInitialSend = useRef(false);

  // Load status from backend
  const fetchStatus = async () => {
    try {
      const res = await authAPI.getVerificationStatus();
      if (res.data) {
        const isVerified = Boolean(res.data.emailVerified);
        setEmailVerified(isVerified);
        setMaskedEmail(res.data.maskedEmail || res.data.email || initialEmail || user?.email || '');

        if (isVerified && onFullyVerified) {
          onFullyVerified();
        }
      }
    } catch (e) {
      // Non-fatal status check
    }
  };

  useEffect(() => {
    fetchStatus();
  }, []);

  // Cooldown interval timer
  useEffect(() => {
    if (emailCooldown <= 0) return;
    const timer = setInterval(() => {
      setEmailCooldown((prev) => Math.max(0, prev - 1));
    }, 1000);
    return () => clearInterval(timer);
  }, [emailCooldown]);

  // Trigger initial code send on mount if not yet verified
  useEffect(() => {
    if (hasTriggeredInitialSend.current) return;
    hasTriggeredInitialSend.current = true;

    if (!emailVerified) {
      handleSendOtp(true);
    }
  }, [emailVerified]);

  // Request code
  const handleSendOtp = async (isInitial = false) => {
    setEmailSending(true);
    setEmailError('');
    setEmailSetupError(null);
    if (!isInitial) setEmailSuccess('');

    try {
      const res = await authAPI.sendVerificationOtp({ contactType: 'email' });
      setEmailCooldown(RESEND_COOLDOWN_SECONDS);
      setEmailSuccess(res.data.message || 'A 4-digit verification code has been sent to your email.');
      if (res.data.destination) setMaskedEmail(res.data.destination);
    } catch (err) {
      const status = err.response?.status;
      const data = err.response?.data;

      if (status === 503 && data?.deliveryStatus === 'unconfigured') {
        setEmailSetupError({
          message: data.message,
          missing: data.missingVariables || ['SMTP_HOST', 'SMTP_USER', 'SMTP_PASS']
        });
      } else if (status === 429) {
        const retrySec = data?.retryAfterSeconds || 60;
        setEmailCooldown(retrySec);
        setEmailError(data?.message || 'Rate limit reached. Please wait before requesting another code.');
      } else {
        setEmailError(data?.message || 'Failed to send email verification code. Please try again.');
      }
    } finally {
      setEmailSending(false);
    }
  };

  // Verify code
  const handleVerifyOtp = async (e) => {
    if (e && e.preventDefault) e.preventDefault();
    const code = emailOtp.trim();

    if (!code || !/^\d{4}$/.test(code)) {
      setEmailError('Please enter the complete 4-digit verification code.');
      return;
    }

    setEmailVerifying(true);
    setEmailError('');

    try {
      const res = await authAPI.verifyOtp({ contactType: 'email', otp: code });
      setEmailVerified(true);
      setEmailSuccess('Email address verified successfully!');
      if (res.data.user) updateUser(res.data.user);

      if (onFullyVerified) {
        onFullyVerified();
      }
    } catch (err) {
      const msg = err.response?.data?.message || 'Incorrect or expired verification code.';
      setEmailError(msg);
    } finally {
      setEmailVerifying(false);
    }
  };

  const handleFinish = () => {
    const role = user?.role || userRole;
    const targetDashboard =
      role === 'admin'
        ? '/admin'
        : `/dashboard/${role}`;
    navigate(targetDashboard, { replace: true });
  };

  return (
    <Card className="p-6 sm:p-8 shadow-2xl bg-white/95 backdrop-blur-sm border border-gray-100 max-w-xl mx-auto">
      {/* Header */}
      <div className="text-center mb-6">
        <div className="inline-flex items-center justify-center p-3.5 bg-red-100 text-red-600 rounded-2xl mb-3 shadow-inner">
          <ShieldCheckIcon className="h-8 w-8" />
        </div>
        <h3 className="text-2xl font-bold text-gray-900">
          Verify Your Email Address
        </h3>
        <p className="text-sm text-gray-600 mt-1 max-w-md mx-auto">
          We've sent a 4-digit verification code to your email to confirm your account and ensure secure access.
        </p>
      </div>

      {/* Target Email Badge */}
      <div className="p-4 rounded-xl border-2 transition-all flex items-center justify-between mb-6 border-red-200 bg-red-50/40">
        <div className="flex items-center space-x-3 truncate">
          <div className="p-2 rounded-lg bg-red-100 text-red-600">
            <EnvelopeIcon className="h-5 w-5" />
          </div>
          <div className="truncate">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Registered Email</p>
            <p className="text-sm font-bold text-gray-900 truncate">
              {maskedEmail || 'Your Email Address'}
            </p>
          </div>
        </div>
        <span
          className={`text-xs font-bold px-3 py-1 rounded-full flex-shrink-0 ${
            emailVerified ? 'bg-green-100 text-green-800' : 'bg-amber-100 text-amber-800'
          }`}
        >
          {emailVerified ? 'Verified ✓' : 'Pending Code'}
        </span>
      </div>

      {/* Verification Form / Status Box */}
      <div className="space-y-4">
        {emailVerified ? (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="p-5 bg-green-50 border border-green-200 rounded-2xl text-green-900 text-sm space-y-2 text-center"
          >
            <CheckCircleIcon className="h-10 w-10 text-green-600 mx-auto" />
            <p className="font-bold text-base">Your email address has been verified!</p>
            <p className="text-xs text-green-700">
              Your account is active and you can now access all BloodNet+ features.
            </p>
          </motion.div>
        ) : (
          <form onSubmit={handleVerifyOtp} className="space-y-4">
            {emailSetupError && (
              <div className="p-3.5 bg-amber-50 border border-amber-300 rounded-xl text-amber-900 text-xs space-y-1">
                <div className="flex items-start">
                  <ExclamationTriangleIcon className="h-5 w-5 text-amber-600 mr-2 flex-shrink-0 mt-0.5" />
                  <div>
                    <strong className="font-bold">Email Service Notice:</strong>
                    <p className="mt-0.5 text-amber-800">{emailSetupError.message}</p>
                    <p className="mt-1 font-mono text-[11px] text-amber-950">
                      Required variables: {emailSetupError.missing.join(', ')}
                    </p>
                  </div>
                </div>
              </div>
            )}

            {emailError && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-red-700 text-xs flex items-center">
                <ExclamationCircleIcon className="h-4 w-4 text-red-500 mr-2 flex-shrink-0" />
                <span>{emailError}</span>
              </div>
            )}

            {emailSuccess && !emailError && (
              <div className="p-3 bg-green-50 border border-green-200 rounded-xl text-green-800 text-xs flex items-center">
                <CheckCircleIcon className="h-4 w-4 text-green-600 mr-2 flex-shrink-0" />
                <span>{emailSuccess}</span>
              </div>
            )}

            <div>
              <label htmlFor="email-otp-input" className="block text-xs font-semibold text-gray-700 uppercase mb-1.5 text-center">
                Enter 4-Digit Code
              </label>
              <div className="relative max-w-xs mx-auto">
                <input
                  id="email-otp-input"
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  maxLength={4}
                  value={emailOtp}
                  onChange={(e) => {
                    const val = e.target.value.replace(/\D/g, '').slice(0, 4);
                    setEmailOtp(val);
                    if (emailError) setEmailError('');
                  }}
                  placeholder="• • • •"
                  aria-label="4-digit email verification code"
                  className="w-full text-center tracking-[0.5em] text-2xl font-bold py-3 px-4 border-2 border-gray-300 rounded-xl focus:ring-2 focus:ring-red-500 focus:border-red-500 font-mono shadow-inner"
                  autoFocus
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-400 font-mono">
                  {emailOtp.length}/4
                </span>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-3 pt-2">
              <Button
                type="submit"
                disabled={emailVerifying || emailOtp.length !== 4}
                loading={emailVerifying}
                className="flex-1 py-3 text-sm font-semibold shadow-md"
              >
                Verify Code
              </Button>

              <Button
                type="button"
                variant="outline"
                onClick={() => handleSendOtp(false)}
                disabled={emailSending || emailCooldown > 0}
                loading={emailSending}
                className="py-3 px-4 text-xs whitespace-nowrap"
              >
                {emailCooldown > 0 ? (
                  `Resend in ${emailCooldown}s`
                ) : (
                  <>
                    <ArrowPathIcon className="h-3.5 w-3.5 mr-1 inline" />
                    Resend Code
                  </>
                )}
              </Button>
            </div>
          </form>
        )}
      </div>

      {/* Completion Action */}
      <div className="mt-8 pt-6 border-t border-gray-100 flex flex-col sm:flex-row items-center justify-between gap-4">
        <p className="text-xs text-gray-500 text-center sm:text-left">
          {emailVerified ? (
            <span className="text-green-700 font-semibold flex items-center justify-center sm:justify-start">
              <CheckCircleIcon className="h-4 w-4 mr-1 inline" />
              Email verified. You are ready to go!
            </span>
          ) : (
            'Enter the 4-digit code to activate your account.'
          )}
        </p>

        <Button
          type="button"
          onClick={handleFinish}
          disabled={!emailVerified}
          className="w-full sm:w-auto px-6 py-3 font-semibold shadow-md"
        >
          <span>Continue to Dashboard</span>
          <ArrowRightIcon className="h-4 w-4 ml-2 inline" />
        </Button>
      </div>
    </Card>
  );
};

export default ContactVerificationSection;
