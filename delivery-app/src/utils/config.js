import Constants from 'expo-constants';

// Access environment variables from app.config.js extra
export const MAPBOX_TOKEN = Constants.expoConfig?.extra?.MAPBOX_PUBLIC_TOKEN || process.env.MAPBOX_PUBLIC_TOKEN || '';
export const GOOGLE_MAPS_API_KEY = Constants.expoConfig?.extra?.GOOGLE_MAPS_API_KEY || process.env.GOOGLE_MAPS_API_KEY || '';
