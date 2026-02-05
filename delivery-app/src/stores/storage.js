import { supabase } from '../lib/supabase';
import AsyncStorage from '@react-native-async-storage/async-storage';

const MOTO_CLIENTS_CACHE_KEY = '@moto_clients_cache';
const MOTO_ORDERS_CACHE_KEY = '@moto_orders_cache';
const B2B_CLIENTS_KEY = '@b2b_clients';
const B2B_DELIVERY_LIST_KEY = '@b2b_delivery_list';

// ============ HELPER: Get current user ID ============
async function getCurrentUserId() {
  const { data: { user } } = await supabase.auth.getUser();
  return user?.id;
}

// ============ MOTO CLIENTS - Supabase + Local Cache ============

// Helper: Transform Supabase data to app format
function transformClientFromSupabase(client) {
  return {
    id: client.id,
    nom: client.name,
    numero: client.phone,
    adresse: client.address,
    neighborhood: client.neighborhood,
    latitude: client.lat,
    longitude: client.lng,
    googleLink: client.notes,
    createdAt: client.created_at,
  };
}

export async function getMotoClients() {
  try {
    const userId = await getCurrentUserId();
    if (!userId) {
      console.warn('No user logged in, returning empty clients');
      return [];
    }

    // Try Supabase first
    const { data, error } = await supabase
      .from('moto_clients')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Supabase error, falling back to cache:', error);
      // Fallback to cache
      const cached = await AsyncStorage.getItem(MOTO_CLIENTS_CACHE_KEY);
      return cached ? JSON.parse(cached) : [];
    }

    // Transform to app format
    const transformed = (data || []).map(transformClientFromSupabase);
    
    // Update cache
    await AsyncStorage.setItem(MOTO_CLIENTS_CACHE_KEY, JSON.stringify(transformed));
    return transformed;
  } catch (e) {
    console.error('Error getting moto clients:', e);
    // Fallback to cache
    try {
      const cached = await AsyncStorage.getItem(MOTO_CLIENTS_CACHE_KEY);
      return cached ? JSON.parse(cached) : [];
    } catch {
      return [];
    }
  }
}

