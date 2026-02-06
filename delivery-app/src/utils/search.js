/**
 * Recherche intelligente pour livreurs
 * Recherche dans: clients, commandes, puis Mapbox
 */

// Normalise une chaîne (accents, majuscules, espaces)
export function normalizeString(str) {
  if (!str) return '';
  return str
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // Enlève les accents
    .replace(/[^\w\s]/g, '') // Enlève la ponctuation
    .trim();
}

// Score de similarité entre deux chaînes (fuzzy matching)
export function getSimilarityScore(str1, str2) {
  const s1 = normalizeString(str1);
  const s2 = normalizeString(str2);
  
  // Match exact = score max
  if (s1 === s2) return 100;
  
  // Contient la recherche = score élevé
  if (s1.includes(s2) || s2.includes(s1)) return 80;
  
  // Match par mots
  const words1 = s1.split(/\s+/);
  const words2 = s2.split(/\s+/);
  
  let matchingWords = 0;
  for (const w2 of words2) {
    if (words1.some(w1 => w1.includes(w2) || w2.includes(w1))) {
      matchingWords++;
    }
  }
  
  if (matchingWords > 0) {
    return Math.min(70, (matchingWords / words2.length) * 70);
  }
  
  // Levenshtein distance approximative (premiers caractères)
  const minLen = Math.min(s1.length, s2.length);
  let matches = 0;
  for (let i = 0; i < minLen; i++) {
    if (s1[i] === s2[i]) matches++;
  }
  
  return Math.min(50, (matches / Math.max(s1.length, s2.length)) * 50);
}

// Recherche dans les clients
export function searchClients(query, clients, orders = []) {
  if (!query || !query.trim()) return [];
  
  const normalizedQuery = normalizeString(query);
  const results = [];
  
  for (const client of clients) {
    let bestScore = 0;
    let matchType = '';
    let matchValue = '';
    
    // Recherche dans le nom
    const nameScore = getSimilarityScore(client.nom, query);
    if (nameScore > bestScore) {
      bestScore = nameScore;
      matchType = 'nom';
      matchValue = client.nom;
    }
    
    // Recherche dans le numéro (exact ou partiel)
    if (client.numero) {
      const phoneNormalized = client.numero.replace(/\D/g, '');
      const queryNormalized = query.replace(/\D/g, '');
      if (phoneNormalized.includes(queryNormalized) || queryNormalized.includes(phoneNormalized)) {
        const phoneScore = queryNormalized.length >= 4 ? 90 : 70;
        if (phoneScore > bestScore) {
          bestScore = phoneScore;
          matchType = 'téléphone';
          matchValue = client.numero;
        }
      }
    }
    
    // Recherche dans l'adresse
    if (client.adresse) {
      const addressScore = getSimilarityScore(client.adresse, query);
      if (addressScore > bestScore) {
        bestScore = addressScore;
        matchType = 'adresse';
        matchValue = client.adresse;
      }
    }
    
    // Recherche dans les commandes du client
    const clientOrders = orders.filter(o => o.clientId === client.id);
    for (const order of clientOrders) {
      if (order.produit) {
        const productScore = getSimilarityScore(order.produit, query);
        if (productScore > bestScore) {
          bestScore = productScore;
          matchType = 'produit';
          matchValue = order.produit;
        }
      }
    }
    
    // Seuil de pertinence: 40+
    if (bestScore >= 40) {
      results.push({
        type: 'client',
        client,
        score: bestScore,
        matchType,
        matchValue,
        id: `client-${client.id}`,
        name: client.nom,
        subtitle: `${matchType}: ${matchValue}`,
        coords: [client.longitude, client.latitude],
      });
    }
  }
  
  // Trier par score décroissant
  results.sort((a, b) => b.score - a.score);
  
  return results;
}

// Recherche de lieux avec Google Places API via serverless proxy (meilleure couverture Côte d'Ivoire)
// FALLBACK vers Mapbox si Google Places n'est pas activé
export async function searchPlaces(query, userLocation) {
  if (!query || !query.trim()) return [];
  
  // Essayer Google Places d'abord (si API activée)
  try {
    const params = new URLSearchParams({
      query: query.trim(),
    });
    
    if (userLocation && userLocation.length === 2) {
      params.append('lat', userLocation[1]);
      params.append('lng', userLocation[0]);
    }
    
    const url = `/api/places-search?${params.toString()}`;
    
    const res = await fetch(url);
    const data = await res.json();
    
    if (res.ok && !data.error && data.results && data.results.length > 0) {
      return data.results;
    }
    
    console.warn('Google Places not available, falling back to Mapbox');
  } catch (e) {
    console.warn('Google Places error, falling back to Mapbox:', e);
  }
  
  // FALLBACK: Utiliser Mapbox Geocoding (toujours disponible)
  try {
    const mapboxToken = 'pk.eyJ1IjoiYmVsb3Zlbm9uZSIsImEiOiJjbTU1b3R1YWEwOHYyMmxzNmlicjYya2gwIn0.6o0e-rhHDDCx4OxLxd89Jg';
    const proximity = userLocation ? `&proximity=${userLocation[0]},${userLocation[1]}` : '';
    const bbox = userLocation
      ? `&bbox=${userLocation[0] - 0.5},${userLocation[1] - 0.5},${userLocation[0] + 0.5},${userLocation[1] + 0.5}`
      : '';
    
    const mapboxUrl = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(query)}.json?access_token=${mapboxToken}&limit=10&language=fr${proximity}${bbox}&types=poi,address,place,locality,neighborhood&autocomplete=true&fuzzyMatch=true&country=CI`;
    
    const res = await fetch(mapboxUrl);
    const data = await res.json();
    
    if (data.features && data.features.length > 0) {
      return data.features.map(f => ({
        type: 'place',
        id: f.id,
        name: f.text,
        subtitle: f.place_name,
        fullName: f.place_name,
        coords: f.center,
        category: f.properties?.category || '',
      }));
    }
    
    return [];
  } catch (e) {
    console.warn('Mapbox search error:', e);
    return [];
  }
}

// Recherche hybride: clients + Mapbox
export async function hybridSearch(query, clients, orders, userLocation, mapboxToken) {
  // 1. Recherche clients d'abord
  const clientResults = searchClients(query, clients, orders);
  
  // 2. Si résultats clients suffisants, les retourner
  if (clientResults.length >= 3) {
    return {
      clients: clientResults.slice(0, 10),
      places: [],
      source: 'clients',
    };
  }
  
  // 3. Sinon, ajouter recherche Mapbox
  try {
    const proximity = userLocation ? `&proximity=${userLocation[0]},${userLocation[1]}` : '';
    const bbox = userLocation
      ? `&bbox=${userLocation[0] - 0.5},${userLocation[1] - 0.5},${userLocation[0] + 0.5},${userLocation[1] + 0.5}`
      : '';
    
    const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(query)}.json?access_token=${mapboxToken}&limit=7&language=fr${proximity}${bbox}&types=poi,address,place,locality,neighborhood&autocomplete=true&fuzzyMatch=true`;
    
    const res = await fetch(url);
    const data = await res.json();
    
    const placeResults = (data.features || []).map(f => ({
      type: 'place',
      id: f.id,
      name: f.text,
      subtitle: f.place_name,
      coords: f.center,
      category: f.properties?.category || '',
    }));
    
    return {
      clients: clientResults,
      places: placeResults,
      source: 'hybrid',
    };
  } catch (e) {
    console.warn('Mapbox search error:', e);
    return {
      clients: clientResults,
      places: [],
      source: 'clients-only',
    };
  }
}
