/**
 * WatchlistProvider – Shared watchlist context.
 *
 * Fetches the user's watchlist ONCE when authenticated and exposes
 * helpers so every <WatchButton> reads from memory instead of
 * hitting Supabase individually (eliminates N+1 queries).
 */
'use client';

import {
  addWatchlistItem,
  getWatchlist,
  removeWatchlistItem,
  type WatchlistItem,
} from '@/lib/api/auth';
import { useAuth } from '@/lib/auth/AuthProvider';
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

/* ───── Context shape ───── */
interface WatchlistContextValue {
  /** Full watchlist array */
  items: WatchlistItem[];
  /** True while initial fetch is in-flight */
  isLoading: boolean;
  /** Check whether a specific item is being watched */
  isWatching: (itemType: WatchlistItem['item_type'], itemId: string) => boolean;
  /** Get the watchlist row id for a watched item (for removal) */
  watchId: (itemType: WatchlistItem['item_type'], itemId: string) => number | null;
  /** Add an item to the watchlist (optimistic) */
  add: (payload: {
    item_type: WatchlistItem['item_type'];
    item_id: string;
    label: string;
  }) => Promise<WatchlistItem>;
  /** Remove an item by its watchlist row id (optimistic) */
  remove: (id: number) => Promise<void>;
  /** Force re-fetch from Supabase */
  refresh: () => Promise<void>;
}

const WatchlistContext = createContext<WatchlistContextValue | undefined>(undefined);

/* ───── Provider ───── */
export function WatchlistProvider({ children }: { children: React.ReactNode }) {
  const { isAuthenticated } = useAuth();
  const [items, setItems] = useState<WatchlistItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  // Fetch once when user signs in; clear on sign out
  useEffect(() => {
    if (!isAuthenticated) {
      setItems([]);
      return;
    }
    setIsLoading(true);
    getWatchlist()
      .then(setItems)
      .catch(() => setItems([]))
      .finally(() => setIsLoading(false));
  }, [isAuthenticated]);

  const isWatching = useCallback(
    (itemType: WatchlistItem['item_type'], itemId: string) =>
      items.some((w) => w.item_type === itemType && w.item_id === itemId),
    [items]
  );

  const watchIdFn = useCallback(
    (itemType: WatchlistItem['item_type'], itemId: string): number | null => {
      const match = items.find((w) => w.item_type === itemType && w.item_id === itemId);
      return match?.id ?? null;
    },
    [items]
  );

  const add = useCallback(
    async (payload: { item_type: WatchlistItem['item_type']; item_id: string; label: string }) => {
      const item = await addWatchlistItem(payload);
      setItems((prev) => [...prev, item]);
      return item;
    },
    []
  );

  const remove = useCallback(async (id: number) => {
    await removeWatchlistItem(id);
    setItems((prev) => prev.filter((w) => w.id !== id));
  }, []);

  const refresh = useCallback(async () => {
    try {
      const fresh = await getWatchlist();
      setItems(fresh);
    } catch {
      // keep stale data on failure
    }
  }, []);

  const value = useMemo<WatchlistContextValue>(
    () => ({ items, isLoading, isWatching, watchId: watchIdFn, add, remove, refresh }),
    [items, isLoading, isWatching, watchIdFn, add, remove, refresh]
  );

  return <WatchlistContext.Provider value={value}>{children}</WatchlistContext.Provider>;
}

/* ───── Hook ───── */
export function useWatchlist() {
  const ctx = useContext(WatchlistContext);
  if (!ctx) throw new Error('useWatchlist must be used within <WatchlistProvider>');
  return ctx;
}