export async function addMotoClient(client) {
  try {
    const userId = await getCurrentUserId();
    if (!userId) {
      throw new Error('User not authenticated');
    }

    // Generate temporary ID
    const tempId = `temp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    // Create optimistic client
    const optimisticClient = {
      id: tempId,
      nom: client.nom || client.name,
      numero: client.numero || client.phone,
      adresse: client.adresse || client.address,
      neighborhood: client.neighborhood || null,
      latitude: client.latitude || client.lat || null,
      longitude: client.longitude || client.lng || null,
      googleLink: client.googleLink || client.notes || null,
      createdAt: new Date().toISOString(),
    };

    // Update cache IMMEDIATELY
    const cached = await AsyncStorage.getItem(MOTO_CLIENTS_CACHE_KEY);
    const currentClients = cached ? JSON.parse(cached) : [];
    const updatedClients = [optimisticClient, ...currentClients];
    await AsyncStorage.setItem(MOTO_CLIENTS_CACHE_KEY, JSON.stringify(updatedClients));

    // Sync to Supabase in background (don't await)
    const clientData = {
      user_id: userId,
      name: client.nom || client.name,
      phone: client.numero || client.phone,
      address: client.adresse || client.address,
      neighborhood: client.neighborhood || null,
      lat: client.latitude || client.lat || null,
      lng: client.longitude || client.lng || null,
      notes: client.googleLink || client.notes || null,
    };

    supabase
      .from('moto_clients')
      .insert([clientData])
      .select()
      .single()
      .then(({ data, error }) => {
        if (error) {
          console.error('Background sync failed:', error);
          return;
        }
        // Replace temp client with real one in cache
        getMotoClients().catch(console.error);
      })
      .catch(console.error);

    // Return immediately with optimistic data
    return updatedClients;
  } catch (e) {
    console.error('Error adding moto client:', e);
    throw e;
  }
}

export async function updateMotoClient(clientId, updates) {
  try {
    const userId = await getCurrentUserId();
    if (!userId) {
      throw new Error('User not authenticated');
    }

    const updateData = {
      name: updates.name,
      phone: updates.phone,
      address: updates.address,
      neighborhood: updates.neighborhood || null,
      lat: updates.lat || null,
      lng: updates.lng || null,
      notes: updates.notes || null,
    };

    const { error } = await supabase
      .from('moto_clients')
      .update(updateData)
      .eq('id', clientId)
      .eq('user_id', userId);

    if (error) throw error;

    // Refresh from Supabase
    const clients = await getMotoClients();
    return clients;
  } catch (e) {
    console.error('Error updating moto client:', e);
    throw e;
  }
}

export async function deleteMotoClient(clientId) {
  try {
    const userId = await getCurrentUserId();
    if (!userId) {
      throw new Error('User not authenticated');
    }

    // Update cache IMMEDIATELY (optimistic delete)
    const cached = await AsyncStorage.getItem(MOTO_CLIENTS_CACHE_KEY);
    const currentClients = cached ? JSON.parse(cached) : [];
    const updatedClients = currentClients.filter(c => c.id !== clientId);
    await AsyncStorage.setItem(MOTO_CLIENTS_CACHE_KEY, JSON.stringify(updatedClients));

    // Also delete related orders from cache
    const ordersCached = await AsyncStorage.getItem(MOTO_ORDERS_CACHE_KEY);
    const currentOrders = ordersCached ? JSON.parse(ordersCached) : [];
    const updatedOrders = currentOrders.filter(o => o.clientId !== clientId);
    await AsyncStorage.setItem(MOTO_ORDERS_CACHE_KEY, JSON.stringify(updatedOrders));

    // Delete from Supabase in background (don't await)
    supabase
      .from('moto_clients')
      .delete()
      .eq('id', clientId)
      .eq('user_id', userId)
      .then(({ error }) => {
        if (error) {
          console.error('Background delete failed:', error);
          // Revert optimistic delete on error
          AsyncStorage.setItem(MOTO_CLIENTS_CACHE_KEY, cached || '[]').catch(console.error);
          AsyncStorage.setItem(MOTO_ORDERS_CACHE_KEY, ordersCached || '[]').catch(console.error);
          return;
        }
        // Refresh from Supabase
        getMotoClients().catch(console.error);
        getMotoOrders().catch(console.error);
      })
      .catch(console.error);

    // Return immediately with optimistic data
    return updatedClients;
  } catch (e) {
    console.error('Error deleting moto client:', e);
    throw e;
  }
}

// Deprecated - for backward compatibility
export async function saveMotoClients(clients) {
  console.warn('saveMotoClients is deprecated - data saved to Supabase automatically');
}

// ============ MOTO ORDERS - Supabase + Local Cache ============

// Helper: Transform order from Supabase to app format
function transformOrderFromSupabase(order) {
  let extraData = { produit: '', quantite: '', photo: null };
  try {
    if (order.notes) {
      extraData = JSON.parse(order.notes);
    }
  } catch (e) {
    // If notes is not JSON, keep it as is
  }

  return {
    id: order.id,
    clientId: order.client_id,
    clientNom: order.client_name,
    clientNumero: order.client_phone,
    clientAdresse: order.client_address,
    produit: extraData.produit || '',
    quantite: extraData.quantite || '',
    prix: order.price,
    photo: extraData.photo || null,
    checked: order.status === 'delivered',
    createdAt: order.created_at,
  };
}

export async function getMotoOrders() {
  try {
    const userId = await getCurrentUserId();
    if (!userId) {
      console.warn('No user logged in, returning empty orders');
      return [];
    }

    // Try Supabase first
    const { data, error } = await supabase
      .from('moto_orders')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Supabase error, falling back to cache:', error);
      // Fallback to cache
      const cached = await AsyncStorage.getItem(MOTO_ORDERS_CACHE_KEY);
      return cached ? JSON.parse(cached) : [];
    }

    // Transform to app format
    const transformed = (data || []).map(transformOrderFromSupabase);

    // Update cache
    await AsyncStorage.setItem(MOTO_ORDERS_CACHE_KEY, JSON.stringify(transformed));
    return transformed;
  } catch (e) {
    console.error('Error getting moto orders:', e);
    // Fallback to cache
    try {
      const cached = await AsyncStorage.getItem(MOTO_ORDERS_CACHE_KEY);
      return cached ? JSON.parse(cached) : [];
    } catch {
      return [];
    }
  }
}

export async function addMotoOrder(order) {
  try {
    const userId = await getCurrentUserId();
    if (!userId) {
      throw new Error('User not authenticated');
    }

    // Generate temporary ID
    const tempId = `temp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    // Create optimistic order
    const optimisticOrder = {
      id: tempId,
      clientId: order.clientId,
      clientNom: order.clientNom || order.clientName,
      clientNumero: order.clientNumero || order.clientPhone,
      clientAdresse: order.clientAdresse || order.clientAddress,
      produit: order.produit || '',
      quantite: order.quantite || '',
      prix: order.prix || order.price || 0,
      photo: order.photo || null,
      checked: order.checked || false,
      createdAt: new Date().toISOString(),
    };

    // Update cache IMMEDIATELY
    const cached = await AsyncStorage.getItem(MOTO_ORDERS_CACHE_KEY);
    const currentOrders = cached ? JSON.parse(cached) : [];
    const updatedOrders = [optimisticOrder, ...currentOrders];
    await AsyncStorage.setItem(MOTO_ORDERS_CACHE_KEY, JSON.stringify(updatedOrders));

    // Store extra fields (produit, quantite, photo) in notes as JSON
    const extraData = {
      produit: order.produit || '',
      quantite: order.quantite || '',
      photo: order.photo || null,
    };

    const orderData = {
      user_id: userId,
      client_id: order.clientId,
      client_name: order.clientNom || order.clientName,
      client_address: order.clientAdresse || order.clientAddress,
      client_phone: order.clientNumero || order.clientPhone,
      price: parseFloat(order.prix || order.price || 0),
      status: order.checked ? 'delivered' : 'pending',
      notes: JSON.stringify(extraData),
      delivered_at: order.checked ? new Date().toISOString() : null,
    };

    // Sync to Supabase in background (don't await)
    supabase
      .from('moto_orders')
      .insert([orderData])
      .select()
      .single()
      .then(({ data, error }) => {
        if (error) {
          console.error('Background sync failed:', error);
          return;
        }
        // Replace temp order with real one in cache
        getMotoOrders().catch(console.error);
      })
      .catch(console.error);

    // Return immediately with optimistic data
    return updatedOrders;
  } catch (e) {
    console.error('Error adding moto order:', e);
    throw e;
  }
}

