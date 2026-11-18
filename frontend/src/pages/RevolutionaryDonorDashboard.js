import React, { useState, useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { motion, AnimatePresence, useScroll, useTransform, useSpring } from 'framer-motion';
import { useAuth } from '../contexts/AuthContext';
import { useNotifications } from '../contexts/NotificationContext';
import { requestAPI, userAPI, certificateAPI } from '../services/api';
import Navbar from '../components/Navbar';
import CertificateGallery from '../components/CertificateGallery';
import LiveTrackingMap from '../components/LiveTrackingMap';
import {
  HeartIcon,
  UserGroupIcon,
  BuildingOfficeIcon,
  MapPinIcon,
  CalendarIcon,
  ClockIcon,
  CheckCircleIcon,
  XCircleIcon,
  ExclamationTriangleIcon,
  ArrowTrendingUpIcon,
  TrophyIcon,
  StarIcon,
  GiftIcon,
  SparklesIcon,
  FireIcon,
  BoltIcon,
  SunIcon,
  MoonIcon,
  CloudIcon,
  CameraIcon,
  EyeIcon,
  TrashIcon,
  ShareIcon,
  ArrowDownTrayIcon,
  DocumentTextIcon,
  BuildingOffice2Icon,
  QrCodeIcon,
  XMarkIcon,
  ShieldCheckIcon,
  PhotoIcon,
  MapIcon,
  PauseIcon,
  PlayIcon,
  ArrowTopRightOnSquareIcon
} from '@heroicons/react/24/outline';
import { HeartIcon as HeartSolidIcon, FireIcon as FireSolidIcon } from '@heroicons/react/24/solid';

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
  
  // Real-time donation coordination & live GPS tracking
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
  const watchIdRef = useRef(null);
  const lastBroadcastTimeRef = useRef(0);

  // Fallback notification function if context is not available
  const fallbackNotification = (message, type = 'info') => {
    console.log(`[${type.toUpperCase()}] ${message}`);
  };
  
  const notify = showNotification || fallbackNotification;
  const [activeSection, setActiveSection] = useState('impact');
  const [nearbyRequests, setNearbyRequests] = useState([]);
  const [donationHistory, setDonationHistory] = useState([]);
  const [donationCamps, setDonationCamps] = useState([]);
  const [campsLoading, setCampsLoading] = useState(false);
  const [campsError, setCampsError] = useState(null);
  const [showHeroImpact, setShowHeroImpact] = useState(false);
  const [loading, setLoading] = useState(true);
  const [selectedRequest, setSelectedRequest] = useState(null);
  const [showRequestModal, setShowRequestModal] = useState(false);
  const [animatingHeart, setAnimatingHeart] = useState(false);
  const [impactAnimation, setImpactAnimation] = useState(false);
  const [livesSaved, setLivesSaved] = useState(0);
  const [nextMilestone, setNextMilestone] = useState(1);
  const [currentStreak, setCurrentStreak] = useState(0);
  const [totalImpact, setTotalImpact] = useState(0);
  const [uploadingPicture, setUploadingPicture] = useState(false);
  const [pictureUploaded, setPictureUploaded] = useState(false);
  const [uploadedPhotos, setUploadedPhotos] = useState([]);
  const [showPhotoGallery, setShowPhotoGallery] = useState(false);
  const [selectedPhoto, setSelectedPhoto] = useState(null);
  const [showCertificateModal, setShowCertificateModal] = useState(false);
  const fileInputRef = useRef(null);
  
  const containerRef = useRef(null);
  const { scrollYProgress } = useScroll({ container: containerRef });
  const yRange = useTransform(scrollYProgress, [0, 1], [0, -100]);
  const scaleRange = useTransform(scrollYProgress, [0, 1], [1, 0.8]);
  
  const springConfig = { damping: 20, stiffness: 300 };
  const scale = useSpring(scaleRange, springConfig);
  const y = useSpring(yRange, springConfig);

  const milestones = [
    { donations: 1, title: "First Drop", icon: "💧", color: "from-blue-400 to-blue-600" },
    { donations: 3, title: "Life Saver", icon: "🌟", color: "from-purple-400 to-purple-600" },
    { donations: 5, title: "Hero Level", icon: "🦸", color: "from-red-400 to-red-600" },
    { donations: 10, title: "Champion", icon: "🏆", color: "from-yellow-400 to-yellow-600" },
    { donations: 25, title: "Legend", icon: "👑", color: "from-indigo-400 to-indigo-600" },
    { donations: 50, title: "Immortal", icon: "🌟", color: "from-pink-400 to-pink-600" }
  ];

  useEffect(() => {
    fetchDashboardData();
    initializeAnimations();
  }, []);

  // Listen for real-time blood requests
  useEffect(() => {
    if (newBloodRequest) {
      console.log('New blood request received in dashboard:', newBloodRequest);
      
      // Add the new request to the nearby requests list immediately
      setNearbyRequests(prev => {
        // Check if request already exists to avoid duplicates
        const exists = prev.some(req => req._id === newBloodRequest.request._id);
        if (!exists) {
          // Show notification to user
          notify(`🩸 New blood request! ${newBloodRequest.request.bloodGroup} blood needed for ${newBloodRequest.request.unitsNeeded} units`, 'success');
          
          // Return updated list with new request at the top
          return [newBloodRequest.request, ...prev];
        }
        return prev;
      });
    }
  }, [newBloodRequest]);

  const initializeAnimations = () => {
    setTimeout(() => setImpactAnimation(true), 500);
    const interval = setInterval(() => setAnimatingHeart(true), 3000);
    return () => clearInterval(interval);
  };

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      
      // Fetch data with individual error handling
      let requestsData = [];
      let historyData = [];
      let campsData = [];
      
      try {
        const requestsResponse = await requestAPI.getNearbyRequests();
        requestsData = requestsResponse.data.requests || [];
        console.log('Nearby requests loaded:', requestsData.length);
      } catch (reqError) {
        console.warn('Failed to fetch nearby requests:', reqError.message);
        // Set mock data for requests
        requestsData = [
          {
            _id: '1',
            recipientName: 'John Doe',
            requesterId: { name: 'John Doe', location: { address: '123 Main St, New York, NY' } },
            bloodGroup: 'A+',
            unitsNeeded: 2,
            urgency: 'urgent',
            status: 'pending',
            createdAt: new Date().toISOString(),
            location: { address: '123 Main St, New York, NY' }
          },
          {
            _id: '2',
            recipientName: 'Jane Smith',
            requesterId: { name: 'Jane Smith', location: { address: '456 Oak Ave, Brooklyn, NY' } },
            bloodGroup: 'O-',
            unitsNeeded: 1,
            urgency: 'normal',
            status: 'pending',
            createdAt: new Date().toISOString(),
            location: { address: '456 Oak Ave, Brooklyn, NY' }
          }
        ];
      }
      
      try {
        const historyResponse = await userAPI.getDonationHistory();
        historyData = historyResponse.data.donations || [];
        console.log('Donation history loaded:', historyData.length);
      } catch (historyError) {
        console.warn('Failed to fetch donation history:', historyError.message);
        // Set mock data for history
        historyData = [
          {
            _id: '1',
            requesterId: { name: 'Alice Johnson' },
            bloodGroup: 'A+',
            unitsNeeded: 2,
            status: 'completed',
            completedAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
          },
          {
            _id: '2',
            requesterId: { name: 'Bob Wilson' },
            bloodGroup: 'O-',
            unitsNeeded: 1,
            status: 'completed',
            completedAt: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString()
          }
        ];
      }
      
      try {
        const campsResponse = await userAPI.getNearbyDonationCamps();
        campsData = campsResponse.data.camps || [];
        console.log('Donation camps loaded:', campsData.length);
      } catch (campsError) {
        console.warn('Failed to fetch donation camps:', campsError.message);
        // Set mock data for camps
        campsData = [
          {
            _id: '1',
            name: 'Community Blood Drive',
            date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
            time: '9:00 AM - 5:00 PM',
            location: 'Central Park, New York',
            description: 'Join us for a community blood drive event',
            targetUnits: 50,
            status: 'active'
          },
          {
            _id: '2',
            name: 'Hospital Donation Camp',
            date: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
            time: '10:00 AM - 4:00 PM',
            location: 'Medical Center, Brooklyn',
            description: 'Help save lives at our hospital donation camp',
            targetUnits: 30,
            status: 'active'
          }
        ];
      }
      
      // Set the data (either real or mock)
      setNearbyRequests(requestsData);
      setDonationHistory(historyData);
      setDonationCamps(campsData);
      
      // Calculate impact based on the data
      calculateImpact(historyData);
      
    } catch (error) {
      console.error('Critical error in fetchDashboardData:', error);
      // Set minimal fallback data to prevent complete failure
      setNearbyRequests([]);
      setDonationHistory([]);
      setDonationCamps([]);
      setLivesSaved(0);
      setTotalImpact(0);
      setCurrentStreak(0);
    } finally {
      setLoading(false);
    }
  };

  const calculateImpact = (donations) => {
    const completedDonations = donations.filter(d => d.status === 'completed');
    const lives = completedDonations.length * 3;
    const impact = completedDonations.length * 100;
    
    setLivesSaved(lives);
    setTotalImpact(impact);
    
    const nextMilestone = milestones.find(m => m.donations > completedDonations.length);
    setNextMilestone(nextMilestone ? nextMilestone.donations - completedDonations.length : 0);
    
    // Calculate streak (simplified - in real app would track dates)
    setCurrentStreak(Math.min(completedDonations.length, 5));
  };

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

      await requestAPI.respondToRequest(pendingAcceptRequest._id, {
        response: 'accepted',
        shareLocation: acceptConsentShareLocation,
        currentLocation: initialCoords
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

      // Remove from nearby requests list immediately
      setNearbyRequests(prev => prev.filter(req => req._id !== pendingAcceptRequest._id));

      socket?.emit('joinTrackingRoom', { requestId: pendingAcceptRequest._id, userId: user?._id || user?.id });
      notify('✅ Blood request accepted! You are now connected with the recipient.', 'success');
      
      try {
        await certificateAPI.generateCertificate(pendingAcceptRequest._id);
        notify('🏆 Certificate generated! Check your Certificates tab.', 'success');
      } catch (certError) {
        console.warn('Certificate generation failed:', certError.message);
      }

      // Load initial tracking record
      try {
        const trRes = await requestAPI.getRequestTracking(pendingAcceptRequest._id);
        setActiveDonationTracking(trRes.data.tracking);
      } catch (trErr) {
        console.warn('Failed to load tracking data:', trErr.message);
      }

      setPendingAcceptRequest(null);
      fetchDashboardData();
    } catch (err) {
      console.error('Failed to accept request:', err);
      notify(err.response?.data?.message || 'Failed to accept request', 'error');
    } finally {
      setAcceptingInProgress(false);
    }
  };

  // Live GPS broadcaster for active donation while tab is open
  useEffect(() => {
    if (!activeDonation || !activeDonation.shareLocation || donorTrackingStatus !== 'active') {
      if (watchIdRef.current !== null && navigator.geolocation) {
        navigator.geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }
      return;
    }

    if (!navigator.geolocation) {
      console.warn('Geolocation not supported on this browser');
      return;
    }

    socket?.emit('joinTrackingRoom', { requestId: activeDonation._id, userId: user?._id || user?.id });

    const refreshTracking = async () => {
      try {
        const res = await requestAPI.getRequestTracking(activeDonation._id);
        setActiveDonationTracking(res.data.tracking);
      } catch (err) {
        console.warn('Tracking fetch error:', err.message);
      }
    };
    refreshTracking();

    watchIdRef.current = navigator.geolocation.watchPosition(
      (pos) => {
        const { latitude, longitude, accuracy } = pos.coords;
        const now = Date.now();
        const updatedCoords = {
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
            lat: latitude,
            lng: longitude,
            accuracy: Math.round(accuracy)
          }).catch(err => console.warn('Broadcast location err:', err.message));
        }
      },
      (err) => {
        console.warn('Geolocation watch error:', err.message);
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 10000 }
    );

    const onTrackingStopped = (payload) => {
      if (payload.requestId === activeDonation._id) {
        notify('Donor coordination for this request has concluded.', 'info');
        setActiveDonation(null);
        localStorage.removeItem('bloodnet_active_donation');
        if (watchIdRef.current !== null) {
          navigator.geolocation.clearWatch(watchIdRef.current);
          watchIdRef.current = null;
        }
        fetchDashboardData();
      }
    };

    socket?.on('trackingStopped', onTrackingStopped);

    return () => {
      if (watchIdRef.current !== null && navigator.geolocation) {
        navigator.geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }
      socket?.off('trackingStopped', onTrackingStopped);
    };
  }, [activeDonation, donorTrackingStatus, socket, user]);

  const handleToggleDonorLocation = async () => {
    if (!activeDonation) return;
    const nextStatus = donorTrackingStatus === 'active' ? 'paused' : 'active';
    try {
      await requestAPI.updateLocationConsent(activeDonation._id, {
        shareLocation: nextStatus === 'active',
        trackingStatus: nextStatus
      });
      setDonorTrackingStatus(nextStatus);
      notify(nextStatus === 'active' ? 'Live location sharing resumed' : 'Live location sharing paused', 'info');
    } catch (err) {
      console.error('Failed to toggle location:', err);
    }
  };

  const handleCompleteActiveDonation = async () => {
    if (!activeDonation) return;
    if (!window.confirm('Have you arrived and completed the blood donation? This will close location tracking.')) return;
    try {
      await requestAPI.updateRequestStatus(activeDonation._id, 'completed');
      setActiveDonation(null);
      localStorage.removeItem('bloodnet_active_donation');
      notify('🎉 Thank you for saving a life! Donation completed.', 'success');
      fetchDashboardData();
    } catch (err) {
      console.error('Failed to complete donation:', err);
    }
  };

  const triggerCelebration = () => {
    setImpactAnimation(true);
    setTimeout(() => setImpactAnimation(false), 2000);
  };

  const handleReferFriend = (request) => {
    const message = `Emergency blood needed! ${request.bloodGroup} blood required for ${request.unitsNeeded} units at ${request.location?.address || 'nearby'}. Your donation could save a life!`;
    
    if (navigator.share) {
      navigator.share({
        title: 'Blood Donation Request',
        text: message,
        url: window.location.href
      }).catch(err => {
        console.log('Share cancelled or failed:', err);
        // Fallback to clipboard if share fails
        navigator.clipboard.writeText(message);
        notify('Request details copied to clipboard!', 'success');
      });
    } else {
      navigator.clipboard.writeText(message);
      notify('Request details copied to clipboard!', 'success');
    }
  };

  const handleShareImpact = () => {
    const message = `I've saved ${livesSaved} lives through blood donation! Join me in making a difference with BloodNet+. Every drop counts! ❤️`;
    
    if (navigator.share) {
      navigator.share({
        title: 'BloodNet+ - My Impact',
        text: message,
        url: window.location.href
      }).catch(err => console.log('Error sharing:', err));
    } else {
      // Fallback - copy to clipboard
      navigator.clipboard.writeText(`${message} ${window.location.href}`);
      notify('Impact story copied to clipboard!', 'success');
    }
  };

  const handleCampRegistration = async (campId) => {
    try {
      console.log('Registering for camp:', campId);
      
      // Call the registration API
      const response = await userAPI.registerForDonationCamp(campId);
      console.log('Camp registration response:', response.data);
      
      // Show success notification
      notify('✅ Successfully registered for donation camp!', 'success');
      
      // Update the camp status in local state
      setDonationCamps(prev => 
        prev.map(camp => 
          camp._id === campId 
            ? { ...camp, registered: true, registeredAt: new Date().toISOString() }
            : camp
        )
      );
      
    } catch (error) {
      console.error('Error registering for camp:', error);
      notify('Failed to register for camp. Please try again.', 'error');
    }
  };

  const handlePictureUpload = async (event) => {
    const file = event.target.files[0];
    if (!file) return;
    
    setUploadingPicture(true);
    
    try {
      // Simulate upload process
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Create photo object
      const photo = {
        id: Date.now(),
        url: URL.createObjectURL(file),
        name: file.name,
        uploadDate: new Date().toISOString(),
        size: file.size
      };
      
      // Add to uploaded photos
      setUploadedPhotos(prev => [...prev, photo]);
      
      // Award impact points for uploading
      setTotalImpact(prev => prev + 10);
      setPictureUploaded(true);
      
      // Show success message
      alert('🎉 Picture uploaded successfully! You earned 10 impact points!');
      
      // Reset after 3 seconds
      setTimeout(() => {
        setPictureUploaded(false);
      }, 3000);
      
    } catch (error) {
      alert('Failed to upload picture. Please try again.');
    } finally {
      setUploadingPicture(false);
    }
  };

  const handleDeletePhoto = (photoId) => {
    if (window.confirm('Are you sure you want to delete this photo?')) {
      setUploadedPhotos(prev => prev.filter(photo => photo.id !== photoId));
      setSelectedPhoto(null);
      alert('Photo deleted successfully!');
    }
  };

  const handleViewPhoto = (photo) => {
    setSelectedPhoto(photo);
  };

  const triggerFileUpload = () => {
    fileInputRef.current?.click();
  };

  const getMilestoneProgress = () => {
    const completedDonations = donationHistory.filter(d => d.status === 'completed').length;
    const currentMilestone = milestones.find(m => m.donations > completedDonations);
    if (!currentMilestone) return 100;
    
    const previousMilestone = milestones[milestones.indexOf(currentMilestone) - 1] || { donations: 0 };
    const progress = ((completedDonations - previousMilestone.donations) / (currentMilestone.donations - previousMilestone.donations)) * 100;
    return Math.min(progress, 100);
  };

  const getCurrentMilestone = () => {
    const completedDonations = donationHistory.filter(d => d.status === 'completed').length;
    return milestones.reverse().find(m => completedDonations >= m.donations) || milestones[0];
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-red-50 via-pink-50 to-rose-50">
        <Navbar />
        <div className="flex items-center justify-center h-screen">
          <div className="text-center">
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
              className="w-16 h-16 mx-auto mb-4"
            >
              <HeartSolidIcon className="h-16 w-16 text-red-500" />
            </motion.div>
            <p className="text-gray-600">Preparing your impact dashboard...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-red-50 via-white to-teal-50 overflow-hidden pt-16">
      
      {/* Animated Background */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <motion.div
          className="absolute top-20 left-20 w-64 h-64 bg-red-200 rounded-full opacity-20"
          animate={{
            scale: [1, 1.2, 1],
            x: [0, 50, 0],
            y: [0, -30, 0],
          }}
          transition={{
            duration: 8,
            repeat: Infinity,
            ease: "easeInOut"
          }}
        />
        <motion.div
          className="absolute bottom-20 right-20 w-96 h-96 bg-teal-200 rounded-full opacity-20"
          animate={{
            scale: [1.2, 1, 1.2],
            x: [0, -50, 0],
            y: [0, 30, 0],
          }}
          transition={{
            duration: 10,
            repeat: Infinity,
            ease: "easeInOut"
          }}
        />
        <motion.div
          className="absolute top-1/2 left-1/3 w-48 h-48 bg-pink-200 rounded-full opacity-15"
          animate={{
            scale: [1, 1.3, 1],
            x: [0, 30, 0],
            y: [0, -20, 0],
          }}
          transition={{
            duration: 12,
            repeat: Infinity,
            ease: "easeInOut"
          }}
        />
      </div>

      <div ref={containerRef} className="relative z-10 max-w-7xl mx-auto px-4 py-8">
        
        {/* Hero Impact Section */}
        <motion.section
          style={{ y, scale }}
          className="text-center mb-12"
        >
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
          >
            <h1 className="text-5xl font-bold mb-4 bg-gradient-to-r from-red-600 to-pink-600 bg-clip-text text-transparent">
              {isNewUser ? `Welcome, ${user?.name?.split(' ')[0]}! 🌟` : `Welcome Back, ${user?.name?.split(' ')[0]}! 🌟`}
            </h1>
            <p className="text-xl text-gray-700 mb-8">
              {isNewUser ? 'Thank you for joining our community of life-saving donors' : 'Your blood donation journey is saving lives'}
            </p>
          </motion.div>
        </motion.section>

        {/* Navigation Tabs */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4, duration: 0.8 }}
          className="flex justify-center mb-8"
        >
          <div className="bg-white rounded-full p-1 shadow-lg border border-red-100">
            {['impact', 'requests', 'camps', 'journey', 'community', 'gallery', 'profile'].map((section) => (
              <button
                key={section}
                onClick={() => setActiveSection(section)}
                className={`px-6 py-3 rounded-full font-medium transition-all ${
                  activeSection === section
                    ? 'bg-gradient-to-r from-red-500 to-pink-500 text-white'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                {section === 'camps' ? 'Donation Camps' : section.charAt(0).toUpperCase() + section.slice(1)}
              </button>
            ))}
          </div>
        </motion.div>

        {/* Active Donation Tracking Card */}
        {activeDonation && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-8 p-6 bg-gradient-to-br from-emerald-50 via-white to-blue-50 border-2 border-emerald-300 rounded-3xl shadow-xl"
          >
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
                {activeDonation.location?.lat && activeDonation.location?.lng && (
                  <a
                    href={`https://www.google.com/maps/dir/?api=1&destination=${activeDonation.location.lat},${activeDonation.location.lng}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-md transition-colors"
                  >
                    <ArrowTopRightOnSquareIcon className="h-4 w-4" />
                    <span>Turn-by-Turn Navigation</span>
                  </a>
                )}
                <button
                  onClick={handleCompleteActiveDonation}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-md transition-colors"
                >
                  Arrived & Fulfilled
                </button>
              </div>
            </div>

            {/* Live GPS Broadcast Status & Map */}
            <div className="mt-4 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2 p-3 bg-white/80 rounded-xl border border-emerald-200 text-xs">
                <div className="flex items-center gap-2">
                  {activeDonation.shareLocation ? (
                    donorTrackingStatus === 'active' ? (
                      <span className="text-emerald-700 font-semibold flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
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
                    Transmitted securely while tab is open. Background tracking does not run when closed.
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
                    currentLocation: donorCoords,
                    trackingStatus: donorTrackingStatus,
                    shareLocation: activeDonation.shareLocation
                  }}
                  myRole="donor"
                  height="380px"
                />
              </div>
            </div>
          </motion.div>
        )}

        {/* Content Sections */}
        <AnimatePresence mode="wait">
          {/* Impact Section */}
          {activeSection === 'impact' && (
            <motion.div
              key="impact"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12"
            >
              <motion.div
                whileHover={{ scale: 1.05, rotate: 1 }}
                className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-2xl p-6 text-white shadow-xl"
              >
                <ShieldCheckIcon className="h-12 w-12 mb-4" />
                <h3 className="text-2xl font-bold mb-2">{donationHistory.length}</h3>
                <p className="text-blue-100">Total Donations</p>
              </motion.div>

              <motion.div
                whileHover={{ scale: 1.05, rotate: -1 }}
                className="bg-gradient-to-br from-purple-500 to-pink-500 rounded-2xl p-6 text-white shadow-xl"
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handlePictureUpload}
                  className="hidden"
                />
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={triggerFileUpload}
                  disabled={uploadingPicture}
                  className="w-full h-24 rounded-lg flex flex-col items-center justify-center transition-all"
                >
                  {uploadingPicture ? (
                    <>
                      <motion.div
                        animate={{ rotate: 360 }}
                        transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                        className="mb-2"
                      >
                        <PhotoIcon className="h-8 w-8 text-white" />
                      </motion.div>
                      <span className="text-sm text-white">Uploading...</span>
                    </>
                  ) : pictureUploaded ? (
                    <>
                      <CheckCircleIcon className="h-8 w-8 text-white mb-2" />
                      <span className="text-sm text-white font-medium">+10 Points!</span>
                    </>
                  ) : (
                    <>
                      <PhotoIcon className="h-8 w-8 text-white mb-2" />
                      <span className="text-sm text-white font-medium">Upload Photo</span>
                      <span className="text-xs text-purple-100 mt-1">Earn Points</span>
                    </>
                  )}
                </motion.button>
              </motion.div>

              <motion.div
                whileHover={{ scale: 1.05, rotate: 1 }}
                className="bg-gradient-to-br from-purple-500 to-purple-600 rounded-2xl p-6 text-white shadow-xl"
              >
                <TrophyIcon className="h-12 w-12 mb-4" />
                <h3 className="text-2xl font-bold mb-2">{totalImpact}</h3>
                <p className="text-purple-100">Impact Points</p>
              </motion.div>
            </motion.div>
          )}

          {/* Requests Section */}
          {activeSection === 'requests' && (
            <motion.div
              key="requests"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
            >
              <h2 className="text-3xl font-bold text-gray-900 mb-6">Urgent Requests Near You</h2>
              
              {nearbyRequests.length === 0 ? (
                <div className="bg-white rounded-2xl p-12 text-center shadow-xl border border-red-100">
                  <HeartIcon className="h-16 w-16 text-gray-300 mx-auto mb-4" />
                  <h3 className="text-xl font-semibold text-gray-900 mb-2">No urgent requests</h3>
                  <p className="text-gray-600">Check back later for new blood donation requests</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {nearbyRequests.map((request, index) => (
                    <motion.div
                      key={request._id}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: index * 0.1 }}
                      whileHover={{ scale: 1.02 }}
                      className="bg-white rounded-2xl p-6 shadow-xl border border-red-100"
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center mb-3">
                            <span className="px-3 py-1 bg-red-100 text-red-700 rounded-full text-sm font-medium mr-3">
                              {request.bloodGroup}
                            </span>
                            <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                              (request.urgency === 'emergency' || request.urgency === 'critical')
                                ? 'bg-red-100 text-red-700 animate-pulse font-bold' 
                                : request.urgency === 'urgent'
                                ? 'bg-orange-100 text-orange-700'
                                : 'bg-yellow-100 text-yellow-700'
                            }`}>
                              {(request.urgency === 'emergency' || request.urgency === 'critical') ? `🚨 ${request.urgency.toUpperCase()}` : request.urgency}
                            </span>
                          </div>
                          
                          <h3 className="text-xl font-semibold text-gray-900 mb-2">
                            {request.recipientName || 'Anonymous'}
                          </h3>
                          
                          <div className="space-y-2 text-gray-600">
                            <p className="flex items-center">
                              <MapPinIcon className="h-4 w-4 mr-2 text-blue-500" />
                              {request.location?.address || 'Location not specified'}
                            </p>
                            <p className="flex items-center">
                              <ClockIcon className="h-4 w-4 mr-2 text-green-500" />
                              {new Date(request.createdAt).toLocaleDateString()}
                            </p>
                            <p className="flex items-center">
                              <UserGroupIcon className="h-4 w-4 mr-2 text-purple-500" />
                              {request.unitsNeeded} units needed
                            </p>
                          </div>
                        </div>
                      </div>
                      
                      <div className="flex space-x-3 mt-6">
                        <motion.button
                          whileHover={{ scale: 1.05 }}
                          whileTap={{ scale: 0.95 }}
                          onClick={() => initiateAcceptRequest(request)}
                          className="flex-1 bg-gradient-to-r from-green-500 to-green-600 text-white py-3 rounded-xl font-medium shadow-lg"
                        >
                          <HeartSolidIcon className="h-5 w-5 inline mr-2" />
                          Save Life Now
                        </motion.button>
                        
                        <motion.button
                          whileHover={{ scale: 1.05 }}
                          whileTap={{ scale: 0.95 }}
                          onClick={() => handleReferFriend(request)}
                          className="flex-1 bg-gradient-to-r from-blue-500 to-blue-600 text-white py-3 rounded-xl font-medium shadow-lg"
                        >
                          <ShareIcon className="h-5 w-5 inline mr-2" />
                          Refer Friend
                        </motion.button>
                      </div>
                    </motion.div>
                  ))}
                </div>
              )}
            </motion.div>
          )}

          {/* Camps Section */}
          {activeSection === 'camps' && (
            <motion.div
              key="camps"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
            >
              <h2 className="text-3xl font-bold text-gray-900 mb-6">Blood Donation Camps</h2>
              
              <div className="bg-white rounded-2xl p-8 shadow-xl border border-red-100">
                {campsLoading ? (
                  <div className="text-center py-12">
                    <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-red-500"></div>
                    <p className="text-gray-600 mt-4">Finding nearby camps...</p>
                  </div>
                ) : campsError ? (
                  <div className="text-center py-12">
                    <ExclamationTriangleIcon className="h-16 w-16 text-red-300 mx-auto mb-4" />
                    <h3 className="text-xl font-semibold text-gray-900 mb-2">Unable to load camps</h3>
                    <p className="text-gray-600">{campsError}</p>
                  </div>
                ) : donationCamps.length === 0 ? (
                  <div className="text-center py-12">
                    <BuildingOfficeIcon className="h-16 w-16 text-gray-300 mx-auto mb-4" />
                    <h3 className="text-xl font-semibold text-gray-900 mb-2">No camps nearby</h3>
                    <p className="text-gray-600">Check back later for new donation opportunities</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {donationCamps.map((camp, index) => (
                      <motion.div
                        key={camp._id}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: index * 0.1 }}
                        whileHover={{ scale: 1.02, y: -5 }}
                        className="bg-gradient-to-br from-red-50 to-pink-50 rounded-xl p-6 border border-red-100 shadow-lg hover:shadow-xl transition-all"
                      >
                        <div className="flex items-start justify-between mb-4">
                          <div className="flex items-center space-x-3">
                            <div className="w-12 h-12 bg-gradient-to-r from-red-500 to-pink-500 rounded-full flex items-center justify-center">
                              <BuildingOfficeIcon className="h-6 w-6 text-white" />
                            </div>
                            <div>
                              <h3 className="text-xl font-bold text-gray-900">{camp.name}</h3>
                              <p className="text-sm text-gray-600">{camp.organizer}</p>
                            </div>
                          </div>
                          <span className="px-3 py-1 bg-green-100 text-green-700 rounded-full text-xs font-medium">
                            Active
                          </span>
                        </div>
                        
                        <div className="space-y-3">
                          <div className="flex items-center space-x-2 text-gray-700">
                            <CalendarIcon className="h-5 w-5 text-red-500" />
                            <span className="font-medium">{camp.date}</span>
                          </div>
                          
                          <div className="flex items-center space-x-2 text-gray-700">
                            <MapPinIcon className="h-5 w-5 text-red-500" />
                            <span>{camp.location}</span>
                          </div>
                          
                          <div className="flex items-center space-x-2 text-gray-700">
                            <ClockIcon className="h-5 w-5 text-red-500" />
                            <span>{camp.time}</span>
                          </div>
                          
                          <div className="pt-3 border-t border-red-100">
                            <p className="text-sm text-gray-600 mb-3">Help save lives at this camp</p>
                            <motion.button
                              whileHover={{ scale: 1.05 }}
                              whileTap={{ scale: 0.95 }}
                              onClick={() => window.open(`https://maps.google.com/?q=${camp.location}`, '_blank')}
                              className="w-full bg-gradient-to-r from-red-500 to-pink-500 text-white py-3 rounded-xl font-medium shadow-lg hover:shadow-xl transition-all"
                            >
                              <MapIcon className="h-5 w-5 inline mr-2" />
                              Get Directions
                            </motion.button>
                          </div>
                        </div>
                      </motion.div>
                    ))}
                  </div>
                )}
              </div>
            </motion.div>
          )}

          {/* Journey Section */}
          {activeSection === 'journey' && (
            <motion.div
              key="journey"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
            >
              <h2 className="text-3xl font-bold text-gray-900 mb-6">Your Donation Journey</h2>
              
              {/* Hero Impact Toggle Button */}
              <div className="mb-6">
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => setShowHeroImpact(!showHeroImpact)}
                  className={`px-6 py-3 rounded-xl font-medium shadow-lg transition-all ${
                    showHeroImpact 
                      ? 'bg-gradient-to-r from-red-500 to-pink-500 text-white' 
                      : 'bg-white text-red-600 border-2 border-red-200 hover:border-red-300'
                  }`}
                >
                  <SparklesIcon className="h-5 w-5 inline mr-2" />
                  {showHeroImpact ? 'Hide' : 'Show'} Hero Impact
                </motion.button>
              </div>

              {/* Hero Impact Section - Only show when user wants to watch */}
              <AnimatePresence>
                {showHeroImpact && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    transition={{ duration: 0.3 }}
                    className="mb-8"
                  >
                    <div className="bg-gradient-to-br from-red-50 to-pink-50 rounded-2xl p-8 shadow-xl border-2 border-red-200 overflow-hidden">
                      <div className="relative">
                        {/* Animated background elements */}
                        <div className="absolute top-0 right-0 w-32 h-32 opacity-10">
                          {[...Array(3)].map((_, i) => (
                            <motion.div
                              key={i}
                              className="absolute"
                              initial={{ y: -20, opacity: 0 }}
                              animate={{ y: 80, opacity: [0, 1, 0] }}
                              transition={{
                                duration: 4,
                                repeat: Infinity,
                                delay: i * 1.3,
                                ease: "easeInOut"
                              }}
                              style={{
                                left: `${Math.random() * 100}%`,
                                transform: `rotate(${Math.random() * 360}deg)`
                              }}
                            >
                              <HeartSolidIcon className="h-8 w-8 text-red-500" />
                            </motion.div>
                          ))}
                        </div>

                        <div className="relative z-10">
                          <div className="text-center mb-6">
                            <motion.div
                              animate={{ scale: [1, 1.1, 1] }}
                              transition={{ duration: 2, repeat: Infinity }}
                              className="inline-block"
                            >
                              <TrophyIcon className="h-16 w-16 text-yellow-500 mx-auto mb-4" />
                            </motion.div>
                            <h3 className="text-2xl font-bold text-gray-900 mb-2">Your Hero Impact</h3>
                            <p className="text-gray-600">Every donation makes you a real hero</p>
                          </div>

                          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                            <motion.div
                              whileHover={{ scale: 1.05, y: -5 }}
                              className="text-center bg-white bg-opacity-80 rounded-xl p-6 shadow-lg"
                            >
                              <div className="text-3xl font-black text-red-600 mb-2">{livesSaved}</div>
                              <div className="text-sm text-gray-700">Lives Saved</div>
                            </motion.div>

                            <motion.div
                              whileHover={{ scale: 1.05, y: -5 }}
                              className="text-center bg-white bg-opacity-80 rounded-xl p-6 shadow-lg"
                            >
                              <div className="text-3xl font-black text-pink-600 mb-2">{donationHistory.length}</div>
                              <div className="text-sm text-gray-700">Total Donations</div>
                            </motion.div>

                            <motion.div
                              whileHover={{ scale: 1.05, y: -5 }}
                              className="text-center bg-white bg-opacity-80 rounded-xl p-6 shadow-lg"
                            >
                              <input
                                ref={fileInputRef}
                                type="file"
                                accept="image/*"
                                onChange={handlePictureUpload}
                                className="hidden"
                              />
                              <motion.button
                                whileHover={{ scale: 1.05 }}
                                whileTap={{ scale: 0.95 }}
                                onClick={triggerFileUpload}
                                disabled={uploadingPicture}
                                className={`relative w-full h-20 rounded-lg flex flex-col items-center justify-center transition-all ${
                                  uploadingPicture 
                                    ? 'bg-gray-100 cursor-not-allowed' 
                                    : pictureUploaded
                                    ? 'bg-green-100 cursor-default'
                                    : 'bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 cursor-pointer'
                                }`}
                              >
                                {uploadingPicture ? (
                                  <>
                                    <motion.div
                                      animate={{ rotate: 360 }}
                                      transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                                      className="mb-2"
                                    >
                                      <PhotoIcon className="h-6 w-6 text-gray-400" />
                                    </motion.div>
                                    <span className="text-xs text-gray-500">Uploading...</span>
                                  </>
                                ) : pictureUploaded ? (
                                  <>
                                    <CheckCircleIcon className="h-6 w-6 text-green-600 mb-2" />
                                    <span className="text-xs text-green-700 font-medium">+10 Points!</span>
                                  </>
                                ) : (
                                  <>
                                    <PhotoIcon className="h-6 w-6 text-white mb-2" />
                                    <span className="text-xs text-white font-medium">Upload Photo</span>
                                    <span className="text-xs text-purple-100 mt-1">Earn Points</span>
                                  </>
                                )}
                              </motion.button>
                            </motion.div>
                          </div>

                          <div className="mt-6 text-center">
                            <p className="text-lg font-medium text-gray-800">
                              🌟 You are a true lifesaver! Keep making a difference! 🌟
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              <div className="bg-white rounded-2xl p-8 shadow-xl border border-red-100">
                <div className="space-y-6">
                  {donationHistory.length === 0 ? (
                    <div className="text-center py-12">
                      <CalendarIcon className="h-16 w-16 text-gray-300 mx-auto mb-4" />
                      <h3 className="text-xl font-semibold text-gray-900 mb-2">Your journey begins here</h3>
                      <p className="text-gray-600">Start donating to build your legacy</p>
                    </div>
                  ) : (
                    donationHistory.map((donation, index) => (
                      <motion.div
                        key={donation._id}
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: index * 0.1 }}
                        className="flex items-center space-x-4 p-4 bg-gray-50 rounded-xl"
                      >
                        <div className="flex-shrink-0">
                          <div className="w-12 h-12 bg-gradient-to-r from-red-500 to-pink-500 rounded-full flex items-center justify-center text-white font-bold">
                            {index + 1}
                          </div>
                        </div>
                        <div className="flex-1">
                          <h4 className="font-semibold text-gray-900">Blood Donation</h4>
                          <p className="text-sm text-gray-600">
                            {new Date(donation.date).toLocaleDateString()} • {donation.location}
                          </p>
                        </div>
                        <div className="flex-shrink-0">
                          <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                            donation.status === 'completed' 
                              ? 'bg-green-100 text-green-700' 
                              : 'bg-yellow-100 text-yellow-700'
                          }`}>
                            {donation.status}
                          </span>
                        </div>
                      </motion.div>
                    ))
                  )}
                </div>

              {/* Recent Certificates Showcase */}
              <div className="mt-8 bg-gradient-to-br from-yellow-50 to-orange-50 rounded-2xl p-6 shadow-xl border border-yellow-200">
                <h3 className="text-xl font-bold text-gray-900 mb-4 flex items-center">
                  <TrophyIcon className="h-6 w-6 text-yellow-600 mr-2" />
                  Recent Certificates
                </h3>
                <div className="text-sm text-gray-600 mb-4">
                  Your latest achievements and milestones
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {/* This will show the 3 most recent certificates */}
                  <div className="bg-white rounded-xl p-4 shadow-md border border-yellow-100">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded-full">Latest</span>
                      <TrophyIcon className="h-5 w-5 text-yellow-500" />
                    </div>
                    <h4 className="font-semibold text-gray-900 mb-1">Blood Donation Certificate</h4>
                    <p className="text-xs text-gray-600">Certificate #BLOOD-2024-123456</p>
                    <div className="mt-3 flex space-x-2">
                      <button className="text-xs bg-blue-500 text-white px-3 py-1 rounded hover:bg-blue-600 transition-colors">
                        View
                      </button>
                      <button className="text-xs bg-green-500 text-white px-3 py-1 rounded hover:bg-green-600 transition-colors">
                        Share
                      </button>
                    </div>
                  </div>
                  
                  <div className="bg-white rounded-xl p-4 shadow-md border border-yellow-100 opacity-75">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs bg-purple-100 text-purple-700 px-2 py-1 rounded-full">Milestone</span>
                      <TrophyIcon className="h-5 w-5 text-purple-500" />
                    </div>
                    <h4 className="font-semibold text-gray-900 mb-1">5th Donation Certificate</h4>
                    <p className="text-xs text-gray-600">Certificate #BLOOD-2024-098765</p>
                    <div className="mt-3 flex space-x-2">
                      <button className="text-xs bg-blue-500 text-white px-3 py-1 rounded hover:bg-blue-600 transition-colors">
                        View
                      </button>
                      <button className="text-xs bg-green-500 text-white px-3 py-1 rounded hover:bg-green-600 transition-colors">
                        Share
                      </button>
                    </div>
                  </div>
                  
                  <div className="bg-white rounded-xl p-4 shadow-md border border-yellow-100 opacity-50">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded-full">First</span>
                      <TrophyIcon className="h-5 w-5 text-blue-500" />
                    </div>
                    <h4 className="font-semibold text-gray-900 mb-1">First Donation Certificate</h4>
                    <p className="text-xs text-gray-600">Certificate #BLOOD-2024-054321</p>
                    <div className="mt-3 flex space-x-2">
                      <button className="text-xs bg-blue-500 text-white px-3 py-1 rounded hover:bg-blue-600 transition-colors">
                        View
                      </button>
                      <button className="text-xs bg-green-500 text-white px-3 py-1 rounded hover:bg-green-600 transition-colors">
                        Share
                      </button>
                    </div>
                  </div>
                </div>
                
                <div className="mt-4 text-center">
                  <button 
                    onClick={() => setShowCertificateModal(true)}
                    className="text-sm bg-gradient-to-r from-yellow-500 to-orange-500 text-white px-6 py-2 rounded-full hover:from-yellow-600 hover:to-orange-600 transition-all"
                  >
                    View All Certificates →
                  </button>
                </div>
              </div>
              </div>
            </motion.div>
          )}

          {/* Community Section */}
          {activeSection === 'community' && (
            <motion.div
              key="community"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
            >
              <h2 className="text-3xl font-bold text-gray-900 mb-6">Join the Community</h2>
              
              <div className="grid grid-cols-1 md:grid-cols-1 gap-6">
                <motion.div
                  whileHover={{ scale: 1.05 }}
                  className="bg-gradient-to-br from-purple-400 to-pink-500 rounded-2xl p-6 text-white shadow-xl"
                >
                  <UserGroupIcon className="h-12 w-12 mb-4" />
                  <h3 className="text-2xl font-bold mb-2">Share Your Impact</h3>
                  <p className="text-purple-100 mb-4">Inspire others to donate</p>
                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={handleShareImpact}
                    className="w-full bg-white text-purple-600 py-3 rounded-xl font-medium shadow-lg"
                  >
                    <ShareIcon className="h-5 w-5 inline mr-2" />
                    Share Your Story
                  </motion.button>
                </motion.div>
              </div>
            </motion.div>
          )}

          {/* Photo Gallery Section */}
          {activeSection === 'gallery' && (
            <motion.div
              key="gallery"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
            >
              <h2 className="text-3xl font-bold text-gray-900 mb-6">My Donation Photos</h2>
              
              {uploadedPhotos.length === 0 ? (
                <div className="text-center py-12">
                  <PhotoIcon className="h-16 w-16 text-gray-300 mx-auto mb-4" />
                  <h3 className="text-xl font-semibold text-gray-900 mb-2">No photos yet</h3>
                  <p className="text-gray-600 mb-6">Upload your blood donation photos to track your journey</p>
                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => setActiveSection('impact')}
                    className="bg-gradient-to-r from-purple-500 to-pink-500 text-white px-6 py-3 rounded-xl font-medium shadow-lg"
                  >
                    Upload Your First Photo
                  </motion.button>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {uploadedPhotos.map((photo) => (
                    <motion.div
                      key={photo.id}
                      whileHover={{ scale: 1.05, y: -5 }}
                      className="bg-white rounded-2xl shadow-xl overflow-hidden"
                    >
                      <div className="aspect-w-16 aspect-h-12 bg-gray-100">
                        <img
                          src={photo.url}
                          alt={photo.name}
                          className="w-full h-48 object-cover"
                        />
                      </div>
                      <div className="p-4">
                        <div className="flex items-center justify-between mb-2">
                          <h4 className="font-semibold text-gray-900 truncate">{photo.name}</h4>
                          <span className="text-xs text-gray-500">
                            {new Date(photo.uploadDate).toLocaleDateString()}
                          </span>
                        </div>
                        <div className="flex gap-2">
                          <motion.button
                            whileHover={{ scale: 1.05 }}
                            whileTap={{ scale: 0.95 }}
                            onClick={() => handleViewPhoto(photo)}
                            className="flex-1 bg-blue-500 text-white py-2 rounded-lg text-sm font-medium"
                          >
                            <EyeIcon className="h-4 w-4 inline mr-1" />
                            View
                          </motion.button>
                          <motion.button
                            whileHover={{ scale: 1.05 }}
                            whileTap={{ scale: 0.95 }}
                            onClick={() => handleDeletePhoto(photo.id)}
                            className="flex-1 bg-red-500 text-white py-2 rounded-lg text-sm font-medium"
                          >
                            <TrashIcon className="h-4 w-4 inline mr-1" />
                            Delete
                          </motion.button>
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </div>
              )}
            </motion.div>
          )}

          {/* Certificates Section */}
          {activeSection === 'certificates' && (
            <motion.div
              key="certificates"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
            >
              <h2 className="text-3xl font-bold text-gray-900 mb-6">My Certificates</h2>
              <CertificateGallery userId={user?.id} />
            </motion.div>
          )}

          {/* Profile Section */}
          {activeSection === 'profile' && (
            <motion.div
              key="profile"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
            >
              <h2 className="text-3xl font-bold text-gray-900 mb-6">My Profile</h2>
              
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Profile Information */}
                <div className="lg:col-span-1">
                  <motion.div
                    whileHover={{ scale: 1.02 }}
                    className="bg-white rounded-2xl shadow-xl p-6"
                  >
                    <div className="text-center mb-6">
                      <div className="w-24 h-24 bg-gradient-to-br from-purple-500 to-pink-500 rounded-full mx-auto mb-4 flex items-center justify-center">
                        <span className="text-3xl text-white font-bold">
                          {user?.name?.charAt(0)?.toUpperCase() || 'D'}
                        </span>
                      </div>
                      <h3 className="text-xl font-bold text-gray-900">{user?.name || 'Donor'}</h3>
                      <p className="text-gray-600">{user?.email || 'donor@bloodnet.com'}</p>
                      <div className="flex justify-center gap-2 mt-3">
                        <span className="bg-purple-100 text-purple-700 px-3 py-1 rounded-full text-sm font-medium">
                          {user?.bloodGroup || 'O+'}
                        </span>
                        <span className="bg-green-100 text-green-700 px-3 py-1 rounded-full text-sm font-medium">
                          Active Donor
                        </span>
                      </div>
                    </div>
                    
                    <div className="space-y-4">
                      <div className="flex justify-between items-center">
                        <span className="text-gray-600">Total Donations</span>
                        <span className="font-bold text-gray-900">{donationHistory.length}</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-gray-600">Impact Points</span>
                        <span className="font-bold text-purple-600">{totalImpact}</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-gray-600">Member Since</span>
                        <span className="font-bold text-gray-900">
                          {user?.createdAt ? new Date(user.createdAt).toLocaleDateString() : '2024'}
                        </span>
                      </div>
                    </div>
                  </motion.div>
                </div>

                {/* Donation Photos Gallery */}
                <div className="lg:col-span-2">
                  <motion.div
                    whileHover={{ scale: 1.02 }}
                    className="bg-white rounded-2xl shadow-xl p-6"
                  >
                    <h3 className="text-xl font-bold text-gray-900 mb-4">My Donation Photos</h3>
                    
                    {uploadedPhotos.length === 0 ? (
                      <div className="text-center py-8">
                        <PhotoIcon className="h-12 w-12 text-gray-300 mx-auto mb-3" />
                        <p className="text-gray-600 mb-4">No donation photos yet</p>
                        <motion.button
                          whileHover={{ scale: 1.05 }}
                          whileTap={{ scale: 0.95 }}
                          onClick={() => setActiveSection('impact')}
                          className="bg-gradient-to-r from-purple-500 to-pink-500 text-white px-4 py-2 rounded-lg text-sm font-medium"
                        >
                          Upload First Photo
                        </motion.button>
                      </div>
                    ) : (
                      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                        {uploadedPhotos.map((photo) => (
                          <motion.div
                            key={photo.id}
                            whileHover={{ scale: 1.05, y: -3 }}
                            className="relative group"
                          >
                            <div className="aspect-square rounded-lg overflow-hidden bg-gray-100">
                              <img
                                src={photo.url}
                                alt={photo.name}
                                className="w-full h-full object-cover"
                              />
                            </div>
                            <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-50 transition-all rounded-lg flex items-center justify-center opacity-0 group-hover:opacity-100">
                              <div className="flex gap-2">
                                <motion.button
                                  whileHover={{ scale: 1.1 }}
                                  whileTap={{ scale: 0.9 }}
                                  onClick={() => handleViewPhoto(photo)}
                                  className="bg-white text-blue-600 p-2 rounded-full"
                                >
                                  <EyeIcon className="h-4 w-4" />
                                </motion.button>
                                <motion.button
                                  whileHover={{ scale: 1.1 }}
                                  whileTap={{ scale: 0.9 }}
                                  onClick={() => handleDeletePhoto(photo.id)}
                                  className="bg-white text-red-600 p-2 rounded-full"
                                >
                                  <TrashIcon className="h-4 w-4" />
                                </motion.button>
                              </div>
                            </div>
                            <div className="mt-2">
                              <p className="text-xs text-gray-600 truncate">{photo.name}</p>
                              <p className="text-xs text-gray-400">
                                {new Date(photo.uploadDate).toLocaleDateString()}
                              </p>
                            </div>
                          </motion.div>
                        ))}
                      </div>
                    )}
                  </motion.div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Journey Section - Moved from Hero */}
        <motion.section
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5, duration: 0.8 }}
          className="mb-12"
        >
          <div className="bg-white rounded-2xl shadow-xl p-6 border border-red-100">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-2xl font-bold text-gray-900">Your Journey</h3>
                <p className="text-gray-600">Level: {getCurrentMilestone().title}</p>
              </div>
              <div className={`text-4xl ${getCurrentMilestone().icon.includes('🌟') ? 'animate-pulse' : ''}`}>
                {getCurrentMilestone().icon}
              </div>
            </div>
            
            <div className="relative">
              <div className="h-4 bg-gray-200 rounded-full overflow-hidden">
                <motion.div
                  className={`h-full bg-gradient-to-r ${getCurrentMilestone().color} rounded-full`}
                  initial={{ width: 0 }}
                  animate={{ width: `${getMilestoneProgress()}%` }}
                  transition={{ duration: 1.5, delay: 0.5 }}
                />
              </div>
              <div className="flex justify-between mt-2">
                <span className="text-sm text-gray-600">Current Level</span>
                <span className="text-sm text-gray-600">{nextMilestone > 0 ? `${nextMilestone} donations to next level` : 'Max Level!'}</span>
              </div>
            </div>
          </div>
        </motion.section>

        {/* Call to Action */}
        <motion.section
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6, duration: 0.8 }}
          className="text-center mt-16"
        >
          <div className="bg-gradient-to-r from-red-500 to-pink-500 rounded-3xl p-8 text-white shadow-2xl">
            <h2 className="text-3xl font-bold mb-4">Ready to Make a Difference?</h2>
            <p className="text-xl mb-6 text-red-100">Your next donation could save up to 3 lives</p>
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => setActiveSection('requests')}
              className="bg-white text-red-600 px-8 py-4 rounded-xl font-bold text-lg shadow-xl"
            >
              <HeartSolidIcon className="h-6 w-6 inline mr-2" />
              Save a Life Today
            </motion.button>
          </div>
        </motion.section>

      {/* Certificate Modal */}
      <AnimatePresence>
        {showCertificateModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50"
            onClick={() => setShowCertificateModal(false)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white rounded-2xl p-6 max-w-4xl w-full max-h-[90vh] overflow-y-auto"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-bold text-gray-900">My Certificates</h2>
                <button
                  onClick={() => setShowCertificateModal(false)}
                  className="text-gray-500 hover:text-gray-700 transition-colors"
                >
                  <XMarkIcon className="h-6 w-6" />
                </button>
              </div>
              
              <CertificateGallery userId={user?.id} />
            </motion.div>
          </motion.div>
        )}

        {/* Accept Request Confirmation & Location Consent Modal */}
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
                        Helps the recipient monitor your travel in real time. Sent securely while this tab is open.
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
                    You can pause or stop location sharing at any time. Tracking ceases automatically once the request is fulfilled.
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
                  className="flex-1 py-3 px-4 bg-gradient-to-r from-red-500 to-pink-500 text-white rounded-xl font-bold shadow-lg hover:shadow-xl transition-all disabled:opacity-50"
                >
                  {acceptingInProgress ? 'Confirming...' : 'Confirm & Save Life'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
      </div>
    </div>
  );
};

export default RevolutionaryDonorDashboard;
