// Vercel Serverless Function - Proxy pour Google Directions API
export default async function handler(req, res) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  const { originLat, originLng, destLat, destLng } = req.query;

  if (!originLat || !originLng || !destLat || !destLng) {
    return res.status(400).json({ error: 'Missing required parameters' });
  }

  const apiKey = process.env.GOOGLE_MAPS_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'API key not configured' });
  }

  try {
    const url = `https://maps.googleapis.com/maps/api/directions/json?origin=${originLat},${originLng}&destination=${destLat},${destLng}&mode=driving&key=${apiKey}&language=fr`;

    const response = await fetch(url);
    const data = await response.json();

    if (data.status !== 'OK') {
      console.error('Google Directions API error:', data.status, data.error_message);
      return res.status(500).json({ 
        error: 'Google Directions API error', 
        status: data.status,
        message: data.error_message 
      });
    }

    if (!data.routes || data.routes.length === 0) {
      return res.status(404).json({ error: 'No route found' });
    }

    const route = data.routes[0];
    const leg = route.legs[0];

    // Convert to GeoJSON format (compatible with existing code)
    const coordinates = [];
    route.overview_polyline.points.split('').forEach((char, i) => {
      // Simplified polyline decoding - in production use a proper library
      // For now, extract coordinates from legs.steps
    });

    // Extract coordinates from steps
    leg.steps.forEach(step => {
      coordinates.push([step.start_location.lng, step.start_location.lat]);
      coordinates.push([step.end_location.lng, step.end_location.lat]);
    });

    const geoJSON = {
      type: 'Feature',
      geometry: {
        type: 'LineString',
        coordinates: coordinates,
      },
      properties: {
        duration: leg.duration.value, // seconds
        distance: leg.distance.value, // meters
      },
    };

    return res.status(200).json({
      route: geoJSON,
      duration: Math.round(leg.duration.value / 60), // minutes
      distance: (leg.distance.value / 1000).toFixed(1), // km
    });

  } catch (error) {
    console.error('Directions error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