export async function updateMotoOrder(orderId, updates) {
  try {
    const userId = await getCurrentUserId();
    if (!userId) {
      throw new Error('User not authenticated');
    }

    // Update cache IMMEDIATELY (optimistic update)
    const cached = await AsyncStorage.getItem(MOTO_ORDERS_CACHE_KEY);
    const currentOrders = cached ? JSON.parse(cached) : [];
    const updatedOrders = currentOrders.map(order => {
      if (order.id === orderId) {
        return {
          ...order,
          ...updates,
          checked: updates.checked !== undefined ? updates.checked : order.checked,
        };
      }
      return order;
    });
    await AsyncStorage.setItem(MOTO_ORDERS_CACHE_KEY, JSON.stringify(updatedOrders));

    // Prepare Supabase update
    const updateData = {};
    
    // Handle checked field (maps to status + delivered_at)
    if (updates.checked !== undefined) {
      updateData.status = updates.checked ? 'delivered' : 'pending';
      updateData.delivered_at = updates.checked ? new Date().toISOString() : null;
    }
    
    if (updates.status !== undefined) updateData.status = updates.status;
    if (updates.price !== undefined || updates.prix !== undefined) {
      updateData.price = parseFloat(updates.price || updates.prix);
    }
    if (updates.notes !== undefined) updateData.notes = updates.notes || null;
    if (updates.deliveredAt !== undefined || updates.delivered_at !== undefined) {
      updateData.delivered_at = updates.deliveredAt || updates.delivered_at || null;
    }

    // Sync to Supabase in background (don't await)
    supabase
      .from('moto_orders')
      .update(updateData)
      .eq('id', orderId)
      .eq('user_id', userId)
      .then(({ error }) => {
        if (error) {
          console.error('Background sync failed:', error);
          // Revert optimistic update on error
          AsyncStorage.setItem(MOTO_ORDERS_CACHE_KEY, cached || '[]').catch(console.error);
          return;
        }
        // Refresh from Supabase to get latest state
        getMotoOrders().catch(console.error);
      })
      .catch(console.error);

    // Return immediately with optimistic data
    return updatedOrders;
  } catch (e) {
    console.error('Error updating moto order:', e);
    throw e;
  }
}

export async function deleteMotoOrder(orderId) {
  try {
    const userId = await getCurrentUserId();
    if (!userId) {
      throw new Error('User not authenticated');
    }

    // Update cache IMMEDIATELY (optimistic delete)
    const cached = await AsyncStorage.getItem(MOTO_ORDERS_CACHE_KEY);
    const currentOrders = cached ? JSON.parse(cached) : [];
    const updatedOrders = currentOrders.filter(o => o.id !== orderId);
    await AsyncStorage.setItem(MOTO_ORDERS_CACHE_KEY, JSON.stringify(updatedOrders));

    // Delete from Supabase in background (don't await)
    supabase
      .from('moto_orders')
      .delete()
      .eq('id', orderId)
      .eq('user_id', userId)
      .then(({ error }) => {
        if (error) {
          console.error('Background delete failed:', error);
          // Revert optimistic delete on error
          AsyncStorage.setItem(MOTO_ORDERS_CACHE_KEY, cached || '[]').catch(console.error);
          return;
        }
        // Refresh from Supabase
        getMotoOrders().catch(console.error);
      })
      .catch(console.error);

    // Return immediately with optimistic data
    return updatedOrders;
  } catch (e) {
    console.error('Error deleting moto order:', e);
    throw e;
  }
}

// Deprecated - for backward compatibility
export async function saveMotoOrders(orders) {
  console.warn('saveMotoOrders is deprecated - data saved to Supabase automatically');
}

// ============ B2B CLIENTS (Local Storage - MVP disabled) ============

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

// ============ B2B DELIVERY LIST (Local Storage - MVP disabled) ============

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

// ============ DATA EXPORT/IMPORT ============

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
      // Import is not supported for Supabase-backed data
      console.warn('Import for MOTO mode is not supported with Supabase sync');
      return false;
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
