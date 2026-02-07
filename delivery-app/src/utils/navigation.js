/**
 * Navigation Turn-by-Turn Service
 * Gère les instructions vocales et visuelles pour la navigation
 */

import * as Speech from 'expo-speech';
import { Platform } from 'react-native';

// Distance minimale avant de déclencher une instruction (en mètres)
const INSTRUCTION_TRIGGER_DISTANCE = 200; // 200m avant la manœuvre
const INSTRUCTION_IMMINENT_DISTANCE = 50; // 50m = "imminent"
const OFF_ROUTE_THRESHOLD = 50; // 50m de déviation = hors route

// Types de manœuvres Mapbox avec traductions françaises
const MANEUVER_INSTRUCTIONS = {
  'turn-left': { icon: '↰', text: 'Tournez à gauche' },
  'turn-right': { icon: '↱', text: 'Tournez à droite' },
  'turn-slight-left': { icon: '↖', text: 'Tournez légèrement à gauche' },
  'turn-slight-right': { icon: '↗', text: 'Tournez légèrement à droite' },
  'turn-sharp-left': { icon: '⬅', text: 'Tournez fortement à gauche' },
  'turn-sharp-right': { icon: '➡', text: 'Tournez fortement à droite' },
  'uturn-left': { icon: '↶', text: 'Faites demi-tour à gauche' },
  'uturn-right': { icon: '↷', text: 'Faites demi-tour à droite' },
  'continue': { icon: '↑', text: 'Continuez tout droit' },
  'merge': { icon: '⤴', text: 'Rejoignez la voie' },
  'fork-left': { icon: '⤴', text: 'Prenez à gauche' },
  'fork-right': { icon: '⤵', text: 'Prenez à droite' },
  'off-ramp-left': { icon: '↖', text: 'Prenez la sortie à gauche' },
  'off-ramp-right': { icon: '↗', text: 'Prenez la sortie à droite' },
  'roundabout': { icon: '⭯', text: 'Au rond-point' },
  'arrive': { icon: '📍', text: 'Vous êtes arrivé' },
  'depart': { icon: '🚀', text: 'Départ' },
};

/**
 * Calcule la distance entre deux coordonnées (Haversine)
 */
export function calculateDistance(lat1, lon1, lat2, lon2) {
  const R = 6371e3; // Rayon de la Terre en mètres
  const φ1 = (lat1 * Math.PI) / 180;
  const φ2 = (lat2 * Math.PI) / 180;
  const Δφ = ((lat2 - lat1) * Math.PI) / 180;
  const Δλ = ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c; // Distance en mètres
}

/**
 * Formate la distance pour l'affichage
 */
export function formatDistance(meters) {
  if (meters < 1000) {
    return `${Math.round(meters)} m`;
  }
  return `${(meters / 1000).toFixed(1)} km`;
}

/**
 * Formate le temps pour l'affichage
 */
export function formatDuration(seconds) {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  
  if (hours > 0) {
    return `${hours}h ${minutes}min`;
  }
  return `${minutes} min`;
}

/**
 * Parse les steps de l'API Mapbox Directions
 */
export function parseRouteSteps(route) {
  if (!route || !route.legs || route.legs.length === 0) {
    return [];
  }

  const steps = [];
  let cumulativeDistance = 0;

  route.legs.forEach((leg, legIndex) => {
    if (leg.steps && Array.isArray(leg.steps)) {
      leg.steps.forEach((step, stepIndex) => {
        const maneuverType = step.maneuver?.type || 'continue';
        const modifier = step.maneuver?.modifier || '';
        const maneuverKey = modifier ? `${maneuverType}-${modifier}` : maneuverType;
        
        const instruction = MANEUVER_INSTRUCTIONS[maneuverKey] || MANEUVER_INSTRUCTIONS['continue'];
        
        steps.push({
          id: `${legIndex}-${stepIndex}`,
          type: maneuverType,
          modifier: modifier,
          instruction: step.maneuver?.instruction || instruction.text,
          icon: instruction.icon,
          streetName: step.name || '',
          distance: step.distance || 0, // Distance de ce step en mètres
          duration: step.duration || 0, // Durée de ce step en secondes
          location: step.maneuver?.location || [0, 0], // [lng, lat]
          cumulativeDistance: cumulativeDistance,
        });

        cumulativeDistance += step.distance || 0;
      });
    }
  });

  return steps;
}

