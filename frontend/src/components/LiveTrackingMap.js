import React, { useEffect, useRef, useState, useMemo } from 'react';
import { locationAPI } from '../services/api';
import { buildDirectionsUrl, cleanAddressForMaps } from '../utils/mapUtils';
import {
  MapPinIcon,
  ShieldCheckIcon,
  ClockIcon,
  ArrowTopRightOnSquareIcon,
  SignalIcon,
  ExclamationTriangleIcon,
  PauseIcon,
  PlayIcon,
  NoSymbolIcon,
  LockClosedIcon,
  ArrowPathIcon
} from '@heroicons/react/24/solid';

/**
 * LiveTrackingMap
 * Production-ready real-time map displaying:
 * - Recipient location (if consented and within 24h window)
 * - Accepted hospital's verified address (static, not live-moving)
 * - Accepted donor's live location (if donor enabled sharing and within 24h window)
 * - Enforces strict 24-hour automatic stop countdown and expired status
 * - Live status badges, accuracy, staleness, directions link & accessible text alternative
 */
const LiveTrackingMap = ({
  requestId,
  requesterLocation,
  hospitalInfo,
  donorInfo,
  myRole,
  isRequestClosed,
  onToggleConsent,
  expiresAt,
  isExpired,
  remainingSeconds,
  locationSharingExpired,
  onRenewSharing,
  height = '420px'
}) => {
  const mapContainerRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const markersRef = useRef({});
  const [googleMapsReady, setGoogleMapsReady] = useState(false);
  const [googleMapsError, setGoogleMapsError] = useState(false);
  const [now, setNow] = useState(Date.now());
  const [resolvedCoords, setResolvedCoords] = useState({});

  // 24-hour expiration state and countdown
  const effectiveExpiresAt = expiresAt || donorInfo?.expiresAt || hospitalInfo?.expiresAt;
  const [timeLeft, setTimeLeft] = useState(() => {
    if (typeof remainingSeconds === 'number') return Math.max(0, remainingSeconds);
    if (effectiveExpiresAt) {
      return Math.max(0, Math.floor((new Date(effectiveExpiresAt).getTime() - Date.now()) / 1000));
    }
    return 86400; // default 24h in seconds if active
  });

  const [hasExpired, setHasExpired] = useState(() => {
    if (isExpired || locationSharingExpired) return true;
    if (donorInfo?.isExpired || donorInfo?.locationSharingExpired) return true;
    if (hospitalInfo?.isExpired || hospitalInfo?.locationSharingExpired) return true;
    if (effectiveExpiresAt) {
      return Date.now() >= new Date(effectiveExpiresAt).getTime();
    }
    return false;
  });

  // Keep countdown running smoothly every second
  useEffect(() => {
    if (!effectiveExpiresAt) return;

    const tick = () => {
      const remainingMs = new Date(effectiveExpiresAt).getTime() - Date.now();
      if (remainingMs <= 0) {
        setTimeLeft(0);
        setHasExpired(true);
      } else {
        setTimeLeft(Math.floor(remainingMs / 1000));
        setHasExpired(false);
      }
    };

    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [effectiveExpiresAt]);

  // Sync state if server passes updated props
  useEffect(() => {
    if (isExpired || locationSharingExpired || donorInfo?.isExpired || hospitalInfo?.isExpired) {
      setHasExpired(true);
      setTimeLeft(0);
    }
  }, [isExpired, locationSharingExpired, donorInfo?.isExpired, hospitalInfo?.isExpired]);

  // Listen to Socket.IO real-time expiration & renewal events
  useEffect(() => {
    const handleExpiredEvent = (data) => {
      if (data?.requestId === requestId) {
        setHasExpired(true);
        setTimeLeft(0);
      }
    };

    const handleRenewedEvent = (data) => {
      if (data?.requestId === requestId) {
        setHasExpired(false);
        if (data.remainingSeconds) {
          setTimeLeft(data.remainingSeconds);
        } else if (data.expiresAt) {
          setTimeLeft(Math.max(0, Math.floor((new Date(data.expiresAt).getTime() - Date.now()) / 1000)));
        }
      }
    };

    if (window.__bloodnetSocket) {
      window.__bloodnetSocket.on('locationSharingExpired', handleExpiredEvent);
      window.__bloodnetSocket.on('locationSharingRenewed', handleRenewedEvent);
    }

    return () => {
      if (window.__bloodnetSocket) {
        window.__bloodnetSocket.off('locationSharingExpired', handleExpiredEvent);
        window.__bloodnetSocket.off('locationSharingRenewed', handleRenewedEvent);
      }
    };
  }, [requestId]);

  const formatCountdown = (totalSec) => {
    if (!totalSec || totalSec <= 0) return '00h 00m 00s';
    const hrs = Math.floor(totalSec / 3600);
    const mins = Math.floor((totalSec % 3600) / 60);
    const secs = totalSec % 60;
    return `${hrs.toString().padStart(2, '0')}h ${mins.toString().padStart(2, '0')}m ${secs.toString().padStart(2, '0')}s`;
  };

  // Dynamic geocoding for addresses that do not yet have numerical coordinates
  useEffect(() => {
    const addressesToLookup = [];
    const reqLat = parseFloat(requesterLocation?.lat);
    const reqLng = parseFloat(requesterLocation?.lng);
    if ((isNaN(reqLat) || isNaN(reqLng) || (reqLat === 0 && reqLng === 0)) && requesterLocation?.address) {
      addressesToLookup.push(requesterLocation.address);
    }

    const hospLat = parseFloat(hospitalInfo?.lat);
    const hospLng = parseFloat(hospitalInfo?.lng);
    if ((isNaN(hospLat) || isNaN(hospLng) || (hospLat === 0 && hospLng === 0)) && hospitalInfo?.address) {
      addressesToLookup.push(hospitalInfo.address);
    }

    const donorLat = parseFloat(donorInfo?.currentLocation?.lat || donorInfo?.lat);
    const donorLng = parseFloat(donorInfo?.currentLocation?.lng || donorInfo?.lng);
    const donorAddr = (donorInfo?.currentLocation?.address || donorInfo?.address || '').trim();
    if ((isNaN(donorLat) || isNaN(donorLng) || (donorLat === 0 && donorLng === 0)) && donorAddr) {
      addressesToLookup.push(donorAddr);
    }

    addressesToLookup.forEach(async (addr) => {
      const cleanAddr = addr.trim();
      if (!cleanAddr || resolvedCoords[cleanAddr]) return;
      try {
        const res = await locationAPI.geocode(cleanAddr);
        if (res.data?.lat && res.data?.lng) {
          setResolvedCoords(prev => ({
            ...prev,
            [cleanAddr]: { lat: res.data.lat, lng: res.data.lng }
          }));
        }
      } catch (err) {
        // Geocoding fallback silent
      }
    });
  }, [requesterLocation, hospitalInfo, resolvedCoords]);

  // Periodically refresh relative time labels (e.g. "updated 12s ago")
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 10000);
    return () => clearInterval(timer);
  }, []);

  // Catch Google Maps auth failure gracefully
  useEffect(() => {
    window.gm_authFailure = () => {
      console.warn('Google Maps auth error or missing credentials. Falling back to OpenStreetMap interactive map.');
      setGoogleMapsError(true);
      setGoogleMapsReady(false);
    };
  }, []);

  const formatTimeAgo = (date) => {
    if (!date) return 'Not available';
    const seconds = Math.floor((now - new Date(date).getTime()) / 1000);
    if (seconds < 30) return 'Just now';
    if (seconds < 60) return `${seconds}s ago`;
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    return `${hours}h ago`;
  };

  const isStale = (date) => {
    if (!date) return true;
    return (now - new Date(date).getTime()) > 5 * 60 * 1000;
  };

  // Check if Google Maps script is available or load it safely
  useEffect(() => {
    if (window.google && window.google.maps) {
      setGoogleMapsReady(true);
      return;
    }

    const apiKey = process.env.REACT_APP_GOOGLE_MAPS_API_KEY;
    if (!apiKey) {
      setGoogleMapsReady(false);
      setGoogleMapsError(true);
      return;
    }

    const existingScript = document.getElementById('google-maps-script');
    if (!existingScript) {
      const script = document.createElement('script');
      script.id = 'google-maps-script';
      script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places`;
      script.async = true;
      script.defer = true;
      script.onload = () => setGoogleMapsReady(true);
      script.onerror = () => {
        setGoogleMapsReady(false);
        setGoogleMapsError(true);
      };
      document.head.appendChild(script);
    } else {
      existingScript.addEventListener('load', () => setGoogleMapsReady(true));
      existingScript.addEventListener('error', () => {
        setGoogleMapsReady(false);
        setGoogleMapsError(true);
      });
    }
  }, []);

  // Compute map center and active points (hiding expired coordinates)
  const points = useMemo(() => {
    const pts = [];

    // Recipient location: only shown if not expired for responders
    const recipientAccessAllowed = myRole === 'recipient' || (!hasExpired && !isRequestClosed);

    if (recipientAccessAllowed && requesterLocation) {
      let reqLat = parseFloat(requesterLocation?.lat);
      let reqLng = parseFloat(requesterLocation?.lng);
      const reqAddr = (requesterLocation?.address || '').trim();
      if ((isNaN(reqLat) || isNaN(reqLng) || (reqLat === 0 && reqLng === 0)) && reqAddr && resolvedCoords[reqAddr]) {
        reqLat = resolvedCoords[reqAddr].lat;
        reqLng = resolvedCoords[reqAddr].lng;
      }

      const hasReqCoords = !isNaN(reqLat) && !isNaN(reqLng) && (reqLat !== 0 || reqLng !== 0);
      const reqDirectionsUrl = buildDirectionsUrl(
        hasReqCoords ? reqLat : null,
        hasReqCoords ? reqLng : null,
        reqAddr
      );

      if (hasReqCoords) {
        pts.push({
          type: 'recipient',
          title: 'Recipient Destination',
          lat: reqLat,
          lng: reqLng,
          address: reqAddr || 'Recipient Location',
          accuracy: requesterLocation?.accuracy,
          lastUpdated: requesterLocation?.lastUpdated,
          color: '#EF4444',
          iconLetter: '♥',
          directionsUrl: reqDirectionsUrl
        });
      } else if (reqAddr) {
        pts.push({
          type: 'recipient',
          title: 'Recipient Destination',
          lat: null,
          lng: null,
          address: reqAddr,
          accuracy: null,
          lastUpdated: requesterLocation?.lastUpdated,
          color: '#EF4444',
          iconLetter: '♥',
          directionsUrl: reqDirectionsUrl
        });
      }
    }

    // Hospital location: saved facility address
    let hospLat = parseFloat(hospitalInfo?.lat);
    let hospLng = parseFloat(hospitalInfo?.lng);
    const hospAddr = (hospitalInfo?.address || '').trim();
    if ((isNaN(hospLat) || isNaN(hospLng) || (hospLat === 0 && hospLng === 0)) && hospAddr && resolvedCoords[hospAddr]) {
      hospLat = resolvedCoords[hospAddr].lat;
      hospLng = resolvedCoords[hospAddr].lng;
    }

    const hasHospCoords = !isNaN(hospLat) && !isNaN(hospLng) && (hospLat !== 0 || hospLng !== 0);
    const hospDirectionsUrl = buildDirectionsUrl(
      hasHospCoords ? hospLat : null,
      hasHospCoords ? hospLng : null,
      hospAddr
    ) || (hospitalInfo?.directionsUrl && !hospitalInfo.directionsUrl.includes('BSNL') ? hospitalInfo.directionsUrl : null);

    if (hasHospCoords) {
      pts.push({
        type: 'hospital',
        title: hospitalInfo?.hospitalName || 'Accepted Hospital',
        lat: hospLat,
        lng: hospLng,
        address: hospAddr || 'Medical Facility',
        verified: true,
        directionsUrl: hospDirectionsUrl,
        color: '#2563EB',
        iconLetter: 'H'
      });
    } else if (hospAddr) {
      pts.push({
        type: 'hospital',
        title: hospitalInfo?.hospitalName || 'Accepted Hospital',
        lat: null,
        lng: null,
        address: hospAddr,
        verified: true,
        directionsUrl: hospDirectionsUrl,
        color: '#2563EB',
        iconLetter: 'H'
      });
    }

    // Donor location: only shown if within unexpired 24-hour window
    const donorAllowed = !hasExpired && !isRequestClosed && !donorInfo?.isExpired;
    if (donorAllowed && (donorInfo?.currentLocation?.lat || donorInfo?.currentLocation?.address || donorInfo?.address || donorInfo?.lat)) {
      let donorLat = parseFloat(donorInfo?.currentLocation?.lat || donorInfo?.lat);
      let donorLng = parseFloat(donorInfo?.currentLocation?.lng || donorInfo?.lng);
      const donorAddr = (donorInfo?.currentLocation?.address || donorInfo?.address || '').trim();

      if ((isNaN(donorLat) || isNaN(donorLng) || (donorLat === 0 && donorLng === 0)) && donorAddr && resolvedCoords[donorAddr]) {
        donorLat = resolvedCoords[donorAddr].lat;
        donorLng = resolvedCoords[donorAddr].lng;
      }

      const hasDonorCoords = !isNaN(donorLat) && !isNaN(donorLng) && (donorLat !== 0 || donorLng !== 0);
      const donorDirectionsUrl = buildDirectionsUrl(
        hasDonorCoords ? donorLat : null,
        hasDonorCoords ? donorLng : null,
        donorAddr
      );

      pts.push({
        type: 'donor',
        title: `Donor: ${donorInfo?.name || 'Responding Donor'}`,
        lat: hasDonorCoords ? donorLat : null,
        lng: hasDonorCoords ? donorLng : null,
        address: donorAddr || (hasDonorCoords ? 'Verified GPS Location' : 'Donor Address'),
        accuracy: donorInfo?.currentLocation?.accuracy,
        lastUpdated: donorInfo?.currentLocation?.lastUpdated,
        color: '#059669',
        iconLetter: 'D',
        directionsUrl: donorDirectionsUrl
      });
    }

    return pts;
  }, [requesterLocation, hospitalInfo, donorInfo, resolvedCoords, hasExpired, isRequestClosed, myRole]);

  // Initialize or update Google Map
  useEffect(() => {
    if (!googleMapsReady || !mapContainerRef.current || !window.google?.maps) return;

    if (!mapInstanceRef.current) {
      const defaultCenter = points[0] ? { lat: points[0].lat, lng: points[0].lng } : { lat: 19.076, lng: 72.8777 };
      mapInstanceRef.current = new window.google.maps.Map(mapContainerRef.current, {
        center: defaultCenter,
        zoom: points.length > 1 ? 12 : 13,
        mapTypeControl: false,
        streetViewControl: false,
        fullscreenControl: true
      });
    }

    const map = mapInstanceRef.current;
    const bounds = new window.google.maps.LatLngBounds();
    const currentMarkers = markersRef.current;

    // Clear stale markers
    Object.keys(currentMarkers).forEach(key => {
      if (!points.some(p => p.type === key && p.lat && p.lng)) {
        currentMarkers[key].setMap(null);
        delete currentMarkers[key];
      }
    });

    points.forEach(point => {
      if (!point.lat || !point.lng) return;

      const pos = { lat: point.lat, lng: point.lng };
      bounds.extend(pos);

      if (currentMarkers[point.type]) {
        currentMarkers[point.type].setPosition(pos);
      } else {
        const marker = new window.google.maps.Marker({
          position: pos,
          map,
          title: point.title,
          label: {
            text: point.iconLetter,
            color: '#FFFFFF',
            fontWeight: 'bold',
            fontSize: '12px'
          },
          icon: {
            path: window.google.maps.SymbolPath.CIRCLE,
            scale: 16,
            fillColor: point.color,
            fillOpacity: 1,
            strokeColor: '#FFFFFF',
            strokeWeight: 2
          }
        });

        const infoWindow = new window.google.maps.InfoWindow({
          content: `
            <div style="font-family: -apple-system, BlinkMacSystemFont, sans-serif; padding: 6px; max-width: 200px;">
              <strong style="color: ${point.color}; font-size: 13px;">${point.title}</strong>
              <p style="margin: 4px 0 0; font-size: 11px; color: #4B5563;">${point.address || 'Verified coordinate'}</p>
              ${point.directionsUrl ? `<a href="${point.directionsUrl}" target="_blank" style="display: inline-block; margin-top: 6px; font-size: 11px; color: #2563EB; font-weight: 600;">Get Directions &rarr;</a>` : ''}
            </div>
          `
        });

        marker.addListener('click', () => {
          infoWindow.open(map, marker);
        });

        currentMarkers[point.type] = marker;
      }
    });

    if (points.length > 1) {
      map.fitBounds(bounds, { top: 40, bottom: 40, left: 40, right: 40 });
    } else if (points.length === 1 && points[0].lat && points[0].lng) {
      map.setCenter({ lat: points[0].lat, lng: points[0].lng });
    }
  }, [googleMapsReady, points]);

  // Tracking status indicators
  const donorLocationSharingActive = !hasExpired && (donorInfo?.donorShareLocation || donorInfo?.shareLocation) && (donorInfo?.currentLocation?.address || donorInfo?.address || donorInfo?.currentLocation?.lat || donorInfo?.lat) && !isRequestClosed;
  const donorStale = donorInfo?.currentLocation?.lastUpdated && isStale(donorInfo.currentLocation.lastUpdated);

  const recipientSharingActive = !hasExpired && requesterLocation?.lat && !isRequestClosed;
  const recipientStale = requesterLocation?.lastUpdated && isStale(requesterLocation.lastUpdated);

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">

      {/* 24-HOUR AUTOMATIC STOP BANNER */}
      {hasExpired ? (
        <div className="px-5 py-3.5 bg-rose-50 border-b border-rose-200 text-xs flex flex-wrap items-center justify-between gap-3 text-rose-900">
          <div className="flex items-center gap-2.5">
            <span className="p-1.5 bg-rose-100 text-rose-700 rounded-lg">
              <LockClosedIcon className="w-4 h-4 text-rose-700" />
            </span>
            <div>
              <span className="font-extrabold text-rose-900 block text-xs">
                24-Hour Location Sharing Window Expired
              </span>
              <span className="text-[11px] text-rose-700 block">
                Sharing automatically concluded at exactly 24 hours for security & privacy. Live coordinates have been revoked for both sides.
              </span>
            </div>
          </div>
          {myRole === 'recipient' && onRenewSharing && !isRequestClosed && (
            <button
              onClick={onRenewSharing}
              type="button"
              className="px-3.5 py-1.5 bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs rounded-xl shadow-xs transition-all flex items-center gap-1.5"
            >
              <ArrowPathIcon className="w-3.5 h-3.5" />
              <span>Renew for 24 Hours</span>
            </button>
          )}
        </div>
      ) : effectiveExpiresAt ? (
        <div className="px-5 py-2.5 bg-amber-50/90 border-b border-amber-200 text-xs flex flex-wrap items-center justify-between gap-2 text-amber-950">
          <div className="flex items-center gap-2">
            <ClockIcon className="w-4 h-4 text-amber-600 flex-shrink-0 animate-pulse" />
            <span>
              <strong className="font-bold">24-Hour Security Timer:</strong>{' '}
              <span className="font-mono font-extrabold text-amber-900 bg-white/90 px-2 py-0.5 rounded border border-amber-300 shadow-2xs">
                {formatCountdown(timeLeft)}
              </span>{' '}
              <span className="text-amber-800 text-[11px]">remaining before sharing stops automatically</span>
            </span>
          </div>
          <span className="text-[10px] text-amber-700 font-semibold bg-amber-100/70 px-2 py-0.5 rounded-full">
            Fixed 24h Window • No Auto-Renewal
          </span>
        </div>
      ) : null}

      {/* Header Bar with Live Tracking Status */}
      <div className="px-5 py-4 border-b border-gray-100 flex flex-wrap items-center justify-between gap-3 bg-gradient-to-r from-gray-50 to-white">
        <div className="flex items-center space-x-2.5">
          <div className="p-2 bg-red-50 text-red-600 rounded-xl">
            <MapPinIcon className="w-5 h-5" />
          </div>
          <div>
            <h4 className="text-sm font-bold text-gray-900 flex items-center gap-1.5">
              <span>Emergency Location & Tracking</span>
              {isRequestClosed ? (
                <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-gray-100 text-gray-600">
                  Closed
                </span>
              ) : hasExpired ? (
                <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-rose-100 text-rose-800 border border-rose-200">
                  Expired (24h Limit)
                </span>
              ) : (
                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 animate-pulse">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 mr-1.5"></span>
                  Live Session
                </span>
              )}
            </h4>
            <p className="text-xs text-gray-500 mt-0.5">
              Strictly restricted to authorized request participants
            </p>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center space-x-2">
          {(() => {
            const hospPt = points.find(p => p.type === 'hospital');
            const targetUrl = hospPt?.directionsUrl || buildDirectionsUrl(hospitalInfo?.lat, hospitalInfo?.lng, hospitalInfo?.address) || hospitalInfo?.directionsUrl;
            if (!targetUrl) return null;
            return (
              <a
                href={targetUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-blue-600 text-white hover:bg-blue-700 shadow-sm transition-colors"
              >
                <ArrowTopRightOnSquareIcon className="w-3.5 h-3.5" />
                <span>Hospital Directions</span>
              </a>
            );
          })()}
        </div>
      </div>

      {/* Quick Location Cards on top */}
      <div className="p-3 bg-gray-50/80 border-b border-gray-200 flex flex-col sm:flex-row flex-wrap gap-2 text-xs">
        {hasExpired ? (
          <div className="flex items-center space-x-2 text-rose-700 font-semibold px-2 py-1">
            <LockClosedIcon className="w-4 h-4" />
            <span>24-hour location sharing timer elapsed. Live coordinates are locked.</span>
          </div>
        ) : points.length > 0 ? (
          points.map((pt) => (
            <div
              key={pt.type}
              className="flex items-center justify-between gap-3 bg-white px-3.5 py-2.5 rounded-xl border border-gray-200 shadow-2xs flex-1 min-w-[280px]"
            >
              <div className="flex items-center space-x-2.5 min-w-0 flex-1">
                <span
                  className="w-3 h-3 rounded-full shrink-0"
                  style={{ backgroundColor: pt.color }}
                />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="font-bold text-gray-900">{pt.title}:</span>
                    {pt.verified && (
                      <span className="inline-flex items-center px-1.5 py-0.2 rounded text-[10px] font-semibold bg-blue-50 text-blue-700 border border-blue-100">
                        Verified
                      </span>
                    )}
                  </div>
                  <p className="text-gray-700 text-xs mt-0.5 break-words font-medium line-clamp-2" title={pt.address}>
                    📍 {pt.address || (pt.lat ? `Near (${pt.lat?.toFixed(4)}, ${pt.lng?.toFixed(4)})` : 'Address pending')}
                  </p>
                </div>
              </div>
              {pt.directionsUrl && (
                <a
                  href={pt.directionsUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold rounded-lg bg-blue-50 text-blue-700 hover:bg-blue-100 hover:text-blue-800 border border-blue-200/80 transition-colors shrink-0 shadow-2xs ml-auto"
                  title={`Open Google Maps directions to ${pt.title}`}
                >
                  <span>Get Directions</span>
                  <ArrowTopRightOnSquareIcon className="w-3.5 h-3.5 text-blue-600" />
                </a>
              )}
            </div>
          ))
        ) : (
          <div className="text-xs text-gray-500 py-1">
            📍 Address or coordinates pending participant confirmation.
          </div>
        )}
      </div>

      {/* Map Container View */}
      <div className="relative w-full bg-gray-100 overflow-hidden" style={{ height }}>
        {/* Google Map element */}
        <div
          ref={mapContainerRef}
          className="w-full h-full"
          style={{ display: (googleMapsReady && !googleMapsError) ? 'block' : 'none' }}
        />

        {/* Reliable Live OpenStreetMap view if Google Maps is offline or lacks credentials */}
        {(!googleMapsReady || googleMapsError) && (() => {
          const validPt = points.find(p => p.lat && p.lng && (p.lat !== 0 || p.lng !== 0));
          if (!validPt) {
            return (
              <div className="w-full h-full flex flex-col items-center justify-center p-6 text-center text-gray-500 bg-gray-50">
                <MapPinIcon className="w-10 h-10 text-gray-400 mb-2 animate-bounce" />
                <p className="text-sm font-semibold text-gray-700">
                  {hasExpired ? 'Location Sharing Concluded' : 'Resolving Location Map View...'}
                </p>
                <p className="text-xs text-gray-500 mt-1 max-w-sm">
                  {hasExpired
                    ? '24-hour location sharing timer ended. Live map coordinates have been removed.'
                    : (points[0]?.address ? `Locating "${points[0].address}"...` : 'Waiting for verified address or GPS coordinates.')}
                </p>
              </div>
            );
          }
          return (
            <iframe
              title="Interactive Live Map"
              width="100%"
              height="100%"
              frameBorder="0"
              scrolling="no"
              src={`https://www.openstreetmap.org/export/embed.html?bbox=${validPt.lng - 0.04}%2C${validPt.lat - 0.04}%2C${validPt.lng + 0.04}%2C${validPt.lat + 0.04}&layer=mapnik&marker=${validPt.lat}%2C${validPt.lng}`}
              style={{ border: 0 }}
            />
          );
        })()}

        {/* Floating Real-Time Status Pill on top of map */}
        <div className="absolute top-3 left-3 z-10 bg-white/95 backdrop-blur-md rounded-xl shadow-md border border-gray-200/80 px-3.5 py-2 text-xs flex items-center space-x-3">
          {donorInfo && (
            <div className="flex items-center space-x-1.5">
              <span className={`w-2 h-2 rounded-full ${
                hasExpired ? 'bg-rose-500' : (donorLocationSharingActive ? (donorStale ? 'bg-amber-500' : 'bg-emerald-500 animate-pulse') : 'bg-gray-400')
              }`} />
              <span className="font-semibold text-gray-800">Donor:</span>
              <span className={hasExpired ? 'text-rose-700 font-bold' : (donorLocationSharingActive ? 'text-emerald-700 font-medium' : 'text-gray-500')}>
                {hasExpired
                  ? 'Expired (24h stop)'
                  : (donorLocationSharingActive ? (donorStale ? 'Location stale (>5m)' : 'En route (sharing active)') : 'Location paused/private')}
              </span>
            </div>
          )}

          {hospitalInfo && (
            <div className="flex items-center space-x-1.5 pl-3 border-l border-gray-200">
              <ShieldCheckIcon className="w-4 h-4 text-blue-600" />
              <span className="font-semibold text-gray-800">Hospital:</span>
              <span className="text-blue-700 font-medium">
                {hasExpired ? 'Verified facility (sharing window ended)' : 'Verified facility address'}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Accessible Detail Cards & Text Alternatives */}
      <div className="p-4 bg-gray-50/70 border-t border-gray-100 grid grid-cols-1 md:grid-cols-3 gap-3">
        {/* 1. Recipient Location Card */}
        <div className="p-3 bg-white rounded-xl border border-gray-200 shadow-2xs space-y-1">
          <div className="flex items-center justify-between text-xs font-bold text-gray-900">
            <span className="flex items-center text-red-600">
              <span className="w-2 h-2 rounded-full bg-red-500 mr-1.5"></span>
              Recipient Location
            </span>
            <span className="text-[11px] text-gray-400">
              {formatTimeAgo(requesterLocation?.lastUpdated)}
            </span>
          </div>
          <p className="text-xs text-gray-700 font-medium truncate">
            {hasExpired && myRole !== 'recipient'
              ? 'Access revoked (24h window elapsed)'
              : (requesterLocation?.address || 'Provided to authorized responders')}
          </p>
          <div className="text-[11px] text-gray-500 flex items-center justify-between pt-1 border-t border-gray-100">
            <span>Accuracy: {requesterLocation?.accuracy ? `±${Math.round(requesterLocation.accuracy)}m` : 'Standard'}</span>
            <span className={`font-semibold ${hasExpired ? 'text-rose-600' : (recipientStale ? 'text-amber-600' : 'text-emerald-600')}`}>
              {hasExpired ? 'Expired' : (recipientStale ? 'Stale' : 'Active')}
            </span>
          </div>
        </div>

        {/* 2. Hospital Details Card */}
        <div className="p-3 bg-white rounded-xl border border-gray-200 shadow-2xs space-y-1">
          <div className="flex items-center justify-between text-xs font-bold text-gray-900">
            <span className="flex items-center text-blue-600">
              <span className="w-2 h-2 rounded-full bg-blue-600 mr-1.5"></span>
              Accepted Hospital
            </span>
            <span className="text-[11px] text-blue-600 font-semibold">Verified Facility</span>
          </div>
          <p className="text-xs text-gray-800 font-medium truncate">
            {hospitalInfo?.hospitalName || 'Awaiting hospital assignment'}
          </p>
          <p className="text-[11px] text-gray-500 truncate">
            {hospitalInfo?.address || 'Address provided upon acceptance'}
          </p>
          <div className="text-[11px] text-gray-500 flex items-center justify-between pt-1 border-t border-gray-100">
            <span>24h Timer:</span>
            <span className={`font-semibold ${hospitalInfo?.isExpired || hasExpired ? 'text-rose-600' : 'text-emerald-600'}`}>
              {hospitalInfo?.isExpired || hasExpired ? 'Expired' : 'Active'}
            </span>
          </div>
        </div>

        {/* 3. Donor Coordination Card */}
        <div className="p-3 bg-white rounded-xl border border-gray-200 shadow-2xs space-y-1">
          <div className="flex items-center justify-between text-xs font-bold text-gray-900">
            <span className="flex items-center text-emerald-600">
              <span className="w-2 h-2 rounded-full bg-emerald-500 mr-1.5"></span>
              Donor Coordination
            </span>
            <span className="text-[11px] text-gray-400">
              {donorInfo?.currentLocation?.lastUpdated ? formatTimeAgo(donorInfo.currentLocation.lastUpdated) : 'Standby'}
            </span>
          </div>
          <p className="text-xs text-gray-800 font-bold truncate">
            {donorInfo?.name || 'Awaiting donor response'}
          </p>
          <p className="text-[11px] text-gray-600 truncate font-medium" title={donorInfo?.currentLocation?.address || donorInfo?.address}>
            📍 {donorInfo?.currentLocation?.address || donorInfo?.address || 'Address provided upon acceptance'}
          </p>
          <div className="text-[11px] flex items-center justify-between pt-1 border-t border-gray-100">
            <span className="text-gray-500">
              {donorLocationSharingActive ? 'Address-tracked session' : 'Standby'}
            </span>
            <span className={`font-semibold ${hasExpired || donorInfo?.isExpired ? 'text-rose-600' : (donorLocationSharingActive ? (donorStale ? 'text-amber-600' : 'text-emerald-600') : 'text-gray-400')}`}>
              {hasExpired || donorInfo?.isExpired ? 'Expired (24h)' : (donorLocationSharingActive ? (donorStale ? 'Stale' : 'Live Sharing') : 'Off')}
            </span>
          </div>
        </div>
      </div>

      {/* Security, Expiration & Privacy Notice Footer */}
      <div className="px-5 py-2.5 bg-gray-50 border-t border-gray-100 text-[11px] text-gray-500 flex flex-wrap items-center justify-between gap-2">
        <span>
          🔒 <strong>24-Hour Strict Lifecycle Notice:</strong> Location sharing automatically halts 24 hours after response acceptance. Does not extend on refresh or new pings. Renewals require fresh recipient authorization.
        </span>
        <span className="text-gray-400 font-medium">Mutual Security Protocol</span>
      </div>
    </div>
  );
};

export default LiveTrackingMap;
