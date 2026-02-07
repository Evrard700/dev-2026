/**
 * Storage Adapter - Compatible Web et Mobile
 * Utilise localStorage sur Web et AsyncStorage sur Mobile
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

// Adaptateur universel de stockage
const StorageAdapter = Platform.OS === 'web'
  ? {
      getItem: async (key) => {
        try {
          if (typeof window !== 'undefined' && window.localStorage) {
            return window.localStorage.getItem(key);
          }
          return null;
        } catch (e) {
          console.error('localStorage getItem error:', e);
          return null;
        }
      },
      setItem: async (key, value) => {
        try {
          if (typeof window !== 'undefined' && window.localStorage) {
            window.localStorage.setItem(key, value);
          }
        } catch (e) {
          console.error('localStorage setItem error:', e);
        }
      },
      removeItem: async (key) => {
        try {
          if (typeof window !== 'undefined' && window.localStorage) {
            window.localStorage.removeItem(key);
          }
        } catch (e) {
          console.error('localStorage removeItem error:', e);
        }
      },
    }
  : AsyncStorage;

export default StorageAdapter;
