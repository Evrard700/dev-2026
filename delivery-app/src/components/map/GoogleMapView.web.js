import React, { useEffect, useRef, forwardRef, useImperativeHandle } from 'react';

// Clé API Google Maps publique (requise côté client pour charger Maps JS API)
const GOOGLE_MAPS_API_KEY = 'AIzaSyCa3sQ8kgVb7pYw4GNlbdT3K6P-wDr4IAw';

const GoogleMapView = forwardRef((props, ref) => {
  const {
    center = [-3.9962, 5.3484], // Abidjan par défaut [lng, lat]
    zoom = 13,
    markers = [],
    routeGeoJSON = null,
    userLocation = null,
    onLongPress,
    onMarkerPress,
    onBearingChange,
    onPitchChange,
    onZoomChange,
    style = {},
  } = props;

  const mapContainerRef = useRef(null);
  const mapRef = useRef(null);
  const markersRef = useRef([]);
  const userMarkerRef = useRef(null);
  const routePolylineRef = useRef(null);

  // Expose methods via ref
  useImperativeHandle(ref, () => ({
    easeTo: (coords, zoom, bearing, pitch, duration = 1000) => {
      if (!mapRef.current) return;
      mapRef.current.panTo({ lat: coords[1], lng: coords[0] });
      if (zoom) mapRef.current.setZoom(zoom);
      if (bearing !== undefined) mapRef.current.setHeading(bearing);
      if (pitch !== undefined) mapRef.current.setTilt(pitch);
    },
    setCamera: ({ centerCoordinate, zoomLevel, pitch, bearing, animationDuration }) => {
      if (!mapRef.current) return;
      if (centerCoordinate) {
        mapRef.current.panTo({ lat: centerCoordinate[1], lng: centerCoordinate[0] });
      }
      if (zoomLevel !== undefined) mapRef.current.setZoom(zoomLevel);
      if (bearing !== undefined) mapRef.current.setHeading(bearing);
      if (pitch !== undefined) mapRef.current.setTilt(pitch);
    },
    zoomIn: (duration) => {
      if (!mapRef.current) return;
      mapRef.current.setZoom(mapRef.current.getZoom() + 1);
    },
    zoomOut: (duration) => {
      if (!mapRef.current) return;
      mapRef.current.setZoom(mapRef.current.getZoom() - 1);
    },
    resetNorth: (duration) => {
      if (!mapRef.current) return;
      mapRef.current.setHeading(0);
    },
    toggle3D: (enable, duration) => {
      if (!mapRef.current) return;
      mapRef.current.setTilt(enable ? 45 : 0);
    },
  }));

  // Load Google Maps script
  useEffect(() => {
    if (window.google && window.google.maps) {
      initMap();
      return;
    }

    const script = document.createElement('script');
    script.src = `https://maps.googleapis.com/maps/api/js?key=${GOOGLE_MAPS_API_KEY}&libraries=geometry`;
    script.async = true;
    script.defer = true;
    script.onload = initMap;
    document.head.appendChild(script);

    return () => {
      // Cleanup if needed
    };
  }, []);

  const initMap = () => {
    if (!mapContainerRef.current || !window.google) return;

    const map = new window.google.maps.Map(mapContainerRef.current, {
      center: { lat: center[1], lng: center[0] },
      zoom: zoom,
      disableDefaultUI: false,
      zoomControl: false,
      mapTypeControl: false,
      streetViewControl: false,
      fullscreenControl: false,
      gestureHandling: 'greedy',
      mapTypeId: 'roadmap',
    });

    mapRef.current = map;

    // Long press handler
    if (onLongPress) {
      let pressTimer;
      map.addListener('mousedown', (e) => {
        pressTimer = setTimeout(() => {
          onLongPress({
            geometry: {
              coordinates: [e.latLng.lng(), e.latLng.lat()],
            },
          });
        }, 500);
      });
      map.addListener('mouseup', () => clearTimeout(pressTimer));
      map.addListener('mousemove', () => clearTimeout(pressTimer));
    }

    // Zoom change handler
    if (onZoomChange) {
      map.addListener('zoom_changed', () => {
        onZoomChange(map.getZoom());
      });
    }

    // Heading/bearing change handler
    if (onBearingChange) {
      map.addListener('heading_changed', () => {
        const heading = map.getHeading() || 0;
        onBearingChange(heading);
      });
    }

    // Tilt/pitch change handler
    if (onPitchChange) {
      map.addListener('tilt_changed', () => {
        const tilt = map.getTilt() || 0;
        onPitchChange(tilt);
      });
    }
  };

  // Update markers
  useEffect(() => {
    if (!mapRef.current || !window.google) return;

    // Clear old markers
    markersRef.current.forEach(m => m.setMap(null));
    markersRef.current = [];

    // Add new markers
    markers.forEach(markerData => {
      const marker = new window.google.maps.Marker({
        position: { lat: markerData.latitude, lng: markerData.longitude },
        map: mapRef.current,
        title: markerData.label,
        icon: {
          path: window.google.maps.SymbolPath.CIRCLE,
          fillColor: markerData.color,
          fillOpacity: 1,
          strokeColor: '#fff',
          strokeWeight: 2,
          scale: 12,
        },
        label: {
          text: markerData.label,
          color: '#fff',
          fontSize: '10px',
          fontWeight: 'bold',
        },
      });

      marker.addListener('click', () => {
        if (onMarkerPress) onMarkerPress(markerData.id);
      });

      markersRef.current.push(marker);
    });
  }, [markers, onMarkerPress]);

  // Update user location
  useEffect(() => {
    if (!mapRef.current || !window.google || !userLocation) return;

    if (userMarkerRef.current) {
      userMarkerRef.current.setPosition({ lat: userLocation[1], lng: userLocation[0] });
    } else {
      userMarkerRef.current = new window.google.maps.Marker({
        position: { lat: userLocation[1], lng: userLocation[0] },
        map: mapRef.current,
        icon: {
          path: window.google.maps.SymbolPath.CIRCLE,
          fillColor: '#4285F4',
          fillOpacity: 1,
          strokeColor: '#fff',
          strokeWeight: 3,
          scale: 8,
        },
        zIndex: 1000,
      });

      // Add pulsing circle
      new window.google.maps.Circle({
        strokeColor: '#4285F4',
        strokeOpacity: 0.3,
        strokeWeight: 2,
        fillColor: '#4285F4',
        fillOpacity: 0.1,
        map: mapRef.current,
        center: { lat: userLocation[1], lng: userLocation[0] },
        radius: 50,
      });
    }
  }, [userLocation]);

  // Update route
  useEffect(() => {
    if (!mapRef.current || !window.google) return;

    // Clear old route
    if (routePolylineRef.current) {
      routePolylineRef.current.setMap(null);
      routePolylineRef.current = null;
    }

    if (!routeGeoJSON) return;

    // Extract coordinates from GeoJSON
    const coordinates = routeGeoJSON.geometry.coordinates.map(coord => ({
      lat: coord[1],
      lng: coord[0],
    }));

    // Draw polyline
    routePolylineRef.current = new window.google.maps.Polyline({
      path: coordinates,
      geodesic: true,
      strokeColor: '#4285F4',
      strokeOpacity: 1.0,
      strokeWeight: 6,
      map: mapRef.current,
    });
  }, [routeGeoJSON]);

  return (
    <div
      ref={mapContainerRef}
      style={{
        width: '100%',
        height: '100%',
        ...style,
      }}
    />
  );
});

GoogleMapView.displayName = 'GoogleMapView';

export default GoogleMapView;
