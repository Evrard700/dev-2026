import { Platform } from 'react-native';

export async function getCurrentLocation() {
  if (Platform.OS === 'web') {
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) {
        reject(new Error('Geolocation not supported'));
        return;
      }
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          resolve({
            coords: {
              longitude: pos.coords.longitude,
              latitude: pos.coords.latitude,
            },
          });
        },
        (err) => reject(err),
        { enableHighAccuracy: true }
      );
    });
  } else {
    const Location = require('expo-location');
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') throw new Error('Permission denied');
    return Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
  }
}

export function watchLocation(callback) {
  if (Platform.OS === 'web') {
    if (!navigator.geolocation) return { remove: () => {} };
    const watchId = navigator.geolocation.watchPosition(
      (pos) => {
        callback({
          coords: {
            longitude: pos.coords.longitude,
            latitude: pos.coords.latitude,
            heading: pos.coords.heading, // Direction GPS native (si disponible)
            speed: pos.coords.speed,
          },
        });
      },
      null,
      { 
        enableHighAccuracy: true,
        maximumAge: 0, // Pas de cache, toujours fresh
        timeout: 5000,
      }
    );
    return { remove: () => navigator.geolocation.clearWatch(watchId) };
  } else {
    let sub;
    const Location = require('expo-location');
    Location.watchPositionAsync(
      { 
        accuracy: Location.Accuracy.BestForNavigation, // Meilleure précision pour navigation
        distanceInterval: 1, // Update tous les 1 mètre (au lieu de 5)
        timeInterval: 500, // Update toutes les 0.5 secondes (au lieu de 3s)
      },
      callback
    ).then(s => { sub = s; });
    return { remove: () => sub?.remove() };
  }
}
