import React, { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '../contexts/AuthContext';
import { useNotifications } from '../contexts/NotificationContext';
import { requestAPI, userAPI, locationAPI } from '../services/api';
import LiveTrackingMap from '../components/LiveTrackingMap';
import { buildDirectionsUrl } from '../utils/mapUtils';
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
  XMarkIcon,
  PhoneIcon,
  TrashIcon,
  ArrowPathIcon,
  FunnelIcon,
  CheckIcon,
  InformationCircleIcon
} from '@heroicons/react/24/outline';
import { HeartIcon as HeartSolidIcon } from '@heroicons/react/24/solid';

// Request Form Component with GPS auto-detect, address lookup, and explicit consent checkboxes
const RequestForm = ({ onSubmit, initialBloodGroup = '' }) => {
  const { user } = useAuth();
  const [formData, setFormData] = useState({
    bloodGroup: initialBloodGroup || user?.bloodGroup || '',
    urgency: 'normal',
    unitsNeeded: 1,
    location: {
      address: user?.location?.address || user?.address || '',
      lat: user?.location?.lat || 0,
      lng: user?.location?.lng || 0,
      accuracy: null,
      placeName: ''
    },
    shareWithHospitals: true,
    shareWithDonors: true,
    notes: ''
  });

  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');
  const [detectingLocation, setDetectingLocation] = useState(false);
  const [geocodingInProgress, setGeocodingInProgress] = useState(false);
  const [locationStatus, setLocationStatus] = useState(null); // 'detecting' | 'success' | 'geocoded' | 'denied' | 'unsupported' | 'not_found'

  useEffect(() => {
    if (initialBloodGroup) {
      setFormData(prev => ({ ...prev, bloodGroup: initialBloodGroup }));
    }
  }, [initialBloodGroup]);

  const handleGetLocation = () => {
    if (!navigator.geolocation) {
      setLocationStatus('unsupported');
      return;
    }
    setDetectingLocation(true);
    setLocationStatus('detecting');
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { latitude, longitude, accuracy } = pos.coords;
        let resolvedAddress = `GPS: ${latitude.toFixed(4)}, ${longitude.toFixed(4)}`;
        let placeName = '';
        try {
          const revRes = await locationAPI.reverse(latitude, longitude);
          if (revRes.data?.address) {
            resolvedAddress = revRes.data.address;
            placeName = revRes.data.displayName || '';
          }
        } catch (e) {
          console.warn('Reverse geocode failed:', e.message);
        }

        setDetectingLocation(false);
        setLocationStatus('success');
        setFormData(prev => ({
          ...prev,
          location: {
            ...prev.location,
            lat: latitude,
            lng: longitude,
            accuracy: Math.round(accuracy),
            address: resolvedAddress,
            placeName
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

  const handleGeocodeAddress = async (addrToSearch) => {
    const target = (addrToSearch || formData.location.address || '').trim();
    if (!target) return;
    setGeocodingInProgress(true);
    try {
      const res = await locationAPI.geocode(target);
      if (res.data?.lat && res.data?.lng) {
        setFormData(prev => ({
          ...prev,
          location: {
            ...prev.location,
            lat: res.data.lat,
            lng: res.data.lng,
            address: target,
            placeName: res.data.displayName || ''
          }
        }));
        setLocationStatus('geocoded');
      } else {
        setLocationStatus('not_found');
      }
    } catch (err) {
      console.warn('Geocoding lookup error:', err);
      setLocationStatus('not_found');
    } finally {
      setGeocodingInProgress(false);
    }
  };

  const handleUseSavedAddress = () => {
    const savedAddr = user?.location?.address || user?.address;
    if (savedAddr) {
      setFormData(prev => ({
        ...prev,
        location: {
          ...prev.location,
          address: savedAddr,
          lat: user?.location?.lat || 0,
          lng: user?.location?.lng || 0,
          placeName: ''
        }
      }));
      if (!user?.location?.lat || user?.location?.lat === 0) {
        handleGeocodeAddress(savedAddr);
      } else {
        setLocationStatus('geocoded');
      }
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccess(false);

    try {
      let finalLat = parseFloat(formData.location.lat) || 0;
      let finalLng = parseFloat(formData.location.lng) || 0;
      const currentAddress = (formData.location.address || '').trim();

      // If coordinates are missing, attempt lookup before submitting
      if (currentAddress && (finalLat === 0 && finalLng === 0)) {
        try {
          const geoRes = await locationAPI.geocode(currentAddress);
          if (geoRes.data?.lat && geoRes.data?.lng) {
            finalLat = geoRes.data.lat;
            finalLng = geoRes.data.lng;
          }
        } catch (e) {
          console.warn('Submit-time geocode fallback error:', e.message);
        }
      }

      const requestData = {
        bloodGroup: formData.bloodGroup,
        urgency: formData.urgency,
        unitsNeeded: formData.unitsNeeded,
        location: {
          address: currentAddress || 'Medical Facility',
          lat: finalLat,
          lng: finalLng,
          accuracy: formData.location.accuracy || undefined,
          shareWithHospitals: formData.shareWithHospitals !== false,
          shareWithDonors: formData.shareWithDonors !== false
        },
        notes: formData.notes
      };

      await requestAPI.createRequest(requestData);
      setSuccess(true);
      setTimeout(() => {
        onSubmit();
      }, 1200);
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
      setFormData(prev => {
        const nextParent = { ...prev[parent], [child]: value };
        if (parent === 'location' && child === 'address') {
          nextParent.lat = 0;
          nextParent.lng = 0;
          nextParent.placeName = '';
          setLocationStatus(null);
        }
        return {
          ...prev,
          [parent]: nextParent
        };
      });
    } else {
      setFormData(prev => ({
        ...prev,
        [name]: value
      }));
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-xl flex items-start gap-3 text-red-800 text-sm">
          <ExclamationTriangleIcon className="h-5 w-5 text-red-600 shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      {success && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl flex items-start gap-3 text-emerald-800 text-sm">
          <CheckCircleIcon className="h-5 w-5 text-emerald-600 shrink-0 mt-0.5" />
          <span>Blood request created successfully! Broadcasting to nearby donors and hospitals...</span>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div>
          <label className="block text-sm font-semibold text-gray-800 mb-2">
            Blood Group *
          </label>
          <select
            name="bloodGroup"
            value={formData.bloodGroup}
            onChange={handleChange}
            required
            className="w-full px-3.5 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-red-500 focus:border-red-500 bg-white font-medium text-gray-900"
          >
            <option value="">Select Blood Group</option>
            {['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'].map(group => (
              <option key={group} value={group}>{group}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-semibold text-gray-800 mb-2">
            Urgency Level *
          </label>
          <select
            name="urgency"
            value={formData.urgency}
            onChange={handleChange}
            className="w-full px-3.5 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-red-500 focus:border-red-500 bg-white font-medium text-gray-900"
          >
            <option value="normal">Normal (Within 24-48 hours)</option>
            <option value="urgent">Urgent (Within 6-12 hours)</option>
            <option value="critical">🚨 Critical / Emergency (Immediate)</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-semibold text-gray-800 mb-2">
            Units Needed *
          </label>
          <div className="flex items-center space-x-2">
            <input
              type="number"
              name="unitsNeeded"
              value={formData.unitsNeeded}
              onChange={handleChange}
              min="1"
              max="10"
              required
              className="w-full px-3.5 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-red-500 focus:border-red-500 bg-white font-medium text-gray-900"
            />
            <span className="text-sm font-medium text-gray-500 shrink-0">Units (Bags)</span>
          </div>
        </div>
      </div>

      <div>
        <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
          <label className="block text-sm font-semibold text-gray-800">
            Destination & Hospital Location *
          </label>
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <button
              type="button"
              onClick={handleGetLocation}
              disabled={detectingLocation}
              className="inline-flex items-center space-x-1 px-3 py-1.5 rounded-lg bg-red-50 text-red-700 hover:bg-red-100 border border-red-200 transition-colors disabled:opacity-60 font-semibold"
            >
              <MapPinIcon className="h-4 w-4 text-red-600" />
              <span>{detectingLocation ? 'Detecting GPS...' : '📍 Auto-detect GPS'}</span>
            </button>
            <button
              type="button"
              onClick={() => handleGeocodeAddress()}
              disabled={geocodingInProgress || !formData.location.address?.trim()}
              className="inline-flex items-center space-x-1 px-3 py-1.5 rounded-lg bg-blue-50 text-blue-700 hover:bg-blue-100 border border-blue-200 transition-colors disabled:opacity-50 font-semibold"
            >
              <MagnifyingGlassIcon className="h-4 w-4 text-blue-600" />
              <span>{geocodingInProgress ? 'Locating...' : '🔍 Pin on Map'}</span>
            </button>
            {(user?.location?.address || user?.address) && (
              <button
                type="button"
                onClick={handleUseSavedAddress}
                className="inline-flex items-center space-x-1 px-3 py-1.5 rounded-lg bg-gray-100 text-gray-700 hover:bg-gray-200 border border-gray-300 transition-colors font-medium"
              >
                <span>🏠 Use Saved Address</span>
              </button>
            )}
          </div>
        </div>

        <input
          type="text"
          name="location.address"
          value={formData.location.address}
          onChange={handleChange}
          onBlur={() => {
            if (formData.location.address && formData.location.lat === 0) {
              handleGeocodeAddress();
            }
          }}
          required
          placeholder="e.g. Ruby Hall Clinic, Pune or District Hospital, Satara"
          className="w-full px-4 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-red-500 focus:border-red-500 text-sm"
        />

        {locationStatus === 'detecting' && (
          <p className="mt-2 text-xs text-blue-600 flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-blue-500 animate-ping"></span>
            Detecting device GPS coordinates...
          </p>
        )}
        {locationStatus === 'success' && (
          <div className="mt-2.5 p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs space-y-1">
            <p className="text-emerald-800 font-semibold flex items-center gap-1.5">
              <CheckCircleIcon className="h-4 w-4 text-emerald-600 shrink-0" />
              GPS Position Locked: {formData.location.lat.toFixed(4)}, {formData.location.lng.toFixed(4)}
              {formData.location.accuracy ? ` (accuracy: ±${formData.location.accuracy}m)` : ''}
            </p>
            {formData.location.placeName && (
              <p className="text-emerald-700 text-[11px] truncate">
                📍 {formData.location.placeName}
              </p>
            )}
          </div>
        )}
        {locationStatus === 'geocoded' && (
          <div className="mt-2.5 p-3 bg-blue-50 border border-blue-200 rounded-xl text-xs space-y-1">
            <p className="text-blue-800 font-semibold flex items-center gap-1.5">
              <CheckCircleIcon className="h-4 w-4 text-blue-600 shrink-0" />
              Address Verified on Map: {formData.location.lat.toFixed(4)}, {formData.location.lng.toFixed(4)}
            </p>
          </div>
        )}
        {locationStatus === 'not_found' && (
          <p className="mt-2 text-xs text-amber-700 flex items-center gap-1.5">
            <ExclamationTriangleIcon className="h-4 w-4 text-amber-600 shrink-0" />
            Could not pinpoint exact map coordinates for this address. Your address text will still be shared directly with responders.
          </p>
        )}
        {locationStatus === 'denied' && (
          <p className="mt-2 text-xs text-amber-700 flex items-center gap-1.5">
            <ExclamationTriangleIcon className="h-4 w-4 text-amber-600 shrink-0" />
            GPS access denied. You can manually enter the hospital or street address above.
          </p>
        )}
      </div>

      <div className="p-4 bg-rose-50/70 border border-rose-200 rounded-xl space-y-3">
        <div className="flex items-start gap-2.5">
          <ShieldCheckIcon className="h-5 w-5 text-rose-600 shrink-0 mt-0.5" />
          <div className="text-xs text-rose-950">
            <span className="font-bold">Privacy & Security Authorization: </span>
            Location sharing starts only when an authorized hospital or donor responds, and automatically stops strictly at 24 hours or upon fulfillment.
          </div>
        </div>

        <div className="space-y-2 pl-7">
          <label className="flex items-center space-x-2 text-xs font-medium text-gray-800 cursor-pointer">
            <input
              type="checkbox"
              name="shareWithHospitals"
              checked={formData.shareWithHospitals}
              onChange={handleChange}
              className="rounded text-red-600 focus:ring-red-500 h-4 w-4"
            />
            <span>Share destination location with verified hospitals that accept this request</span>
          </label>

          <label className="flex items-center space-x-2 text-xs font-medium text-gray-800 cursor-pointer">
            <input
              type="checkbox"
              name="shareWithDonors"
              checked={formData.shareWithDonors}
              onChange={handleChange}
              className="rounded text-red-600 focus:ring-red-500 h-4 w-4"
            />
            <span>Share destination location with eligible responding donors during coordination</span>
          </label>
        </div>
      </div>

      <div>
        <label className="block text-sm font-semibold text-gray-800 mb-2">
          Clinical Notes & Special Requirements (Optional)
        </label>
        <textarea
          name="notes"
          value={formData.notes}
          onChange={handleChange}
          rows="3"
          placeholder="e.g. Patient admitted in ICU Bed 14, contact attendant at entrance, urgent surgery scheduled."
          className="w-full px-4 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-red-500 focus:border-red-500 text-sm"
        />
      </div>

      <div className="flex justify-end items-center space-x-4 pt-4 border-t border-gray-200">
        <button
          type="button"
          onClick={onSubmit}
          className="px-6 py-2.5 border border-gray-300 rounded-xl text-gray-700 hover:bg-gray-50 font-semibold text-sm transition-colors"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={loading || success}
          className="px-8 py-2.5 bg-red-600 text-white rounded-xl hover:bg-red-700 font-bold text-sm transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
        >
          {loading ? (
            <>
              <ArrowPathIcon className="h-4 w-4 animate-spin" />
              <span>Broadcasting Request...</span>
            </>
          ) : success ? (
            <>
              <CheckCircleIcon className="h-4 w-4" />
              <span>Broadcast Sent!</span>
            </>
          ) : (
            <>
              <HeartIcon className="h-4 w-4" />
              <span>Broadcast Emergency Request</span>
            </>
          )}
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
  const [bloodStocks, setBloodStocks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('requests'); // 'requests' | 'create' | 'donors' | 'bloodBanks'
  const [statusFilter, setStatusFilter] = useState('all'); // 'all' | 'active' | 'completed'
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchPerformed, setSearchPerformed] = useState(false);
  const [searchFilters, setSearchFilters] = useState({
    bloodGroup: '',
    maxDistance: 50
  });
  const [prefilledBloodGroup, setPrefilledBloodGroup] = useState('');

  // Real-time tracking modal state
  const [activeTrackingRequest, setActiveTrackingRequest] = useState(null);
  const [trackingData, setTrackingData] = useState(null);
  const [trackingLoading, setTrackingLoading] = useState(false);
  const [trackingError, setTrackingError] = useState(null);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      const [requestsResponse, bloodStocksResponse] = await Promise.all([
        requestAPI.getMyRequests(),
        userAPI.getNearbyBloodStocks()
      ]);
      setMyRequests(requestsResponse.data.requests || []);
      setBloodStocks(bloodStocksResponse.data.stocks || []);
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSearchDonors = async (customFilters) => {
    const filters = customFilters || searchFilters;
    try {
      setSearchLoading(true);
      setSearchPerformed(true);
      
      const searchParams = {
        bloodGroup: filters.bloodGroup || undefined,
        maxDistance: filters.maxDistance,
        lat: user?.location?.lat || undefined,
        lng: user?.location?.lng || undefined
      };
      
      const response = await userAPI.searchNearbyDonors(searchParams);
      const donorList = response.data?.donors || (Array.isArray(response.data) ? response.data : []);
      setNearbyDonors(donorList);
    } catch (error) {
      console.error('Error searching donors:', error);
      setNearbyDonors([]);
    } finally {
      setSearchLoading(false);
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
      alert(error.response?.data?.message || 'Failed to delete request');
    }
  };

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
          const isDonorUpdate = payload.role === 'donor' || payload.senderRole === 'donor';
          if (isDonorUpdate) {
            const loc = payload.location || {
              address: payload.address,
              lat: payload.lat,
              lng: payload.lng,
              accuracy: payload.accuracy,
              lastUpdated: payload.lastUpdated
            };
            const updatedActiveDonor = prev.activeDonor ? {
              ...prev.activeDonor,
              address: loc.address || prev.activeDonor.address,
              currentLocation: {
                ...prev.activeDonor.currentLocation,
                ...loc
              },
              trackingStatus: payload.trackingStatus || prev.activeDonor.trackingStatus
            } : prev.activeDonor;

            const updatedAllDonors = (prev.allDonors || []).map(d => {
              if (d.responderId?.toString() === payload.participantId?.toString()) {
                return {
                  ...d,
                  address: loc.address || d.address,
                  currentLocation: {
                    ...d.currentLocation,
                    ...loc
                  }
                };
              }
              return d;
            });

            return {
              ...prev,
              activeDonor: updatedActiveDonor,
              allDonors: updatedAllDonors
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

    const handleLocationSharingExpired = (payload) => {
      if (payload.requestId === activeTrackingRequest._id) {
        setTrackingData(prev => prev ? {
          ...prev,
          isExpired: true,
          locationSharingExpired: true,
          remainingSeconds: 0
        } : prev);
      }
    };

    const handleLocationSharingRenewed = (payload) => {
      if (payload.requestId === activeTrackingRequest._id) {
        setTrackingData(prev => prev ? {
          ...prev,
          isExpired: false,
          locationSharingExpired: false,
          expiresAt: payload.expiresAt,
          remainingSeconds: payload.remainingSeconds || 86400
        } : prev);
      }
    };

    const handleNewResponseReceived = (payload) => {
      if (payload.requestId === activeTrackingRequest._id) {
        handleOpenTracking(activeTrackingRequest);
        fetchDashboardData();
      }
    };

    const handleFulfillmentSelected = (payload) => {
      if (payload.requestId === activeTrackingRequest._id) {
        handleOpenTracking(activeTrackingRequest);
        fetchDashboardData();
      }
    };

    socket.on('locationSharingExpired', handleLocationSharingExpired);
    socket.on('locationSharingRenewed', handleLocationSharingRenewed);
    socket.on('newResponseReceived', handleNewResponseReceived);
    socket.on('fulfillmentSelected', handleFulfillmentSelected);

    return () => {
      socket.off('locationUpdate', handleLocationUpdate);
      socket.off('trackingStopped', handleTrackingStopped);
      socket.off('locationSharingExpired', handleLocationSharingExpired);
      socket.off('locationSharingRenewed', handleLocationSharingRenewed);
      socket.off('newResponseReceived', handleNewResponseReceived);
      socket.off('fulfillmentSelected', handleFulfillmentSelected);
    };
  }, [socket, activeTrackingRequest]);

  // Renew 24-hour location sharing window with fresh authorization
  const handleRenewSharing = async (responderId) => {
    if (!activeTrackingRequest) return;
    try {
      const res = await requestAPI.renewLocationSharing(activeTrackingRequest._id, { responderId });
      if (res.data?.success) {
        const refresh = await requestAPI.getRequestTracking(activeTrackingRequest._id);
        setTrackingData(refresh.data.tracking || refresh.data);
      }
    } catch (err) {
      console.error('Failed to renew location sharing:', err);
      alert(err.response?.data?.message || 'Failed to renew location sharing');
    }
  };

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

  // Select final fulfillment option (donor or hospital)
  const handleSelectFulfillment = async (responderId, responseId, responderType) => {
    if (!activeTrackingRequest) return;
    const responderLabel = responderType === 'hospital' ? 'this hospital' : 'this donor';
    if (!window.confirm(`Choose ${responderLabel} for fulfillment? Other responses will be closed and reserved hospital inventory will be safely handled.`)) {
      return;
    }
    try {
      await requestAPI.selectFulfillment(activeTrackingRequest._id, {
        responderId,
        responseId,
        responderType
      });
      handleOpenTracking(activeTrackingRequest);
      fetchDashboardData();
    } catch (err) {
      console.error('Failed to select fulfillment option:', err);
      alert(err.response?.data?.message || 'Failed to select fulfillment option');
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

  // Initial load
  useEffect(() => {
    if (user) {
      fetchDashboardData();
    }
  }, [user]);

  // When donors tab is selected, trigger search if not yet performed
  useEffect(() => {
    if (activeTab === 'donors' && !searchPerformed && user) {
      handleSearchDonors();
    }
  }, [activeTab, user]);

  const activeRequests = myRequests.filter(r => r.status === 'pending' || r.status === 'accepted');
  const completedRequests = myRequests.filter(r => r.status === 'completed');

  const filteredRequests = myRequests.filter(r => {
    if (statusFilter === 'active') return r.status === 'pending' || r.status === 'accepted';
    if (statusFilter === 'completed') return r.status === 'completed';
    return true;
  });

  if (loading && myRequests.length === 0) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-red-50 via-white to-teal-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-red-600 mx-auto mb-4"></div>
          <p className="text-gray-600 font-medium">Loading Recipient Dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-red-50/30 py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8">
        
        {/* Modern Clinical Header */}
        <div className="bg-white rounded-2xl p-6 sm:p-8 shadow-sm border border-gray-200">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div className="space-y-2">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl bg-red-100 flex items-center justify-center text-red-600">
                  <HeartSolidIcon className="w-7 h-7" />
                </div>
                <div>
                  <h1 className="text-2xl sm:text-3xl font-extrabold text-gray-900 tracking-tight">
                    {isNewUser ? `Welcome, ${user?.name || 'Recipient'}!` : `Welcome Back, ${user?.name || 'Recipient'}!`}
                  </h1>
                  <p className="text-xs sm:text-sm text-gray-500 font-medium">
                    BloodNet+ Recipient Hub • Request Blood, Connect with Donors & Hospitals
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2 pt-1 text-xs">
                <span className="px-2.5 py-1 bg-red-100 text-red-800 font-bold rounded-full">
                  Blood Group: {user?.bloodGroup || 'Not Specified'}
                </span>
                <span className="px-2.5 py-1 bg-emerald-100 text-emerald-800 font-semibold rounded-full flex items-center gap-1">
                  <CheckCircleIcon className="w-3.5 h-3.5" />
                  Verified Account
                </span>
                {user?.location?.address && (
                  <span className="px-2.5 py-1 bg-gray-100 text-gray-700 font-medium rounded-full truncate max-w-xs">
                    📍 {user.location.address}
                  </span>
                )}
              </div>
            </div>

            <div className="flex items-center gap-3">
              <button
                onClick={() => {
                  setPrefilledBloodGroup(user?.bloodGroup || '');
                  setActiveTab('create');
                }}
                className="px-5 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-xl font-bold text-sm shadow-sm transition-all flex items-center gap-2 transform hover:-translate-y-0.5"
              >
                <PlusIcon className="w-5 h-5" />
                <span>+ Create Blood Request</span>
              </button>
            </div>
          </div>
        </div>

        {/* Top 4 Interactive KPI Stat Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
          {/* Card 1: Active Requests */}
          <div
            onClick={() => setActiveTab('requests')}
            className={`p-6 rounded-2xl bg-white border cursor-pointer transition-all duration-200 shadow-xs hover:shadow-md ${
              activeTab === 'requests' ? 'border-red-500 ring-2 ring-red-500/20' : 'border-gray-200 hover:border-red-300'
            }`}
          >
            <div className="flex items-center justify-between mb-4">
              <span className="text-xs font-bold uppercase tracking-wider text-gray-500">Active Requests</span>
              <div className="w-10 h-10 rounded-xl bg-red-50 text-red-600 flex items-center justify-center">
                <ClockIcon className="w-6 h-6" />
              </div>
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-extrabold text-gray-900">{activeRequests.length}</span>
              {activeRequests.length > 0 ? (
                <span className="text-xs font-bold text-red-600 bg-red-100 px-2 py-0.5 rounded-full flex items-center gap-1 animate-pulse">
                  <span className="w-1.5 h-1.5 rounded-full bg-red-600"></span>
                  Active Now
                </span>
              ) : (
                <span className="text-xs text-gray-400">None pending</span>
              )}
            </div>
            <p className="text-xs text-gray-500 mt-2">Awaiting match or live coordinating</p>
          </div>

          {/* Card 2: Create Request */}
          <div
            onClick={() => {
              setPrefilledBloodGroup(user?.bloodGroup || '');
              setActiveTab('create');
            }}
            className={`p-6 rounded-2xl bg-white border cursor-pointer transition-all duration-200 shadow-xs hover:shadow-md ${
              activeTab === 'create' ? 'border-red-500 ring-2 ring-red-500/20' : 'border-gray-200 hover:border-red-300'
            }`}
          >
            <div className="flex items-center justify-between mb-4">
              <span className="text-xs font-bold uppercase tracking-wider text-gray-500">New Request</span>
              <div className="w-10 h-10 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center">
                <PlusIcon className="w-6 h-6" />
              </div>
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-xl font-extrabold text-red-600">+ Emergency</span>
            </div>
            <p className="text-xs text-gray-500 mt-2">Broadcast urgent blood requirement</p>
          </div>

          {/* Card 3: Nearby Donors */}
          <div
            onClick={() => setActiveTab('donors')}
            className={`p-6 rounded-2xl bg-white border cursor-pointer transition-all duration-200 shadow-xs hover:shadow-md ${
              activeTab === 'donors' ? 'border-blue-500 ring-2 ring-blue-500/20' : 'border-gray-200 hover:border-blue-300'
            }`}
          >
            <div className="flex items-center justify-between mb-4">
              <span className="text-xs font-bold uppercase tracking-wider text-gray-500">Nearby Donors</span>
              <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
                <UserGroupIcon className="w-6 h-6" />
              </div>
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-extrabold text-gray-900">
                {nearbyDonors.length > 0 ? nearbyDonors.length : 'Find'}
              </span>
              <span className="text-xs text-blue-600 font-semibold bg-blue-50 px-2 py-0.5 rounded-full">
                Available
              </span>
            </div>
            <p className="text-xs text-gray-500 mt-2">Connect with verified local donors</p>
          </div>

          {/* Card 4: Blood Banks */}
          <div
            onClick={() => setActiveTab('bloodBanks')}
            className={`p-6 rounded-2xl bg-white border cursor-pointer transition-all duration-200 shadow-xs hover:shadow-md ${
              activeTab === 'bloodBanks' ? 'border-purple-500 ring-2 ring-purple-500/20' : 'border-gray-200 hover:border-purple-300'
            }`}
          >
            <div className="flex items-center justify-between mb-4">
              <span className="text-xs font-bold uppercase tracking-wider text-gray-500">Blood Banks</span>
              <div className="w-10 h-10 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center">
                <BuildingOfficeIcon className="w-6 h-6" />
              </div>
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-extrabold text-gray-900">{bloodStocks.length}</span>
              <span className="text-xs text-purple-600 font-semibold bg-purple-50 px-2 py-0.5 rounded-full">
                Facilities
              </span>
            </div>
            <p className="text-xs text-gray-500 mt-2">Live hospital & blood bank inventory</p>
          </div>
        </div>

        {/* Standard Segmented Navigation Tabs */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="border-b border-gray-200 bg-gray-50/60 px-4 sm:px-6">
            <nav className="flex space-x-4 sm:space-x-8 overflow-x-auto py-2">
              <button
                onClick={() => setActiveTab('requests')}
                className={`py-3 px-3 rounded-lg font-bold text-sm flex items-center space-x-2 whitespace-nowrap transition-colors ${
                  activeTab === 'requests'
                    ? 'bg-white text-red-600 shadow-xs border border-gray-200'
                    : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100/60'
                }`}
              >
                <HeartIcon className="w-4 h-4" />
                <span>My Blood Requests ({myRequests.length})</span>
                {activeRequests.length > 0 && (
                  <span className="px-2 py-0.5 rounded-full text-[11px] bg-red-600 text-white font-extrabold">
                    {activeRequests.length} Active
                  </span>
                )}
              </button>

              <button
                onClick={() => {
                  setPrefilledBloodGroup(user?.bloodGroup || '');
                  setActiveTab('create');
                }}
                className={`py-3 px-3 rounded-lg font-bold text-sm flex items-center space-x-2 whitespace-nowrap transition-colors ${
                  activeTab === 'create'
                    ? 'bg-white text-red-600 shadow-xs border border-gray-200'
                    : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100/60'
                }`}
              >
                <PlusIcon className="w-4 h-4" />
                <span>+ Create Blood Request</span>
              </button>

              <button
                onClick={() => setActiveTab('donors')}
                className={`py-3 px-3 rounded-lg font-bold text-sm flex items-center space-x-2 whitespace-nowrap transition-colors ${
                  activeTab === 'donors'
                    ? 'bg-white text-blue-600 shadow-xs border border-gray-200'
                    : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100/60'
                }`}
              >
                <UserGroupIcon className="w-4 h-4" />
                <span>Search Nearby Donors</span>
              </button>

              <button
                onClick={() => setActiveTab('bloodBanks')}
                className={`py-3 px-3 rounded-lg font-bold text-sm flex items-center space-x-2 whitespace-nowrap transition-colors ${
                  activeTab === 'bloodBanks'
                    ? 'bg-white text-purple-600 shadow-xs border border-gray-200'
                    : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100/60'
                }`}
              >
                <BuildingOfficeIcon className="w-4 h-4" />
                <span>Blood Banks & Stock ({bloodStocks.length})</span>
              </button>
            </nav>
          </div>

          <div className="p-6 sm:p-8">
            {/* TAB 1: MY BLOOD REQUESTS & HISTORY */}
            {activeTab === 'requests' && (
              <div className="space-y-6">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-gray-200">
                  <div>
                    <h2 className="text-xl font-bold text-gray-900">Emergency Blood Requests</h2>
                    <p className="text-xs text-gray-500">Track incoming hospital offers, donor responses, and live coordinates</p>
                  </div>

                  <div className="flex items-center space-x-2">
                    <button
                      onClick={() => setStatusFilter('all')}
                      className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                        statusFilter === 'all' ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      }`}
                    >
                      All ({myRequests.length})
                    </button>
                    <button
                      onClick={() => setStatusFilter('active')}
                      className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                        statusFilter === 'active' ? 'bg-red-600 text-white' : 'bg-red-50 text-red-700 hover:bg-red-100'
                      }`}
                    >
                      Active ({activeRequests.length})
                    </button>
                    <button
                      onClick={() => setStatusFilter('completed')}
                      className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                        statusFilter === 'completed' ? 'bg-emerald-600 text-white' : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                      }`}
                    >
                      Completed ({completedRequests.length})
                    </button>
                  </div>
                </div>

                {filteredRequests.length > 0 ? (
                  <div className="space-y-4">
                    {filteredRequests.map((request) => {
                      const isEmergency = request.urgency === 'critical' || request.urgency === 'emergency';
                      const isAccepted = request.status === 'accepted';
                      const isCompleted = request.status === 'completed';

                      return (
                        <div
                          key={request._id}
                          className={`p-5 rounded-xl border transition-all ${
                            isAccepted
                              ? 'bg-emerald-50/40 border-emerald-300 shadow-xs'
                              : isEmergency
                              ? 'bg-red-50/30 border-red-200 shadow-xs'
                              : 'bg-white border-gray-200 hover:border-gray-300'
                          }`}
                        >
                          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                            <div className="space-y-2 flex-1">
                              <div className="flex flex-wrap items-center gap-2">
                                <span className="px-3 py-1 bg-red-600 text-white font-extrabold rounded-lg text-sm shadow-xs">
                                  {request.bloodGroup}
                                </span>
                                <span className="text-xs font-bold text-gray-700 bg-gray-100 px-2.5 py-1 rounded-lg">
                                  {request.unitsNeeded} {request.unitsNeeded === 1 ? 'Unit' : 'Units'} Needed
                                </span>
                                <span className={`px-2.5 py-1 rounded-lg text-xs font-bold ${
                                  isEmergency
                                    ? 'bg-red-600 text-white animate-pulse'
                                    : request.urgency === 'urgent'
                                    ? 'bg-amber-100 text-amber-800'
                                    : 'bg-gray-100 text-gray-700'
                                }`}>
                                  {isEmergency ? '🚨 CRITICAL EMERGENCY' : (request.urgency || 'normal').toUpperCase()}
                                </span>
                                <span className={`px-2.5 py-1 rounded-lg text-xs font-bold uppercase ${
                                  request.status === 'accepted'
                                    ? 'bg-emerald-100 text-emerald-800'
                                    : request.status === 'completed'
                                    ? 'bg-blue-100 text-blue-800'
                                    : request.status === 'cancelled'
                                    ? 'bg-gray-100 text-gray-600'
                                    : 'bg-yellow-100 text-yellow-800'
                                }`}>
                                  {request.status}
                                </span>
                              </div>

                              <div className="text-xs text-gray-600 space-y-1">
                                <p className="flex items-center gap-1.5 font-medium text-gray-800">
                                  <MapPinIcon className="w-4 h-4 text-red-600 shrink-0" />
                                  <span>{request.location?.address || 'Hospital Location Specified'}</span>
                                </p>
                                <p className="flex items-center gap-1.5 text-gray-500">
                                  <ClockIcon className="w-4 h-4 text-gray-400 shrink-0" />
                                  <span>Requested on {new Date(request.createdAt).toLocaleDateString()} at {new Date(request.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                                </p>
                                {request.notes && (
                                  <p className="text-xs text-gray-700 bg-gray-50 p-2 rounded-lg border border-gray-100 mt-1">
                                    <span className="font-semibold">Notes:</span> {request.notes}
                                  </p>
                                )}
                              </div>

                              {isAccepted && (
                                <div className="mt-3 p-3 bg-emerald-100/70 border border-emerald-300 rounded-xl flex items-center justify-between text-xs text-emerald-950">
                                  <div className="flex items-center gap-2">
                                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-600 animate-ping"></span>
                                    <span className="font-bold">
                                      Request Accepted! Responders coordinating live location & stock.
                                    </span>
                                  </div>
                                </div>
                              )}
                            </div>

                            <div className="flex items-center gap-3 shrink-0">
                              <button
                                onClick={() => handleOpenTracking(request)}
                                className={`px-4 py-2.5 rounded-xl font-bold text-xs flex items-center gap-1.5 transition-all shadow-xs ${
                                  isAccepted
                                    ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
                                    : 'bg-red-600 hover:bg-red-700 text-white'
                                }`}
                              >
                                <MapPinIcon className="w-4 h-4" />
                                <span>{isAccepted ? 'Track & Coordinate' : 'View Offers & Live Tracking'}</span>
                              </button>

                              {request.status === 'pending' && (
                                <button
                                  onClick={() => handleDeleteRequest(request._id)}
                                  className="p-2.5 rounded-xl border border-gray-200 text-gray-500 hover:text-red-600 hover:bg-red-50 hover:border-red-200 transition-colors"
                                  title="Cancel and delete request"
                                >
                                  <TrashIcon className="w-4 h-4" />
                                </button>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="py-16 text-center bg-gray-50 rounded-2xl border border-dashed border-gray-300">
                    <HeartIcon className="w-12 h-12 text-gray-400 mx-auto mb-3" />
                    <h3 className="text-base font-bold text-gray-800">No blood requests in this category</h3>
                    <p className="text-xs text-gray-500 max-w-sm mx-auto mt-1 mb-6">
                      Create an emergency request to broadcast your blood needs directly to verified local donors and hospitals.
                    </p>
                    <button
                      onClick={() => {
                        setPrefilledBloodGroup(user?.bloodGroup || '');
                        setActiveTab('create');
                      }}
                      className="px-5 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-xl font-bold text-xs shadow-xs"
                    >
                      + Create Blood Request
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* TAB 2: CREATE BLOOD REQUEST */}
            {activeTab === 'create' && (
              <div className="space-y-6">
                <div>
                  <h2 className="text-xl font-bold text-gray-900">Create Emergency Blood Request</h2>
                  <p className="text-xs text-gray-500">Broadcast your requirement immediately to nearby registered donors and verified hospital blood banks</p>
                </div>
                <div className="p-6 bg-white rounded-2xl border border-gray-200 shadow-xs">
                  <RequestForm
                    initialBloodGroup={prefilledBloodGroup}
                    onSubmit={() => {
                      setActiveTab('requests');
                      fetchDashboardData();
                    }}
                  />
                </div>
              </div>
            )}

            {/* TAB 3: SEARCH NEARBY DONORS */}
            {activeTab === 'donors' && (
              <div className="space-y-6">
                <div>
                  <h2 className="text-xl font-bold text-gray-900">Search Nearby Blood Donors</h2>
                  <p className="text-xs text-gray-500">Locate available voluntary donors filtered by blood type and proximity</p>
                </div>

                {/* Filter Controls */}
                <div className="p-5 bg-gray-50 rounded-2xl border border-gray-200">
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 items-end">
                    <div>
                      <label className="block text-xs font-bold text-gray-700 uppercase mb-1">
                        Blood Group Filter
                      </label>
                      <select
                        value={searchFilters.bloodGroup}
                        onChange={(e) => setSearchFilters(prev => ({ ...prev, bloodGroup: e.target.value }))}
                        className="w-full px-3.5 py-2 border border-gray-300 rounded-xl bg-white text-sm font-semibold focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="">All Blood Groups</option>
                        {['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'].map(bg => (
                          <option key={bg} value={bg}>{bg}</option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-gray-700 uppercase mb-1">
                        Max Distance (Radius)
                      </label>
                      <select
                        value={searchFilters.maxDistance}
                        onChange={(e) => setSearchFilters(prev => ({ ...prev, maxDistance: Number(e.target.value) }))}
                        className="w-full px-3.5 py-2 border border-gray-300 rounded-xl bg-white text-sm font-semibold focus:ring-2 focus:ring-blue-500"
                      >
                        <option value={10}>Within 10 km</option>
                        <option value={25}>Within 25 km</option>
                        <option value={50}>Within 50 km</option>
                        <option value={100}>Within 100 km</option>
                      </select>
                    </div>

                    <div>
                      <button
                        onClick={() => handleSearchDonors()}
                        disabled={searchLoading}
                        className="w-full px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold text-sm shadow-xs flex items-center justify-center space-x-2 transition-colors disabled:opacity-60"
                      >
                        {searchLoading ? (
                          <>
                            <ArrowPathIcon className="w-4 h-4 animate-spin" />
                            <span>Searching...</span>
                          </>
                        ) : (
                          <>
                            <MagnifyingGlassIcon className="w-4 h-4" />
                            <span>Search Available Donors</span>
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                </div>

                {/* Donor Results */}
                {searchLoading ? (
                  <div className="py-16 text-center">
                    <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600 mx-auto mb-3"></div>
                    <p className="text-sm text-gray-600 font-medium">Scanning nearby active donors...</p>
                  </div>
                ) : nearbyDonors.length > 0 ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {nearbyDonors.map((donor) => (
                      <div
                        key={donor._id}
                        className="p-5 rounded-2xl border border-gray-200 bg-white hover:border-blue-300 hover:shadow-md transition-all flex flex-col justify-between"
                      >
                        <div className="space-y-3">
                          <div className="flex items-start justify-between">
                            <div>
                              <h3 className="font-extrabold text-gray-900 text-base">{donor.name}</h3>
                              <span className="text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full inline-block mt-0.5">
                                🟢 Available to Donate
                              </span>
                            </div>
                            <span className="px-3 py-1 bg-red-100 text-red-800 font-extrabold rounded-lg text-sm">
                              {donor.bloodGroup}
                            </span>
                          </div>

                          <div className="text-xs text-gray-600 space-y-1">
                            {donor.distance !== null && donor.distance !== undefined && (
                              <p className="font-semibold text-blue-700">
                                📍 {donor.distance} km away
                              </p>
                            )}
                            <p className="text-gray-500 truncate">
                              🏠 {donor.location?.address || donor.address || 'Address on file'}
                            </p>
                            {donor.phone && (
                              <p className="font-medium text-gray-800 flex items-center gap-1">
                                <PhoneIcon className="w-3.5 h-3.5 text-gray-400" />
                                <a href={`tel:${donor.phone}`} className="hover:text-blue-600 underline">
                                  {donor.phone}
                                </a>
                              </p>
                            )}
                          </div>
                        </div>

                        <div className="pt-4 mt-4 border-t border-gray-100 flex items-center justify-between">
                          <button
                            onClick={() => {
                              setPrefilledBloodGroup(donor.bloodGroup || '');
                              setActiveTab('create');
                            }}
                            className="w-full px-3 py-2 bg-rose-50 hover:bg-rose-100 text-rose-700 rounded-xl font-bold text-xs transition-colors text-center"
                          >
                            + Request {donor.bloodGroup} Donation
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="py-16 text-center bg-gray-50 rounded-2xl border border-dashed border-gray-300">
                    <UserGroupIcon className="w-12 h-12 text-gray-400 mx-auto mb-3" />
                    <h3 className="text-base font-bold text-gray-800">
                      {searchPerformed ? 'No active donors found in this radius' : 'Find Available Donors'}
                    </h3>
                    <p className="text-xs text-gray-500 max-w-sm mx-auto mt-1 mb-4">
                      {searchPerformed
                        ? 'Try selecting "All Blood Groups" or expanding your distance radius.'
                        : 'Click "Search Available Donors" to find matching blood donors in your region.'}
                    </p>
                    <button
                      onClick={() => handleSearchDonors({ bloodGroup: '', maxDistance: 100 })}
                      className="px-4 py-2 bg-blue-600 text-white rounded-xl font-bold text-xs hover:bg-blue-700"
                    >
                      Expand Search to 100 km
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* TAB 4: BLOOD BANKS & HOSPITAL STOCK */}
            {activeTab === 'bloodBanks' && (
              <div className="space-y-6">
                <div>
                  <h2 className="text-xl font-bold text-gray-900">Nearby Blood Banks & Hospitals</h2>
                  <p className="text-xs text-gray-500">Live inventory and blood availability from verified medical facilities in your area</p>
                </div>

                {bloodStocks.length > 0 ? (
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {bloodStocks.map((facility) => {
                      const dirUrl = buildDirectionsUrl(facility.lat, facility.lng, facility.location);

                      return (
                        <div
                          key={facility._id}
                          className="p-6 rounded-2xl border border-gray-200 bg-white hover:border-purple-300 hover:shadow-md transition-all space-y-4"
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <div className="flex items-center gap-2 flex-wrap">
                                <h3 className="font-extrabold text-gray-900 text-base">{facility.name}</h3>
                                <span className="px-2 py-0.5 bg-purple-100 text-purple-800 rounded-full text-[10px] font-bold">
                                  {facility.type}
                                </span>
                              </div>
                              <p className="text-xs text-gray-600 mt-1">📍 {facility.location}</p>
                              {facility.distance !== null && facility.distance !== undefined && (
                                <p className="text-xs font-semibold text-purple-700 mt-0.5">
                                  🚗 {facility.distance} km away
                                </p>
                              )}
                            </div>

                            {dirUrl && (
                              <a
                                href={dirUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="px-3 py-1.5 rounded-xl bg-purple-50 hover:bg-purple-100 text-purple-700 font-bold text-xs flex items-center gap-1 shrink-0 transition-colors border border-purple-200"
                              >
                                <span>Get Directions</span>
                                <ArrowTopRightOnSquareIcon className="w-3.5 h-3.5" />
                              </a>
                            )}
                          </div>

                          <div className="flex flex-wrap items-center gap-4 text-xs text-gray-500 py-1 border-y border-gray-100">
                            <span>🕒 {facility.operatingHours}</span>
                            {facility.phone && (
                              <a href={`tel:${facility.phone}`} className="hover:text-purple-700 flex items-center gap-1 font-medium">
                                <PhoneIcon className="w-3.5 h-3.5" />
                                <span>{facility.phone}</span>
                              </a>
                            )}
                          </div>

                          {/* 8-Blood Group Grid */}
                          <div>
                            <span className="block text-[11px] font-bold text-gray-700 uppercase tracking-wider mb-2">
                              Live Units in Stock
                            </span>
                            <div className="grid grid-cols-4 sm:grid-cols-8 gap-2">
                              {['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'].map((group) => {
                                const units = facility.bloodStock?.[group] ?? 0;
                                const isOutOfStock = units === 0;
                                const isLow = units > 0 && units <= 5;

                                return (
                                  <div
                                    key={group}
                                    className={`p-2 rounded-xl text-center border ${
                                      isOutOfStock
                                        ? 'bg-red-50/70 border-red-200 text-red-700'
                                        : isLow
                                        ? 'bg-amber-50/70 border-amber-200 text-amber-800'
                                        : 'bg-emerald-50/70 border-emerald-200 text-emerald-800'
                                    }`}
                                  >
                                    <span className="block text-xs font-extrabold">{group}</span>
                                    <span className="block text-sm font-bold mt-0.5">{units}</span>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="py-16 text-center bg-gray-50 rounded-2xl border border-dashed border-gray-300">
                    <BuildingOfficeIcon className="w-12 h-12 text-gray-400 mx-auto mb-3" />
                    <h3 className="text-base font-bold text-gray-800">No blood facilities found</h3>
                    <p className="text-xs text-gray-500 max-w-sm mx-auto mt-1">
                      Check back shortly or create an emergency blood request to reach regional networks.
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

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
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="text-xl font-bold text-gray-900">
                        Emergency Request Coordination
                      </h3>
                      <span className="px-2.5 py-0.5 rounded-full text-xs font-extrabold bg-red-100 text-red-800">
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
                    <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-red-600 mx-auto mb-3"></div>
                    <p className="text-sm text-gray-600 font-medium">Connecting to secure tracking channel...</p>
                  </div>
                ) : trackingError ? (
                  <div className="py-10 text-center text-red-600">
                    <ExclamationTriangleIcon className="h-10 w-10 mx-auto mb-2 text-red-500" />
                    <p className="font-semibold">{trackingError}</p>
                  </div>
                ) : trackingData ? (
                  <div className="space-y-6 pt-4">
                    {/* Fulfillment Choice Notification Banner */}
                    {trackingData.fulfillmentChosen && (
                      <div className="p-3.5 bg-emerald-50 border border-emerald-300 rounded-xl flex items-center justify-between text-xs text-emerald-950 shadow-xs">
                        <div className="flex items-center gap-2.5">
                          <CheckCircleIcon className="w-5 h-5 text-emerald-600 shrink-0" />
                          <div>
                            <p className="font-bold text-emerald-900">
                              Fulfillment Confirmed with {trackingData.selectedResponderType === 'hospital' ? 'Hospital' : 'Donor'}
                            </p>
                            <p className="text-[11px] text-emerald-700">
                              Selected responder is assigned. Other offers are closed and unfulfilled inventory holds are safely released.
                            </p>
                          </div>
                        </div>
                        <span className="px-2.5 py-1 bg-emerald-200/70 text-emerald-900 font-extrabold rounded-full text-[11px] shrink-0">
                          Fulfillment Selected
                        </span>
                      </div>
                    )}

                    {/* Live Tracking Map */}
                    <div className="rounded-xl overflow-hidden border border-gray-200 shadow-sm">
                      <LiveTrackingMap
                        requestId={activeTrackingRequest._id}
                        requesterLocation={trackingData.requesterLocation}
                        hospitalInfo={trackingData.hospitalInfo}
                        donorInfo={trackingData.activeDonor}
                        myRole="recipient"
                        isRequestClosed={['completed', 'cancelled', 'rejected'].includes(trackingData.status)}
                        expiresAt={trackingData.expiresAt}
                        isExpired={trackingData.isExpired}
                        remainingSeconds={trackingData.remainingSeconds}
                        locationSharingExpired={trackingData.locationSharingExpired}
                        onRenewSharing={() => handleRenewSharing(trackingData.activeDonor?._id || trackingData.activeDonor?.responderId || trackingData.hospitalInfo?.hospitalId)}
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
                            Responding Hospitals ({trackingData.allHospitals?.length || (trackingData.hospitalInfo ? 1 : 0)})
                          </span>
                        </div>
                        {(() => {
                          const hospitalsList = (trackingData.allHospitals && trackingData.allHospitals.length > 0)
                            ? trackingData.allHospitals
                            : (trackingData.hospitalInfo ? [trackingData.hospitalInfo] : []);

                          if (hospitalsList.length === 0) {
                            return (
                              <p className="text-xs text-gray-500 py-3 italic">
                                No hospital has responded yet. Eligible hospitals can accept anytime.
                              </p>
                            );
                          }

                          return (
                            <div className="space-y-3">
                              {hospitalsList.map((hosp, idx) => {
                                const isSelected = hosp.isSelected || trackingData.selectedResponderId?.toString() === hosp.responderId?.toString();
                                const dirUrl = buildDirectionsUrl(hosp.lat, hosp.lng, hosp.address) || hosp.directionsUrl;

                                return (
                                  <div
                                    key={hosp.responderId || hosp.hospitalId || idx}
                                    className={`p-3 rounded-xl border text-xs transition-colors overflow-hidden ${
                                      isSelected ? 'bg-white border-blue-500 shadow-sm ring-1 ring-blue-300' : 'bg-white/80 border-blue-200'
                                    }`}
                                  >
                                    <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                                      <div className="space-y-1 min-w-0 flex-1">
                                        <div className="flex items-center gap-1.5 flex-wrap">
                                          <span className="font-bold text-gray-900 text-sm">{hosp.hospitalName || hosp.name}</span>
                                          <span className="text-[10px] px-1.5 py-0.2 rounded bg-blue-100 text-blue-800 font-semibold">
                                            Verified Facility
                                          </span>
                                        </div>
                                        <p className="text-gray-600 break-words">📍 {hosp.address || 'Address on file'}</p>
                                        {hosp.phone && <p className="text-gray-600">📞 {hosp.phone}</p>}
                                        {hosp.unitsReserved > 0 && (
                                          <p className="text-[11px] text-blue-700 font-semibold">
                                            📦 {hosp.unitsReserved} unit(s) reserved in stock
                                          </p>
                                        )}
                                        {dirUrl && (
                                          <div>
                                            <a
                                              href={dirUrl}
                                              target="_blank"
                                              rel="noopener noreferrer"
                                              className="inline-flex items-center gap-1 text-[11px] font-semibold text-blue-700 hover:text-blue-900 underline mt-0.5"
                                            >
                                              <span>Get Directions on Google Maps</span>
                                              <ArrowTopRightOnSquareIcon className="h-3 w-3" />
                                            </a>
                                          </div>
                                        )}
                                      </div>
                                      <div className="shrink-0 flex sm:flex-col items-center sm:items-end justify-between sm:justify-start gap-1.5 pt-2 sm:pt-0 border-t sm:border-t-0 border-gray-100">
                                        {isSelected ? (
                                          <span className="px-3 py-1.5 rounded-full bg-emerald-100 text-emerald-800 text-xs font-bold flex items-center gap-1 shadow-2xs">
                                            <CheckCircleIcon className="w-4 h-4 text-emerald-600" />
                                            Selected Facility
                                          </span>
                                        ) : trackingData.fulfillmentChosen ? (
                                          <span className="px-3 py-1 rounded-lg text-xs text-gray-400 bg-gray-100 font-medium">
                                            Option Closed
                                          </span>
                                        ) : (
                                          <button
                                            onClick={() => handleSelectFulfillment(hosp.responderId || hosp.hospitalId, hosp.responseId, 'hospital')}
                                            className="px-3.5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 active:scale-95 text-white text-xs font-bold shadow-xs transition-all whitespace-nowrap"
                                          >
                                            Choose Hospital Stock
                                          </button>
                                        )}
                                      </div>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          );
                        })()}
                        <p className="text-[10px] text-gray-500 italic mt-2">
                          Notice: Hospital inventory is reserved atomically when accepted and released safely if another option is chosen.
                        </p>
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
                              const isSelected = donor.isSelected || trackingData.selectedResponderId?.toString() === donor.responderId?.toString();
                              return (
                                <div
                                  key={donor.responderId}
                                  className={`p-3 rounded-xl border text-xs transition-colors overflow-hidden ${
                                    isSelected ? 'bg-white border-rose-500 shadow-sm ring-1 ring-rose-300' : 'bg-white/90 border-rose-200'
                                  }`}
                                >
                                  <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                                    <div className="space-y-1 min-w-0 flex-1">
                                      <div className="flex items-center gap-1.5 flex-wrap">
                                        <span className="font-bold text-gray-900 text-sm">{donor.name}</span>
                                        <span className="px-2 py-0.5 rounded text-[11px] font-extrabold bg-rose-100 text-rose-800 border border-rose-200">
                                          {donor.bloodGroup}
                                        </span>
                                        {donor.isExpired ? (
                                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-rose-100 text-rose-800 font-bold">
                                            24h Expired
                                          </span>
                                        ) : donor.donorShareLocation ? (
                                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800 font-semibold flex items-center gap-1">
                                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                                            Live Active
                                          </span>
                                        ) : null}
                                      </div>

                                      {donor.phone && (
                                        <p className="text-gray-600 flex items-center gap-1 text-xs">
                                          <span>📞</span>
                                          <span>{donor.phone}</span>
                                        </p>
                                      )}

                                      {(donor.address || donor.currentLocation?.address) && (
                                        <p className="text-gray-700 text-xs flex items-start gap-1 font-medium" title={donor.address || donor.currentLocation?.address}>
                                          <MapPinIcon className="w-3.5 h-3.5 text-emerald-600 shrink-0 mt-0.5" />
                                          <span className="break-words line-clamp-2">{donor.address || donor.currentLocation?.address}</span>
                                        </p>
                                      )}

                                      {donor.directionsUrl && (
                                        <div>
                                          <a
                                            href={donor.directionsUrl}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="inline-flex items-center gap-1 text-[11px] font-semibold text-blue-700 hover:text-blue-900 underline mt-0.5"
                                          >
                                            <span>Get Directions to Donor Address</span>
                                            <ArrowTopRightOnSquareIcon className="h-3 w-3" />
                                          </a>
                                        </div>
                                      )}

                                      <div className="mt-1 flex items-center gap-1.5 text-[11px] text-gray-500 flex-wrap">
                                        <span className="capitalize font-medium text-gray-700">{donor.trackingStatus || 'En route'}</span>
                                        {donor.isExpired && (
                                          <button
                                            onClick={() => handleRenewSharing(donor.responderId)}
                                            className="px-2 py-0.5 rounded bg-rose-100 hover:bg-rose-200 text-rose-800 text-[10px] font-bold transition-colors"
                                          >
                                            + Renew 24h Window
                                          </button>
                                        )}
                                      </div>
                                    </div>

                                    <div className="shrink-0 flex sm:flex-col items-center sm:items-end justify-between sm:justify-start gap-1.5 pt-2 sm:pt-0 border-t sm:border-t-0 border-gray-100">
                                      {isSelected ? (
                                        <span className="px-3 py-1.5 rounded-full bg-emerald-100 text-emerald-800 text-xs font-bold flex items-center gap-1 shadow-2xs">
                                          <CheckCircleIcon className="w-4 h-4 text-emerald-600" />
                                          Selected Match
                                        </span>
                                      ) : trackingData.fulfillmentChosen ? (
                                        <span className="px-3 py-1 rounded-lg text-xs text-gray-400 bg-gray-100 font-medium">
                                          Option Closed
                                        </span>
                                      ) : (
                                        <button
                                          onClick={() => handleSelectFulfillment(donor.responderId, donor.responseId, 'donor')}
                                          className="px-3.5 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 active:scale-95 text-white text-xs font-bold shadow-xs transition-all whitespace-nowrap"
                                        >
                                          Choose Donor Match
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
    </div>
  );
};

export default RecipientDashboard;
