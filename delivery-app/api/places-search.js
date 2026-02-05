// Vercel Serverless Function - Proxy pour Google Places API
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

  const { query, lat, lng } = req.query;

  if (!query || !query.trim()) {
    return res.status(400).json({ error: 'Query parameter is required' });
  }

  const apiKey = process.env.GOOGLE_PLACES_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'API key not configured' });
  }

  try {
    // Autocomplete request
    const location = lat && lng ? `&location=${lat},${lng}&radius=50000` : '';
    const autocompleteUrl = `https://maps.googleapis.com/maps/api/place/autocomplete/json?input=${encodeURIComponent(query)}&key=${apiKey}&language=fr${location}&components=country:ci`;

    const autocompleteRes = await fetch(autocompleteUrl);
    const autocompleteData = await autocompleteRes.json();

    if (autocompleteData.status !== 'OK' && autocompleteData.status !== 'ZERO_RESULTS') {
      console.error('Google Places API error:', autocompleteData.status, autocompleteData.error_message);
      return res.status(500).json({ 
        error: 'Google Places API error', 
        status: autocompleteData.status,
        message: autocompleteData.error_message 
      });
    }

    if (!autocompleteData.predictions || autocompleteData.predictions.length === 0) {
      return res.status(200).json({ results: [] });
    }

    // Fetch details for each place (limit to 10)
    const detailsPromises = autocompleteData.predictions.slice(0, 10).map(async (prediction) => {
      try {
        const detailsUrl = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${prediction.place_id}&fields=geometry,name,formatted_address,types&key=${apiKey}`;
        const detailsRes = await fetch(detailsUrl);
        const detailsData = await detailsRes.json();

        if (detailsData.status === 'OK' && detailsData.result) {
          const result = detailsData.result;
          return {
            type: 'place',
            id: prediction.place_id,
            name: result.name || prediction.structured_formatting?.main_text || prediction.description,
            subtitle: result.formatted_address || prediction.description,
            fullName: result.formatted_address || prediction.description,
            coords: [
              result.geometry.location.lng,
              result.geometry.location.lat
            ],
            category: result.types?.[0] || '',
          };
        }
        return null;
      } catch (e) {
        console.error('Error fetching place details:', e);
        return null;
      }
    });

    const results = await Promise.all(detailsPromises);
    const validResults = results.filter(r => r !== null);

    return res.status(200).json({ results: validResults });

  } catch (error) {
    console.error('Search error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
