import React, { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '../contexts/AuthContext';
import { useNotifications } from '../contexts/NotificationContext';
import { requestAPI, userAPI } from '../services/api';
import LiveTrackingMap from '../components/LiveTrackingMap';
import { 
  HeartIcon, 
  MapPinIcon, 
  ClockIcon,
  ExclamationTriangleIcon,
  CheckCircleIcon,
  PlusIcon,
  MagnifyingGlassIcon,
  UserGroupIcon,
  BellIcon,
  BuildingOfficeIcon,
  ShieldCheckIcon,
  PauseIcon,
  PlayIcon,
  ArrowTopRightOnSquareIcon,
  XMarkIcon
} from '@heroicons/react/24/outline';
import { HeartIcon as HeartSolidIcon } from '@heroicons/react/24/solid';

// Request Form Component with GPS auto-detect, explanation, and explicit consent checkboxes
const RequestForm = ({ onSubmit }) => {
  const { user } = useAuth();
  const [formData, setFormData] = useState({
    bloodGroup: '',
    urgency: 'normal',
    unitsNeeded: 1,
    location: {
      address: user?.location?.address || '',
      lat: user?.location?.lat || 0,
      lng: user?.location?.lng || 0,
      accuracy: null
    },
    shareWithHospitals: true,
    shareWithDonors: true,
    notes: ''
  });

  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');
  const [detectingLocation, setDetectingLocation] = useState(false);
  const [locationStatus, setLocationStatus] = useState(null); // 'detecting' | 'success' | 'denied' | 'unsupported'

  const handleGetLocation = () => {
    if (!navigator.geolocation) {
      setLocationStatus('unsupported');
      return;
    }
    setDetectingLocation(true);
    setLocationStatus('detecting');
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setDetectingLocation(false);
        setLocationStatus('success');
        const { latitude, longitude, accuracy } = pos.coords;
        setFormData(prev => ({
          ...prev,
          location: {
            ...prev.location,
            lat: latitude,
            lng: longitude,
            accuracy: Math.round(accuracy),
            address: prev.location.address || `GPS: ${latitude.toFixed(4)}, ${longitude.toFixed(4)}`
          }
        }));
      },
      (err) => {
        setDetectingLocation(false);
        setLocationStatus('denied');
        console.warn('Geolocation denied or unavailable:', err.message);
      },
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 30000 }
    );
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccess(false);
    
    try {
      // Prepare request data with proper location format and consent flags
      const requestData = {
        bloodGroup: formData.bloodGroup,
        urgency: formData.urgency,
        unitsNeeded: formData.unitsNeeded,
        location: {
          address: formData.location.address,
          lat: parseFloat(formData.location.lat) || 0,
          lng: parseFloat(formData.location.lng) || 0,
          accuracy: formData.location.accuracy || undefined,
          shareWithHospitals: formData.shareWithHospitals !== false,
          shareWithDonors: formData.shareWithDonors !== false
        },
        notes: formData.notes
      };

      console.log('Sending request data:', requestData);
      const response = await requestAPI.createRequest(requestData);
      console.log('Request created successfully:', response.data);
      setSuccess(true);
      setTimeout(() => {
        onSubmit();
      }, 1500);
    } catch (err) {
      console.error('Error creating request:', err);
      setError(err.response?.data?.message || err.response?.data?.errors?.[0]?.msg || 'Failed to create request');
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    if (type === 'checkbox') {
      setFormData(prev => ({ ...prev, [name]: checked }));
    } else if (name.includes('.')) {
      const [parent, child] = name.split('.');
      setFormData(prev => ({
        ...prev,
        [parent]: {
          ...prev[parent],
          [child]: value
        }
      }));
    } else {
      setFormData(prev => ({
        ...prev,
        [name]: value
      }));
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Blood Group *
          </label>
          <select
            name="bloodGroup"
            value={formData.bloodGroup}
            onChange={handleChange}
            required
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent"
          >
            <option value="">Select Blood Group</option>
            {['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'].map(group => (
              <option key={group} value={group}>{group}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Urgency Level *
          </label>
          <select
            name="urgency"
            value={formData.urgency}
            onChange={handleChange}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent"
          >
            <option value="normal">Normal</option>
            <option value="urgent">Urgent</option>
            <option value="critical">Critical</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Units Needed *
          </label>
          <input
            type="number"
            name="unitsNeeded"
            value={formData.unitsNeeded}
            onChange={handleChange}
            min="1"
            max="10"
            required
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent"
          />
        </div>

        <div className="md:col-span-2">
          <div className="flex items-center justify-between mb-2">
            <label className="block text-sm font-medium text-gray-700">
              Address & Destination Location *
            </label>
            <button
              type="button"
              onClick={handleGetLocation}
              disabled={detectingLocation}
              className="inline-flex items-center space-x-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg bg-red-50 text-red-700 hover:bg-red-100 border border-red-200 transition-colors disabled:opacity-60"
            >
              <MapPinIcon className="h-4 w-4 text-red-600" />
              <span>{detectingLocation ? 'Detecting GPS...' : '📍 Use My GPS Location'}</span>
            </button>
          </div>
          <input
            type="text"
            name="location.address"
            value={formData.location.address}
            onChange={handleChange}
            required
            placeholder="e.g. Ward 4B, City General Hospital, or Street Address"
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent text-sm"
          />

          {/* GPS feedback & explanation */}
          {locationStatus === 'detecting' && (
            <p className="mt-1.5 text-xs text-blue-600 flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-blue-500 animate-ping"></span>
              Requesting GPS permission from device...
            </p>
          )}
          {locationStatus === 'success' && (
            <p className="mt-1.5 text-xs text-emerald-700 flex items-center gap-1">
              <CheckCircleIcon className="h-4 w-4 text-emerald-600 inline" />
              GPS locked (lat: {formData.location.lat.toFixed(4)}, lng: {formData.location.lng.toFixed(4)}{formData.location.accuracy ? `, ±${formData.location.accuracy}m` : ''})
            </p>
          )}
          {locationStatus === 'denied' && (
            <p className="mt-1.5 text-xs text-amber-700 flex items-center gap-1">
              <ExclamationTriangleIcon className="h-4 w-4 text-amber-600 inline" />
              GPS permission denied or unavailable. You can type your complete address manually above.
            </p>
          )}

          {/* Privacy & Consent controls */}
          <div className="mt-3 p-3.5 bg-rose-50/70 border border-rose-200/80 rounded-xl space-y-2.5">
            <div className="flex items-start gap-2">
              <ShieldCheckIcon className="h-5 w-5 text-rose-600 flex-shrink-0 mt-0.5" />
              <div className="text-xs text-rose-900">
                <span className="font-semibold">Privacy & Consent: </span>
                Your location coordinates are encrypted and only accessible to authorized medical facilities or donors who accept this specific request.
              </div>
            </div>
            
            <div className="space-y-1.5 pl-7">
              <label className="flex items-center space-x-2 text-xs font-medium text-gray-800 cursor-pointer">
                <input
                  type="checkbox"
                  name="shareWithHospitals"
                  checked={formData.shareWithHospitals}
                  onChange={handleChange}
                  className="rounded text-red-600 focus:ring-red-500 h-4 w-4"
                />
                <span>Share location with verified hospital when they accept this request</span>
              </label>

              <label className="flex items-center space-x-2 text-xs font-medium text-gray-800 cursor-pointer">
                <input
                  type="checkbox"
                  name="shareWithDonors"
                  checked={formData.shareWithDonors}
                  onChange={handleChange}
                  className="rounded text-red-600 focus:ring-red-500 h-4 w-4"
                />
                <span>Share location with responding donor while coordinating donation</span>
              </label>
              <p className="text-[11px] text-gray-500 italic">
                You can pause location sharing at any time. Sharing automatically revokes when the request is fulfilled or cancelled.
              </p>
            </div>
          </div>
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Additional Notes
        </label>
        <textarea
          name="notes"
          value={formData.notes}
          onChange={handleChange}
          rows="3"
          placeholder="Any additional information or special requirements"
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent"
        />
      </div>

      <div className="flex justify-end space-x-4">
        <button
          type="button"
          onClick={onSubmit}
          className="px-6 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={loading || success}
          className="px-6 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? 'Creating...' : success ? 'Request Sent!' : 'Create Request'}
        </button>
      </div>
    </form>
  );
};

const RecipientDashboard = () => {
  const { user } = useAuth();
  const location = useLocation();
  const isNewUser = Boolean(
    location.state?.isNewUser ??
    (sessionStorage.getItem('bloodnet_just_registered') === 'true' || user?.isNewUser === true)
  );

  useEffect(() => {
    const timer = setTimeout(() => {
      sessionStorage.removeItem('bloodnet_just_registered');
    }, 10000);
    return () => clearTimeout(timer);
  }, []);
  const { notifications, socket } = useNotifications();
  const [nearbyDonors, setNearbyDonors] = useState([]);
  const [myRequests, setMyRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showRequestForm, setShowRequestForm] = useState(false);
  const [showRequestHistory, setShowRequestHistory] = useState(false);
  const [showSearchDonors, setShowSearchDonors] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [showBloodStocks, setShowBloodStocks] = useState(false);
  const [bloodStocks, setBloodStocks] = useState([]);
  const [searchPerformed, setSearchPerformed] = useState(false);
  const [searchFilters, setSearchFilters] = useState({
    bloodGroup: '',
    maxDistance: 50
  });

  // Real-time tracking modal state
  const [activeTrackingRequest, setActiveTrackingRequest] = useState(null);
  const [trackingData, setTrackingData] = useState(null);
  const [trackingLoading, setTrackingLoading] = useState(false);
  const [trackingError, setTrackingError] = useState(null);

  const handleOpenTracking = async (req) => {
    setActiveTrackingRequest(req);
    setTrackingLoading(true);
    setTrackingError(null);
    try {
      const res = await requestAPI.getRequestTracking(req._id);
      setTrackingData(res.data.tracking || res.data);
      socket?.emit('joinTrackingRoom', { requestId: req._id, userId: user?._id || user?.id });
    } catch (err) {
      console.error('Failed to get tracking details:', err);
      setTrackingError(err.response?.data?.message || 'Unable to load tracking details');
    } finally {
      setTrackingLoading(false);
    }
  };

  const handleCloseTracking = () => {
    if (activeTrackingRequest) {
      socket?.emit('leaveTrackingRoom', { requestId: activeTrackingRequest._id });
    }
    setActiveTrackingRequest(null);
    setTrackingData(null);
  };

  // Real-time location & status listener
  useEffect(() => {
    if (!socket || !activeTrackingRequest) return;

    const handleLocationUpdate = (payload) => {
      if (payload.requestId === activeTrackingRequest._id) {
        setTrackingData(prev => {
          if (!prev) return prev;
          if (payload.senderRole === 'donor' && payload.location) {
            return {
              ...prev,
              activeDonor: prev.activeDonor ? {
                ...prev.activeDonor,
                currentLocation: payload.location,
                trackingStatus: payload.trackingStatus || prev.activeDonor.trackingStatus
              } : prev.activeDonor
            };
          }
          return prev;
        });
      }
    };

    const handleTrackingStopped = (payload) => {
      if (payload.requestId === activeTrackingRequest._id) {
        setTrackingData(prev => prev ? { ...prev, status: payload.status, isRequestClosed: true } : prev);
        fetchDashboardData();
      }
    };

    socket.on('locationUpdate', handleLocationUpdate);
    socket.on('trackingStopped', handleTrackingStopped);

    return () => {
      socket.off('locationUpdate', handleLocationUpdate);
      socket.off('trackingStopped', handleTrackingStopped);
    };
  }, [socket, activeTrackingRequest]);

  // Toggle consent (pause/resume sharing without cancelling request)
  const handleToggleConsent = async (target, currentVal) => {
    if (!activeTrackingRequest) return;
    try {
      const payload = {};
      if (target === 'hospital') payload.shareWithHospitals = !currentVal;
      if (target === 'donor') payload.shareWithDonors = !currentVal;
      const res = await requestAPI.updateLocationConsent(activeTrackingRequest._id, payload);
      setTrackingData(prev => ({
        ...prev,
        shareWithHospitals: res.data.tracking?.shareWithHospitals ?? payload.shareWithHospitals ?? prev.shareWithHospitals,
        shareWithDonors: res.data.tracking?.shareWithDonors ?? payload.shareWithDonors ?? prev.shareWithDonors
      }));
    } catch (err) {
      console.error('Failed to update consent:', err);
    }
  };

  // Select primary coordinating donor
  const handleSelectDonor = async (donorId) => {
    if (!activeTrackingRequest) return;
    try {
      const res = await requestAPI.selectActiveDonor(activeTrackingRequest._id, donorId);
      setTrackingData(prev => ({
        ...prev,
        activeDonor: res.data.activeDonor
      }));
    } catch (err) {
      console.error('Failed to select active donor:', err);
    }
  };

  // Mark request as completed or cancelled
  const handleUpdateStatus = async (newStatus) => {
    if (!activeTrackingRequest) return;
    const confirmMsg = newStatus === 'completed'
      ? 'Mark this blood request as fulfilled? Location tracking will stop immediately.'
      : 'Cancel this blood request? Location sharing will stop immediately.';
    if (!window.confirm(confirmMsg)) return;

    try {
      await requestAPI.updateRequestStatus(activeTrackingRequest._id, newStatus);
      handleCloseTracking();
      fetchDashboardData();
    } catch (err) {
      console.error('Failed to update request status:', err);
    }
  };

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      console.log('Fetching dashboard data...');
      const [requestsResponse, bloodStocksResponse] = await Promise.all([
        requestAPI.getMyRequests(),
        userAPI.getNearbyBloodStocks()
      ]);
      console.log('Requests response:', requestsResponse);
      console.log('Requests data:', requestsResponse.data.requests);
      setMyRequests(requestsResponse.data.requests);
      console.log('My requests set:', requestsResponse.data.requests);
      console.log('Blood stocks response:', bloodStocksResponse);
      setBloodStocks(bloodStocksResponse.data.stocks || []);
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSearchDonors = async () => {
    try {
      setLoading(true);
      setSearchPerformed(true);
      
      const searchParams = {
        bloodGroup: searchFilters.bloodGroup || undefined,
        maxDistance: searchFilters.maxDistance
      };
      
      const response = await userAPI.searchNearbyDonors(searchParams);
      setNearbyDonors(response.data);
    } catch (error) {
      console.error('Error searching donors:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteRequest = async (requestId) => {
    if (!window.confirm('Are you sure you want to delete this blood request? This action cannot be undone.')) {
      return;
    }
    
    try {
      await requestAPI.deleteRequest(requestId);
      fetchDashboardData();
    } catch (error) {
      console.error('Error deleting request:', error);
    }
  };

  useEffect(() => {
    if (user) {
      fetchDashboardData();
    }
  }, [user]);

  if (loading && myRequests.length === 0) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-red-50 via-white to-teal-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-red-500 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-red-50 via-white to-teal-50 py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Big Welcome Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
          className="mb-12 text-center"
        >
          <div className="bg-gradient-to-br from-pink-200 via-rose-300 to-pink-400 rounded-3xl p-12 shadow-2xl">
            <motion.div
              initial={{ scale: 0.9 }}
              animate={{ scale: 1 }}
              transition={{ duration: 0.5, delay: 0.2 }}
            >
              <div className="flex justify-center mb-6">
                <div className="bg-white bg-opacity-50 p-4 rounded-full">
                  <HeartSolidIcon className="h-16 w-16 text-rose-600" />
                </div>
              </div>
              <h1 className="text-5xl font-bold text-rose-800 mb-4">
                {isNewUser ? `Welcome, ${user.name}!` : `Welcome Back, ${user.name}!`}
              </h1>
              <p className="text-xl text-rose-700 mb-8">
                {isNewUser ? 'Welcome to your BloodNet+ Dashboard' : 'Your BloodNet+ Dashboard'}
              </p>
              <div className="bg-white bg-opacity-60 rounded-2xl p-6 max-w-2xl mx-auto">
                <p className="text-rose-800 text-lg leading-relaxed">
                  {isNewUser
                    ? "Thank you for joining BloodNet+! Manage your blood requests, connect with nearby donors, and save lives. Together, we're building a community of hope and support."
                    : "Manage your blood requests, connect with nearby donors, and save lives. Together, we're building a community of hope and support."}
                </p>
              </div>
            </motion.div>
          </div>
        </motion.div>

        {/* Main Content */}
        <div className="space-y-8">
          {/* Four Main Action Buttons */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {/* Create Blood Request Button */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.2 }}
            >
              <button
                onClick={() => setShowRequestForm(!showRequestForm)}
                className="w-full bg-rose-300 hover:bg-rose-400 text-rose-800 rounded-2xl p-8 flex flex-col items-center justify-center space-y-4 transition-all duration-300 shadow-lg hover:shadow-xl transform hover:scale-105"
              >
                <PlusIcon className="h-12 w-12" />
                <div className="text-center">
                  <h3 className="text-xl font-bold mb-2">Create Blood Request</h3>
                  <p className="text-sm opacity-80">Request blood donation</p>
                </div>
              </button>
            </motion.div>

            {/* Search Nearby Donors Button */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.3 }}
            >
              <button
                onClick={() => setShowSearchDonors(!showSearchDonors)}
                className="w-full bg-pink-300 hover:bg-pink-400 text-pink-800 rounded-2xl p-8 flex flex-col items-center justify-center space-y-4 transition-all duration-300 shadow-lg hover:shadow-xl transform hover:scale-105"
              >
                <MagnifyingGlassIcon className="h-12 w-12" />
                <div className="text-center">
                  <h3 className="text-xl font-bold mb-2">Search Nearby Donors</h3>
                  <p className="text-sm opacity-80">Find donors in your area</p>
                </div>
              </button>
            </motion.div>

            {/* Blood Request History Button */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.4 }}
            >
              <button
                onClick={() => {
                  console.log('History button clicked, current state:', showRequestHistory);
                  setShowRequestHistory(!showRequestHistory);
                  console.log('History button clicked, new state:', !showRequestHistory);
                }}
                className="w-full bg-rose-200 hover:bg-rose-300 text-rose-700 rounded-2xl p-8 flex flex-col items-center justify-center space-y-4 transition-all duration-300 shadow-lg hover:shadow-xl transform hover:scale-105"
              >
                <ClockIcon className="h-12 w-12" />
                <div className="text-center">
                  <h3 className="text-xl font-bold mb-2">My Blood History</h3>
                  <p className="text-sm opacity-80">View your requests</p>
                  <span className="inline-block mt-2 bg-white bg-opacity-60 px-3 py-1 rounded-full text-xs font-semibold">
                    {myRequests.length} requests
                  </span>
                </div>
              </button>
            </motion.div>

            {/* Blood Stocks Button */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.5 }}
            >
              <button
                onClick={() => setShowBloodStocks(!showBloodStocks)}
                className="w-full bg-purple-300 hover:bg-purple-400 text-purple-800 rounded-2xl p-8 flex flex-col items-center justify-center space-y-4 transition-all duration-300 shadow-lg hover:shadow-xl transform hover:scale-105"
              >
                <BuildingOfficeIcon className="h-12 w-12" />
                <div className="text-center">
                  <h3 className="text-xl font-bold mb-2">Blood Banks</h3>
                  <p className="text-sm opacity-80">Check blood availability</p>
                  <span className="inline-block mt-2 bg-white bg-opacity-60 px-3 py-1 rounded-full text-xs font-semibold">
                    {bloodStocks.length} facilities
                  </span>
                </div>
              </button>
            </motion.div>
          </div>

          {/* Content Grid */}
          <div className="grid lg:grid-cols-3 gap-8">
            {/* Left Column - Forms and History */}
            <div className="lg:col-span-2 space-y-6">
              {/* Request Form */}
              {showRequestForm && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="bg-white rounded-xl shadow-sm p-6 border border-gray-200"
                >
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">Create Blood Request</h3>
                  <RequestForm onSubmit={() => {
                    setShowRequestForm(false);
                    fetchDashboardData();
                  }} />
                </motion.div>
              )}

              {/* Blood Request History */}
              {showRequestHistory && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="bg-white rounded-xl shadow-sm p-6 border border-gray-200"
                >
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">Blood Request History</h3>
                  {console.log('Rendering history section, showRequestHistory:', showRequestHistory, 'myRequests:', myRequests)}
                  {myRequests.length > 0 ? (
                    <div className="space-y-4">
                      {myRequests.map((request) => (
                        <div key={request._id} className="p-4 bg-gray-50 rounded-lg border border-gray-200">
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <div className="flex items-center space-x-2 mb-2">
                                <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-800">
                                  {request.bloodGroup}
                                </span>
                                <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-semibold ${
                                  (request.urgency === 'critical' || request.urgency === 'emergency') ? 'bg-red-600 text-white animate-pulse' :
                                  request.urgency === 'urgent' ? 'bg-amber-100 text-amber-800' :
                                  'bg-gray-100 text-gray-800'
                                }`}>{request.urgency === 'critical' || request.urgency === 'emergency' ? `🚨 ${(request.urgency || '').toUpperCase()}` : request.urgency}</span>
                                <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                                  request.status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                                  request.status === 'accepted' ? 'bg-green-100 text-green-800' :
                                  request.status === 'rejected' ? 'bg-red-100 text-red-800' :
                                  'bg-gray-100 text-gray-800'
                                }`}>{request.status}</span>
                              </div>
                              <div className="flex justify-between items-center text-sm mt-2">
                                <span className="text-gray-600">Location:</span>
                                <span className="font-medium text-gray-900">{request.location?.address || 'Not specified'}</span>
                              </div>
                              {request.notes && (
                                <div className="text-sm mt-1">
                                  <span className="text-gray-600">Notes:</span>
                                  <span className="font-medium text-gray-800 ml-1">{request.notes}</span>
                                </div>
                              )}
                              
                              {/* Accepted details teaser */}
                              {request.status === 'accepted' && (
                                <div className="mt-3 p-2.5 bg-emerald-50 border border-emerald-200 rounded-lg flex items-center justify-between text-xs">
                                  <span className="text-emerald-800 font-medium flex items-center gap-1.5">
                                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                                    Request Accepted! Live coordination available.
                                  </span>
                                  <button
                                    onClick={() => handleOpenTracking(request)}
                                    className="px-3 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-md font-semibold text-xs transition-colors flex items-center gap-1"
                                  >
                                    <MapPinIcon className="h-3.5 w-3.5" />
                                    <span>Track & Coordinate</span>
                                  </button>
                                </div>
                              )}
                            </div>
                            
                            <div className="flex items-center space-x-2 ml-4">
                              {request.status !== 'accepted' && (
                                <button
                                  onClick={() => handleOpenTracking(request)}
                                  className="text-xs text-rose-700 hover:text-rose-800 font-medium underline px-2 py-1"
                                >
                                  Details
                                </button>
                              )}
                              {request.status === 'pending' && (
                                <button
                                  onClick={() => handleDeleteRequest(request._id)}
                                  className="text-red-600 hover:text-red-800 text-sm font-medium"
                                  title="Delete Request"
                                >
                                  Delete
                                </button>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-gray-500 text-center py-8">No blood requests found</p>
                  )}
                </motion.div>
              )}

              {/* Coordination & Live Tracking Modal */}
              <AnimatePresence>
                {activeTrackingRequest && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-3 sm:p-6 overflow-y-auto"
                  >
                    <motion.div
                      initial={{ scale: 0.95, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      exit={{ scale: 0.95, opacity: 0 }}
                      className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full max-h-[92vh] overflow-y-auto border border-gray-200 p-6"
                    >
                      {/* Modal Header */}
                      <div className="flex items-start justify-between pb-4 border-b border-gray-200">
                        <div>
                          <div className="flex items-center gap-2">
                            <h3 className="text-xl font-bold text-gray-900">
                              Emergency Request Coordination
                            </h3>
                            <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-rose-100 text-rose-800">
                              {activeTrackingRequest.bloodGroup} • {activeTrackingRequest.unitsNeeded} Units
                            </span>
                            <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold uppercase ${
                              activeTrackingRequest.status === 'accepted' ? 'bg-emerald-100 text-emerald-800' :
                              activeTrackingRequest.status === 'completed' ? 'bg-blue-100 text-blue-800' :
                              'bg-amber-100 text-amber-800'
                            }`}>
                              {activeTrackingRequest.status}
                            </span>
                          </div>
                          <p className="text-xs text-gray-500 mt-1">
                            Destination: <span className="font-medium text-gray-700">{activeTrackingRequest.location?.address}</span>
                          </p>
                        </div>
                        <button
                          onClick={handleCloseTracking}
                          className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
                        >
                          <XMarkIcon className="h-6 w-6" />
                        </button>
                      </div>

                      {/* Modal Body */}
                      {trackingLoading ? (
                        <div className="py-16 text-center">
                          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-rose-600 mx-auto mb-3"></div>
                          <p className="text-sm text-gray-600">Connecting to secure tracking channel...</p>
                        </div>
                      ) : trackingError ? (
                        <div className="py-10 text-center text-red-600">
                          <ExclamationTriangleIcon className="h-10 w-10 mx-auto mb-2 text-red-500" />
                          <p className="font-semibold">{trackingError}</p>
                        </div>
                      ) : trackingData ? (
                        <div className="space-y-6 pt-4">
                          {/* Live Tracking Map */}
                          <div className="rounded-xl overflow-hidden border border-gray-200 shadow-sm">
                            <LiveTrackingMap
                              requestId={activeTrackingRequest._id}
                              requesterLocation={trackingData.requesterLocation}
                              hospitalInfo={trackingData.hospitalInfo}
                              donorInfo={trackingData.activeDonor}
                              myRole="recipient"
                              isRequestClosed={['completed', 'cancelled', 'rejected'].includes(trackingData.status)}
                              onToggleConsent={(type) => handleToggleConsent(type, type === 'hospital' ? trackingData.shareWithHospitals : trackingData.shareWithDonors)}
                            />
                          </div>

                          {/* Coordination details cards: Hospital & Donors */}
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {/* Hospital Card */}
                            <div className="p-4 rounded-xl border border-blue-200 bg-blue-50/50">
                              <div className="flex items-center justify-between mb-2">
                                <span className="text-xs font-bold text-blue-900 uppercase tracking-wider flex items-center gap-1">
                                  <BuildingOfficeIcon className="h-4 w-4 text-blue-600" />
                                  Accepted Hospital
                                </span>
                                {trackingData.hospitalInfo?.verified && (
                                  <span className="text-[11px] px-2 py-0.5 rounded-full bg-blue-100 text-blue-800 font-semibold flex items-center gap-0.5">
                                    <ShieldCheckIcon className="h-3.5 w-3.5 text-blue-600" />
                                    Verified Facility
                                  </span>
                                )}
                              </div>
                              {trackingData.hospitalInfo ? (
                                <div className="space-y-1.5 text-xs text-gray-700">
                                  <p className="font-bold text-sm text-gray-900">{trackingData.hospitalInfo.hospitalName}</p>
                                  <p className="text-gray-600">📍 {trackingData.hospitalInfo.address}</p>
                                  {trackingData.hospitalInfo.phone && (
                                    <p className="text-gray-600">📞 {trackingData.hospitalInfo.phone}</p>
                                  )}
                                  {trackingData.hospitalInfo.acceptedAt && (
                                    <p className="text-[11px] text-gray-500">
                                      Accepted: {new Date(trackingData.hospitalInfo.acceptedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                    </p>
                                  )}
                                  {trackingData.hospitalInfo.directionsUrl && (
                                    <a
                                      href={trackingData.hospitalInfo.directionsUrl}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="inline-flex items-center gap-1 text-xs font-semibold text-blue-700 hover:text-blue-900 mt-2 underline"
                                    >
                                      <span>Get Directions on Google Maps</span>
                                      <ArrowTopRightOnSquareIcon className="h-3.5 w-3.5" />
                                    </a>
                                  )}
                                  <p className="text-[10px] text-gray-500 italic mt-1">
                                    Notice: Hospital location reflects the verified medical facility address (not live GPS tracking).
                                  </p>
                                </div>
                              ) : (
                                <p className="text-xs text-gray-500 py-3 italic">
                                  No hospital has accepted this request yet.
                                </p>
                              )}
                            </div>

                            {/* Donors Card */}
                            <div className="p-4 rounded-xl border border-rose-200 bg-rose-50/50">
                              <div className="flex items-center justify-between mb-2">
                                <span className="text-xs font-bold text-rose-900 uppercase tracking-wider flex items-center gap-1">
                                  <UserGroupIcon className="h-4 w-4 text-rose-600" />
                                  Responding Donors ({trackingData.allDonors?.length || 0})
                                </span>
                              </div>
                              {trackingData.allDonors && trackingData.allDonors.length > 0 ? (
                                <div className="space-y-2">
                                  {trackingData.allDonors.map((donor) => {
                                    const isCoordinating = trackingData.activeDonor?._id?.toString() === donor.responderId?.toString();
                                    return (
                                      <div
                                        key={donor.responderId}
                                        className={`p-2.5 rounded-lg border text-xs transition-colors ${
                                          isCoordinating ? 'bg-white border-rose-400 shadow-xs' : 'bg-white/70 border-gray-200'
                                        }`}
                                      >
                                        <div className="flex items-center justify-between">
                                          <div>
                                            <span className="font-bold text-gray-900">{donor.name}</span>
                                            <span className="ml-2 text-rose-700 font-semibold">{donor.bloodGroup}</span>
                                            {donor.phone && (
                                              <p className="text-gray-600 mt-0.5">📞 {donor.phone}</p>
                                            )}
                                            <div className="mt-1 flex items-center gap-1.5 text-[11px]">
                                              {donor.shareLocation ? (
                                                <span className="text-emerald-700 font-medium">🟢 Live Location Active</span>
                                              ) : (
                                                <span className="text-gray-500">⚪ Location Sharing Off</span>
                                              )}
                                              <span className="text-gray-400">•</span>
                                              <span className="text-gray-500 capitalize">{donor.trackingStatus || 'En route'}</span>
                                            </div>
                                          </div>
                                          <div>
                                            {isCoordinating ? (
                                              <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-bold">
                                                Active Match
                                              </span>
                                            ) : (
                                              <button
                                                onClick={() => handleSelectDonor(donor.responderId)}
                                                className="px-2 py-1 rounded-md bg-rose-100 hover:bg-rose-200 text-rose-800 text-[10px] font-semibold transition-colors"
                                              >
                                                Coordinate Here
                                              </button>
                                            )}
                                          </div>
                                        </div>
                                      </div>
                                    );
                                  })}
                                </div>
                              ) : (
                                <p className="text-xs text-gray-500 py-3 italic">
                                  No donors have responded yet.
                                </p>
                              )}
                              <p className="text-[10px] text-gray-500 italic mt-2">
                                Note: Responding donors do not see each other's contact info or live locations.
                              </p>
                            </div>
                          </div>

                          {/* Privacy Consent Toggles & Request Lifecycle Actions */}
                          <div className="pt-4 border-t border-gray-200 flex flex-wrap items-center justify-between gap-3">
                            <div className="flex flex-wrap items-center gap-2 text-xs">
                              <button
                                type="button"
                                onClick={() => handleToggleConsent('hospital', trackingData.shareWithHospitals)}
                                className={`px-3 py-1.5 rounded-lg border font-medium flex items-center gap-1 transition-colors ${
                                  trackingData.shareWithHospitals
                                    ? 'bg-blue-50 border-blue-300 text-blue-800 hover:bg-blue-100'
                                    : 'bg-gray-100 border-gray-300 text-gray-700 hover:bg-gray-200'
                                }`}
                              >
                                {trackingData.shareWithHospitals ? <PauseIcon className="h-3.5 w-3.5" /> : <PlayIcon className="h-3.5 w-3.5" />}
                                <span>{trackingData.shareWithHospitals ? 'Pause Hospital Sharing' : 'Resume Hospital Sharing'}</span>
                              </button>

                              <button
                                type="button"
                                onClick={() => handleToggleConsent('donor', trackingData.shareWithDonors)}
                                className={`px-3 py-1.5 rounded-lg border font-medium flex items-center gap-1 transition-colors ${
                                  trackingData.shareWithDonors
                                    ? 'bg-rose-50 border-rose-300 text-rose-800 hover:bg-rose-100'
                                    : 'bg-gray-100 border-gray-300 text-gray-700 hover:bg-gray-200'
                                }`}
                              >
                                {trackingData.shareWithDonors ? <PauseIcon className="h-3.5 w-3.5" /> : <PlayIcon className="h-3.5 w-3.5" />}
                                <span>{trackingData.shareWithDonors ? 'Pause Donor Sharing' : 'Resume Donor Sharing'}</span>
                              </button>
                            </div>

                            <div className="flex items-center gap-2">
                              {activeTrackingRequest.status !== 'completed' && activeTrackingRequest.status !== 'cancelled' && (
                                <>
                                  <button
                                    type="button"
                                    onClick={() => handleUpdateStatus('cancelled')}
                                    className="px-3 py-1.5 rounded-lg border border-red-300 text-red-700 hover:bg-red-50 text-xs font-semibold transition-colors"
                                  >
                                    Cancel Request
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleUpdateStatus('completed')}
                                    className="px-4 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold shadow-xs transition-colors flex items-center gap-1"
                                  >
                                    <CheckCircleIcon className="h-4 w-4" />
                                    <span>Mark as Fulfilled</span>
                                  </button>
                                </>
                              )}
                            </div>
                          </div>
                        </div>
                      ) : null}
                    </motion.div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Right Column - Search & Info */}
            <div className="space-y-6">
              {/* Search Donors */}
              {showSearchDonors && (
                <motion.div
                  id="search-section"
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="bg-white rounded-xl shadow-sm p-6 border border-gray-200"
                >
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Search Nearby Donors</h3>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Blood Group
                    </label>
                    <select
                      value={searchFilters.bloodGroup}
                      onChange={(e) => setSearchFilters(prev => ({ ...prev, bloodGroup: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-rose-400 focus:border-transparent"
                    >
                      <option value="">All Blood Groups</option>
                      {['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'].map(group => (
                        <option key={group} value={group}>{group}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Max Distance (km)
                    </label>
                    <input
                      type="number"
                      value={searchFilters.maxDistance}
                      onChange={(e) => setSearchFilters(prev => ({ ...prev, maxDistance: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-rose-400 focus:border-transparent"
                      min="1"
                      max="100"
                    />
                  </div>
                  <button 
                    onClick={handleSearchDonors}
                    className="w-full bg-rose-200 text-rose-700 py-2 rounded-lg hover:bg-rose-300 transition-colors flex items-center justify-center space-x-2"
                  >
                    <MagnifyingGlassIcon className="h-4 w-4" />
                    <span>Search Donors</span>
                  </button>
                </div>

                {/* Search Results */}
                {nearbyDonors.length > 0 && (
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.5, delay: 0.6 }}
                    className="bg-white rounded-xl shadow-sm p-6 border border-gray-200 mt-6"
                  >
                    <h3 className="text-lg font-semibold text-gray-900 mb-4">Search Results</h3>
                    <div className="space-y-3">
                      {nearbyDonors.map((donor) => (
                        <div key={donor._id} className="p-4 bg-gray-50 rounded-lg border border-gray-200">
                          <div className="flex items-center justify-between">
                            <div>
                              <h4 className="font-medium text-gray-900">{donor.name}</h4>
                              <p className="text-sm text-gray-600">{donor.bloodGroup} • {donor.phone}</p>
                              <p className="text-xs text-gray-500 mt-1">
                                {donor.location?.address || 'Location not specified'}
                              </p>
                            </div>
                            <div className="text-right">
                              <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                                Available
                              </span>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </motion.div>
                )}

                {/* No Donors Found Message */}
                {nearbyDonors.length === 0 && searchPerformed && (
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.5, delay: 0.6 }}
                    className="bg-white rounded-xl shadow-sm p-6 border border-gray-200 mt-6"
                  >
                    <div className="text-center py-8">
                      <UserGroupIcon className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                      <p className="text-gray-500">No active donors found</p>
                      <p className="text-sm text-gray-400 mt-2">
                        Try adjusting your search criteria or distance range
                      </p>
                    </div>
                  </motion.div>
                )}
                </motion.div>
              )}

              {/* Blood Stocks Section */}
              {showBloodStocks && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="bg-white rounded-xl shadow-sm p-6 border border-gray-200"
                >
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">Nearby Blood Banks & Hospitals</h3>
                  <p className="text-gray-600 mb-6">Check blood availability at nearby facilities</p>
                  
                  {bloodStocks.length > 0 ? (
                    <div className="space-y-4">
                      {bloodStocks.map((facility) => (
                        <div key={facility._id} className="p-4 bg-gray-50 rounded-lg border border-gray-200">
                          <div className="flex items-start justify-between mb-3">
                            <div>
                              <h4 className="font-semibold text-gray-900">{facility.name}</h4>
                              <p className="text-sm text-gray-600">{facility.type}</p>
                              <p className="text-sm text-gray-500">{facility.location}</p>
                              <p className="text-sm text-gray-500">{facility.distance} km away</p>
                            </div>
                            <div className="text-right">
                              <p className="text-sm text-gray-500">{facility.operatingHours}</p>
                              <p className="text-sm text-gray-500">{facility.phone}</p>
                            </div>
                          </div>
                          
                          <div className="grid grid-cols-4 gap-2">
                            {Object.entries(facility.bloodStock).map(([bloodType, units]) => (
                              <div key={bloodType} className="text-center">
                                <div className={`text-xs font-semibold px-2 py-1 rounded ${
                                  units === 0 ? 'bg-red-100 text-red-700' :
                                  units <= 5 ? 'bg-yellow-100 text-yellow-700' :
                                  'bg-green-100 text-green-700'
                                }`}>
                                  {bloodType}
                                </div>
                                <div className="text-sm text-gray-600">{units}</div>
                              </div>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-8">
                      <BuildingOfficeIcon className="h-16 w-16 text-gray-300 mx-auto mb-4" />
                      <h4 className="text-lg font-semibold text-gray-900 mb-2">No blood banks found</h4>
                      <p className="text-gray-600">Check back later for blood stock information</p>
                    </div>
                  )}
                </motion.div>
              )}

              {/* Recent Notifications */}
              {showNotifications && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="bg-white rounded-xl shadow-sm p-6 border border-gray-200"
                >
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Recent Notifications</h3>
                <div className="space-y-3">
                  {notifications.slice(0, 5).map((notification) => (
                    <div key={notification._id} className="p-3 bg-gray-50 rounded-lg">
                      <p className="text-sm font-medium text-gray-900">{notification.title}</p>
                      <p className="text-xs text-gray-600 mt-1">{notification.message}</p>
                      <p className="text-xs text-gray-400 mt-2">
                        {new Date(notification.createdAt).toLocaleDateString()}
                      </p>
                    </div>
                  ))}
                  {notifications.length === 0 && (
                    <p className="text-gray-500 text-center py-4">No notifications</p>
                  )}
                </div>
                </motion.div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default RecipientDashboard;
