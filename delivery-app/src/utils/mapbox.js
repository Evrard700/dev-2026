import { Platform } from 'react-native';

const MAPBOX_TOKEN = 'pk.eyJ1IjoiZXZyYXJkNzAwIiwiYSI6ImNtZHFsbnk1NDA3NnUya3Nhc2ZzMXhtNm8ifQ.38Ot2vrfENkyvJ7mi7AsVw';

let MapboxGL = null;
if (Platform.OS !== 'web') {
  MapboxGL = require('@rnmapbox/maps').default;
  MapboxGL.setAccessToken(MAPBOX_TOKEN);
}

export const MAPBOX_API_URL = 'https://api.mapbox.com';

export function getDirectionsUrl(start, end) {
  return `${MAPBOX_API_URL}/directions/v5/mapbox/driving/${start[0]},${start[1]};${end[0]},${end[1]}?geometries=geojson&overview=full&steps=true&access_token=${MAPBOX_TOKEN}`;
}

export function parseGoogleMapsUrl(url) {
  if (!url) return null;
  try {
    // Format: https://maps.google.com/?q=LAT,LNG
    let match = url.match(/[@?](-?\d+\.?\d*),(-?\d+\.?\d*)/);
    if (match) {
      return { latitude: parseFloat(match[1]), longitude: parseFloat(match[2]) };
    }
    // Format: https://goo.gl/maps/... or place coordinates
    match = url.match(/(-?\d+\.?\d*),\s*(-?\d+\.?\d*)/);
    if (match) {
      return { latitude: parseFloat(match[1]), longitude: parseFloat(match[2]) };
    }
  } catch (e) {
    console.warn('Failed to parse Google Maps URL:', e);
  }
  return null;
}

export { MAPBOX_TOKEN };
export default MapboxGL;
