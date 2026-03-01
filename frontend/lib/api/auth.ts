/**
 * User-features data access via Supabase client.
 *
 * Auth is handled by the AuthProvider (supabase.auth).
 * Watchlist, alerts, and newsletter hit Supabase Postgres directly
 * (protected by RLS policies keyed on auth.uid()).
 */
import { createClient } from '@/lib/supabase/client';

const supabase = createClient();

/* ───── Types ───── */
export interface UserProfile {
  id: string;
  email: string;
  display_name: string | null;
  roles: string[];
}

export interface WatchlistItem {
  id: number;
  user_id: string;
  item_type: 'county' | 'national_category' | 'budget_programme';
  item_id: string;
  label: string;
  notify: boolean;
  metadata: Record<string, unknown>;
  created_at: string;
}

export interface DataAlert {
  id: number;
  user_id: string;
  alert_type: string;
  title: string;
  body: string | null;
  item_type: string | null;
  item_id: string | null;
  read: boolean;
  created_at: string;
}

/* ───── Profile ───── */
export async function updateProfile(displayName: string): Promise<UserProfile> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const { data, error } = await supabase
    .from('profiles')
    .update({ display_name: displayName })
    .eq('id', user.id)
    .select('id, email, display_name, roles')
    .single();

  if (error) throw error;
  return data as UserProfile;
}

/* ───── Watchlist ───── */
export async function getWatchlist(): Promise<WatchlistItem[]> {
  const { data, error } = await supabase
    .from('watchlist_items')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) throw error;
  return (data ?? []) as WatchlistItem[];
}

export async function addWatchlistItem(payload: {
  item_type: WatchlistItem['item_type'];
  item_id: string;
  label: string;
  notify?: boolean;
}): Promise<WatchlistItem> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const { data, error } = await supabase
    .from('watchlist_items')
    .insert({
      user_id: user.id,
      item_type: payload.item_type,
      item_id: payload.item_id,
      label: payload.label,
      notify: payload.notify ?? true,
    })
    .select()
    .single();

  if (error) {
    // Unique constraint violation → already watching
    if (error.code === '23505') {
      const existing = await supabase
        .from('watchlist_items')
        .select('*')
        .eq('user_id', user.id)
        .eq('item_type', payload.item_type)
        .eq('item_id', payload.item_id)
        .single();
      if (existing.data) return existing.data as WatchlistItem;
    }
    throw error;
  }
  return data as WatchlistItem;
}

export async function removeWatchlistItem(id: number): Promise<void> {
  const { error } = await supabase.from('watchlist_items').delete().eq('id', id);
  if (error) throw error;
}

/* ───── Alerts ───── */
export async function getAlerts(unreadOnly = false): Promise<DataAlert[]> {
  let query = supabase
    .from('data_alerts')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(50);

  if (unreadOnly) {
    query = query.eq('read', false);
  }

  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []) as DataAlert[];
}

export async function markAlertRead(id: number): Promise<void> {
  const { error } = await supabase.from('data_alerts').update({ read: true }).eq('id', id);
  if (error) throw error;
}

export async function markAllAlertsRead(): Promise<void> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const { error } = await supabase
    .from('data_alerts')
    .update({ read: true })
    .eq('user_id', user.id)
    .eq('read', false);

  if (error) throw error;
}

/* ───── Newsletter ───── */
export async function subscribeNewsletter(
  email: string
): Promise<{ status: string; email: string }> {
  // Try insert first; if email exists, update to re-subscribe
  const { error: insertError } = await supabase
    .from('newsletter_subscribers')
    .insert({ email, confirmed: false, subscribed_at: new Date().toISOString() });

  if (insertError) {
    // Unique constraint on email → update the existing row
    if (insertError.code === '23505') {
      const { error: updateError } = await supabase
        .from('newsletter_subscribers')
        .update({
          confirmed: false,
          subscribed_at: new Date().toISOString(),
          unsubscribed_at: null,
        })
        .eq('email', email);
      if (updateError) throw updateError;
      return { status: 'resubscribed', email };
    }
    throw insertError;
  }
  return { status: 'subscribed', email };
}

export async function unsubscribeNewsletter(email: string): Promise<{ status: string }> {
  const { error } = await supabase
    .from('newsletter_subscribers')
    .update({ unsubscribed_at: new Date().toISOString() })
    .eq('email', email);

  if (error) throw error;
  return { status: 'unsubscribed' };
}
