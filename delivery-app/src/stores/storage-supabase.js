import { supabase } from '../lib/supabase';
import StorageAdapter from "../lib/storage-adapter";

const MOTO_CLIENTS_CACHE_KEY = '@moto_clients_cache';
const MOTO_ORDERS_CACHE_KEY = '@moto_orders_cache';

// ============ HELPER: Get current user ID ============
async function getCurrentUserId() {
  const { data: { user } } = await supabase.auth.getUser();
  return user?.id;
}

// ============ MOTO CLIENTS - Supabase + Cache ============

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
      const cached = await StorageAdapter.getItem(MOTO_CLIENTS_CACHE_KEY);
      return cached ? JSON.parse(cached) : [];
    }

    // Update cache
    await StorageAdapter.setItem(MOTO_CLIENTS_CACHE_KEY, JSON.stringify(data));
    return data || [];
  } catch (e) {
    console.error('Error getting moto clients:', e);
    // Fallback to cache
    try {
      const cached = await StorageAdapter.getItem(MOTO_CLIENTS_CACHE_KEY);
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

    const clientData = {
      user_id: userId,
      name: client.name,
      phone: client.phone,
      address: client.address,
      neighborhood: client.neighborhood || null,
      lat: client.lat || null,
      lng: client.lng || null,
      notes: client.notes || null,
    };

    const { data, error } = await supabase
      .from('moto_clients')
      .insert([clientData])
      .select()
      .single();

    if (error) throw error;

    // Update cache
    const clients = await getMotoClients();
    return clients;
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

    // Refresh cache
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

    // Delete client (cascade will delete orders)
    const { error } = await supabase
      .from('moto_clients')
      .delete()
      .eq('id', clientId)
      .eq('user_id', userId);

    if (error) throw error;

    // Refresh cache
    const clients = await getMotoClients();
    return clients;
  } catch (e) {
    console.error('Error deleting moto client:', e);
    throw e;
  }
}

// ============ MOTO ORDERS - Supabase + Cache ============

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
      const cached = await StorageAdapter.getItem(MOTO_ORDERS_CACHE_KEY);
      return cached ? JSON.parse(cached) : [];
    }

    // Update cache
    await StorageAdapter.setItem(MOTO_ORDERS_CACHE_KEY, JSON.stringify(data));
    return data || [];
  } catch (e) {
    console.error('Error getting moto orders:', e);
    // Fallback to cache
    try {
      const cached = await StorageAdapter.getItem(MOTO_ORDERS_CACHE_KEY);
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

    const orderData = {
      user_id: userId,
      client_id: order.clientId,
      client_name: order.clientName,
      client_address: order.clientAddress,
      client_phone: order.clientPhone,
      price: order.price,
      status: order.status || 'pending',
      notes: order.notes || null,
      delivered_at: order.deliveredAt || null,
    };

    const { data, error } = await supabase
      .from('moto_orders')
      .insert([orderData])
      .select()
      .single();

    if (error) throw error;

    // Update cache
    const orders = await getMotoOrders();
    return orders;
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

    const updateData = {
      status: updates.status,
      price: updates.price,
      notes: updates.notes || null,
      delivered_at: updates.deliveredAt || updates.delivered_at || null,
    };

    const { error } = await supabase
      .from('moto_orders')
      .update(updateData)
      .eq('id', orderId)
      .eq('user_id', userId);

    if (error) throw error;

    // Refresh cache
    const orders = await getMotoOrders();
    return orders;
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

    const { error } = await supabase
      .from('moto_orders')
      .delete()
      .eq('id', orderId)
      .eq('user_id', userId);

    if (error) throw error;

    // Refresh cache
    const orders = await getMotoOrders();
    return orders;
  } catch (e) {
    console.error('Error deleting moto order:', e);
    throw e;
  }
}

// Keep old functions for backward compatibility (will be removed later)
export async function saveMotoClients() {
  // Deprecated - data is saved in Supabase now
  console.warn('saveMotoClients is deprecated');
}

export async function saveMotoOrders() {
  // Deprecated - data is saved in Supabase now
  console.warn('saveMotoOrders is deprecated');
}
