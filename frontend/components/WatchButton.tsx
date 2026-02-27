'use client';

import {
  addWatchlistItem,
  getWatchlist,
  removeWatchlistItem,
  type WatchlistItem,
} from '@/lib/api/auth';
import { useAuth } from '@/lib/auth/AuthProvider';
import { AnimatePresence, motion } from 'framer-motion';
import { Bookmark, BookmarkCheck, Loader2 } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';

interface WatchButtonProps {
  itemType: WatchlistItem['item_type'];
  itemId: string;
  label: string;
  /** Render as compact icon-only (for cards) vs full button */
  compact?: boolean;
  className?: string;
}

/**
 * Reusable "Watch / Unwatch" toggle.
 *
 * Place on any county card, budget category, or national item.
 * When the user is NOT logged in, clicking opens the auth modal
 * (handled via a custom event so AuthModal can listen).
 */
export default function WatchButton({
  itemType,
  itemId,
  label,
  compact = false,
  className = '',
}: WatchButtonProps) {
  const { isAuthenticated } = useAuth();
  const [watching, setWatching] = useState(false);
  const [watchId, setWatchId] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);

  // Check if already watching (only when authenticated)
  useEffect(() => {
    if (!isAuthenticated) return;
    getWatchlist()
      .then((items) => {
        const match = items.find((w) => w.item_type === itemType && w.item_id === itemId);
        if (match) {
          setWatching(true);
          setWatchId(match.id);
        }
      })
      .catch(() => {});
  }, [isAuthenticated, itemType, itemId]);

  const handleToggle = useCallback(async () => {
    if (!isAuthenticated) {
      // Dispatch event for AuthModal to open
      window.dispatchEvent(new CustomEvent('open-auth-modal'));
      return;
    }
    setLoading(true);
    try {
      if (watching && watchId) {
        await removeWatchlistItem(watchId);
        setWatching(false);
        setWatchId(null);
      } else {
        const item = await addWatchlistItem({ item_type: itemType, item_id: itemId, label });
        setWatching(true);
        setWatchId(item.id);
      }
    } catch {
      // 409 = already watching
    } finally {
      setLoading(false);
    }
  }, [isAuthenticated, watching, watchId, itemType, itemId, label]);

  if (compact) {
    return (
      <button
        onClick={handleToggle}
        disabled={loading}
        title={watching ? 'Remove from watchlist' : 'Add to watchlist'}
        className={`p-2 rounded-lg transition-all ${
          watching
            ? 'text-gov-gold bg-gov-gold/15 hover:bg-gov-gold/25'
            : 'text-gov-forest/40 hover:text-gov-sage hover:bg-gov-sage/10'
        } disabled:opacity-50 ${className}`}>
        {loading ? (
          <Loader2 className='w-4 h-4 animate-spin' />
        ) : watching ? (
          <BookmarkCheck className='w-4 h-4' />
        ) : (
          <Bookmark className='w-4 h-4' />
        )}
      </button>
    );
  }

  return (
    <motion.button
      onClick={handleToggle}
      disabled={loading}
      whileTap={{ scale: 0.96 }}
      className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all border ${
        watching
          ? 'bg-gov-gold/15 text-gov-gold border-gov-gold/30 hover:bg-gov-gold/25'
          : 'bg-white/80 text-gov-forest/70 border-gov-sage/20 hover:bg-gov-sage/10 hover:text-gov-sage'
      } disabled:opacity-50 shadow-sm ${className}`}>
      <AnimatePresence mode='wait'>
        {loading ? (
          <motion.span
            key='loading'
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}>
            <Loader2 className='w-4 h-4 animate-spin' />
          </motion.span>
        ) : watching ? (
          <motion.span
            key='watching'
            initial={{ scale: 0.5, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}>
            <BookmarkCheck className='w-4 h-4' />
          </motion.span>
        ) : (
          <motion.span
            key='not-watching'
            initial={{ scale: 0.5, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}>
            <Bookmark className='w-4 h-4' />
          </motion.span>
        )}
      </AnimatePresence>
      {watching ? 'Watching' : 'Watch'}
    </motion.button>
  );
}
