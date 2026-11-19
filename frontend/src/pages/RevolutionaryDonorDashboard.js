import React, { useState, useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '../contexts/AuthContext';
import { useNotifications } from '../contexts/NotificationContext';
import { requestAPI, userAPI, certificateAPI } from '../services/api';
import CertificateGallery from '../components/CertificateGallery';
import LiveTrackingMap from '../components/LiveTrackingMap';
import { buildDirectionsUrl } from '../utils/mapUtils';
import {
  HeartIcon,
  UserGroupIcon,
  BuildingOfficeIcon,
  MapPinIcon,
  CalendarIcon,
  ClockIcon,
  CheckCircleIcon,
  ExclamationTriangleIcon,
  TrophyIcon,
  SparklesIcon,
  ShareIcon,
  XMarkIcon,
  ShieldCheckIcon,
  PhotoIcon,
  PauseIcon,
  PlayIcon,
  ArrowTopRightOnSquareIcon,
  ArrowPathIcon,
  PhoneIcon,
  EyeIcon,
  TrashIcon,
  PlusIcon
} from '@heroicons/react/24/outline';
import { HeartIcon as HeartSolidIcon } from '@heroicons/react/24/solid';

const RevolutionaryDonorDashboard = () => {
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

  const { notifications, showNotification, newBloodRequest, socket } = useNotifications();

  // Fallback notification function if context is not available
  const notify = showNotification || ((message, type = 'info') => {
    console.log(`[${type.toUpperCase()}] ${message}`);
  });

  // State
  const [loading, setLoading] = useState(true);
  const [activeSection, setActiveSection] = useState('requests'); // 'requests' | 'active' | 'camps' | 'history' | 'impact'
  const [requestFilter, setRequestFilter] = useState('all'); // 'all' | 'urgent' | 'matching'
  const [isAvailable, setIsAvailable] = useState(user?.isAvailable !== false);
  const [availabilityLoading, setAvailabilityLoading] = useState(false);

  // Data
  const [nearbyRequests, setNearbyRequests] = useState([]);
  const [donationHistory, setDonationHistory] = useState([]);
  const [donationCamps, setDonationCamps] = useState([]);
  const [campsLoading, setCampsLoading] = useState(false);
  const [registeringCampId, setRegisteringCampId] = useState(null);

  // Active donation coordination & live GPS tracking
  const [pendingAcceptRequest, setPendingAcceptRequest] = useState(null);
  const [acceptConsentShareLocation, setAcceptConsentShareLocation] = useState(true);
  const [acceptingInProgress, setAcceptingInProgress] = useState(false);
  const [activeDonation, setActiveDonation] = useState(() => {
    try {
      const saved = localStorage.getItem('bloodnet_active_donation');
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });
  const [activeDonationTracking, setActiveDonationTracking] = useState(null);
  const [donorCoords, setDonorCoords] = useState(null);
  const [donorTrackingStatus, setDonorTrackingStatus] = useState('active');
  const [donorAddress, setDonorAddress] = useState(() => {
    return user?.location?.address || user?.address || (user?.city && user?.state ? `${user.city}, ${user.state}` : '') || '';
  });
  const [isEditingAddress, setIsEditingAddress] = useState(false);
  const [tempAddress, setTempAddress] = useState('');
  const watchIdRef = useRef(null);
  const lastBroadcastTimeRef = useRef(0);

  // Impact and photos
  const [livesSaved, setLivesSaved] = useState(0);
  const [totalImpact, setTotalImpact] = useState(0);
  const [nextMilestone, setNextMilestone] = useState(1);
  const [uploadingPicture, setUploadingPicture] = useState(false);
  const [uploadedPhotos, setUploadedPhotos] = useState([]);
  const [selectedPhoto, setSelectedPhoto] = useState(null);
  const [showCertificateModal, setShowCertificateModal] = useState(false);
  const fileInputRef = useRef(null);

  const milestones = [
    { donations: 1, title: 'First Drop', icon: '💧', color: 'from-blue-500 to-blue-600' },
    { donations: 3, title: 'Life Saver', icon: '🌟', color: 'from-purple-500 to-purple-600' },
    { donations: 5, title: 'Hero Level', icon: '🦸', color: 'from-red-500 to-red-600' },
    { donations: 10, title: 'Champion', icon: '🏆', color: 'from-amber-500 to-amber-600' },
    { donations: 25, title: 'Legend', icon: '👑', color: 'from-indigo-500 to-indigo-600' },
    { donations: 50, title: 'Life Immortal', icon: '🌟', color: 'from-rose-500 to-rose-600' }
  ];

  // Synchronize donor address if user object updates
  useEffect(() => {
    if (user && !donorAddress) {
      const userAddr = user.location?.address || user.address || (user.city && user.state ? `${user.city}, ${user.state}` : '');
      if (userAddr) setDonorAddress(userAddr);
    }
  }, [user, donorAddress]);

  const handleUpdateDonorAddress = async (newAddr) => {
    const clean = (newAddr || '').trim();
    if (!clean) return;
    try {
      setDonorAddress(clean);
      setDonorCoords(prev => ({
        ...(prev || {}),
        address: clean,
        lastUpdated: new Date().toISOString()
      }));
      if (activeDonation?._id) {
        await requestAPI.updateLocation(activeDonation._id, {
          address: clean
        });
        notify('📍 Current location address updated for recipient tracking', 'success');
      }
      setIsEditingAddress(false);
    } catch (err) {
      console.error('Failed to update address:', err);
      notify('Failed to update location address', 'error');
    }
  };

  // Fetch all dashboard data
  const fetchDashboardData = async () => {
    try {
      setLoading(true);

      const [requestsRes, historyRes, campsRes, activeRes] = await Promise.allSettled([
        requestAPI.getNearbyRequests(),
        userAPI.getDonationHistory(),
        userAPI.getNearbyDonationCamps(),
        requestAPI.getDonorActiveDonation()
      ]);

      // 1. Nearby requests
      if (requestsRes.status === 'fulfilled') {
        const reqs = requestsRes.value.data.requests || [];
        setNearbyRequests(reqs);
      } else {
        console.warn('Failed to fetch nearby requests:', requestsRes.reason);
      }

      // 2. Donation history
      let hist = [];
      if (historyRes.status === 'fulfilled') {
        hist = historyRes.value.data.donations || [];
        setDonationHistory(hist);
        calculateImpact(hist);
      } else {
        console.warn('Failed to fetch donation history:', historyRes.reason);
      }

      // 3. Donation camps
      if (campsRes.status === 'fulfilled') {
        setDonationCamps(campsRes.value.data.camps || []);
      } else {
        console.warn('Failed to fetch donation camps:', campsRes.reason);
      }

      // 4. Active ongoing donation
      if (activeRes.status === 'fulfilled') {
        const data = activeRes.value.data;
        if (data?.hasActive && data?.request) {
          const req = data.request;
          const myResp = data.myResponse;
          const restoredActive = {
            _id: req._id,
            bloodGroup: req.bloodGroup,
            unitsNeeded: req.unitsNeeded,
            recipientName: req.recipientName || 'Recipient',
            location: req.location,
            shareLocation: myResp?.donorShareLocation !== false,
            donorTrackingStatus: myResp?.trackingStatus || 'active'
          };
          setActiveDonation(restoredActive);
          setDonorTrackingStatus(myResp?.trackingStatus || 'active');
          localStorage.setItem('bloodnet_active_donation', JSON.stringify(restoredActive));
          if (data.tracking) {
            setActiveDonationTracking(data.tracking);
          }
        } else if (data && !data.hasActive) {
          setActiveDonation(null);
          setActiveDonationTracking(null);
          localStorage.removeItem('bloodnet_active_donation');
        }
      }
    } catch (error) {
      console.error('Critical error in fetchDashboardData:', error);
    } finally {
      setLoading(false);
    }
  };

  const calculateImpact = (donations) => {
    const completed = donations.filter(d => d.status === 'completed');
    const lives = completed.length * 3;
    const impact = completed.length * 100 + uploadedPhotos.length * 10;

    setLivesSaved(lives);
    setTotalImpact(impact);

    const nextM = milestones.find(m => m.donations > completed.length);
    setNextMilestone(nextM ? nextM.donations - completed.length : 0);
  };

  useEffect(() => {
    if (user) {
      setIsAvailable(user?.isAvailable !== false);
      fetchDashboardData();
    }
  }, [user]);

  // Real-time listener for incoming blood requests
  useEffect(() => {
    if (newBloodRequest?.request) {
      setNearbyRequests(prev => {
        const exists = prev.some(r => r._id === newBloodRequest.request._id);
        if (!exists) {
          notify(`🩸 Urgent request! ${newBloodRequest.request.bloodGroup} needed at ${newBloodRequest.request.location?.address || 'nearby location'}`, 'info');
          return [newBloodRequest.request, ...prev];
        }
        return prev;
      });
    }
  }, [newBloodRequest]);

  // Toggle donor availability status
  const handleToggleAvailability = async () => {
    try {
      setAvailabilityLoading(true);
      const nextStatus = !isAvailable;
      await userAPI.updateAvailability(nextStatus);
      setIsAvailable(nextStatus);
      notify(nextStatus ? '🟢 You are now marked as Available to Donate!' : '⚪ You are marked as Temporarily Busy', 'success');
    } catch (err) {
      console.error('Failed to update availability:', err);
      notify('Failed to update availability status', 'error');
    } finally {
      setAvailabilityLoading(false);
    }
  };

  // 1. Accept request initiation & confirmation
  const initiateAcceptRequest = (request) => {
    setPendingAcceptRequest(request);
    setAcceptConsentShareLocation(true);
  };

  const confirmAcceptRequest = async () => {
    if (!pendingAcceptRequest) return;
    setAcceptingInProgress(true);
    try {
      let initialCoords = null;
      if (acceptConsentShareLocation && navigator.geolocation) {
        try {
          const pos = await new Promise((resolve, reject) =>
            navigator.geolocation.getCurrentPosition(resolve, reject, { enableHighAccuracy: true, timeout: 8000 })
          );
          initialCoords = {
            address: donorAddress || user?.location?.address || user?.address || '',
            lat: pos.coords.latitude,
            lng: pos.coords.longitude,
            accuracy: Math.round(pos.coords.accuracy),
            lastUpdated: new Date().toISOString()
          };
          setDonorCoords(initialCoords);
        } catch (posErr) {
          console.warn('Initial geolocation warning:', posErr.message);
        }
      }

      const defaultAddr = donorAddress || user?.location?.address || user?.address || (user?.city && user?.state ? `${user.city}, ${user.state}` : '') || '';
      await requestAPI.respondToRequest(pendingAcceptRequest._id, {
        response: 'accepted',
        shareLocation: acceptConsentShareLocation,
        address: defaultAddr,
        currentLocation: {
          ...(initialCoords || {}),
          address: defaultAddr
        }
      });

      const newActive = {
        _id: pendingAcceptRequest._id,
        bloodGroup: pendingAcceptRequest.bloodGroup,
        unitsNeeded: pendingAcceptRequest.unitsNeeded,
        recipientName: pendingAcceptRequest.recipientName || 'Recipient',
        location: pendingAcceptRequest.location,
        shareLocation: acceptConsentShareLocation
      };
      setActiveDonation(newActive);
      localStorage.setItem('bloodnet_active_donation', JSON.stringify(newActive));

      // Mark the accepted request in state immediately so the button updates in real time
      setNearbyRequests(prev => prev.map(req => {
        if (req._id === pendingAcceptRequest._id) {
          return {
            ...req,
            hasAccepted: true,
            myResponseStatus: 'accepted'
          };
        }
        return req;
      }));

      socket?.emit('joinTrackingRoom', { requestId: pendingAcceptRequest._id, userId: user?._id || user?.id });
      notify('✅ Blood request accepted! You are now connected with the recipient.', 'success');

      try {
        await certificateAPI.generateCertificate(pendingAcceptRequest._id);
      } catch (certError) {
        console.warn('Certificate generation note:', certError.message);
      }

      try {
        const trRes = await requestAPI.getRequestTracking(pendingAcceptRequest._id);
        setActiveDonationTracking(trRes.data.tracking || trRes.data);
      } catch (trErr) {
        console.warn('Failed to load tracking data:', trErr.message);
      }

      setPendingAcceptRequest(null);
      setActiveSection('active');
      fetchDashboardData();
    } catch (err) {
      console.error('Failed to accept request:', err);
      notify(err.response?.data?.message || 'Failed to accept request', 'error');
    } finally {
      setAcceptingInProgress(false);
    }
  };

  const setActiveDonationFromRequest = (request) => {
    const newActive = {
      _id: request._id,
      bloodGroup: request.bloodGroup,
      unitsNeeded: request.unitsNeeded,
      recipientName: request.recipientName || 'Recipient',
      location: request.location,
      shareLocation: true,
      donorTrackingStatus: 'active'
    };
    setActiveDonation(newActive);
    localStorage.setItem('bloodnet_active_donation', JSON.stringify(newActive));
    setActiveSection('active');
  };

  const isRequestAcceptedByMe = (req) => {
    if (!req) return false;
    const userId = user?._id || user?.id;
    if (activeDonation?._id?.toString() === req._id?.toString()) return true;
    if (req.hasAccepted || req.myResponseStatus === 'accepted' || req.myResponseStatus === 'selected') return true;
    if (userId && req.donorId?.toString() === userId.toString()) return true;
    if (userId && req.selectedResponderId?.toString() === userId.toString()) return true;
    if (userId && req.responses?.some(r => r.responderId?.toString() === userId.toString() && ['accepted', 'selected'].includes(r.responseStatus))) return true;
    return false;
  };

  const isRequestFulfillmentChosenForMe = (req) => {
    if (!req) return false;
    const userId = user?._id || user?.id;
    return Boolean(req.isFulfillmentSelected || (userId && req.selectedResponderId?.toString() === userId.toString()));
  };

  const isRequestClosedForMe = (req) => {
    if (!req) return false;
    const userId = user?._id || user?.id;
    return Boolean(req.isClosedForMe || (req.fulfillmentChosen && userId && req.selectedResponderId?.toString() !== userId.toString()));
  };

  // 2. Synchronize tracking stream and socket room whenever activeDonation is present
  useEffect(() => {
    if (!activeDonation?._id) {
      setActiveDonationTracking(null);
      return;
    }

    let isMounted = true;
    socket?.emit('joinTrackingRoom', { requestId: activeDonation._id, userId: user?._id || user?.id });

    const refreshTracking = async () => {
      try {
        const res = await requestAPI.getRequestTracking(activeDonation._id);
        if (isMounted) {
          setActiveDonationTracking(res.data.tracking || res.data);
        }
      } catch (err) {
        console.warn('Tracking fetch error:', err.message);
      }
    };
    refreshTracking();

    const onTrackingStopped = (payload) => {
      if (payload.requestId === activeDonation._id) {
        notify('Donor coordination for this request has concluded.', 'info');
        setActiveDonation(null);
        setActiveDonationTracking(null);
        localStorage.removeItem('bloodnet_active_donation');
        if (watchIdRef.current !== null && navigator.geolocation) {
          navigator.geolocation.clearWatch(watchIdRef.current);
          watchIdRef.current = null;
        }
        fetchDashboardData();
      }
    };

    const onLocationUpdate = (payload) => {
      if (payload.requestId === activeDonation._id) {
        setActiveDonationTracking(prev => {
          if (!prev) return prev;
          if (payload.senderRole === 'recipient' && payload.location) {
            return {
              ...prev,
              requesterLocation: {
                ...prev.requesterLocation,
                lat: payload.location.lat,
                lng: payload.location.lng,
                accuracy: payload.location.accuracy,
                lastUpdated: payload.location.lastUpdated,
                isStale: false
              }
            };
          }
          return prev;
        });
      }
    };

    socket?.on('trackingStopped', onTrackingStopped);
    socket?.on('trackingLocationUpdate', onLocationUpdate);

    return () => {
      isMounted = false;
      socket?.emit('leaveTrackingRoom', { requestId: activeDonation._id });
      socket?.off('trackingStopped', onTrackingStopped);
      socket?.off('trackingLocationUpdate', onLocationUpdate);
    };
  }, [activeDonation?._id, socket, user]);

  // 3. Live GPS broadcaster for active donation while tab is open
  useEffect(() => {
    if (!activeDonation || !activeDonation.shareLocation || donorTrackingStatus !== 'active') {
      if (watchIdRef.current !== null && navigator.geolocation) {
        navigator.geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }
      return;
    }

    const activeAddr = donorAddress || user?.location?.address || user?.address || '';

    // If geolocation is not available, broadcast address-based location immediately
    if (!navigator.geolocation) {
      console.warn('Geolocation not supported on this device, using address-based tracking');
      if (activeAddr) {
        requestAPI.updateLocation(activeDonation._id, {
          address: activeAddr
        }).catch(() => {});
      }
      return;
    }

    watchIdRef.current = navigator.geolocation.watchPosition(
      (pos) => {
        const { latitude, longitude, accuracy } = pos.coords;
        const now = Date.now();
        const updatedCoords = {
          address: activeAddr,
          lat: latitude,
          lng: longitude,
          accuracy: Math.round(accuracy),
          lastUpdated: new Date().toISOString()
        };
        setDonorCoords(updatedCoords);

        // Throttle updates: send at most once every 15 seconds
        if (now - lastBroadcastTimeRef.current >= 15000) {
          lastBroadcastTimeRef.current = now;
          requestAPI.updateLocation(activeDonation._id, {
            address: activeAddr,
            lat: latitude,
            lng: longitude,
            accuracy: Math.round(accuracy)
          }).catch(err => console.warn('Broadcast location err:', err.message));
        }
      },
      (err) => {
        console.warn('Geolocation watch error, falling back to address-based tracking:', err.message);
        if (activeAddr) {
          setDonorCoords(prev => ({
            ...(prev || {}),
            address: activeAddr,
            lastUpdated: new Date().toISOString()
          }));
          if (Date.now() - lastBroadcastTimeRef.current >= 30000) {
            lastBroadcastTimeRef.current = Date.now();
            requestAPI.updateLocation(activeDonation._id, {
              address: activeAddr
            }).catch(() => {});
          }
        }
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 10000 }
    );

    return () => {
      if (watchIdRef.current !== null && navigator.geolocation) {
        navigator.geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }
    };
  }, [activeDonation, donorTrackingStatus]);

  const handleToggleDonorLocation = async () => {
    if (!activeDonation) return;
    const nextStatus = donorTrackingStatus === 'active' ? 'paused' : 'active';
    try {
      await requestAPI.updateLocationConsent(activeDonation._id, {
        shareLocation: nextStatus === 'active',
        trackingStatus: nextStatus
      });
      setDonorTrackingStatus(nextStatus);
      notify(nextStatus === 'active' ? 'Live GPS location sharing resumed' : 'Live location sharing paused', 'info');
    } catch (err) {
      console.error('Failed to toggle location:', err);
    }
  };

  const handleCompleteActiveDonation = async () => {
    if (!activeDonation) return;
    if (!window.confirm('Have you arrived at the facility and completed the donation? This will fulfill the request.')) return;
    try {
      await requestAPI.updateRequestStatus(activeDonation._id, 'completed');
      setActiveDonation(null);
      localStorage.removeItem('bloodnet_active_donation');
      notify('🎉 Thank you for saving a life! Donation completed successfully.', 'success');
      setActiveSection('history');
      fetchDashboardData();
    } catch (err) {
      console.error('Failed to complete donation:', err);
      notify(err.response?.data?.message || 'Failed to complete donation', 'error');
    }
  };

  // Refer request to friends or community
  const handleReferFriend = (request) => {
    const message = `🚨 Emergency blood needed! ${request.bloodGroup} blood required (${request.unitsNeeded} units) at ${request.location?.address || 'local hospital'}. If you can donate or know someone, please help save a life!`;

    if (navigator.share) {
      navigator.share({
        title: 'Emergency Blood Need - BloodNet+',
        text: message,
        url: window.location.href
      }).catch(err => {
        navigator.clipboard.writeText(message);
        notify('Request details copied to clipboard!', 'success');
      });
    } else {
      navigator.clipboard.writeText(message);
      notify('Request details copied to clipboard!', 'success');
    }
  };

  // Register for donation camp
  const handleCampRegistration = async (campId) => {
    try {
      setRegisteringCampId(campId);
      const res = await userAPI.registerForDonationCamp(campId);
      notify(res.data?.message || '✅ Successfully registered for donation camp!', 'success');
      setDonationCamps(prev =>
        prev.map(c => (c._id === campId ? { ...c, registered: true } : c))
      );
    } catch (error) {
      console.error('Camp registration error:', error);
      notify(error.response?.data?.message || 'Failed to register for camp', 'error');
    } finally {
      setRegisteringCampId(null);
    }
  };

  // Photo upload
  const handlePictureUpload = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    setUploadingPicture(true);
    try {
      await new Promise(r => setTimeout(r, 1200));
      const photo = {
        id: Date.now(),
        url: URL.createObjectURL(file),
        name: file.name,
        uploadDate: new Date().toISOString()
      };
      setUploadedPhotos(prev => [photo, ...prev]);
      setTotalImpact(prev => prev + 10);
      notify('🎉 Photo uploaded! You earned 10 Impact Points!', 'success');
    } catch (err) {
      notify('Failed to upload picture', 'error');
    } finally {
      setUploadingPicture(false);
    }
  };

  const handleDeletePhoto = (photoId) => {
    if (window.confirm('Delete this donation photo?')) {
      setUploadedPhotos(prev => prev.filter(p => p.id !== photoId));
      setSelectedPhoto(null);
      notify('Photo removed', 'info');
    }
  };

  const getMilestoneProgress = () => {
    const count = donationHistory.length;
    const currentM = milestones.find(m => m.donations > count);
    if (!currentM) return 100;
    const prevM = milestones[milestones.indexOf(currentM) - 1] || { donations: 0 };
    return Math.min(Math.round(((count - prevM.donations) / (currentM.donations - prevM.donations)) * 100), 100);
  };

  const getCurrentMilestone = () => {
    const count = donationHistory.length;
    return [...milestones].reverse().find(m => count >= m.donations) || milestones[0];
  };

  // Request filtering
  const filteredRequests = nearbyRequests.filter(req => {
    if (requestFilter === 'urgent') return req.urgency === 'critical' || req.urgency === 'emergency' || req.urgency === 'urgent';
    if (requestFilter === 'matching') return user?.bloodGroup ? req.bloodGroup === user.bloodGroup : true;
    return true;
  });

  if (loading && nearbyRequests.length === 0 && donationHistory.length === 0) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-red-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-red-600 mx-auto mb-4"></div>
          <p className="text-gray-600 font-medium">Loading Donor Hub...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-red-50/30 py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8">

        {/* Clinical Header */}
        <div className="bg-white rounded-2xl p-6 sm:p-8 shadow-sm border border-gray-200">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div className="space-y-2">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl bg-red-100 flex items-center justify-center text-red-600">
                  <HeartSolidIcon className="w-7 h-7" />
                </div>
                <div>
                  <h1 className="text-2xl sm:text-3xl font-extrabold text-gray-900 tracking-tight">
                    {isNewUser ? `Welcome, ${user?.name || 'Life Saver'}!` : `Welcome Back, ${user?.name || 'Life Saver'}!`}
                  </h1>
                  <p className="text-xs sm:text-sm text-gray-500 font-medium">
                    BloodNet+ Voluntary Donor Hub • Connect, Coordinate & Save Lives
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2 pt-1 text-xs">
                <span className="px-2.5 py-1 bg-red-100 text-red-800 font-bold rounded-full">
                  Blood Group: {user?.bloodGroup || 'O+'}
                </span>
                <span className="px-2.5 py-1 bg-emerald-100 text-emerald-800 font-semibold rounded-full flex items-center gap-1">
                  <CheckCircleIcon className="w-3.5 h-3.5" />
                  Verified Donor
                </span>
                {user?.location?.address && (
                  <span className="px-2.5 py-1 bg-gray-100 text-gray-700 font-medium rounded-full truncate max-w-xs">
                    📍 {user.location.address}
                  </span>
                )}
              </div>
            </div>

            {/* Availability Toggle Switch */}
            <div className="flex items-center gap-4 bg-gray-50 p-3 sm:p-4 rounded-xl border border-gray-200">
              <div className="text-left">
                <p className="text-xs font-bold text-gray-800">Donation Availability</p>
                <p className="text-[11px] text-gray-500">
                  {isAvailable ? 'Visible to nearby patients in need' : 'Temporarily paused'}
                </p>
              </div>

              <button
                type="button"
                onClick={handleToggleAvailability}
                disabled={availabilityLoading}
                className={`relative inline-flex h-7 w-14 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                  isAvailable ? 'bg-emerald-600' : 'bg-gray-300'
                }`}
              >
                <span
                  className={`pointer-events-none inline-block h-6 w-6 transform rounded-full bg-white shadow-md ring-0 transition duration-200 ease-in-out ${
                    isAvailable ? 'translate-x-7' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>
          </div>
        </div>

        {/* Top 4 KPI Metric Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
          {/* Card 1: Urgent Requests */}
          <div
            onClick={() => setActiveSection('requests')}
            className={`p-6 rounded-2xl bg-white border cursor-pointer transition-all duration-200 shadow-xs hover:shadow-md ${
              activeSection === 'requests' ? 'border-red-500 ring-2 ring-red-500/20' : 'border-gray-200 hover:border-red-300'
            }`}
          >
            <div className="flex items-center justify-between mb-4">
              <span className="text-xs font-bold uppercase tracking-wider text-gray-500">Urgent Requests</span>
              <div className="w-10 h-10 rounded-xl bg-red-50 text-red-600 flex items-center justify-center">
                <HeartIcon className="w-6 h-6" />
              </div>
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-extrabold text-gray-900">{nearbyRequests.length}</span>
              {nearbyRequests.length > 0 && (
                <span className="text-xs font-bold text-red-600 bg-red-100 px-2 py-0.5 rounded-full animate-pulse">
                  Waiting
                </span>
              )}
            </div>
            <p className="text-xs text-gray-500 mt-2">Open blood needs in your area</p>
          </div>

          {/* Card 2: Active Coordination */}
          <div
            onClick={() => {
              if (activeDonation) setActiveSection('active');
              else setActiveSection('requests');
            }}
            className={`p-6 rounded-2xl bg-white border cursor-pointer transition-all duration-200 shadow-xs hover:shadow-md ${
              activeSection === 'active' ? 'border-emerald-500 ring-2 ring-emerald-500/20' : 'border-gray-200 hover:border-emerald-300'
            }`}
          >
            <div className="flex items-center justify-between mb-4">
              <span className="text-xs font-bold uppercase tracking-wider text-gray-500">Active Donation</span>
              <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
                <ClockIcon className="w-6 h-6" />
              </div>
            </div>
            <div className="flex items-baseline gap-2">
              {activeDonation ? (
                <>
                  <span className="text-xl font-extrabold text-emerald-600">En Route</span>
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-ping"></span>
                </>
              ) : (
                <span className="text-xl font-extrabold text-gray-400">Ready</span>
              )}
            </div>
            <p className="text-xs text-gray-500 mt-2">
              {activeDonation ? `Coordinating ${activeDonation.bloodGroup} donation` : 'No active trip in progress'}
            </p>
          </div>

          {/* Card 3: Total Impact & Lives Saved */}
          <div
            onClick={() => setActiveSection('history')}
            className={`p-6 rounded-2xl bg-white border cursor-pointer transition-all duration-200 shadow-xs hover:shadow-md ${
              activeSection === 'history' ? 'border-blue-500 ring-2 ring-blue-500/20' : 'border-gray-200 hover:border-blue-300'
            }`}
          >
            <div className="flex items-center justify-between mb-4">
              <span className="text-xs font-bold uppercase tracking-wider text-gray-500">My Impact</span>
              <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
                <TrophyIcon className="w-6 h-6" />
              </div>
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-extrabold text-gray-900">{livesSaved}</span>
              <span className="text-xs text-blue-600 font-semibold bg-blue-50 px-2 py-0.5 rounded-full">
                Lives Saved
              </span>
            </div>
            <p className="text-xs text-gray-500 mt-2">{donationHistory.length} completed blood donations</p>
          </div>

          {/* Card 4: Donation Camps */}
          <div
            onClick={() => setActiveSection('camps')}
            className={`p-6 rounded-2xl bg-white border cursor-pointer transition-all duration-200 shadow-xs hover:shadow-md ${
              activeSection === 'camps' ? 'border-purple-500 ring-2 ring-purple-500/20' : 'border-gray-200 hover:border-purple-300'
            }`}
          >
            <div className="flex items-center justify-between mb-4">
              <span className="text-xs font-bold uppercase tracking-wider text-gray-500">Donation Camps</span>
              <div className="w-10 h-10 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center">
                <BuildingOfficeIcon className="w-6 h-6" />
              </div>
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-extrabold text-gray-900">{donationCamps.length}</span>
              <span className="text-xs text-purple-600 font-semibold bg-purple-50 px-2 py-0.5 rounded-full">
                Upcoming
              </span>
            </div>
            <p className="text-xs text-gray-500 mt-2">Community blood drives in region</p>
          </div>
        </div>

        {/* Standard Segmented Navigation Tabs */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="border-b border-gray-200 bg-gray-50/60 px-4 sm:px-6">
            <nav className="flex space-x-4 sm:space-x-8 overflow-x-auto py-2">
              <button
                onClick={() => setActiveSection('requests')}
                className={`py-3 px-3 rounded-lg font-bold text-sm flex items-center space-x-2 whitespace-nowrap transition-colors ${
                  activeSection === 'requests'
                    ? 'bg-white text-red-600 shadow-xs border border-gray-200'
                    : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100/60'
                }`}
              >
                <HeartIcon className="w-4 h-4" />
                <span>Urgent Blood Requests ({nearbyRequests.length})</span>
                {nearbyRequests.length > 0 && (
                  <span className="px-2 py-0.5 rounded-full text-[11px] bg-red-600 text-white font-extrabold">
                    {nearbyRequests.length}
                  </span>
                )}
              </button>

              <button
                onClick={() => setActiveSection('active')}
                className={`py-3 px-3 rounded-lg font-bold text-sm flex items-center space-x-2 whitespace-nowrap transition-colors ${
                  activeSection === 'active'
                    ? 'bg-white text-emerald-600 shadow-xs border border-gray-200'
                    : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100/60'
                }`}
              >
                <ClockIcon className="w-4 h-4" />
                <span>Live Donation Coordination</span>
                {activeDonation && (
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping"></span>
                )}
              </button>

              <button
                onClick={() => setActiveSection('camps')}
                className={`py-3 px-3 rounded-lg font-bold text-sm flex items-center space-x-2 whitespace-nowrap transition-colors ${
                  activeSection === 'camps'
                    ? 'bg-white text-purple-600 shadow-xs border border-gray-200'
                    : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100/60'
                }`}
              >
                <BuildingOfficeIcon className="w-4 h-4" />
                <span>Donation Camps ({donationCamps.length})</span>
              </button>

              <button
                onClick={() => setActiveSection('history')}
                className={`py-3 px-3 rounded-lg font-bold text-sm flex items-center space-x-2 whitespace-nowrap transition-colors ${
                  activeSection === 'history'
                    ? 'bg-white text-blue-600 shadow-xs border border-gray-200'
                    : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100/60'
                }`}
              >
                <TrophyIcon className="w-4 h-4" />
                <span>History & Certificates ({donationHistory.length})</span>
              </button>

              <button
                onClick={() => setActiveSection('impact')}
                className={`py-3 px-3 rounded-lg font-bold text-sm flex items-center space-x-2 whitespace-nowrap transition-colors ${
                  activeSection === 'impact'
                    ? 'bg-white text-amber-600 shadow-xs border border-gray-200'
                    : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100/60'
                }`}
              >
                <SparklesIcon className="w-4 h-4" />
                <span>Journey & Badges</span>
              </button>
            </nav>
          </div>

          <div className="p-6 sm:p-8">

            {/* TAB 1: URGENT BLOOD REQUESTS */}
            {activeSection === 'requests' && (
              <div className="space-y-6">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-gray-200">
                  <div>
                    <h2 className="text-xl font-bold text-gray-900">Urgent Blood Requests Near You</h2>
                    <p className="text-xs text-gray-500">Patients and hospitals in urgent need of your blood type</p>
                  </div>

                  {/* Filter Pills */}
                  <div className="flex items-center space-x-2">
                    <button
                      onClick={() => setRequestFilter('all')}
                      className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                        requestFilter === 'all' ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      }`}
                    >
                      All ({nearbyRequests.length})
                    </button>
                    <button
                      onClick={() => setRequestFilter('urgent')}
                      className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                        requestFilter === 'urgent' ? 'bg-red-600 text-white' : 'bg-red-50 text-red-700 hover:bg-red-100'
                      }`}
                    >
                      🚨 Emergency Only
                    </button>
                    <button
                      onClick={() => setRequestFilter('matching')}
                      className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                        requestFilter === 'matching' ? 'bg-blue-600 text-white' : 'bg-blue-50 text-blue-700 hover:bg-blue-100'
                      }`}
                    >
                      Match My Type ({user?.bloodGroup || 'O+'})
                    </button>
                  </div>
                </div>

                {filteredRequests.length > 0 ? (
                  <div className="space-y-4">
                    {filteredRequests.map((request) => {
                      const isEmergency = request.urgency === 'critical' || request.urgency === 'emergency';
                      const directionsUrl = buildDirectionsUrl(request.location?.lat, request.location?.lng, request.location?.address);
                      const acceptedByMe = isRequestAcceptedByMe(request);
                      const chosenForMe = isRequestFulfillmentChosenForMe(request);
                      const closedForMe = isRequestClosedForMe(request);

                      return (
                        <div
                          key={request._id}
                          className={`p-6 rounded-2xl border transition-all ${
                            acceptedByMe
                              ? 'bg-emerald-50/40 border-emerald-300 shadow-xs ring-1 ring-emerald-300/50'
                              : isEmergency
                              ? 'bg-red-50/30 border-red-200 shadow-xs'
                              : 'bg-white border-gray-200 hover:border-gray-300'
                          }`}
                        >
                          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
                            <div className="space-y-3 flex-1">
                              <div className="flex flex-wrap items-center gap-2">
                                <span className="px-3.5 py-1 bg-red-600 text-white font-extrabold rounded-lg text-base shadow-xs">
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
                                {acceptedByMe && (
                                  <span className="px-2.5 py-1 rounded-lg text-xs font-extrabold bg-emerald-100 text-emerald-800 flex items-center gap-1">
                                    <CheckCircleIcon className="w-3.5 h-3.5 text-emerald-600" />
                                    {chosenForMe ? 'MATCH SELECTED' : 'ACCEPTED BY YOU'}
                                  </span>
                                )}
                                {request.approxDistanceKm !== null && request.approxDistanceKm !== undefined && (
                                  <span className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-blue-50 text-blue-700">
                                    📍 ~{request.approxDistanceKm} km away
                                  </span>
                                )}
                              </div>

                              <div className="text-xs text-gray-600 space-y-1.5">
                                <p className="font-semibold text-gray-900 text-sm">
                                  Patient: {request.recipientName || 'Verified Patient'}
                                </p>
                                <p className="flex items-center gap-1.5 text-gray-700 font-medium">
                                  <MapPinIcon className="w-4 h-4 text-red-600 shrink-0" />
                                  <span>{request.location?.address || 'Medical Facility'}</span>
                                </p>
                                <p className="flex items-center gap-1.5 text-gray-500">
                                  <ClockIcon className="w-4 h-4 text-gray-400 shrink-0" />
                                  <span>Posted on {new Date(request.createdAt).toLocaleDateString()} at {new Date(request.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                                </p>
                                {request.notes && (
                                  <p className="text-xs text-gray-700 bg-gray-50 p-2.5 rounded-lg border border-gray-100 mt-1">
                                    <span className="font-semibold">Special Instructions:</span> {request.notes}
                                  </p>
                                )}
                              </div>

                              {acceptedByMe && (
                                <div className="mt-3 p-3 bg-emerald-50 border border-emerald-300 rounded-xl flex items-center justify-between text-xs text-emerald-950 shadow-xs">
                                  <div className="flex items-center gap-2">
                                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-600 animate-ping"></span>
                                    <span className="font-bold">
                                      {chosenForMe
                                        ? '🎉 The recipient selected your match! Live coordination is locked in.'
                                        : 'You accepted this blood request! Live GPS coordination is active.'}
                                    </span>
                                  </div>
                                  <button
                                    onClick={() => setActiveDonationFromRequest(request)}
                                    className="text-emerald-700 hover:text-emerald-900 font-extrabold underline shrink-0 ml-2"
                                  >
                                    Open Live Tracking Map →
                                  </button>
                                </div>
                              )}
                            </div>

                            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 shrink-0">
                              {directionsUrl && (
                                <a
                                  href={directionsUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="px-4 py-2.5 rounded-xl border border-gray-300 text-gray-700 hover:bg-gray-50 font-bold text-xs flex items-center justify-center gap-1.5 transition-colors"
                                >
                                  <span>View Map</span>
                                  <ArrowTopRightOnSquareIcon className="w-4 h-4" />
                                </a>
                              )}

                              <button
                                onClick={() => handleReferFriend(request)}
                                className="px-4 py-2.5 rounded-xl border border-blue-200 text-blue-700 hover:bg-blue-50 font-bold text-xs flex items-center justify-center gap-1.5 transition-colors"
                              >
                                <ShareIcon className="w-4 h-4" />
                                <span>Refer / Share</span>
                              </button>

                              {closedForMe ? (
                                <span className="px-5 py-2.5 rounded-xl bg-gray-100 text-gray-400 font-bold text-xs flex items-center justify-center gap-1.5 cursor-not-allowed">
                                  <span>Option Closed</span>
                                </span>
                              ) : chosenForMe ? (
                                <button
                                  onClick={() => setActiveDonationFromRequest(request)}
                                  className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-xs flex items-center justify-center gap-1.5 transition-all"
                                >
                                  <CheckCircleIcon className="w-4 h-4" />
                                  <span>Match Selected! Track Live</span>
                                </button>
                              ) : acceptedByMe ? (
                                <button
                                  onClick={() => setActiveDonationFromRequest(request)}
                                  className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-xs flex items-center justify-center gap-1.5 transition-all"
                                >
                                  <span className="w-2 h-2 rounded-full bg-white animate-pulse"></span>
                                  <span>Accepted • View Live Tracking</span>
                                </button>
                              ) : (
                                <button
                                  onClick={() => initiateAcceptRequest(request)}
                                  className="px-6 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 text-white font-bold text-xs shadow-xs flex items-center justify-center gap-1.5 transition-all"
                                >
                                  <HeartSolidIcon className="w-4 h-4" />
                                  <span>Accept & Donate</span>
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
                    <h3 className="text-base font-bold text-gray-800">No matching requests found</h3>
                    <p className="text-xs text-gray-500 max-w-sm mx-auto mt-1 mb-4">
                      Great news! There are no pending requests matching your current filter right now.
                    </p>
                    <button
                      onClick={() => setRequestFilter('all')}
                      className="px-4 py-2 bg-gray-900 text-white rounded-xl text-xs font-bold"
                    >
                      Show All Nearby Requests
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* TAB 2: LIVE DONATION COORDINATION */}
            {activeSection === 'active' && (
              <div className="space-y-6">
                {activeDonation ? (
                  <div className="p-6 bg-gradient-to-br from-emerald-50 via-white to-blue-50 border-2 border-emerald-300 rounded-3xl shadow-sm space-y-6">
                    <div className="flex flex-col md:flex-row items-start md:items-center justify-between pb-4 border-b border-emerald-100 gap-4">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="w-3 h-3 rounded-full bg-emerald-500 animate-ping"></span>
                          <span className="text-xs font-bold uppercase tracking-wider text-emerald-800">
                            Active Emergency Donation En Route
                          </span>
                          <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-rose-100 text-rose-800">
                            {activeDonation.bloodGroup} • {activeDonation.unitsNeeded} Units
                          </span>
                        </div>
                        <h3 className="text-xl font-bold text-gray-900 mt-1">
                          Destination: {activeDonation.location?.address || 'Medical Facility'}
                        </h3>
                        <p className="text-xs text-gray-600 mt-0.5">
                          Coordinating directly with: <span className="font-semibold text-gray-800">{activeDonation.recipientName || 'Recipient'}</span>
                        </p>
                      </div>

                      <div className="flex items-center gap-2">
                        {(() => {
                          const navUrl = buildDirectionsUrl(
                            activeDonation.location?.lat,
                            activeDonation.location?.lng,
                            activeDonation.location?.address
                          );
                          if (!navUrl) return null;
                          return (
                            <a
                              href={navUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-xs transition-colors"
                            >
                              <ArrowTopRightOnSquareIcon className="h-4 w-4" />
                              <span>Turn-by-Turn Navigation</span>
                            </a>
                          );
                        })()}
                        <button
                          onClick={handleCompleteActiveDonation}
                          className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-xs transition-colors"
                        >
                          Arrived & Fulfilled
                        </button>
                      </div>
                    </div>

                    {/* Live GPS Broadcast Status */}
                    <div className="space-y-4">
                      <div className="flex flex-wrap items-center justify-between gap-2 p-3 bg-white/90 rounded-xl border border-emerald-200 text-xs">
                        <div className="flex items-center gap-2">
                          {activeDonation.shareLocation ? (
                            donorTrackingStatus === 'active' ? (
                              <span className="text-emerald-700 font-semibold flex items-center gap-1.5">
                                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                                Live GPS Broadcasting Active {donorCoords?.accuracy ? `(±${donorCoords.accuracy}m)` : ''}
                              </span>
                            ) : (
                              <span className="text-amber-700 font-semibold flex items-center gap-1.5">
                                <span className="w-2 h-2 rounded-full bg-amber-500"></span>
                                Location Sharing Paused by You
                              </span>
                            )
                          ) : (
                            <span className="text-gray-500 font-medium">Location Sharing Disabled for this request</span>
                          )}
                          <span className="text-gray-400">•</span>
                          <span className="text-gray-500 text-[11px]">
                            Protected by 24-hour automatic safety expiration window.
                          </span>
                        </div>

                        {activeDonation.shareLocation && (
                          <button
                            onClick={handleToggleDonorLocation}
                            className={`px-3 py-1 rounded-lg border font-semibold text-xs flex items-center gap-1 transition-colors ${
                              donorTrackingStatus === 'active'
                                ? 'bg-amber-50 text-amber-800 border-amber-200 hover:bg-amber-100'
                                : 'bg-emerald-50 text-emerald-800 border-emerald-200 hover:bg-emerald-100'
                            }`}
                          >
                            {donorTrackingStatus === 'active' ? <PauseIcon className="h-3.5 w-3.5" /> : <PlayIcon className="h-3.5 w-3.5" />}
                            <span>{donorTrackingStatus === 'active' ? 'Pause Sharing' : 'Resume Sharing'}</span>
                          </button>
                        )}
                      </div>

                      {/* Tracked Physical Location / Address Bar */}
                      <div className="p-3 bg-white/95 rounded-xl border border-emerald-200 text-xs flex flex-wrap items-center justify-between gap-3 shadow-2xs">
                        <div className="flex items-center gap-2 min-w-0 flex-1">
                          <MapPinIcon className="w-4 h-4 text-emerald-600 shrink-0" />
                          <span className="font-bold text-gray-800 shrink-0">Your Tracked Address:</span>
                          {isEditingAddress ? (
                            <div className="flex items-center gap-2 flex-1 max-w-md">
                              <input
                                type="text"
                                value={tempAddress}
                                onChange={(e) => setTempAddress(e.target.value)}
                                placeholder="e.g. Gangapuri, Wai or Current Landmark"
                                className="px-2.5 py-1 text-xs border border-emerald-300 rounded-lg w-full focus:outline-none focus:ring-1 focus:ring-emerald-500"
                              />
                              <button
                                onClick={() => handleUpdateDonorAddress(tempAddress)}
                                className="px-3 py-1 bg-emerald-600 text-white font-bold rounded-lg hover:bg-emerald-700 text-xs shrink-0"
                              >
                                Save
                              </button>
                              <button
                                onClick={() => setIsEditingAddress(false)}
                                className="px-2.5 py-1 text-gray-500 hover:text-gray-700 text-xs shrink-0"
                              >
                                Cancel
                              </button>
                            </div>
                          ) : (
                            <span className="text-gray-700 font-medium truncate" title={donorAddress || 'Profile address'}>
                              {donorAddress || user?.location?.address || user?.address || 'Profile Address'}
                            </span>
                          )}
                        </div>
                        {!isEditingAddress && (
                          <button
                            onClick={() => {
                              setTempAddress(donorAddress || user?.location?.address || user?.address || '');
                              setIsEditingAddress(true);
                            }}
                            className="text-emerald-700 hover:text-emerald-900 font-bold underline text-xs shrink-0"
                          >
                            Update Location Address
                          </button>
                        )}
                      </div>

                      {/* Embedded Live Map */}
                      <div className="rounded-2xl overflow-hidden border border-gray-200 shadow-sm">
                        <LiveTrackingMap
                          requestId={activeDonation._id}
                          requesterLocation={activeDonationTracking?.requesterLocation || activeDonation.location}
                          hospitalInfo={activeDonationTracking?.hospitalInfo}
                          donorInfo={{
                            name: user?.name,
                            phone: user?.phone,
                            bloodGroup: user?.bloodGroup,
                            address: donorAddress || user?.location?.address || user?.address || [user?.city, user?.state].filter(Boolean).join(', ') || 'Donor Location',
                            currentLocation: {
                              address: donorAddress || user?.location?.address || user?.address || '',
                              lat: donorCoords?.lat,
                              lng: donorCoords?.lng,
                              accuracy: donorCoords?.accuracy,
                              lastUpdated: donorCoords?.lastUpdated
                            },
                            trackingStatus: donorTrackingStatus,
                            shareLocation: activeDonation.shareLocation,
                            expiresAt: activeDonationTracking?.expiresAt,
                            isExpired: activeDonationTracking?.isExpired,
                            remainingSeconds: activeDonationTracking?.remainingSeconds,
                            locationSharingExpired: activeDonationTracking?.locationSharingExpired
                          }}
                          expiresAt={activeDonationTracking?.expiresAt}
                          isExpired={activeDonationTracking?.isExpired}
                          remainingSeconds={activeDonationTracking?.remainingSeconds}
                          locationSharingExpired={activeDonationTracking?.locationSharingExpired}
                          myRole="donor"
                          height="400px"
                        />
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="py-16 text-center bg-gray-50 rounded-2xl border border-dashed border-gray-300">
                    <ClockIcon className="w-12 h-12 text-gray-400 mx-auto mb-3" />
                    <h3 className="text-base font-bold text-gray-800">No active donation in progress</h3>
                    <p className="text-xs text-gray-500 max-w-sm mx-auto mt-1 mb-4">
                      When you accept an urgent blood request, turn-by-turn navigation and live recipient coordination will appear right here.
                    </p>
                    <button
                      onClick={() => setActiveSection('requests')}
                      className="px-5 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-bold"
                    >
                      Browse Urgent Requests
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* TAB 3: DONATION CAMPS */}
            {activeSection === 'camps' && (
              <div className="space-y-6">
                <div>
                  <h2 className="text-xl font-bold text-gray-900">Upcoming Blood Donation Camps</h2>
                  <p className="text-xs text-gray-500">Participate in organized hospital and community blood drives</p>
                </div>

                {donationCamps.length > 0 ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {donationCamps.map((camp) => {
                      const dirUrl = buildDirectionsUrl(null, null, camp.location);
                      const isRegistering = registeringCampId === camp._id;

                      return (
                        <div
                          key={camp._id}
                          className="p-6 rounded-2xl border border-gray-200 bg-white hover:border-purple-300 hover:shadow-md transition-all flex flex-col justify-between space-y-4"
                        >
                          <div className="space-y-3">
                            <div className="flex items-start justify-between gap-2">
                              <div>
                                <h3 className="font-extrabold text-gray-900 text-base">{camp.name}</h3>
                                <p className="text-xs font-semibold text-purple-700 mt-0.5">
                                  Organized by: {camp.organizer}
                                </p>
                              </div>
                              {camp.registered ? (
                                <span className="px-2.5 py-1 bg-emerald-100 text-emerald-800 rounded-full text-xs font-bold shrink-0 flex items-center gap-1">
                                  <CheckCircleIcon className="w-3.5 h-3.5" />
                                  Registered
                                </span>
                              ) : (
                                <span className="px-2.5 py-1 bg-purple-100 text-purple-800 rounded-full text-xs font-bold shrink-0">
                                  Upcoming
                                </span>
                              )}
                            </div>

                            <p className="text-xs text-gray-600 leading-relaxed">
                              {camp.description || 'Community blood donation camp supporting regional emergency reserves.'}
                            </p>

                            <div className="text-xs text-gray-600 space-y-1.5 pt-2 border-t border-gray-100">
                              <p className="flex items-center gap-1.5 font-medium text-gray-800">
                                <CalendarIcon className="w-4 h-4 text-purple-600 shrink-0" />
                                <span>Date: {camp.date} ({camp.time || '9:00 AM - 5:00 PM'})</span>
                              </p>
                              <p className="flex items-center gap-1.5 text-gray-700">
                                <MapPinIcon className="w-4 h-4 text-red-500 shrink-0" />
                                <span>Venue: {camp.location}</span>
                              </p>
                              {camp.targetUnits && (
                                <p className="flex items-center gap-1.5 text-gray-500">
                                  <UserGroupIcon className="w-4 h-4 text-gray-400 shrink-0" />
                                  <span>Target Goal: {camp.targetUnits} donor units</span>
                                </p>
                              )}
                            </div>
                          </div>

                          <div className="pt-4 border-t border-gray-100 flex items-center gap-3">
                            {dirUrl && (
                              <a
                                href={dirUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="px-4 py-2.5 rounded-xl border border-gray-300 text-gray-700 hover:bg-gray-50 font-bold text-xs flex items-center justify-center gap-1 transition-colors"
                              >
                                <span>Directions</span>
                                <ArrowTopRightOnSquareIcon className="w-3.5 h-3.5" />
                              </a>
                            )}

                            {camp.registered ? (
                              <button
                                disabled
                                className="flex-1 py-2.5 bg-emerald-50 text-emerald-800 border border-emerald-200 rounded-xl font-bold text-xs cursor-default text-center"
                              >
                                Registered for Camp ✅
                              </button>
                            ) : (
                              <button
                                onClick={() => handleCampRegistration(camp._id)}
                                disabled={isRegistering}
                                className="flex-1 py-2.5 bg-purple-600 hover:bg-purple-700 text-white rounded-xl font-bold text-xs shadow-xs transition-colors flex items-center justify-center gap-1.5 disabled:opacity-50"
                              >
                                {isRegistering ? (
                                  <>
                                    <ArrowPathIcon className="w-4 h-4 animate-spin" />
                                    <span>Registering...</span>
                                  </>
                                ) : (
                                  <>
                                    <PlusIcon className="w-4 h-4" />
                                    <span>Register as Donor</span>
                                  </>
                                )}
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="py-16 text-center bg-gray-50 rounded-2xl border border-dashed border-gray-300">
                    <BuildingOfficeIcon className="w-12 h-12 text-gray-400 mx-auto mb-3" />
                    <h3 className="text-base font-bold text-gray-800">No donation camps scheduled</h3>
                    <p className="text-xs text-gray-500 max-w-sm mx-auto mt-1">
                      Check back shortly for new hospital and Red Cross blood drives in your district.
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* TAB 4: DONATION HISTORY & CERTIFICATES */}
            {activeSection === 'history' && (
              <div className="space-y-8">
                <div>
                  <h2 className="text-xl font-bold text-gray-900">Donation History & Verified Certificates</h2>
                  <p className="text-xs text-gray-500">Your track record of life-saving contributions and official certificates</p>
                </div>

                {/* History Log */}
                <div className="space-y-4">
                  <h3 className="text-sm font-bold uppercase tracking-wider text-gray-700">Completed Donations ({donationHistory.length})</h3>
                  {donationHistory.length > 0 ? (
                    <div className="space-y-3">
                      {donationHistory.map((item, idx) => (
                        <div
                          key={item._id || idx}
                          className="p-4 bg-gray-50 rounded-xl border border-gray-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                        >
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-800 font-extrabold flex items-center justify-center text-sm">
                              #{idx + 1}
                            </div>
                            <div>
                              <p className="font-bold text-gray-900 text-sm">
                                Blood Donation • {item.bloodGroup || user?.bloodGroup || 'O+'} ({item.unitsNeeded || 1} Unit)
                              </p>
                              <p className="text-xs text-gray-600 mt-0.5">
                                📍 {item.location || 'Medical Facility'}
                              </p>
                              <p className="text-[11px] text-gray-400">
                                Completed on {item.date ? new Date(item.date).toLocaleDateString() : 'Recent'}
                              </p>
                            </div>
                          </div>

                          <div className="flex items-center gap-2">
                            <span className="px-3 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800">
                              Fulfilled Life Saver
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="p-8 bg-gray-50 rounded-xl border border-dashed border-gray-300 text-center">
                      <p className="text-xs text-gray-500">No completed donations yet. Accept an urgent request to begin your life-saving journey!</p>
                    </div>
                  )}
                </div>

                {/* Certificate Showcase Gallery */}
                <div className="pt-6 border-t border-gray-200">
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <h3 className="text-lg font-bold text-gray-900">Donor Certificates</h3>
                      <p className="text-xs text-gray-500">Official verified certificates awarded for voluntary donations</p>
                    </div>
                  </div>
                  <CertificateGallery userId={user?.id || user?._id} />
                </div>
              </div>
            )}

            {/* TAB 5: JOURNEY, BADGES & PHOTO GALLERY */}
            {activeSection === 'impact' && (
              <div className="space-y-8">
                <div>
                  <h2 className="text-xl font-bold text-gray-900">Your Life-Saving Journey & Milestones</h2>
                  <p className="text-xs text-gray-500">Track your level, progress toward milestones, and personal donation gallery</p>
                </div>

                {/* Milestone Level Banner */}
                <div className="p-6 bg-gradient-to-r from-red-600 to-rose-700 text-white rounded-2xl shadow-sm space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-xs font-bold uppercase tracking-wider text-red-200">Current Milestone Level</span>
                      <h3 className="text-2xl font-black mt-0.5">{getCurrentMilestone().title}</h3>
                    </div>
                    <div className="text-4xl">{getCurrentMilestone().icon}</div>
                  </div>

                  <div className="space-y-1.5">
                    <div className="h-3 w-full bg-black/20 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-white rounded-full transition-all duration-1000"
                        style={{ width: `${getMilestoneProgress()}%` }}
                      />
                    </div>
                    <div className="flex justify-between text-xs text-red-100 font-medium">
                      <span>{donationHistory.length} Completed Donations</span>
                      <span>{nextMilestone > 0 ? `${nextMilestone} more donations to next tier` : 'Maximum Milestone Reached!'}</span>
                    </div>
                  </div>
                </div>

                {/* Milestones Grid */}
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                  {milestones.map((m) => {
                    const achieved = donationHistory.length >= m.donations;

                    return (
                      <div
                        key={m.title}
                        className={`p-4 rounded-xl border text-center transition-all ${
                          achieved
                            ? 'bg-white border-amber-300 shadow-xs'
                            : 'bg-gray-50 border-gray-200 opacity-60'
                        }`}
                      >
                        <div className="text-3xl mb-2">{m.icon}</div>
                        <p className="font-extrabold text-xs text-gray-900">{m.title}</p>
                        <p className="text-[10px] text-gray-500 mt-0.5">{m.donations} Donation{m.donations > 1 ? 's' : ''}</p>
                        {achieved && (
                          <span className="inline-block mt-1 px-2 py-0.5 bg-emerald-100 text-emerald-800 text-[9px] font-extrabold rounded-full">
                            Unlocked
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>

                {/* Donation Photo Upload & Gallery */}
                <div className="p-6 bg-white rounded-2xl border border-gray-200 space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-gray-100">
                    <div>
                      <h3 className="text-base font-bold text-gray-900">Donation Photo Memories</h3>
                      <p className="text-xs text-gray-500">Upload and keep memories of your blood donation drives</p>
                    </div>

                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      onChange={handlePictureUpload}
                      className="hidden"
                    />

                    <button
                      onClick={() => fileInputRef.current?.click()}
                      disabled={uploadingPicture}
                      className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors shadow-xs"
                    >
                      {uploadingPicture ? (
                        <>
                          <ArrowPathIcon className="w-4 h-4 animate-spin" />
                          <span>Uploading...</span>
                        </>
                      ) : (
                        <>
                          <PhotoIcon className="w-4 h-4" />
                          <span>Upload Donation Photo</span>
                        </>
                      )}
                    </button>
                  </div>

                  {uploadedPhotos.length > 0 ? (
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                      {uploadedPhotos.map((photo) => (
                        <div
                          key={photo.id}
                          className="group relative rounded-xl overflow-hidden border border-gray-200 bg-gray-50"
                        >
                          <img
                            src={photo.url}
                            alt={photo.name}
                            className="w-full h-36 object-cover"
                          />
                          <div className="p-2 bg-white">
                            <p className="text-[11px] font-medium text-gray-700 truncate">{photo.name}</p>
                            <p className="text-[10px] text-gray-400">{new Date(photo.uploadDate).toLocaleDateString()}</p>
                          </div>
                          <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button
                              onClick={() => setSelectedPhoto(photo)}
                              className="p-1 rounded bg-black/60 text-white hover:bg-black/80"
                              title="View photo"
                            >
                              <EyeIcon className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => handleDeletePhoto(photo.id)}
                              className="p-1 rounded bg-red-600/80 text-white hover:bg-red-700"
                              title="Delete photo"
                            >
                              <TrashIcon className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="py-8 text-center bg-gray-50 rounded-xl border border-dashed border-gray-200">
                      <PhotoIcon className="w-10 h-10 text-gray-400 mx-auto mb-2" />
                      <p className="text-xs text-gray-500">No donation photos uploaded yet. Share a picture from your next donation!</p>
                    </div>
                  )}
                </div>
              </div>
            )}

          </div>
        </div>

        {/* Accept Request Confirmation & Location Consent Modal */}
        <AnimatePresence>
          {pendingAcceptRequest && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            >
              <motion.div
                initial={{ scale: 0.95, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.95, opacity: 0 }}
                className="bg-white rounded-3xl p-6 md:p-8 max-w-lg w-full shadow-2xl border border-red-100"
              >
                <div className="flex items-center justify-between pb-4 border-b border-gray-100">
                  <div className="flex items-center space-x-2">
                    <HeartSolidIcon className="h-7 w-7 text-red-500 animate-pulse" />
                    <h3 className="text-xl font-bold text-gray-900">Commit to Donate Blood</h3>
                  </div>
                  <button
                    onClick={() => setPendingAcceptRequest(null)}
                    className="text-gray-400 hover:text-gray-600 p-1"
                  >
                    <XMarkIcon className="h-6 w-6" />
                  </button>
                </div>

                <div className="py-4 space-y-4">
                  <div className="p-4 bg-red-50 rounded-2xl border border-red-100 space-y-1.5 text-sm">
                    <div className="flex justify-between font-bold text-gray-900">
                      <span>Blood Group: {pendingAcceptRequest.bloodGroup}</span>
                      <span>{pendingAcceptRequest.unitsNeeded} Unit(s) Needed</span>
                    </div>
                    <p className="text-gray-700">
                      📍 <span className="font-semibold">Destination:</span> {pendingAcceptRequest.location?.address || 'Medical Facility'}
                    </p>
                    <p className="text-xs text-red-700 font-semibold uppercase">
                      Urgency: {pendingAcceptRequest.urgency}
                    </p>
                  </div>

                  <div className="p-4 bg-rose-50/70 border border-rose-200 rounded-2xl space-y-2">
                    <div className="flex items-start gap-2">
                      <ShieldCheckIcon className="h-5 w-5 text-rose-600 flex-shrink-0 mt-0.5" />
                      <div>
                        <p className="text-xs font-bold text-rose-900">Live Location Sharing with Recipient</p>
                        <p className="text-[11px] text-gray-600 mt-0.5">
                          Enables the recipient to monitor your travel in real time. Protected by a strict 24-hour expiration window.
                        </p>
                      </div>
                    </div>

                    <label className="flex items-center space-x-3 text-xs font-semibold text-gray-800 cursor-pointer pt-1 pl-7">
                      <input
                        type="checkbox"
                        checked={acceptConsentShareLocation}
                        onChange={(e) => setAcceptConsentShareLocation(e.target.checked)}
                        className="rounded text-red-600 focus:ring-red-500 h-4 w-4"
                      />
                      <span>Share my live location with recipient while traveling</span>
                    </label>
                    <p className="text-[10px] text-gray-500 italic pl-7">
                      You can pause or stop location sharing at any time. Location access ceases automatically once fulfilled.
                    </p>
                  </div>
                </div>

                <div className="flex space-x-3 pt-3 border-t border-gray-100">
                  <button
                    type="button"
                    onClick={() => setPendingAcceptRequest(null)}
                    disabled={acceptingInProgress}
                    className="flex-1 py-3 px-4 border border-gray-300 rounded-xl text-gray-700 font-semibold hover:bg-gray-50 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={confirmAcceptRequest}
                    disabled={acceptingInProgress}
                    className="flex-1 py-3 px-4 bg-red-600 hover:bg-red-700 text-white rounded-xl font-bold shadow-sm transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    {acceptingInProgress ? (
                      <>
                        <ArrowPathIcon className="w-4 h-4 animate-spin" />
                        <span>Confirming...</span>
                      </>
                    ) : (
                      <>
                        <HeartSolidIcon className="w-4 h-4" />
                        <span>Confirm & Save Life</span>
                      </>
                    )}
                  </button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Selected Photo Modal */}
        <AnimatePresence>
          {selectedPhoto && (
            <div
              className="fixed inset-0 bg-black/75 z-50 flex items-center justify-center p-4"
              onClick={() => setSelectedPhoto(null)}
            >
              <div
                className="bg-white rounded-2xl max-w-2xl w-full p-4 space-y-4"
                onClick={e => e.stopPropagation()}
              >
                <div className="flex items-center justify-between">
                  <h4 className="font-bold text-gray-900">{selectedPhoto.name}</h4>
                  <button onClick={() => setSelectedPhoto(null)} className="p-1 text-gray-500 hover:text-gray-700">
                    <XMarkIcon className="w-6 h-6" />
                  </button>
                </div>
                <img src={selectedPhoto.url} alt={selectedPhoto.name} className="w-full max-h-[70vh] object-contain rounded-xl" />
              </div>
            </div>
          )}
        </AnimatePresence>

      </div>
    </div>
  );
};

export default RevolutionaryDonorDashboard;
