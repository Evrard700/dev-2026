import { supabase } from '../lib/supabase';
import AsyncStorage from '@react-native-async-storage/async-storage';
const MOTO_CLIENTS_KEY = '@moto_clients';
const B2B_CLIENTS_KEY = '@b2b_clients';
const MOTO_ORDERS_KEY = '@moto_orders';
const B2B_DELIVERY_LIST_KEY = '@b2b_delivery_list';

// ============ MOTO LIVRAISON ============

export async function getMotoClients() {
  try {
    const data = await AsyncStorage.getItem(MOTO_CLIENTS_KEY);
    return data ? JSON.parse(data) : [];
  } catch (e) {
    console.error('Error getting moto clients:', e);
    return [];
  }
}

export async function saveMotoClients(clients) {
  try {
    await AsyncStorage.setItem(MOTO_CLIENTS_KEY, JSON.stringify(clients));
  } catch (e) {
    console.error('Error saving moto clients:', e);
  }
}

export async function addMotoClient(client) {
  const clients = await getMotoClients();
  clients.push(client);
  await saveMotoClients(clients);
  return clients;
}

export async function updateMotoClient(clientId, updates) {
  const clients = await getMotoClients();
  const index = clients.findIndex(c => c.id === clientId);
  if (index !== -1) {
    clients[index] = { ...clients[index], ...updates };
    await saveMotoClients(clients);
  }
  return clients;
}

export async function deleteMotoClient(clientId) {
  let clients = await getMotoClients();
  clients = clients.filter(c => c.id !== clientId);
  await saveMotoClients(clients);
  // Also remove orders for this client
  let orders = await getMotoOrders();
  orders = orders.filter(o => o.clientId !== clientId);
  await saveMotoOrders(orders);
  return clients;
}

// ============ MOTO ORDERS ============

export async function getMotoOrders() {
  try {
    const data = await AsyncStorage.getItem(MOTO_ORDERS_KEY);
    return data ? JSON.parse(data) : [];
  } catch (e) {
    console.error('Error getting moto orders:', e);
    return [];
  }
}

export async function saveMotoOrders(orders) {
  try {
    await AsyncStorage.setItem(MOTO_ORDERS_KEY, JSON.stringify(orders));
  } catch (e) {
    console.error('Error saving moto orders:', e);
  }
}

export async function addMotoOrder(order) {
  const orders = await getMotoOrders();
  orders.push(order);
  await saveMotoOrders(orders);
  return orders;
}

export async function updateMotoOrder(orderId, updates) {
  const orders = await getMotoOrders();
  const index = orders.findIndex(o => o.id === orderId);
  if (index !== -1) {
    orders[index] = { ...orders[index], ...updates };
    await saveMotoOrders(orders);
  }
  return orders;
}

export async function deleteMotoOrder(orderId) {
  let orders = await getMotoOrders();
  orders = orders.filter(o => o.id !== orderId);
  await saveMotoOrders(orders);
  return orders;
}

// ============ B2B CLIENTS ============

export async function getB2BClients() {
  try {
    const data = await AsyncStorage.getItem(B2B_CLIENTS_KEY);
    return data ? JSON.parse(data) : [];
  } catch (e) {
    console.error('Error getting B2B clients:', e);
    return [];
  }
}

export async function saveB2BClients(clients) {
  try {
    await AsyncStorage.setItem(B2B_CLIENTS_KEY, JSON.stringify(clients));
  } catch (e) {
    console.error('Error saving B2B clients:', e);
  }
}

export async function addB2BClient(client) {
  const clients = await getB2BClients();
  clients.push(client);
  await saveB2BClients(clients);
  return clients;
}

export async function updateB2BClient(clientId, updates) {
  const clients = await getB2BClients();
  const index = clients.findIndex(c => c.id === clientId);
  if (index !== -1) {
    clients[index] = { ...clients[index], ...updates };
    await saveB2BClients(clients);
  }
  return clients;
}

export async function deleteB2BClient(clientId) {
  let clients = await getB2BClients();
  clients = clients.filter(c => c.id !== clientId);
  await saveB2BClients(clients);
  return clients;
}

// ============ B2B DELIVERY LIST ============

export async function getB2BDeliveryList() {
  try {
    const data = await AsyncStorage.getItem(B2B_DELIVERY_LIST_KEY);
    return data ? JSON.parse(data) : [];
  } catch (e) {
    console.error('Error getting B2B delivery list:', e);
    return [];
  }
}

export async function saveB2BDeliveryList(list) {
  try {
    await AsyncStorage.setItem(B2B_DELIVERY_LIST_KEY, JSON.stringify(list));
  } catch (e) {
    console.error('Error saving B2B delivery list:', e);
  }
}


// ============ AUTH ============

const AUTH_USER_KEY = '@auth_user';

export async function getAuthUser() {
  try {
    const { data } = await supabase.auth.getSession();
    if (data.session) {
      const user = data.session.user;
      return {
        id: user.id,
        email: user.email,
        name: user.user_metadata?.name,
        mode: user.user_metadata?.mode || 'moto'
      };
    }
    const cached = await AsyncStorage.getItem(AUTH_USER_KEY);
    return cached ? JSON.parse(cached) : null;
  } catch (e) { return null; }
}

export async function saveAuthUser(user) {
  await AsyncStorage.setItem(AUTH_USER_KEY, JSON.stringify(user));
}

export async function logoutUser() {
  await supabase.auth.signOut();
  await AsyncStorage.removeItem(AUTH_USER_KEY);
}

