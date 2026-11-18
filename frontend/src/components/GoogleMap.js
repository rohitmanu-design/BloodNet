import React, { useEffect, useRef, useState } from 'react';
import { MapPinIcon } from '@heroicons/react/24/outline';
import StaticMap from './StaticMap';

const GoogleMap = ({ requests, donors, hospitals, center, height = '400px' }) => {
  const mapRef = useRef(null);
  const [mapLoaded, setMapLoaded] = useState(false);
  const [error, setError] = useState(null);
  const [useStaticMap, setUseStaticMap] = useState(false);

  // Mock data for demonstration
  const mockRequests = [
    {
      recipientName: "John Doe",
      bloodGroup: "A+",
      urgency: "critical",
      location: { lat: 40.7128, lng: -74.0060 }
    },
    {
      recipientName: "Jane Smith", 
      bloodGroup: "O-",
      urgency: "urgent",
      location: { lat: 40.7580, lng: -73.9855 }
    },
    {
      recipientName: "Mike Johnson",
      bloodGroup: "B+",
      urgency: "normal",
      location: { lat: 40.7489, lng: -73.9680 }
    }
  ];

  const mockDonors = [
    {
      name: "Available Donor 1",
      location: { lat: 40.7282, lng: -73.9942 }
    },
    {
      name: "Available Donor 2",
      location: { lat: 40.7350, lng: -73.9900 }
    }
  ];

  const mockHospitals = [
    {
      name: "City Hospital",
      location: { lat: 40.7128, lng: -74.0060 }
    },
    {
      name: "Medical Center",
      location: { lat: 40.7580, lng: -73.9855 }
    }
  ];

  // Use provided data or mock data
  const requestsData = requests && requests.length > 0 ? requests : mockRequests;
  const donorsData = donors && donors.length > 0 ? donors : mockDonors;
  const hospitalsData = hospitals && hospitals.length > 0 ? hospitals : mockHospitals;

  useEffect(() => {
    const apiKey = process.env.REACT_APP_GOOGLE_MAPS_API_KEY;
    if (!apiKey) {
      setUseStaticMap(true);
      return;
    }

    // Set a timeout to fall back to static map if Google Maps takes too long
    const timeoutId = setTimeout(() => {
      if (!mapLoaded && !error) {
        setError('Google Maps loading timeout. Using static map instead.');
        setUseStaticMap(true);
      }
    }, 5000);

    // Check if Google Maps API is loaded
    const checkGoogleMaps = () => {
      if (window.google && window.google.maps) {
        clearTimeout(timeoutId);
        setMapLoaded(true);
        initializeMap();
      } else {
        loadGoogleMaps();
      }
    };

    const loadGoogleMaps = () => {
      const script = document.createElement('script');
      script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places&callback=initMap`;
      script.async = true;
      script.defer = true;
      
      // Set up callback for when Google Maps loads
      window.initMap = () => {
        setMapLoaded(true);
        initializeMap();
      };
      
      script.onerror = () => {
        setError('Failed to load Google Maps. Please check your internet connection.');
        setUseStaticMap(true);
      };
      
      document.head.appendChild(script);
    };

    const initializeMap = () => {
      if (!mapRef.current || !window.google) return;

      // Default center (can be updated based on hospital location)
      const defaultCenter = center || { lat: 40.7128, lng: -74.0060 }; // New York
      
      const map = new window.google.maps.Map(mapRef.current, {
        center: defaultCenter,
        zoom: 12,
        styles: [
          {
            featureType: "poi",
            elementType: "labels",
            stylers: [{ visibility: "off" }]
          }
        ],
        mapTypeControl: false,
        streetViewControl: false,
        fullscreenControl: false
      });

      // Add markers for requests
      requestsData?.forEach((request, index) => {
        if (request.location?.lat && request.location?.lng) {
          new window.google.maps.Marker({
            position: { lat: request.location.lat, lng: request.location.lng },
            map,
            title: `Blood Request: ${request.recipientName}`,
            icon: {
              url: 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(`
                <svg width="32" height="32" viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg">
                  <circle cx="16" cy="16" r="14" fill="#EF4444" stroke="#FFFFFF" stroke-width="2"/>
                  <text x="16" y="20" text-anchor="middle" fill="white" font-size="12" font-weight="bold">${request.bloodGroup}</text>
                </svg>
              `),
              scaledSize: new window.google.maps.Size(32, 32)
            },
            label: {
              text: request.urgency === 'critical' ? '!' : '',
              color: 'white',
              fontWeight: 'bold'
            }
          });
        }
      });

      // Add markers for donors
      donorsData?.forEach((donor) => {
        if (donor.location?.lat && donor.location?.lng) {
          new window.google.maps.Marker({
            position: { lat: donor.location.lat, lng: donor.location.lng },
            map,
            title: `Donor: ${donor.name}`,
            icon: {
              url: 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(`
                <svg width="32" height="32" viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg">
                  <circle cx="16" cy="16" r="14" fill="#10B981" stroke="#FFFFFF" stroke-width="2"/>
                  <text x="16" y="20" text-anchor="middle" fill="white" font-size="16">♥</text>
                </svg>
              `),
              scaledSize: new window.google.maps.Size(32, 32)
            }
          });
        }
      });

      // Add markers for hospitals
      hospitalsData?.forEach((hospital) => {
        if (hospital.location?.lat && hospital.location?.lng) {
          new window.google.maps.Marker({
            position: { lat: hospital.location.lat, lng: hospital.location.lng },
            map,
            title: `Hospital: ${hospital.name}`,
            icon: {
              url: 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(`
                <svg width="32" height="32" viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg">
                  <circle cx="16" cy="16" r="14" fill="#3B82F6" stroke="#FFFFFF" stroke-width="2"/>
                  <text x="16" y="20" text-anchor="middle" fill="white" font-size="16">H</text>
                </svg>
              `),
              scaledSize: new window.google.maps.Size(32, 32)
            }
          });
        }
      });

      // Add current location marker
      if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
          (position) => {
            const currentPos = {
              lat: position.coords.latitude,
              lng: position.coords.longitude
            };
            
            new window.google.maps.Marker({
              position: currentPos,
              map,
              title: 'Your Location',
              icon: {
                url: 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(`
                  <svg width="40" height="40" viewBox="0 0 40 40" xmlns="http://www.w3.org/2000/svg">
                    <circle cx="20" cy="20" r="18" fill="#8B5CF6" stroke="#FFFFFF" stroke-width="2"/>
                    <circle cx="20" cy="20" r="6" fill="#FFFFFF"/>
                  </svg>
                `),
                scaledSize: new window.google.maps.Size(40, 40)
              },
              zIndex: 1000
            });

            // Center map on current location
            map.setCenter(currentPos);
          },
          (error) => {
            console.log('Could not get current location:', error);
          }
        );
      }
    };

    checkGoogleMaps();

    return () => {
      // Clean up
      clearTimeout(timeoutId);
      if (window.initMap) {
        delete window.initMap;
      }
    };
  }, [requestsData, donorsData, hospitalsData, center]);

  // If there's an error or timeout, show static map
  if (error || useStaticMap) {
    return (
      <div>
        <StaticMap height={height} />
        {error && (
          <div className="mt-4 bg-yellow-50 border border-yellow-200 rounded-lg p-3">
            <p className="text-sm text-yellow-800">
              <strong>Note:</strong> Using static map view. Google Maps couldn't load: {error}
            </p>
          </div>
        )}
        <div className="mt-4 grid grid-cols-3 gap-4 text-sm">
          <div className="flex items-center space-x-2">
            <div className="w-3 h-3 bg-red-500 rounded-full"></div>
            <span className="text-gray-600">Requests</span>
          </div>
          <div className="flex items-center space-x-2">
            <div className="w-3 h-3 bg-green-500 rounded-full"></div>
            <span className="text-gray-600">Donors</span>
          </div>
          <div className="flex items-center space-x-2">
            <div className="w-3 h-3 bg-blue-500 rounded-full"></div>
            <span className="text-gray-600">Hospitals</span>
          </div>
        </div>
      </div>
    );
  }

  if (!mapLoaded) {
    return (
      <div className="bg-gray-100 rounded-lg flex items-center justify-center" style={{ height }}>
        <div className="text-center p-6">
          <div className="animate-spin rounded-full h-8 w-8 border-4 border-red-500 border-t-transparent mx-auto mb-4"></div>
          <p className="text-gray-600">Loading map...</p>
          <p className="text-sm text-gray-500 mt-2">This may take a few seconds</p>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div 
        ref={mapRef} 
        className="rounded-lg"
        style={{ width: '100%', height }}
      />
      <div className="mt-4 grid grid-cols-3 gap-4 text-sm">
        <div className="flex items-center space-x-2">
          <div className="w-3 h-3 bg-red-500 rounded-full"></div>
          <span className="text-gray-600">Requests</span>
        </div>
        <div className="flex items-center space-x-2">
          <div className="w-3 h-3 bg-green-500 rounded-full"></div>
          <span className="text-gray-600">Donors</span>
        </div>
        <div className="flex items-center space-x-2">
          <div className="w-3 h-3 bg-blue-500 rounded-full"></div>
          <span className="text-gray-600">Hospitals</span>
        </div>
      </div>
    </div>
  );
};

export default GoogleMap;
