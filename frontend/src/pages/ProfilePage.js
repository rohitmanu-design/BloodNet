import React, { useState, useRef, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useAuth } from '../contexts/AuthContext';
import { userAPI, authAPI } from '../services/api';
import {
  UserIcon,
  CameraIcon,
  XMarkIcon,
  EnvelopeIcon,
  PhoneIcon,
  MapPinIcon,
  HeartIcon,
  BuildingOfficeIcon,
  CheckCircleIcon,
  ExclamationCircleIcon,
  PencilSquareIcon,
  ShieldCheckIcon,
  ClockIcon,
  ArrowTopRightOnSquareIcon,
  SparklesIcon,
  InformationCircleIcon
} from '@heroicons/react/24/outline';
import Button from '../components/ui/Button';
import Card from '../components/ui/Card';
import Input from '../components/ui/Input';

const ProfilePage = () => {
  const { user, updateUser } = useAuth();

  const isEmailVerified = Boolean(user?.emailVerified || user?.isEmailVerified || user?.verified);
  const isPhoneVerified = Boolean(user?.phoneVerified || user?.isPhoneVerified);

  // Sync fresh profile from server on mount
  useEffect(() => {
    authAPI.getProfile().then(res => {
      if (res.data?.user) {
        updateUser(res.data.user);
      }
    }).catch(err => {
      console.warn('Could not refresh profile:', err.message);
    });
  }, []);

  // Helper to build profile image url
  const getImageUrl = (imagePath) => {
    if (!imagePath) return null;
    if (imagePath.startsWith('http://') || imagePath.startsWith('https://') || imagePath.startsWith('data:')) {
      return imagePath;
    }
    const baseUrl = process.env.REACT_APP_API_URL
      ? process.env.REACT_APP_API_URL.replace(/\/api\/?$/, '')
      : (typeof window !== 'undefined' && window.location.hostname !== 'localhost' ? 'https://bloodnet-2.onrender.com' : 'http://localhost:5000');
    const cleanPath = imagePath.startsWith('/') ? imagePath : `/${imagePath}`;
    return `${baseUrl}${cleanPath}`;
  };

  const [formData, setFormData] = useState({
    name: '',
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    emergencyContact: '',
    bloodGroup: '',
    address: '',
    city: '',
    age: '',
    gender: 'prefer_not_to_say',
    weight: '',
    hemoglobin: '',
    hospitalName: '',
    contactNumber: '',
    isAvailable: true
  });

  const [profileImage, setProfileImage] = useState(null);
  const [previewImage, setPreviewImage] = useState(null);
  const [loading, setLoading] = useState(false);
  const [availabilityLoading, setAvailabilityLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [isEditing, setIsEditing] = useState(false);
  const fileInputRef = useRef(null);

  useEffect(() => {
    if (user) {
      const parts = (user.name || '').trim().split(/\s+/);
      const fName = user.firstName || parts[0] || '';
      const lName = user.lastName || parts.slice(1).join(' ') || '';

      setFormData({
        name: user.name || '',
        firstName: fName,
        lastName: lName,
        email: user.email || '',
        phone: user.phone || '',
        emergencyContact: user.emergencyContact || '',
        bloodGroup: user.bloodGroup || '',
        address: user.address || user.location?.address || '',
        city: user.city || user.location?.city || '',
        age: user.age !== undefined && user.age !== null ? user.age : (user.donorHealthDetails?.age || ''),
        gender: user.gender || 'prefer_not_to_say',
        weight: user.donorHealthDetails?.weight || '',
        hemoglobin: user.donorHealthDetails?.hemoglobin || '',
        hospitalName: user.hospitalName || '',
        contactNumber: user.contactNumber || user.phone || '',
        isAvailable: user.isAvailable !== false
      });

      setPreviewImage(getImageUrl(user.profileImage));
    }
  }, [user]);

  const handleImageChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        setError('Image size should be less than 5MB');
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => {
        setPreviewImage(reader.result);
        setProfileImage(file);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleRemoveImage = () => {
    setPreviewImage(null);
    setProfileImage(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
    setError('');
  };

  const handleToggleAvailability = async () => {
    if (user?.role !== 'donor' || availabilityLoading) return;
    const targetState = !formData.isAvailable;
    setAvailabilityLoading(true);
    setError('');
    try {
      const res = await userAPI.updateAvailability(targetState);
      const updatedUser = res.data?.user || { ...user, isAvailable: targetState };
      updateUser(updatedUser);
      setFormData(prev => ({ ...prev, isAvailable: targetState }));
      setSuccess(`Donation status set to: ${targetState ? 'Available to donate' : 'Currently paused'}`);
      setTimeout(() => setSuccess(''), 4000);
    } catch (err) {
      setError(err.response?.data?.message || 'Could not update availability status');
    } finally {
      setAvailabilityLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccess('');

    try {
      const formDataToSend = new FormData();

      // Ensure unified name is up-to-date
      const combinedName = (formData.firstName || formData.lastName)
        ? `${formData.firstName.trim()} ${formData.lastName.trim()}`.trim()
        : formData.name.trim();

      formDataToSend.append('name', combinedName);
      formDataToSend.append('firstName', formData.firstName);
      formDataToSend.append('lastName', formData.lastName);
      formDataToSend.append('email', formData.email);
      formDataToSend.append('phone', formData.phone);
      formDataToSend.append('emergencyContact', formData.emergencyContact);
      formDataToSend.append('address', formData.address);
      formDataToSend.append('city', formData.city);
      formDataToSend.append('gender', formData.gender);

      if (formData.age) {
        formDataToSend.append('age', formData.age);
      }

      if (user?.role === 'donor') {
        formDataToSend.append('bloodGroup', formData.bloodGroup);
        formDataToSend.append('isAvailable', formData.isAvailable);
        if (formData.weight) formDataToSend.append('weight', formData.weight);
        if (formData.hemoglobin) formDataToSend.append('hemoglobin', formData.hemoglobin);
      } else if (user?.role === 'recipient') {
        if (formData.bloodGroup) formDataToSend.append('bloodGroup', formData.bloodGroup);
      } else if (user?.role === 'hospital') {
        formDataToSend.append('hospitalName', formData.hospitalName);
        formDataToSend.append('contactNumber', formData.contactNumber);
      }

      // Add profile image if uploaded
      if (profileImage) {
        formDataToSend.append('profileImage', profileImage);
      }

      const response = await userAPI.updateProfile(formDataToSend);
      const updatedUser = response.data?.user;

      if (updatedUser) {
        updateUser(updatedUser);
        setPreviewImage(getImageUrl(updatedUser.profileImage));
      }

      setSuccess('Profile information updated and synchronized successfully!');
      setIsEditing(false);
      setProfileImage(null);
      setTimeout(() => setSuccess(''), 5000);
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Failed to update profile');
    } finally {
      setLoading(false);
    }
  };

  const bloodGroups = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];
  const userLat = user?.location?.lat || 0;
  const userLng = user?.location?.lng || 0;
  const hasCoordinates = userLat !== 0 || userLng !== 0;
  const mapLink = hasCoordinates ? `https://www.google.com/maps/search/?api=1&query=${userLat},${userLng}` : null;

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 via-white to-gray-50 py-10 px-4 sm:px-6 lg:px-8">
      <div className="max-w-6xl mx-auto space-y-8">

        {/* Top Header Card */}
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white rounded-3xl p-6 sm:p-8 shadow-sm border border-gray-200/80 relative overflow-hidden"
        >
          <div className="absolute top-0 right-0 w-80 h-80 bg-gradient-to-br from-red-100/40 via-pink-100/30 to-transparent rounded-full blur-3xl pointer-events-none -mr-20 -mt-20"></div>

          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 relative z-10">
            <div className="flex flex-col sm:flex-row items-center sm:items-start gap-5 text-center sm:text-left">
              {/* Profile Avatar */}
              <div className="relative group">
                <div className="w-28 h-28 sm:w-32 sm:h-32 rounded-2xl overflow-hidden bg-gradient-to-br from-gray-100 to-gray-200 shadow-md border-4 border-white flex items-center justify-center">
                  {previewImage ? (
                    <img
                      src={previewImage}
                      alt={formData.name || 'Profile'}
                      className="w-full h-full object-cover"
                      onError={() => setPreviewImage(null)}
                    />
                  ) : (
                    <UserIcon className="h-14 w-14 text-gray-400" />
                  )}
                </div>

                <button
                  type="button"
                  onClick={() => {
                    setIsEditing(true);
                    fileInputRef.current?.click();
                  }}
                  title="Change avatar picture"
                  className="absolute -bottom-2 -right-2 p-2 bg-red-600 hover:bg-red-700 text-white rounded-xl shadow-lg transition-transform transform hover:scale-105 active:scale-95"
                >
                  <CameraIcon className="h-4 w-4" />
                </button>

                {previewImage && isEditing && (
                  <button
                    type="button"
                    onClick={handleRemoveImage}
                    title="Remove avatar"
                    className="absolute -top-2 -right-2 p-1.5 bg-gray-900/80 hover:bg-black text-white rounded-lg shadow-md transition-all"
                  >
                    <XMarkIcon className="h-3.5 w-3.5" />
                  </button>
                )}

                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleImageChange}
                  className="hidden"
                />
              </div>

              {/* Name, Role & Verification Badges */}
              <div className="space-y-2">
                <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2">
                  <span className="px-3 py-1 bg-red-50 text-red-700 text-xs font-bold uppercase tracking-wider rounded-full border border-red-200">
                    {user?.role === 'donor' && '❤️ Verified Donor'}
                    {user?.role === 'recipient' && '🩹 Recipient Member'}
                    {user?.role === 'hospital' && '🏥 Medical Facility'}
                    {user?.role === 'admin' && '🛡️ Super Administrator'}
                  </span>

                  {isEmailVerified ? (
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
                      <CheckCircleIcon className="w-3.5 h-3.5" /> Email Verified
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-50 text-amber-700 border border-amber-200">
                      <ExclamationCircleIcon className="w-3.5 h-3.5" /> Unverified Email
                    </span>
                  )}

                  {isPhoneVerified && (
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-50 text-blue-700 border border-blue-200">
                      <CheckCircleIcon className="w-3.5 h-3.5" /> Phone Verified
                    </span>
                  )}
                </div>

                <h1 className="text-2xl sm:text-3xl font-extrabold text-gray-900 tracking-tight">
                  {user?.name || `${formData.firstName} ${formData.lastName}`.trim() || 'User Profile'}
                </h1>

                <p className="text-sm text-gray-500 flex items-center justify-center sm:justify-start gap-2">
                  <EnvelopeIcon className="w-4 h-4 text-gray-400" />
                  <span>{user?.email}</span>
                  {user?.createdAt && (
                    <>
                      <span>•</span>
                      <span className="text-gray-400 text-xs">
                        Member since {new Date(user.createdAt).toLocaleDateString(undefined, { month: 'short', year: 'numeric' })}
                      </span>
                    </>
                  )}
                </p>
              </div>
            </div>

            {/* Top Action Buttons */}
            <div className="flex flex-wrap items-center justify-center gap-3">
              {user?.role === 'donor' && (
                <button
                  type="button"
                  onClick={handleToggleAvailability}
                  disabled={availabilityLoading}
                  className={`px-4 py-2.5 rounded-xl font-semibold text-xs tracking-wide transition-all shadow-sm flex items-center gap-2 ${
                    formData.isAvailable
                      ? 'bg-emerald-500 hover:bg-emerald-600 text-white'
                      : 'bg-gray-200 hover:bg-gray-300 text-gray-800'
                  }`}
                >
                  <span className={`w-2.5 h-2.5 rounded-full ${formData.isAvailable ? 'bg-white animate-pulse' : 'bg-gray-500'}`} />
                  {availabilityLoading ? 'Updating...' : formData.isAvailable ? 'Available to Donate' : 'Unavailable (Paused)'}
                </button>
              )}

              {user?.role === 'admin' && (
                <a
                  href="/admin"
                  className="px-4 py-2.5 rounded-xl font-semibold text-xs bg-slate-900 hover:bg-black text-white shadow-sm flex items-center gap-2"
                >
                  <ShieldCheckIcon className="w-4 h-4 text-red-400" />
                  Admin Portal
                </a>
              )}

              <Button
                onClick={() => {
                  setIsEditing(!isEditing);
                  setError('');
                }}
                variant={isEditing ? 'outline' : 'primary'}
                className="flex items-center gap-2"
              >
                <PencilSquareIcon className="w-4 h-4" />
                {isEditing ? 'Cancel Edit' : 'Edit Profile'}
              </Button>
            </div>
          </div>

          {/* Alert Banners */}
          {error && (
            <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-2xl flex items-start gap-3 text-red-700 text-sm">
              <ExclamationCircleIcon className="w-5 h-5 flex-shrink-0 mt-0.5 text-red-500" />
              <span>{error}</span>
            </div>
          )}

          {success && (
            <div className="mt-4 p-4 bg-emerald-50 border border-emerald-200 rounded-2xl flex items-start gap-3 text-emerald-800 text-sm">
              <CheckCircleIcon className="w-5 h-5 flex-shrink-0 mt-0.5 text-emerald-600" />
              <span>{success}</span>
            </div>
          )}
        </motion.div>

        {/* Main Content: Overview vs. Edit Form */}
        {isEditing ? (
          /* ================= EDIT MODE ================= */
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white rounded-3xl p-6 sm:p-8 shadow-sm border border-gray-200/80"
          >
            <div className="border-b border-gray-100 pb-5 mb-6 flex items-center justify-between">
              <div>
                <h2 className="text-xl font-bold text-gray-900">Edit Profile Information</h2>
                <p className="text-xs text-gray-500 mt-1">
                  Keep your personal and medical information up-to-date for accurate matching and notifications.
                </p>
              </div>
              <span className="text-xs text-gray-400 font-medium">* Required fields</span>
            </div>

            <form onSubmit={handleSubmit} className="space-y-8">
              {/* Personal Details Section */}
              <div className="space-y-4">
                <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wider flex items-center gap-2">
                  <UserIcon className="w-4 h-4 text-red-500" />
                  Personal Information
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1">First Name *</label>
                    <input
                      name="firstName"
                      value={formData.firstName}
                      onChange={handleChange}
                      required
                      placeholder="e.g. Rahul"
                      className="w-full px-4 py-2.5 text-sm border border-gray-300 rounded-xl focus:ring-2 focus:ring-red-500 focus:border-transparent outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1">Last Name *</label>
                    <input
                      name="lastName"
                      value={formData.lastName}
                      onChange={handleChange}
                      required
                      placeholder="e.g. Sharma"
                      className="w-full px-4 py-2.5 text-sm border border-gray-300 rounded-xl focus:ring-2 focus:ring-red-500 focus:border-transparent outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1">Email Address *</label>
                    <input
                      name="email"
                      type="email"
                      value={formData.email}
                      onChange={handleChange}
                      required
                      className="w-full px-4 py-2.5 text-sm border border-gray-300 rounded-xl focus:ring-2 focus:ring-red-500 focus:border-transparent outline-none bg-gray-50"
                      disabled
                      title="Email cannot be changed directly"
                    />
                    <p className="text-[11px] text-gray-400 mt-1">Verified registration email.</p>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1">Phone Number</label>
                    <input
                      name="phone"
                      value={formData.phone}
                      onChange={handleChange}
                      placeholder="+91 9876543210"
                      className="w-full px-4 py-2.5 text-sm border border-gray-300 rounded-xl focus:ring-2 focus:ring-red-500 focus:border-transparent outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1">Emergency Contact Number</label>
                    <input
                      name="emergencyContact"
                      value={formData.emergencyContact}
                      onChange={handleChange}
                      placeholder="Family or alternate phone number"
                      className="w-full px-4 py-2.5 text-sm border border-gray-300 rounded-xl focus:ring-2 focus:ring-red-500 focus:border-transparent outline-none"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-gray-700 mb-1">Age (Years)</label>
                      <input
                        name="age"
                        type="number"
                        min="1"
                        max="120"
                        value={formData.age}
                        onChange={handleChange}
                        placeholder="e.g. 26"
                        className="w-full px-4 py-2.5 text-sm border border-gray-300 rounded-xl focus:ring-2 focus:ring-red-500 focus:border-transparent outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-gray-700 mb-1">Gender</label>
                      <select
                        name="gender"
                        value={formData.gender}
                        onChange={handleChange}
                        className="w-full px-4 py-2.5 text-sm border border-gray-300 rounded-xl focus:ring-2 focus:ring-red-500 focus:border-transparent outline-none bg-white"
                      >
                        <option value="prefer_not_to_say">Prefer not to say</option>
                        <option value="male">Male</option>
                        <option value="female">Female</option>
                        <option value="other">Other</option>
                      </select>
                    </div>
                  </div>
                </div>
              </div>

              {/* Location & Address Section */}
              <div className="space-y-4 pt-4 border-t border-gray-100">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wider flex items-center gap-2">
                    <MapPinIcon className="w-4 h-4 text-red-500" />
                    Location & Address
                  </h3>
                  <span className="text-[11px] text-gray-400">Auto-geocodes on save</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="sm:col-span-2">
                    <label className="block text-xs font-semibold text-gray-700 mb-1">Street / Residential Address</label>
                    <input
                      name="address"
                      value={formData.address}
                      onChange={handleChange}
                      placeholder="e.g. 102 Green Heights, MG Road"
                      className="w-full px-4 py-2.5 text-sm border border-gray-300 rounded-xl focus:ring-2 focus:ring-red-500 focus:border-transparent outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1">City / District</label>
                    <input
                      name="city"
                      value={formData.city}
                      onChange={handleChange}
                      placeholder="e.g. Pune, Mumbai, Delhi"
                      className="w-full px-4 py-2.5 text-sm border border-gray-300 rounded-xl focus:ring-2 focus:ring-red-500 focus:border-transparent outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1">GPS Coordinates (Auto-synced)</label>
                    <input
                      disabled
                      value={hasCoordinates ? `${userLat.toFixed(5)}, ${userLng.toFixed(5)}` : 'Calculated automatically on save'}
                      className="w-full px-4 py-2.5 text-sm border border-gray-200 rounded-xl bg-gray-50 text-gray-500 outline-none"
                    />
                  </div>
                </div>
              </div>

              {/* Role-Specific Fields: Donor */}
              {user?.role === 'donor' && (
                <div className="space-y-4 pt-4 border-t border-gray-100">
                  <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wider flex items-center gap-2">
                    <HeartIcon className="w-4 h-4 text-red-500" />
                    Donor Screening & Blood Details
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-xs font-semibold text-gray-700 mb-1">Blood Group *</label>
                      <select
                        name="bloodGroup"
                        value={formData.bloodGroup}
                        onChange={handleChange}
                        required
                        className="w-full px-4 py-2.5 text-sm border border-gray-300 rounded-xl focus:ring-2 focus:ring-red-500 focus:border-transparent outline-none bg-white font-bold text-red-600"
                      >
                        <option value="">Select Blood Group</option>
                        {bloodGroups.map(bg => (
                          <option key={bg} value={bg}>{bg}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-gray-700 mb-1">Weight (kg) (Min 50 kg)</label>
                      <input
                        name="weight"
                        type="number"
                        min="30"
                        max="250"
                        step="0.5"
                        value={formData.weight}
                        onChange={handleChange}
                        placeholder="e.g. 65"
                        className="w-full px-4 py-2.5 text-sm border border-gray-300 rounded-xl focus:ring-2 focus:ring-red-500 focus:border-transparent outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-gray-700 mb-1">Hemoglobin (g/dL) (Min 13)</label>
                      <input
                        name="hemoglobin"
                        type="number"
                        min="5"
                        max="25"
                        step="0.1"
                        value={formData.hemoglobin}
                        onChange={handleChange}
                        placeholder="e.g. 14.2"
                        className="w-full px-4 py-2.5 text-sm border border-gray-300 rounded-xl focus:ring-2 focus:ring-red-500 focus:border-transparent outline-none"
                      />
                    </div>
                  </div>

                  <div className="p-4 bg-emerald-50/60 border border-emerald-200 rounded-2xl flex items-center justify-between">
                    <div>
                      <p className="text-xs font-bold text-emerald-900">Active Donor Availability</p>
                      <p className="text-[11px] text-emerald-700 mt-0.5">Allow recipients and hospitals to reach you during emergencies.</p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        name="isAvailable"
                        checked={formData.isAvailable}
                        onChange={handleChange}
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 bg-gray-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-600"></div>
                    </label>
                  </div>
                </div>
              )}

              {/* Role-Specific Fields: Recipient */}
              {user?.role === 'recipient' && (
                <div className="space-y-4 pt-4 border-t border-gray-100">
                  <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wider flex items-center gap-2">
                    <HeartIcon className="w-4 h-4 text-red-500" />
                    Recipient Health Specifications
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-semibold text-gray-700 mb-1">Required Blood Group</label>
                      <select
                        name="bloodGroup"
                        value={formData.bloodGroup}
                        onChange={handleChange}
                        className="w-full px-4 py-2.5 text-sm border border-gray-300 rounded-xl focus:ring-2 focus:ring-red-500 focus:border-transparent outline-none bg-white font-bold text-red-600"
                      >
                        <option value="">Select Blood Group</option>
                        {bloodGroups.map(bg => (
                          <option key={bg} value={bg}>{bg}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>
              )}

              {/* Role-Specific Fields: Hospital */}
              {user?.role === 'hospital' && (
                <div className="space-y-4 pt-4 border-t border-gray-100">
                  <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wider flex items-center gap-2">
                    <BuildingOfficeIcon className="w-4 h-4 text-red-500" />
                    Hospital Facility Details
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-semibold text-gray-700 mb-1">Hospital / Clinic Name *</label>
                      <input
                        name="hospitalName"
                        value={formData.hospitalName}
                        onChange={handleChange}
                        required
                        placeholder="e.g. City Care Multispeciality Hospital"
                        className="w-full px-4 py-2.5 text-sm border border-gray-300 rounded-xl focus:ring-2 focus:ring-red-500 focus:border-transparent outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-gray-700 mb-1">Direct Desk / Helpline Number</label>
                      <input
                        name="contactNumber"
                        value={formData.contactNumber}
                        onChange={handleChange}
                        placeholder="e.g. 020-2567890"
                        className="w-full px-4 py-2.5 text-sm border border-gray-300 rounded-xl focus:ring-2 focus:ring-red-500 focus:border-transparent outline-none"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Save & Cancel Actions */}
              <div className="flex items-center justify-end gap-3 pt-6 border-t border-gray-100">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setIsEditing(false);
                    setError('');
                  }}
                  disabled={loading}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  variant="primary"
                  loading={loading}
                  disabled={loading}
                  className="px-6 py-2.5"
                >
                  {loading ? 'Saving Changes...' : 'Save Profile'}
                </Button>
              </div>
            </form>
          </motion.div>
        ) : (
          /* ================= READ-ONLY OVERVIEW ================= */
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

            {/* Left 2 Cols: Details Grid */}
            <div className="lg:col-span-2 space-y-6">

              {/* Personal Details Card */}
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
                className="bg-white rounded-3xl p-6 sm:p-7 shadow-sm border border-gray-200/80"
              >
                <div className="flex items-center justify-between mb-5 pb-3 border-b border-gray-100">
                  <h2 className="text-base font-bold text-gray-900 flex items-center gap-2">
                    <UserIcon className="w-5 h-5 text-red-500" />
                    Personal & Account Information
                  </h2>
                  <button
                    onClick={() => setIsEditing(true)}
                    className="text-xs text-red-600 hover:text-red-700 font-semibold flex items-center gap-1"
                  >
                    <PencilSquareIcon className="w-3.5 h-3.5" /> Edit
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-y-4 gap-x-6 text-sm">
                  <div>
                    <span className="text-xs text-gray-400 block font-medium">Full Name</span>
                    <span className="font-semibold text-gray-900 text-base">{user?.name || 'Not specified'}</span>
                  </div>
                  <div>
                    <span className="text-xs text-gray-400 block font-medium">Email Address</span>
                    <span className="font-semibold text-gray-900 flex items-center gap-1.5">
                      {user?.email}
                      {isEmailVerified ? (
                        <CheckCircleIcon className="w-4 h-4 text-emerald-500 inline" title="Verified Email" />
                      ) : (
                        <span className="text-[10px] text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded font-normal">Pending</span>
                      )}
                    </span>
                  </div>
                  <div>
                    <span className="text-xs text-gray-400 block font-medium">Primary Phone</span>
                    <span className="font-semibold text-gray-900">{user?.phone || 'Not provided'}</span>
                  </div>
                  <div>
                    <span className="text-xs text-gray-400 block font-medium">Emergency Contact</span>
                    <span className="font-semibold text-gray-900">{user?.emergencyContact || 'None listed'}</span>
                  </div>
                  <div>
                    <span className="text-xs text-gray-400 block font-medium">Age</span>
                    <span className="font-semibold text-gray-900">{user?.age ? `${user.age} years old` : 'Not specified'}</span>
                  </div>
                  <div>
                    <span className="text-xs text-gray-400 block font-medium">Gender</span>
                    <span className="font-semibold text-gray-900 capitalize">
                      {user?.gender ? user.gender.replace(/_/g, ' ') : 'Not specified'}
                    </span>
                  </div>
                </div>
              </motion.div>

              {/* Role Specific Overview */}
              {user?.role === 'donor' && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.15 }}
                  className="bg-white rounded-3xl p-6 sm:p-7 shadow-sm border border-gray-200/80"
                >
                  <div className="flex items-center justify-between mb-5 pb-3 border-b border-gray-100">
                    <h2 className="text-base font-bold text-gray-900 flex items-center gap-2">
                      <HeartIcon className="w-5 h-5 text-red-500" />
                      Donor Health & Donation Metrics
                    </h2>
                    <span className={`px-2.5 py-1 text-xs font-bold rounded-full ${
                      formData.isAvailable ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-gray-100 text-gray-600'
                    }`}>
                      {formData.isAvailable ? 'Active & Ready' : 'Paused'}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
                    <div className="p-4 bg-red-50/70 border border-red-100 rounded-2xl text-center">
                      <span className="text-xs text-red-600 font-semibold block">Blood Group</span>
                      <span className="text-2xl font-black text-red-600 mt-1 block">{user?.bloodGroup || 'N/A'}</span>
                    </div>
                    <div className="p-4 bg-gray-50 border border-gray-100 rounded-2xl text-center">
                      <span className="text-xs text-gray-500 font-semibold block">Body Weight</span>
                      <span className="text-xl font-bold text-gray-800 mt-1 block">
                        {user?.donorHealthDetails?.weight ? `${user.donorHealthDetails.weight} kg` : 'N/A'}
                      </span>
                    </div>
                    <div className="p-4 bg-gray-50 border border-gray-100 rounded-2xl text-center">
                      <span className="text-xs text-gray-500 font-semibold block">Hemoglobin</span>
                      <span className="text-xl font-bold text-gray-800 mt-1 block">
                        {user?.donorHealthDetails?.hemoglobin ? `${user.donorHealthDetails.hemoglobin} g/dL` : 'N/A'}
                      </span>
                    </div>
                    <div className="p-4 bg-gray-50 border border-gray-100 rounded-2xl text-center">
                      <span className="text-xs text-gray-500 font-semibold block">Total Donations</span>
                      <span className="text-xl font-bold text-gray-800 mt-1 block">
                        {user?.totalDonations || 0}
                      </span>
                    </div>
                  </div>

                  <div className="p-4 bg-slate-50 border border-slate-100 rounded-2xl flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-600">
                    <div className="flex items-center gap-2">
                      <ClockIcon className="w-4 h-4 text-slate-400" />
                      <span>
                        Last Donation:{' '}
                        <strong className="text-slate-800">
                          {user?.lastDonation ? new Date(user.lastDonation).toLocaleDateString() : 'No prior donations recorded'}
                        </strong>
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={handleToggleAvailability}
                      disabled={availabilityLoading}
                      className="text-red-600 hover:text-red-700 font-bold underline"
                    >
                      {formData.isAvailable ? 'Click here to pause availability' : 'Click here to activate availability'}
                    </button>
                  </div>
                </motion.div>
              )}

              {user?.role === 'recipient' && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.15 }}
                  className="bg-white rounded-3xl p-6 sm:p-7 shadow-sm border border-gray-200/80"
                >
                  <div className="flex items-center justify-between mb-5 pb-3 border-b border-gray-100">
                    <h2 className="text-base font-bold text-gray-900 flex items-center gap-2">
                      <HeartIcon className="w-5 h-5 text-red-500" />
                      Blood Needs & Recipient Profile
                    </h2>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="p-4 bg-red-50/70 border border-red-100 rounded-2xl">
                      <span className="text-xs text-red-600 font-semibold block">Required Blood Group</span>
                      <span className="text-2xl font-black text-red-600 mt-1 block">{user?.bloodGroup || 'Not specified'}</span>
                      <p className="text-[11px] text-red-500 mt-1">Matched donors will be searched primarily against this blood type.</p>
                    </div>

                    <div className="p-4 bg-gray-50 border border-gray-100 rounded-2xl flex flex-col justify-between">
                      <div>
                        <span className="text-xs text-gray-500 font-semibold block">Emergency Requests</span>
                        <p className="text-xs text-gray-600 mt-1">Need blood urgently? You can create live geo-tracked requests for immediate donor matching.</p>
                      </div>
                      <a
                        href="/create-request"
                        className="mt-3 inline-flex items-center justify-center gap-1.5 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-bold transition-all shadow-sm"
                      >
                        Create Blood Request
                      </a>
                    </div>
                  </div>
                </motion.div>
              )}

              {user?.role === 'hospital' && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.15 }}
                  className="bg-white rounded-3xl p-6 sm:p-7 shadow-sm border border-gray-200/80"
                >
                  <div className="flex items-center justify-between mb-5 pb-3 border-b border-gray-100">
                    <h2 className="text-base font-bold text-gray-900 flex items-center gap-2">
                      <BuildingOfficeIcon className="w-5 h-5 text-red-500" />
                      Hospital Facility Overview
                    </h2>
                  </div>

                  <div className="space-y-4">
                    <div className="p-4 bg-gray-50 border border-gray-100 rounded-2xl">
                      <span className="text-xs text-gray-400 block font-medium">Facility / Hospital Name</span>
                      <span className="text-lg font-bold text-gray-900">{user?.hospitalName || user?.name || 'Healthcare Facility'}</span>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <span className="text-xs text-gray-400 block font-medium">Facility Desk Phone</span>
                        <span className="text-sm font-semibold text-gray-800">{user?.contactNumber || user?.phone || 'N/A'}</span>
                      </div>
                      <div>
                        <span className="text-xs text-gray-400 block font-medium">Inventory & Blood Bank</span>
                        <a href="/hospital/inventory" className="text-sm font-bold text-red-600 hover:underline">
                          View Blood Inventory →
                        </a>
                      </div>
                    </div>
                  </div>
                </motion.div>
              )}
            </div>

            {/* Right Column: Location & System Card */}
            <div className="space-y-6">

              {/* Location Card */}
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
                className="bg-white rounded-3xl p-6 shadow-sm border border-gray-200/80"
              >
                <div className="flex items-center justify-between mb-4 pb-3 border-b border-gray-100">
                  <h3 className="text-sm font-bold text-gray-900 flex items-center gap-2">
                    <MapPinIcon className="w-4 h-4 text-red-500" />
                    Location & GPS
                  </h3>
                  <button
                    onClick={() => setIsEditing(true)}
                    className="text-xs text-red-600 hover:text-red-700 font-semibold"
                  >
                    Edit
                  </button>
                </div>

                <div className="space-y-3 text-sm">
                  <div>
                    <span className="text-xs text-gray-400 block font-medium">Street Address</span>
                    <span className="text-gray-800 font-medium">
                      {user?.address || user?.location?.address || 'No street address provided'}
                    </span>
                  </div>

                  <div>
                    <span className="text-xs text-gray-400 block font-medium">City / District</span>
                    <span className="text-gray-800 font-medium">
                      {user?.city || user?.location?.city || 'Not specified'}
                    </span>
                  </div>

                  <div className="pt-2">
                    <span className="text-xs text-gray-400 block font-medium">Geographic Coordinates</span>
                    <div className="mt-1 p-2.5 bg-gray-50 border border-gray-100 rounded-xl font-mono text-xs text-gray-600 flex items-center justify-between">
                      <span>{hasCoordinates ? `${userLat.toFixed(4)}, ${userLng.toFixed(4)}` : 'Pending address geocoding'}</span>
                      {hasCoordinates && (
                        <a
                          href={mapLink}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-red-600 hover:text-red-700 flex items-center gap-1 font-sans text-xs font-semibold ml-2"
                        >
                          Map <ArrowTopRightOnSquareIcon className="w-3.5 h-3.5" />
                        </a>
                      )}
                    </div>
                  </div>
                </div>
              </motion.div>

              {/* Security & System Info Card */}
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.25 }}
                className="bg-white rounded-3xl p-6 shadow-sm border border-gray-200/80"
              >
                <h3 className="text-sm font-bold text-gray-900 flex items-center gap-2 mb-4 pb-3 border-b border-gray-100">
                  <ShieldCheckIcon className="w-4 h-4 text-emerald-500" />
                  Security & Profile Status
                </h3>

                <div className="space-y-3 text-xs">
                  <div className="flex items-center justify-between py-1">
                    <span className="text-gray-500">Account Type</span>
                    <span className="font-semibold text-gray-800 uppercase tracking-wider">{user?.role || 'User'}</span>
                  </div>

                  <div className="flex items-center justify-between py-1">
                    <span className="text-gray-500">Email Verification</span>
                    <span className={isEmailVerified ? 'text-emerald-600 font-bold' : 'text-amber-600 font-bold'}>
                      {isEmailVerified ? 'Verified' : 'Unverified'}
                    </span>
                  </div>

                  <div className="flex items-center justify-between py-1">
                    <span className="text-gray-500">Phone Verification</span>
                    <span className={isPhoneVerified ? 'text-blue-600 font-bold' : 'text-gray-400 font-medium'}>
                      {isPhoneVerified ? 'Verified' : 'Not verified'}
                    </span>
                  </div>

                  <div className="flex items-center justify-between py-1">
                    <span className="text-gray-500">Account ID</span>
                    <span className="font-mono text-gray-400 text-[10px]">{user?._id || user?.id || '—'}</span>
                  </div>
                </div>
              </motion.div>

            </div>
          </div>
        )}

      </div>
    </div>
  );
};

export default ProfilePage;
