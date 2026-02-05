import React, { useEffect, useRef, useImperativeHandle, forwardRef, useState } from 'react';
import { View, StyleSheet } from 'react-native';

const MAPBOX_TOKEN = 'pk.eyJ1IjoiZXZyYXJkNzAwIiwiYSI6ImNtZHFsbnk1NDA3NnUya3Nhc2ZzMXhtNm8ifQ.38Ot2vrfENkyvJ7mi7AsVw';

// Inject mapbox-gl CSS
if (typeof document !== 'undefined') {
  const existingLink = document.getElementById('mapbox-gl-css');
  if (!existingLink) {
    const link = document.createElement('link');
    link.id = 'mapbox-gl-css';
    link.rel = 'stylesheet';
    link.href = 'https://api.mapbox.com/mapbox-gl-js/v3.3.0/mapbox-gl.css';
    document.head.appendChild(link);
  }
}

let mapboxgl = null;
if (typeof window !== 'undefined') {
  mapboxgl = require('mapbox-gl');
  mapboxgl.accessToken = MAPBOX_TOKEN;
}

const WebMapView = forwardRef(({
  center,
  zoom = 14,
  pitch = 0,
  bearing = 0,
  style,
  markers = [],
  routeGeoJSON = null,
  userLocation = null,
  onLongPress,
  onMarkerPress,
  onBearingChange,
  onPitchChange,
  onZoomChange,
  mapStyle = 'mapbox://styles/mapbox/streets-v12',
  disableGestures = false, // Nouveau: désactiver les gestes en mode navigation
}, ref) => {
  const mapContainer = useRef(null);
  const mapInstance = useRef(null);
  const markersRef = useRef([]);
  const userMarkerRef = useRef(null);
  const longPressTimer = useRef(null);
  const onLongPressRef = useRef(onLongPress);
  const onMarkerPressRef = useRef(onMarkerPress);
  const onBearingChangeRef = useRef(onBearingChange);
  const onPitchChangeRef = useRef(onPitchChange);
  const onZoomChangeRef = useRef(onZoomChange);

  useImperativeHandle(ref, () => ({
    flyTo: (coords, zoomLevel, options = {}) => {
      if (mapInstance.current) {
        mapInstance.current.flyTo({
          center: coords,
          zoom: zoomLevel || zoom,
          duration: options.duration || 1000,
          pitch: options.pitch,
          bearing: options.bearing,
          curve: 1.42,
          essential: true,
        });
      }
    },
    easeTo: (coords, zoomLevel, bearingVal, pitchVal, duration = 1000) => {
      if (mapInstance.current) {
        mapInstance.current.easeTo({
          center: coords,
          zoom: zoomLevel || zoom,
          bearing: bearingVal || 0,
          pitch: pitchVal || 0,
          duration: duration,
          easing: duration < 200 ? (t) => t : (t) => t * (2 - t), // Linéaire si rapide, ease-out sinon
        });
      }
    },
    setCamera: ({ centerCoordinate, zoomLevel, animationDuration, pitch: pitchVal, bearing: bearingVal }) => {
      if (mapInstance.current) {
        // Use easeTo for smoother transitions with explicit defaults
        mapInstance.current.easeTo({
          center: centerCoordinate,
          zoom: zoomLevel ?? mapInstance.current.getZoom(),
          pitch: pitchVal ?? 0,
          bearing: bearingVal ?? 0,
          duration: animationDuration || 1000,
          easing: (t) => t * (2 - t), // ease-out quad for smoother animation
        });
      }
    },
    getMap: () => mapInstance.current,
    // New methods for advanced controls
    zoomIn: (duration = 300) => {
      if (mapInstance.current) {
        mapInstance.current.zoomIn({ duration });
      }
    },
    zoomOut: (duration = 300) => {
      if (mapInstance.current) {
        mapInstance.current.zoomOut({ duration });
      }
    },
    rotateTo: (bearingVal, duration = 500) => {
      if (mapInstance.current) {
        mapInstance.current.rotateTo(bearingVal, { duration });
      }
    },
    resetNorth: (duration = 500) => {
      if (mapInstance.current) {
        mapInstance.current.resetNorth({ duration });
      }
    },
    setPitch: (pitchVal, duration = 500) => {
      if (mapInstance.current) {
        mapInstance.current.easeTo({ pitch: pitchVal, duration });
      }
    },
    getBearing: () => mapInstance.current?.getBearing() || 0,
    getPitch: () => mapInstance.current?.getPitch() || 0,
    getZoom: () => mapInstance.current?.getZoom() || zoom,
    // Toggle 3D view with smooth animation
    toggle3D: (enable, duration = 800) => {
      if (mapInstance.current) {
        mapInstance.current.easeTo({
          pitch: enable ? 60 : 0,
          bearing: enable ? 30 : 0,
          duration,
        });
      }
    },
  }));

  // Keep refs in sync with latest props
  useEffect(() => {
    onLongPressRef.current = onLongPress;
  }, [onLongPress]);

  // Update gesture controls dynamically when disableGestures changes
  useEffect(() => {
    const map = mapInstance.current;
    if (!map) return;

    try {
      if (disableGestures) {
        // Mode navigation: désactiver tous les gestes
        map.dragPan.disable();
        map.scrollZoom.disable();
        map.doubleClickZoom.disable();
        map.touchZoomRotate.disable();
        map.dragRotate.disable();
      } else {
        // Mode normal: réactiver les gestes
        map.dragPan.enable();
        map.scrollZoom.enable();
        map.doubleClickZoom.enable();
        map.touchZoomRotate.enable();
        map.dragRotate.enable();
      }
    } catch (e) {
      console.warn('Error toggling gestures:', e);
    }
  }, [disableGestures]);

  useEffect(() => {
    onMarkerPressRef.current = onMarkerPress;
  }, [onMarkerPress]);

  useEffect(() => {
    onBearingChangeRef.current = onBearingChange;
  }, [onBearingChange]);

  useEffect(() => {
    onPitchChangeRef.current = onPitchChange;
  }, [onPitchChange]);

  useEffect(() => {
    onZoomChangeRef.current = onZoomChange;
  }, [onZoomChange]);

  // Initialize map
  useEffect(() => {
    if (!mapContainer.current || !mapboxgl) return;

    const map = new mapboxgl.Map({
      container: mapContainer.current,
      style: mapStyle,
      center: center || [-3.9962, 5.3484],
      zoom: zoom,
      pitch: pitch,
      bearing: bearing,
      antialias: true,
      // Enhanced gesture controls - Désactivés en mode navigation
      touchZoomRotate: !disableGestures,
      touchPitch: !disableGestures,
      dragRotate: !disableGestures,
      pitchWithRotate: !disableGestures,
      dragPan: !disableGestures, // Empêche de déplacer la carte
      scrollZoom: !disableGestures, // Empêche de zoomer
      doubleClickZoom: !disableGestures, // Empêche double-clic zoom
      // Smooth animations
      fadeDuration: 300,
      // Better performance
      preserveDrawingBuffer: true,
    });

    // Hide default navigation controls since we have custom ones
    // This improves performance and avoids duplicate controls

    // Track bearing/pitch/zoom changes with throttling for better performance
    let lastBearingUpdate = 0;
    let lastPitchUpdate = 0;
    let lastZoomUpdate = 0;
    const THROTTLE_MS = 50; // Throttle to 20fps max for state updates

    map.on('rotate', () => {
      const now = Date.now();
      if (now - lastBearingUpdate > THROTTLE_MS) {
        lastBearingUpdate = now;
        if (onBearingChangeRef.current) {
          onBearingChangeRef.current(map.getBearing());
        }
      }
    });

    map.on('pitch', () => {
      const now = Date.now();
      if (now - lastPitchUpdate > THROTTLE_MS) {
        lastPitchUpdate = now;
        if (onPitchChangeRef.current) {
          onPitchChangeRef.current(map.getPitch());
        }
      }
    });

    map.on('zoom', () => {
      const now = Date.now();
      if (now - lastZoomUpdate > THROTTLE_MS) {
        lastZoomUpdate = now;
        if (onZoomChangeRef.current) {
          onZoomChangeRef.current(map.getZoom());
        }
      }
    });

    // Also update at end of gestures for final accurate values
    map.on('rotateend', () => {
      if (onBearingChangeRef.current) {
        onBearingChangeRef.current(map.getBearing());
      }
    });
    map.on('pitchend', () => {
      if (onPitchChangeRef.current) {
        onPitchChangeRef.current(map.getPitch());
      }
    });
    map.on('zoomend', () => {
      if (onZoomChangeRef.current) {
        onZoomChangeRef.current(map.getZoom());
      }
    });

    // Add 3D buildings layer when style loads
    map.on('style.load', () => {
      try {
        if (!map.getLayer('3d-buildings')) {
          const layers = map.getStyle().layers;
          let labelLayerId;
          for (let i = 0; i < layers.length; i++) {
            if (layers[i].type === 'symbol' && layers[i].layout && layers[i].layout['text-field']) {
              labelLayerId = layers[i].id;
              break;
            }
          }
          map.addLayer({
            id: '3d-buildings',
            source: 'composite',
            'source-layer': 'building',
            filter: ['==', 'extrude', 'true'],
            type: 'fill-extrusion',
            minzoom: 14,
            paint: {
              'fill-extrusion-color': '#aaa',
              'fill-extrusion-height': ['interpolate', ['linear'], ['zoom'], 14, 0, 14.05, ['get', 'height']],
              'fill-extrusion-base': ['interpolate', ['linear'], ['zoom'], 14, 0, 14.05, ['get', 'min_height']],
              'fill-extrusion-opacity': 0.6,
            },
          }, labelLayerId);
        }
      } catch (e) { /* source may not exist for some styles */ }
    });

    // Long press handler - uses ref to always get latest callback
    let pressStart = null;
    map.on('mousedown', (e) => {
      pressStart = Date.now();
      longPressTimer.current = setTimeout(() => {
        if (onLongPressRef.current) {
          onLongPressRef.current({
            geometry: {
              coordinates: [e.lngLat.lng, e.lngLat.lat],
            },
          });
        }
      }, 600);
    });

    map.on('mouseup', () => {
      if (longPressTimer.current) {
        clearTimeout(longPressTimer.current);
      }
    });

    map.on('mousemove', () => {
      if (longPressTimer.current) {
        clearTimeout(longPressTimer.current);
      }
    });

    // Touch long press for mobile browsers
    map.on('touchstart', (e) => {
      if (e.originalEvent.touches.length === 1) {
        longPressTimer.current = setTimeout(() => {
          const touch = e.lngLat;
          if (onLongPressRef.current) {
            onLongPressRef.current({
              geometry: {
                coordinates: [touch.lng, touch.lat],
              },
            });
          }
        }, 600);
      }
    });

    map.on('touchend', () => {
      if (longPressTimer.current) clearTimeout(longPressTimer.current);
    });

    map.on('touchmove', () => {
      if (longPressTimer.current) clearTimeout(longPressTimer.current);
    });

    mapInstance.current = map;

    return () => {
      map.remove();
      mapInstance.current = null;
    };
  }, []);

  // Update style - handle fog/opacity crash by wrapping in try/catch
  // and re-adding route after style loads
  const pendingRouteRef = useRef(null);

  useEffect(() => {
    const map = mapInstance.current;
    if (!map) return;

    try {
      // Save current route data before style change destroys it
      pendingRouteRef.current = routeGeoJSON;
      map.setStyle(mapStyle);
    } catch (e) {
      console.warn('Style change error (safe to ignore):', e);
    }

    const onStyleLoad = () => {
      try {
        map.setPitch(pitch);
      } catch (e) { /* ignore */ }
      // Re-add 3D buildings after style change
      try {
        if (!map.getLayer('3d-buildings')) {
          const styleObj = map.getStyle();
          if (!styleObj || !styleObj.layers) return;
          const layers = styleObj.layers;
          let labelLayerId;
          for (let i = 0; i < layers.length; i++) {
            if (layers[i].type === 'symbol' && layers[i].layout && layers[i].layout['text-field']) {
              labelLayerId = layers[i].id;
              break;
            }
          }
          map.addLayer({
            id: '3d-buildings',
            source: 'composite',
            'source-layer': 'building',
            filter: ['==', 'extrude', 'true'],
            type: 'fill-extrusion',
            minzoom: 14,
            paint: {
              'fill-extrusion-color': '#aaa',
              'fill-extrusion-height': ['interpolate', ['linear'], ['zoom'], 14, 0, 14.05, ['get', 'height']],
              'fill-extrusion-base': ['interpolate', ['linear'], ['zoom'], 14, 0, 14.05, ['get', 'min_height']],
              'fill-extrusion-opacity': 0.6,
            },
          }, labelLayerId);
        }
      } catch (e) { /* ignore */ }
      // Re-add route after style loaded
      if (pendingRouteRef.current) {
        try {
          if (map.getSource('route')) return;
          map.addSource('route', { type: 'geojson', data: pendingRouteRef.current });
          map.addLayer({
            id: 'route-line',
            type: 'line',
            source: 'route',
            paint: {
              'line-color': '#4361ee',
              'line-width': 8,
              'line-opacity': 0.85,
            },
            layout: {
              'line-cap': 'round',
              'line-join': 'round',
            },
          });
        } catch (e) { /* ignore */ }
      }
    };

    map.once('style.load', onStyleLoad);
    return () => {
      try { map.off('style.load', onStyleLoad); } catch (e) { /* ignore */ }
    };
  }, [mapStyle]);

  // Update pitch
  useEffect(() => {
    if (mapInstance.current) {
      try {
        mapInstance.current.setPitch(pitch);
      } catch (e) { /* ignore */ }
    }
  }, [pitch]);

  // Update markers - new pin style with colored border circle + arrow
  useEffect(() => {
    if (!mapInstance.current || !mapboxgl) return;

    // Remove old markers
    markersRef.current.forEach(m => m.remove());
    markersRef.current = [];

    // Add new markers with solid avatar pin style
    markers.forEach((markerData) => {
      const color = markerData.color || '#c0392b';
      const border = markerData.borderColor || '#ffffff';

      // Create pin container
      const container = document.createElement('div');
      container.style.cssText = `
        display: flex;
        flex-direction: column;
        align-items: center;
        cursor: pointer;
        filter: drop-shadow(0 3px 6px rgba(0,0,0,0.35));
      `;

      // Solid filled circle with avatar initials or photo
      const circle = document.createElement('div');
      if (markerData.photo) {
        circle.style.cssText = `
          width: 54px;
          height: 54px;
          border-radius: 50%;
          border: 3.5px solid ${border};
          background-image: url(${markerData.photo});
          background-size: cover;
          background-position: center;
          box-sizing: border-box;
        `;
      } else {
        circle.style.cssText = `
          width: 54px;
          height: 54px;
          border-radius: 50%;
          border: 3.5px solid ${border};
          background-color: ${color};
          display: flex;
          align-items: center;
          justify-content: center;
          font-weight: 800;
          font-size: 18px;
          color: #ffffff;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
        `;
        circle.textContent = markerData.label || '';
      }

      // Arrow/pin bottom
      const arrow = document.createElement('div');
      arrow.style.cssText = `
        width: 0;
        height: 0;
        border-left: 10px solid transparent;
        border-right: 10px solid transparent;
        border-top: 12px solid ${color};
        margin-top: -2px;
      `;

      container.appendChild(circle);
      container.appendChild(arrow);

      container.addEventListener('click', () => {
        if (onMarkerPressRef.current) onMarkerPressRef.current(markerData.id);
      });

      const marker = new mapboxgl.Marker({ element: container, anchor: 'bottom' })
        .setLngLat([markerData.longitude, markerData.latitude])
        .addTo(mapInstance.current);

      markersRef.current.push(marker);
    });
  }, [markers]);

  // Update user location
  useEffect(() => {
    if (!mapInstance.current || !mapboxgl || !userLocation) return;

    if (userMarkerRef.current) {
      userMarkerRef.current.setLngLat(userLocation);
    } else {
      const el = document.createElement('div');
      el.style.cssText = `
        width: 18px;
        height: 18px;
        border-radius: 50%;
        background-color: #4361ee;
        border: 3px solid white;
        box-shadow: 0 0 0 8px rgba(67,97,238,0.25), 0 2px 6px rgba(0,0,0,0.3);
      `;
      userMarkerRef.current = new mapboxgl.Marker({ element: el })
        .setLngLat(userLocation)
        .addTo(mapInstance.current);
    }
  }, [userLocation]);

  // Update route
  useEffect(() => {
    if (!mapInstance.current) return;

    const map = mapInstance.current;

    const addRoute = () => {
      try {
        const source = map.getSource('route');
        if (source) {
          if (routeGeoJSON) {
            source.setData(routeGeoJSON);
          } else {
            source.setData({ type: 'FeatureCollection', features: [] });
          }
        } else if (routeGeoJSON) {
          map.addSource('route', { type: 'geojson', data: routeGeoJSON });
          map.addLayer({
            id: 'route-line',
            type: 'line',
            source: 'route',
            paint: {
              'line-color': '#4361ee',
              'line-width': 8,
              'line-opacity': 0.85,
            },
            layout: {
              'line-cap': 'round',
              'line-join': 'round',
            },
          });
        }
      } catch (e) {
        console.warn('Route update error (safe to ignore):', e);
      }
    };

    try {
      if (map.isStyleLoaded()) {
        addRoute();
      } else {
        map.on('style.load', addRoute);
      }
    } catch (e) {
      map.once('style.load', addRoute);
    }
  }, [routeGeoJSON]);

  return (
    <View style={[styles.container, style]}>
      <div ref={mapContainer} style={{ width: '100%', height: '100%' }} />
    </View>
  );
});

const styles = StyleSheet.create({
  container: {
    flex: 1,
    overflow: 'hidden',
  },
});

export default WebMapView;
