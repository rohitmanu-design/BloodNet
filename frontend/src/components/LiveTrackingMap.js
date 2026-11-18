import React, { useEffect, useRef, useState, useMemo } from 'react';
import { locationAPI } from '../services/api';
import {
  MapPinIcon,
  ShieldCheckIcon,
  ClockIcon,
  ArrowTopRightOnSquareIcon,
  SignalIcon,
  ExclamationTriangleIcon,
  PauseIcon,
  PlayIcon,
  NoSymbolIcon
} from '@heroicons/react/24/solid';

/**
 * LiveTrackingMap
 * Production-ready real-time map displaying:
 * - Recipient location (if consented)
 * - Accepted hospital's verified address (static, not live-moving)
 * - Accepted donor's live location (if donor enabled sharing)
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
  height = '420px'
}) => {
  const mapContainerRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const markersRef = useRef({});
  const [googleMapsReady, setGoogleMapsReady] = useState(false);
  const [googleMapsError, setGoogleMapsError] = useState(false);
  const [now, setNow] = useState(Date.now());
  const [resolvedCoords, setResolvedCoords] = useState({});

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

  // Format relative timestamp
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

  // Determine if location timestamp is stale (> 5 minutes)
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

    const existingScript = document.getElementById('google-maps-script');
    if (!existingScript) {
      const script = document.createElement('script');
      script.id = 'google-maps-script';
      script.src = `https://maps.googleapis.com/maps/api/js?key=AIzaSyB41DRUbKWJHPxaFjMAwdrzWzbVKartNGg&libraries=places`;
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

  // Compute map center and active points
  const points = useMemo(() => {
    const pts = [];

    let reqLat = parseFloat(requesterLocation?.lat);
    let reqLng = parseFloat(requesterLocation?.lng);
    const reqAddr = (requesterLocation?.address || '').trim();
    if ((isNaN(reqLat) || isNaN(reqLng) || (reqLat === 0 && reqLng === 0)) && reqAddr && resolvedCoords[reqAddr]) {
      reqLat = resolvedCoords[reqAddr].lat;
      reqLng = resolvedCoords[reqAddr].lng;
    }

    if (!isNaN(reqLat) && !isNaN(reqLng) && (reqLat !== 0 || reqLng !== 0)) {
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
        directionsUrl: `https://www.google.com/maps/dir/?api=1&destination=${reqLat},${reqLng}`
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
        directionsUrl: `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(reqAddr)}`
      });
    }

    let hospLat = parseFloat(hospitalInfo?.lat);
    let hospLng = parseFloat(hospitalInfo?.lng);
    const hospAddr = (hospitalInfo?.address || '').trim();
    if ((isNaN(hospLat) || isNaN(hospLng) || (hospLat === 0 && hospLng === 0)) && hospAddr && resolvedCoords[hospAddr]) {
      hospLat = resolvedCoords[hospAddr].lat;
      hospLng = resolvedCoords[hospAddr].lng;
    }

    if (!isNaN(hospLat) && !isNaN(hospLng) && (hospLat !== 0 || hospLng !== 0)) {
      pts.push({
        type: 'hospital',
        title: hospitalInfo?.hospitalName || 'Accepted Hospital',
        lat: hospLat,
        lng: hospLng,
        address: hospAddr || 'Medical Facility',
        verified: true,
        directionsUrl: hospitalInfo?.directionsUrl || `https://www.google.com/maps/dir/?api=1&destination=${hospLat},${hospLng}`,
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
        directionsUrl: `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(hospAddr)}`,
        color: '#2563EB',
        iconLetter: 'H'
      });
    }

    const donorLat = parseFloat(donorInfo?.currentLocation?.lat);
    const donorLng = parseFloat(donorInfo?.currentLocation?.lng);
    if (!isNaN(donorLat) && !isNaN(donorLng) && (donorLat !== 0 || donorLng !== 0)) {
      pts.push({
        type: 'donor',
        title: `Donor: ${donorInfo?.name || 'Responding Donor'}`,
        lat: donorLat,
        lng: donorLng,
        accuracy: donorInfo?.currentLocation?.accuracy,
        lastUpdated: donorInfo?.currentLocation?.lastUpdated,
        color: '#059669',
        iconLetter: 'D',
        directionsUrl: `https://www.google.com/maps/dir/?api=1&destination=${donorLat},${donorLng}`
      });
    }
    return pts;
  }, [requesterLocation, hospitalInfo, donorInfo, resolvedCoords]);

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
    const currentMarkers = markersRef.current;

    // Clear old markers not in current points
    Object.keys(currentMarkers).forEach(key => {
      if (!points.some(p => p.type === key)) {
        currentMarkers[key].setMap(null);
        delete currentMarkers[key];
      }
    });

    const bounds = new window.google.maps.LatLngBounds();

    points.forEach(point => {
      const pos = { lat: point.lat, lng: point.lng };
      bounds.extend(pos);

      const svgIcon = `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(`
        <svg width="36" height="36" viewBox="0 0 36 36" xmlns="http://www.w3.org/2000/svg">
          <circle cx="18" cy="18" r="16" fill="${point.color}" stroke="#FFFFFF" stroke-width="2.5" shadow="drop-shadow(0 2px 4px rgba(0,0,0,0.3))"/>
          <text x="18" y="23" text-anchor="middle" fill="#FFFFFF" font-size="14" font-weight="bold" font-family="sans-serif">${point.iconLetter}</text>
        </svg>
      `)}`;

      if (currentMarkers[point.type]) {
        currentMarkers[point.type].setPosition(pos);
      } else {
        const marker = new window.google.maps.Marker({
          position: pos,
          map,
          title: point.title,
          icon: {
            url: svgIcon,
            scaledSize: new window.google.maps.Size(36, 36)
          }
        });

        const infoWindow = new window.google.maps.InfoWindow({
          content: `
            <div style="font-family: sans-serif; padding: 6px 10px; max-width: 240px;">
              <h4 style="margin: 0 0 4px; font-size: 13px; font-weight: 700; color: #111;">${point.title}</h4>
              <p style="margin: 0; font-size: 11px; color: #555;">${point.address || 'Location coordinates active'}</p>
              ${point.directionsUrl ? `<a href="${point.directionsUrl}" target="_blank" rel="noopener noreferrer" style="display:inline-block; margin-top:6px; font-size:11px; color:#2563EB; font-weight:600;">Get Directions &rarr;</a>` : ''}
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
    } else if (points.length === 1) {
      map.setCenter({ lat: points[0].lat, lng: points[0].lng });
    }
  }, [googleMapsReady, points]);

  // Tracking status indicators
  const donorLocationSharingActive = donorInfo?.donorShareLocation && donorInfo?.currentLocation?.lat && !isRequestClosed;
  const donorStale = donorInfo?.currentLocation?.lastUpdated && isStale(donorInfo.currentLocation.lastUpdated);

  const recipientSharingActive = requesterLocation?.lat && !isRequestClosed;
  const recipientStale = requesterLocation?.lastUpdated && isStale(requesterLocation.lastUpdated);

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
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
          {hospitalInfo?.directionsUrl && (
            <a
              href={hospitalInfo.directionsUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center px-3 py-1.5 rounded-lg text-xs font-semibold bg-blue-50 text-blue-700 hover:bg-blue-100 transition-colors"
            >
              <ArrowTopRightOnSquareIcon className="w-3.5 h-3.5 mr-1" />
              Hospital Directions
            </a>
          )}
        </div>
      </div>

      {/* Quick Location Cards - ALWAYS Visible on top */}
      <div className="p-3 bg-gray-50 border-b border-gray-200 flex flex-wrap gap-2 text-xs">
        {points.length > 0 ? (
          points.map((pt) => (
            <div
              key={pt.type}
              className="flex items-center space-x-2 bg-white px-3 py-2 rounded-xl border border-gray-200 shadow-2xs"
            >
              <span
                className="w-3 h-3 rounded-full flex-shrink-0"
                style={{ backgroundColor: pt.color }}
              />
              <div>
                <span className="font-bold text-gray-900 mr-1">{pt.title}:</span>
                <span className="text-gray-700">{pt.address || `${pt.lat?.toFixed(4)}, ${pt.lng?.toFixed(4)}`}</span>
              </div>
              {pt.directionsUrl && (
                <a
                  href={pt.directionsUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-600 hover:text-blue-800 font-bold flex items-center gap-0.5 ml-2 bg-blue-50 hover:bg-blue-100 px-2 py-1 rounded-md transition-colors"
                >
                  <span>Directions</span>
                  <ArrowTopRightOnSquareIcon className="w-3 h-3" />
                </a>
              )}
            </div>
          ))
        ) : (
          <div className="text-xs text-gray-500 py-1">
            📍 Coordinates pending GPS connection or participant confirmation.
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
                <p className="text-sm font-semibold text-gray-700">Resolving Location Map View...</p>
                <p className="text-xs text-gray-500 mt-1 max-w-sm">
                  {points[0]?.address ? `Locating "${points[0].address}"...` : 'Waiting for verified address or GPS coordinates.'}
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
                donorLocationSharingActive ? (donorStale ? 'bg-amber-500' : 'bg-emerald-500 animate-pulse') : 'bg-gray-400'
              }`} />
              <span className="font-semibold text-gray-800">Donor:</span>
              <span className={donorLocationSharingActive ? 'text-emerald-700 font-medium' : 'text-gray-500'}>
                {donorLocationSharingActive ? (donorStale ? 'Location stale (>5m)' : 'En route (sharing active)') : 'Location paused/private'}
              </span>
            </div>
          )}

          {hospitalInfo && (
            <div className="flex items-center space-x-1.5 pl-3 border-l border-gray-200">
              <ShieldCheckIcon className="w-4 h-4 text-blue-600" />
              <span className="font-semibold text-gray-800">Hospital:</span>
              <span className="text-blue-700 font-medium">Verified facility address</span>
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
            {requesterLocation?.address || 'Provided to authorized responders'}
          </p>
          <div className="text-[11px] text-gray-500 flex items-center justify-between pt-1 border-t border-gray-100">
            <span>Accuracy: {requesterLocation?.accuracy ? `±${Math.round(requesterLocation.accuracy)}m` : 'Standard'}</span>
            <span className={`font-semibold ${recipientStale ? 'text-amber-600' : 'text-emerald-600'}`}>
              {recipientStale ? 'Stale' : 'Active'}
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
          <p className="text-xs text-gray-800 font-medium truncate">
            {donorInfo?.name || 'Awaiting donor response'}
          </p>
          <div className="text-[11px] flex items-center justify-between pt-1 border-t border-gray-100">
            <span className="text-gray-500">
              {donorLocationSharingActive ? `Accuracy: ±${Math.round(donorInfo.currentLocation?.accuracy || 15)}m` : 'Location private'}
            </span>
            <span className={`font-semibold ${donorLocationSharingActive ? (donorStale ? 'text-amber-600' : 'text-emerald-600') : 'text-gray-400'}`}>
              {donorLocationSharingActive ? (donorStale ? 'Stale' : 'Live Sharing') : 'Off'}
            </span>
          </div>
        </div>
      </div>

      {/* Mobile & Privacy Notice Footer */}
      <div className="px-5 py-2.5 bg-gray-50 border-t border-gray-100 text-[11px] text-gray-500 flex flex-wrap items-center justify-between gap-2">
        <span>
          🔒 <strong>Privacy & Device Notice:</strong> Location updates are securely transmitted only while the BloodNet+ tab is open. Tracking ceases immediately when this request is marked completed.
        </span>
        <span className="text-gray-400">End-to-end authorized participants only</span>
      </div>
    </div>
  );
};

export default LiveTrackingMap;