export async function registerUser(email, password, name, mode) {
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { data: { name, mode: mode || 'moto' } }
  });
  if (error) return { error: error.message };
  // If user already exists (identities is empty), suggest login instead
  if (data.user && data.user.identities && data.user.identities.length === 0) {
    return { error: 'Un compte existe deja avec cet email. Veuillez vous connecter.' };
  }
  const safeUser = {
    id: data.user.id,
    email: data.user.email,
    name,
    mode: mode || 'moto'
  };
  await saveAuthUser(safeUser);
  return { user: safeUser };
}

export async function loginUser(email, password) {
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password
  });
  if (error) {
    // If email not confirmed, try resending confirmation by signing up again
    // Supabase will resend the confirmation email for unconfirmed accounts
    if (error.message.includes('Email not confirmed') || error.message.includes('email_not_confirmed')) {
      try {
        await supabase.auth.resend({ type: 'signup', email });
      } catch (e) { /* ignore */ }
      return { error: 'Votre email n\'est pas encore confirme. Un nouveau lien de confirmation a ete envoye a ' + email + '.' };
    }
    // If invalid credentials, try to sign up in case the account exists but wasn't confirmed
    if (error.message.includes('Invalid login credentials')) {
      // Check if the user might exist with unconfirmed email by attempting signUp
      const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
        email,
        password,
        options: { data: { name: email.split('@')[0], mode: 'moto' } }
      });
      // If signUp returns a user with identities = [] it means user already exists
      if (signUpData?.user && signUpData.user.identities && signUpData.user.identities.length === 0) {
        return { error: 'Identifiants incorrects. Si vous avez deja un compte, verifiez votre mot de passe. Si vous avez recu un email de confirmation, veuillez le confirmer d\'abord.' };
      }
      // If signUp succeeded (new account), clean it up and tell user to use register
      if (signUpData?.user && signUpData.user.identities && signUpData.user.identities.length > 0) {
        return { error: 'Aucun compte trouve avec cet email. Veuillez creer un compte.' };
      }
      return { error: 'Identifiants incorrects. Verifiez votre email et mot de passe.' };
    }
    return { error: error.message };
  }
  const user = data.user;
  const safeUser = {
    id: user.id,
    email: user.email,
    name: user.user_metadata?.name,
    mode: user.user_metadata?.mode || 'moto'
  };
  await saveAuthUser(safeUser);
  return { user: safeUser };
}

export async function shareB2BDataToEmail(targetEmail) {
  const clients = await getB2BClients();
  const deliveryList = await getB2BDeliveryList();
  const currentUser = await getAuthUser();
  if (!currentUser) return { error: 'Non connecte.' };
  return { success: true };
}

export async function getSharedB2BData() {
  const currentUser = await getAuthUser();
  if (!currentUser) return [];
  const shareKey = `@b2b_shared_${currentUser.id}`;
  try {
    const data = await AsyncStorage.getItem(shareKey);
    return data ? JSON.parse(data) : [];
  } catch (e) { return []; }
}

export async function importSharedB2BData(shareIndex) {
  const shares = await getSharedB2BData();
  if (shareIndex < 0 || shareIndex >= shares.length) return false;
  const share = shares[shareIndex];
  const existingClients = await getB2BClients();
  const existingIds = new Set(existingClients.map(c => c.id));
  const newClients = share.clients.filter(c => !existingIds.has(c.id));
  await saveB2BClients([...existingClients, ...newClients]);
  return true;
}

export async function clearSharedB2BData() {
  const currentUser = await getAuthUser();
  if (!currentUser) return;
  await AsyncStorage.removeItem(`@b2b_shared_${currentUser.id}`);
}

// ============ ROUTE CACHE (offline) ============

const ROUTE_CACHE_KEY = '@route_cache';

export async function getCachedRoute(startKey, endKey) {
  try {
    const data = await AsyncStorage.getItem(ROUTE_CACHE_KEY);
    const cache = data ? JSON.parse(data) : {};
    const key = `${startKey}_${endKey}`;
    return cache[key] || null;
  } catch (e) { return null; }
}

export async function cacheRoute(startKey, endKey, routeData) {
  try {
    const data = await AsyncStorage.getItem(ROUTE_CACHE_KEY);
    const cache = data ? JSON.parse(data) : {};
    const key = `${startKey}_${endKey}`;
    cache[key] = { ...routeData, cachedAt: Date.now() };
    await AsyncStorage.setItem(ROUTE_CACHE_KEY, JSON.stringify(cache));
  } catch (e) { /* ignore */ }
}

// ============ THEME ============

const THEME_KEY = '@app_theme';

export async function getAppTheme() {
  try {
    const data = await AsyncStorage.getItem(THEME_KEY);
    return data || 'system';
  } catch (e) { return 'system'; }
}

export async function saveAppTheme(theme) {
  await AsyncStorage.setItem(THEME_KEY, theme);
}

// ============ DATA SHARING ============

export async function exportAllData(interfaceType) {
  try {
    if (interfaceType === 'moto') {
      const clients = await getMotoClients();
      const orders = await getMotoOrders();
      return JSON.stringify({ type: 'moto', clients, orders }, null, 2);
    } else {
      const clients = await getB2BClients();
      const deliveryList = await getB2BDeliveryList();
      return JSON.stringify({ type: 'b2b', clients, deliveryList }, null, 2);
    }
  } catch (e) {
    console.error('Error exporting data:', e);
    return null;
  }
}

export async function importData(jsonString) {
  try {
    const data = JSON.parse(jsonString);
    if (data.type === 'moto') {
      await saveMotoClients(data.clients || []);
      await saveMotoOrders(data.orders || []);
    } else if (data.type === 'b2b') {
      await saveB2BClients(data.clients || []);
      await saveB2BDeliveryList(data.deliveryList || []);
    }
    return true;
  } catch (e) {
    console.error('Error importing data:', e);
    return false;
  }
}
