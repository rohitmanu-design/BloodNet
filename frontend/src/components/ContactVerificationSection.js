import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { authAPI } from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import {
  EnvelopeIcon,
  PhoneIcon,
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
  const [phoneVerified, setPhoneVerified] = useState(Boolean(user?.phoneVerified));
  const [maskedEmail, setMaskedEmail] = useState(initialEmail);
  const [maskedPhone, setMaskedPhone] = useState(initialPhone);

  // OTP inputs
  const [emailOtp, setEmailOtp] = useState('');
  const [phoneOtp, setPhoneOtp] = useState('');

  // Loading states
  const [emailSending, setEmailSending] = useState(false);
  const [phoneSending, setPhoneSending] = useState(false);
  const [emailVerifying, setEmailVerifying] = useState(false);
  const [phoneVerifying, setPhoneVerifying] = useState(false);

  // Cooldown countdown timers (seconds)
  const [emailCooldown, setEmailCooldown] = useState(0);
  const [phoneCooldown, setPhoneCooldown] = useState(0);

  // Feedback states
  const [emailError, setEmailError] = useState('');
  const [emailSetupError, setEmailSetupError] = useState(null);
  const [emailSuccess, setEmailSuccess] = useState('');

  const [phoneError, setPhoneError] = useState('');
  const [phoneSetupError, setPhoneSetupError] = useState(null);
  const [phoneSuccess, setPhoneSuccess] = useState('');

  // Initial load
  const hasTriggeredInitialSend = useRef(false);

  // Load status from backend
  const fetchStatus = async () => {
    try {
      const res = await authAPI.getVerificationStatus();
      if (res.data) {
        setEmailVerified(Boolean(res.data.emailVerified));
        setPhoneVerified(Boolean(res.data.phoneVerified));
        setMaskedEmail(res.data.maskedEmail || res.data.email || initialEmail);
        setMaskedPhone(res.data.maskedPhone || res.data.phone || initialPhone);

        if (res.data.emailVerified && res.data.phoneVerified) {
          if (onFullyVerified) onFullyVerified();
        }
      }
    } catch (e) {
      // Non-fatal status check
    }
  };

  useEffect(() => {
    fetchStatus();
  }, []);

  // Cooldown interval timers
  useEffect(() => {
    if (emailCooldown <= 0) return;
    const timer = setInterval(() => {
      setEmailCooldown((prev) => Math.max(0, prev - 1));
    }, 1000);
    return () => clearInterval(timer);
  }, [emailCooldown]);

  useEffect(() => {
    if (phoneCooldown <= 0) return;
    const timer = setInterval(() => {
      setPhoneCooldown((prev) => Math.max(0, prev - 1));
    }, 1000);
    return () => clearInterval(timer);
  }, [phoneCooldown]);

  // Trigger initial code sends on mount if not yet verified
  useEffect(() => {
    if (hasTriggeredInitialSend.current) return;
    hasTriggeredInitialSend.current = true;

    if (!emailVerified) {
      handleSendOtp('email', true);
    }
    if (!phoneVerified) {
      handleSendOtp('phone', true);
    }
  }, [emailVerified, phoneVerified]);

  // Request code
  const handleSendOtp = async (contactType, isInitial = false) => {
    if (contactType === 'email') {
      setEmailSending(true);
      setEmailError('');
      setEmailSetupError(null);
      if (!isInitial) setEmailSuccess('');

      try {
        const res = await authAPI.sendVerificationOtp({ contactType: 'email' });
        setEmailCooldown(RESEND_COOLDOWN_SECONDS);
        setEmailSuccess(res.data.message || 'Verification code sent to your email.');
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
    } else {
      setPhoneSending(true);
      setPhoneError('');
      setPhoneSetupError(null);
      if (!isInitial) setPhoneSuccess('');

      try {
        const res = await authAPI.sendVerificationOtp({ contactType: 'phone' });
        setPhoneCooldown(RESEND_COOLDOWN_SECONDS);
        setPhoneSuccess(res.data.message || 'Verification code sent to your phone.');
        if (res.data.destination) setMaskedPhone(res.data.destination);
      } catch (err) {
        const status = err.response?.status;
        const data = err.response?.data;

        if (status === 503 && data?.deliveryStatus === 'unconfigured') {
          setPhoneSetupError({
            message: data.message,
            missing: data.missingVariables || ['TWILIO_ACCOUNT_SID', 'TWILIO_AUTH_TOKEN', 'TWILIO_PHONE_NUMBER']
          });
        } else if (status === 429) {
          const retrySec = data?.retryAfterSeconds || 60;
          setPhoneCooldown(retrySec);
          setPhoneError(data?.message || 'Rate limit reached. Please wait before requesting another code.');
        } else {
          setPhoneError(data?.message || 'Failed to send phone verification code. Please try again.');
        }
      } finally {
        setPhoneSending(false);
      }
    }
  };

  // Verify code
  const handleVerifyOtp = async (contactType) => {
    const code = contactType === 'email' ? emailOtp.trim() : phoneOtp.trim();

    if (!code || !/^\d{4}$/.test(code)) {
      if (contactType === 'email') setEmailError('Please enter the complete 4-digit code');
      else setPhoneError('Please enter the complete 4-digit code');
      return;
    }

    if (contactType === 'email') {
      setEmailVerifying(true);
      setEmailError('');
      try {
        const res = await authAPI.verifyOtp({ contactType: 'email', otp: code });
        setEmailVerified(true);
        setEmailSuccess('Email address verified successfully!');
        if (res.data.user) updateUser(res.data.user);

        if (res.data.isFullyVerified) {
          if (onFullyVerified) onFullyVerified();
        }
      } catch (err) {
        const msg = err.response?.data?.message || 'Incorrect or expired verification code';
        setEmailError(msg);
      } finally {
        setEmailVerifying(false);
      }
    } else {
      setPhoneVerifying(true);
      setPhoneError('');
      try {
        const res = await authAPI.verifyOtp({ contactType: 'phone', otp: code });
        setPhoneVerified(true);
        setPhoneSuccess('Phone number verified successfully!');
        if (res.data.user) updateUser(res.data.user);

        if (res.data.isFullyVerified) {
          if (onFullyVerified) onFullyVerified();
        }
      } catch (err) {
        const msg = err.response?.data?.message || 'Incorrect or expired verification code';
        setPhoneError(msg);
      } finally {
        setPhoneVerifying(false);
      }
    }
  };

  const isFullyVerified = emailVerified && phoneVerified;

  const handleFinish = () => {
    const targetDashboard =
      userRole === 'admin'
        ? '/admin'
        : `/dashboard/${userRole}`;
    navigate(targetDashboard, { replace: true });
  };

  return (
    <Card className="p-6 sm:p-8 shadow-2xl bg-white/95 backdrop-blur-sm border border-gray-100 max-w-2xl mx-auto">
      {/* Header */}
      <div className="text-center mb-6">
        <div className="inline-flex items-center justify-center p-3 bg-red-100 text-red-600 rounded-2xl mb-3">
          <ShieldCheckIcon className="h-8 w-8" />
        </div>
        <h3 className="text-2xl font-bold text-gray-900">
          Verify Contact Details
        </h3>
        <p className="text-sm text-gray-600 mt-1 max-w-md mx-auto">
          To ensure donor and patient safety, we require verification for both your email and phone number.
        </p>
      </div>

      {/* Progress Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
        <div
          className={`p-4 rounded-xl border-2 transition-all flex items-center justify-between ${
            emailVerified ? 'border-green-500 bg-green-50/50' : 'border-amber-400 bg-amber-50/30'
          }`}
        >
          <div className="flex items-center space-x-3">
            <div className={`p-2 rounded-lg ${emailVerified ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}>
              <EnvelopeIcon className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase">Email Contact</p>
              <p className="text-sm font-bold text-gray-900 truncate max-w-[160px] sm:max-w-[180px]">
                {maskedEmail || 'Registered Email'}
              </p>
            </div>
          </div>
          <span
            className={`text-xs font-bold px-2.5 py-1 rounded-full ${
              emailVerified ? 'bg-green-100 text-green-800' : 'bg-amber-100 text-amber-800'
            }`}
          >
            {emailVerified ? 'Verified ✓' : 'Pending'}
          </span>
        </div>

        <div
          className={`p-4 rounded-xl border-2 transition-all flex items-center justify-between ${
            phoneVerified ? 'border-green-500 bg-green-50/50' : 'border-amber-400 bg-amber-50/30'
          }`}
        >
          <div className="flex items-center space-x-3">
            <div className={`p-2 rounded-lg ${phoneVerified ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}>
              <PhoneIcon className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase">Phone Contact</p>
              <p className="text-sm font-bold text-gray-900 truncate max-w-[160px] sm:max-w-[180px]">
                {maskedPhone || 'Registered Phone'}
              </p>
            </div>
          </div>
          <span
            className={`text-xs font-bold px-2.5 py-1 rounded-full ${
              phoneVerified ? 'bg-green-100 text-green-800' : 'bg-amber-100 text-amber-800'
            }`}
          >
            {phoneVerified ? 'Verified ✓' : 'Pending'}
          </span>
        </div>
      </div>

      <div className="space-y-6">
        {/* EMAIL VERIFICATION BOX */}
        <div className="p-5 border border-gray-200 rounded-2xl bg-white shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <h4 className="text-sm font-bold text-gray-900 flex items-center">
              <EnvelopeIcon className="h-4 w-4 mr-1.5 text-red-500" />
              1. Email Address Verification
            </h4>
            {emailVerified && (
              <span className="text-xs font-semibold text-green-700 flex items-center">
                <CheckCircleIcon className="h-4 w-4 mr-1 text-green-600" />
                Confirmed
              </span>
            )}
          </div>

          {emailVerified ? (
            <div className="p-3 bg-green-50 border border-green-200 rounded-xl text-green-800 text-xs flex items-center">
              <CheckCircleIcon className="h-5 w-5 text-green-600 mr-2 flex-shrink-0" />
              <span>Your email address <strong>{maskedEmail}</strong> has been successfully verified.</span>
            </div>
          ) : (
            <div className="space-y-3">
              {emailSetupError && (
                <div className="p-3 bg-amber-50 border border-amber-300 rounded-xl text-amber-900 text-xs space-y-1">
                  <div className="flex items-start">
                    <ExclamationTriangleIcon className="h-5 w-5 text-amber-600 mr-2 flex-shrink-0 mt-0.5" />
                    <div>
                      <strong className="font-bold">Email Service Not Configured:</strong>
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
                <div className="p-2.5 bg-green-50 border border-green-200 rounded-xl text-green-700 text-xs flex items-center">
                  <CheckCircleIcon className="h-4 w-4 text-green-600 mr-2 flex-shrink-0" />
                  <span>{emailSuccess}</span>
                </div>
              )}

              <div className="flex flex-col sm:flex-row gap-3">
                <div className="relative flex-1">
                  <input
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
                    placeholder="4-digit code"
                    aria-label="Email 4-digit verification code"
                    className="w-full text-center tracking-widest text-lg font-bold px-4 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-red-500 focus:border-transparent font-mono"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-400">
                    {emailOtp.length}/4
                  </span>
                </div>

                <Button
                  type="button"
                  onClick={() => handleVerifyOtp('email')}
                  disabled={emailVerifying || emailOtp.length !== 4}
                  loading={emailVerifying}
                  className="px-5 py-2.5 text-sm"
                >
                  Verify Email
                </Button>

                <Button
                  type="button"
                  variant="outline"
                  onClick={() => handleSendOtp('email')}
                  disabled={emailSending || emailCooldown > 0}
                  loading={emailSending}
                  className="px-4 py-2.5 text-xs whitespace-nowrap"
                >
                  {emailCooldown > 0 ? (
                    `Resend in ${emailCooldown}s`
                  ) : (
                    <>
                      <ArrowPathIcon className="h-3.5 w-3.5 mr-1" />
                      Resend Code
                    </>
                  )}
                </Button>
              </div>
            </div>
          )}
        </div>

        {/* PHONE NUMBER VERIFICATION BOX */}
        <div className="p-5 border border-gray-200 rounded-2xl bg-white shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <h4 className="text-sm font-bold text-gray-900 flex items-center">
              <PhoneIcon className="h-4 w-4 mr-1.5 text-teal-600" />
              2. Phone Number Verification
            </h4>
            {phoneVerified && (
              <span className="text-xs font-semibold text-green-700 flex items-center">
                <CheckCircleIcon className="h-4 w-4 mr-1 text-green-600" />
                Confirmed
              </span>
            )}
          </div>

          {phoneVerified ? (
            <div className="p-3 bg-green-50 border border-green-200 rounded-xl text-green-800 text-xs flex items-center">
              <CheckCircleIcon className="h-5 w-5 text-green-600 mr-2 flex-shrink-0" />
              <span>Your phone number <strong>{maskedPhone}</strong> has been successfully verified.</span>
            </div>
          ) : (
            <div className="space-y-3">
              {phoneSetupError && (
                <div className="p-3 bg-amber-50 border border-amber-300 rounded-xl text-amber-900 text-xs space-y-1">
                  <div className="flex items-start">
                    <ExclamationTriangleIcon className="h-5 w-5 text-amber-600 mr-2 flex-shrink-0 mt-0.5" />
                    <div>
                      <strong className="font-bold">SMS Service Not Configured:</strong>
                      <p className="mt-0.5 text-amber-800">{phoneSetupError.message}</p>
                      <p className="mt-1 font-mono text-[11px] text-amber-950">
                        Required variables: {phoneSetupError.missing.join(', ')}
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {phoneError && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-red-700 text-xs flex items-center">
                  <ExclamationCircleIcon className="h-4 w-4 text-red-500 mr-2 flex-shrink-0" />
                  <span>{phoneError}</span>
                </div>
              )}

              {phoneSuccess && !phoneError && (
                <div className="p-2.5 bg-green-50 border border-green-200 rounded-xl text-green-700 text-xs flex items-center">
                  <CheckCircleIcon className="h-4 w-4 text-green-600 mr-2 flex-shrink-0" />
                  <span>{phoneSuccess}</span>
                </div>
              )}

              <div className="flex flex-col sm:flex-row gap-3">
                <div className="relative flex-1">
                  <input
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    maxLength={4}
                    value={phoneOtp}
                    onChange={(e) => {
                      const val = e.target.value.replace(/\D/g, '').slice(0, 4);
                      setPhoneOtp(val);
                      if (phoneError) setPhoneError('');
                    }}
                    placeholder="4-digit code"
                    aria-label="Phone 4-digit verification code"
                    className="w-full text-center tracking-widest text-lg font-bold px-4 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-red-500 focus:border-transparent font-mono"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-400">
                    {phoneOtp.length}/4
                  </span>
                </div>

                <Button
                  type="button"
                  onClick={() => handleVerifyOtp('phone')}
                  disabled={phoneVerifying || phoneOtp.length !== 4}
                  loading={phoneVerifying}
                  className="px-5 py-2.5 text-sm"
                >
                  Verify Phone
                </Button>

                <Button
                  type="button"
                  variant="outline"
                  onClick={() => handleSendOtp('phone')}
                  disabled={phoneSending || phoneCooldown > 0}
                  loading={phoneSending}
                  className="px-4 py-2.5 text-xs whitespace-nowrap"
                >
                  {phoneCooldown > 0 ? (
                    `Resend in ${phoneCooldown}s`
                  ) : (
                    <>
                      <ArrowPathIcon className="h-3.5 w-3.5 mr-1" />
                      Resend Code
                    </>
                  )}
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Completion Actions */}
      <div className="mt-8 pt-6 border-t border-gray-100 flex flex-col sm:flex-row items-center justify-between gap-4">
        <p className="text-xs text-gray-500 text-center sm:text-left">
          {isFullyVerified ? (
            <span className="text-green-700 font-semibold flex items-center">
              <CheckCircleIcon className="h-4 w-4 mr-1 inline" />
              Both email and phone number are verified. Account fully verified!
            </span>
          ) : (
            'Both codes must be verified to mark your account fully verified.'
          )}
        </p>

        <Button
          type="button"
          onClick={handleFinish}
          disabled={!isFullyVerified}
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