/**
 * Trouve la prochaine instruction à afficher
 */
export function getNextInstruction(userLocation, steps, lastSpokenStepId = null) {
  if (!userLocation || !steps || steps.length === 0) {
    return null;
  }

  const [userLng, userLat] = userLocation;

  // Trouver le step le plus proche devant nous
  let closestStep = null;
  let minDistance = Infinity;

  for (let i = 0; i < steps.length; i++) {
    const step = steps[i];
    const [stepLng, stepLat] = step.location;
    const distance = calculateDistance(userLat, userLng, stepLat, stepLng);

    // Garder seulement les steps devant nous (distance < 500m)
    if (distance < 500 && distance < minDistance) {
      minDistance = distance;
      closestStep = step;
    }
  }

  if (!closestStep) {
    return null;
  }

  const distanceToStep = minDistance;
  const shouldSpeak = 
    lastSpokenStepId !== closestStep.id && 
    distanceToStep <= INSTRUCTION_TRIGGER_DISTANCE;

  return {
    step: closestStep,
    distanceToStep,
    shouldSpeak,
    isImminent: distanceToStep <= INSTRUCTION_IMMINENT_DISTANCE,
  };
}

/**
 * Vérifie si l'utilisateur est hors route
 */
export function isOffRoute(userLocation, routeGeometry) {
  if (!userLocation || !routeGeometry || !routeGeometry.coordinates) {
    return false;
  }

  const [userLng, userLat] = userLocation;
  let minDistance = Infinity;

  // Trouver le point le plus proche sur la route
  routeGeometry.coordinates.forEach(([lng, lat]) => {
    const distance = calculateDistance(userLat, userLng, lat, lng);
    if (distance < minDistance) {
      minDistance = distance;
    }
  });

  return minDistance > OFF_ROUTE_THRESHOLD;
}

/**
 * Prononce une instruction vocale
 */
export function speakInstruction(instruction, distanceToStep) {
  if (!instruction) return;

  // Construire la phrase complète
  let text = instruction.instruction;
  
  if (distanceToStep > INSTRUCTION_IMMINENT_DISTANCE) {
    text = `Dans ${Math.round(distanceToStep)} mètres, ${instruction.instruction.toLowerCase()}`;
  } else {
    text = instruction.instruction;
  }

  if (instruction.streetName && instruction.streetName !== 'unknown') {
    text += ` sur ${instruction.streetName}`;
  }

  // Prononcer avec expo-speech
  Speech.speak(text, {
    language: Platform.OS === 'android' ? 'fr' : 'fr-FR', // Android utilise 'fr' simple
    pitch: 1.0,
    rate: 0.85, // Plus lent pour meilleure compréhension
  });

  console.log('🔊 Navigation:', text);
}

/**
 * Arrête toutes les instructions vocales en cours
 */
export function stopSpeaking() {
  Speech.stop();
}

/**
 * Calcule les statistiques globales de la route
 */
export function getRouteStats(steps, currentStepId = null) {
  if (!steps || steps.length === 0) {
    return {
      totalSteps: 0,
      currentStepIndex: 0,
      remainingDistance: 0,
      remainingDuration: 0,
      progress: 0,
    };
  }

  const totalSteps = steps.length;
  let currentStepIndex = 0;
  let remainingDistance = 0;
  let remainingDuration = 0;

  // Trouver l'index du step actuel
  if (currentStepId) {
    currentStepIndex = steps.findIndex(s => s.id === currentStepId);
    if (currentStepIndex === -1) currentStepIndex = 0;
  }

  // Calculer distance et durée restantes
  for (let i = currentStepIndex; i < steps.length; i++) {
    remainingDistance += steps[i].distance;
    remainingDuration += steps[i].duration;
  }

  const totalDistance = steps.reduce((sum, s) => sum + s.distance, 0);
  const progress = totalDistance > 0 ? ((totalDistance - remainingDistance) / totalDistance) * 100 : 0;

  return {
    totalSteps,
    currentStepIndex: currentStepIndex + 1, // +1 pour affichage humain (1-based)
    remainingDistance,
    remainingDuration,
    progress,
  };
}
