import { createClient } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';

const SUPABASE_URL = 'https://ybmpvlhwplsxotpymetp.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlibXB2bGh3cGxzeG90cHltZXRwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzAwMzAyNDgsImV4cCI6MjA4NTYwNjI0OH0.-0a9zipmkDeesipMwz53wvf9qYvK2s12T8Y1PLh_FY8';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});
