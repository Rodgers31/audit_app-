'use client';

import {
  getAlerts,
  markAlertRead,
  markAllAlertsRead,
  updateProfile,
  type DataAlert,
} from '@/lib/api/auth';
import { useAuth } from '@/lib/auth/AuthProvider';
import { useWatchlist } from '@/lib/auth/WatchlistProvider';
import { AnimatePresence, motion } from 'framer-motion';
import {
  Bell,
  BellOff,
  Bookmark,
  CheckCheck,
  Loader2,
  MapPin,
  Settings,
  Trash2,
  User,
} from 'lucide-react';
import { useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';

type Tab = 'profile' | 'watchlist' | 'alerts';

export default function AccountDashboard() {
  const { user, refreshUser } = useAuth();
  const { items: watchlist, isLoading: watchlistLoading, remove: removeWatch } = useWatchlist();
  const searchParams = useSearchParams();
  const initialTab = (searchParams.get('tab') as Tab) || 'profile';
  const [activeTab, setActiveTab] = useState<Tab>(initialTab);

  // Profile state
  const [displayName, setDisplayName] = useState(user?.display_name || '');
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState('');

  // Alerts state
  const [alerts, setAlerts] = useState<DataAlert[]>([]);
  const [alertsLoading, setAlertsLoading] = useState(false);

  // Load alerts when tab changes
  useEffect(() => {
    if (activeTab === 'alerts') {
      setAlertsLoading(true);
      getAlerts()
        .then(setAlerts)
        .catch(() => {})
        .finally(() => setAlertsLoading(false));
    }
  }, [activeTab]);

  // Save profile
  const handleSaveProfile = useCallback(async () => {
    setSaving(true);
    setSaveMsg('');
    try {
      await updateProfile(displayName);
      await refreshUser();
      setSaveMsg('Saved!');
      setTimeout(() => setSaveMsg(''), 3000);
    } catch {
      setSaveMsg('Failed to save');
    } finally {
      setSaving(false);
    }
  }, [displayName, refreshUser]);

  // Remove watchlist item (via context)
  const handleRemoveWatch = useCallback(
    async (id: number) => {
      try {
        await removeWatch(id);
      } catch {}
    },
    [removeWatch]
  );

  // Mark alert read
  const handleMarkRead = useCallback(async (id: number) => {
    try {
      await markAlertRead(id);
      setAlerts((prev) => prev.map((a) => (a.id === id ? { ...a, read: true } : a)));
    } catch {}
  }, []);

  // Mark all alerts read
  const handleMarkAllRead = useCallback(async () => {
    try {
      await markAllAlertsRead();
      setAlerts((prev) => prev.map((a) => ({ ...a, read: true })));
    } catch {}
  }, []);

  const tabs: { id: Tab; label: string; icon: React.ReactNode }[] = [
    { id: 'profile', label: 'Profile', icon: <User className='w-4 h-4' /> },
    { id: 'watchlist', label: 'Watchlist', icon: <Bookmark className='w-4 h-4' /> },
    { id: 'alerts', label: 'Alerts', icon: <Bell className='w-4 h-4' /> },
  ];

  const unreadCount = alerts.filter((a) => !a.read).length;

  return (
    <div className='max-w-4xl mx-auto px-4 py-8'>
      {/* Tab bar */}
      <div className='flex gap-1 bg-white/60 backdrop-blur-md border border-gov-sage/20 p-1 rounded-2xl mb-8 shadow-sm'>
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-2 flex-1 justify-center py-3 px-4 rounded-xl text-sm font-semibold transition-all relative ${
              activeTab === tab.id
                ? 'bg-gov-forest text-white shadow-md'
                : 'text-gov-forest/70 hover:bg-gov-sage/10'
            }`}>
            {tab.icon}
            {tab.label}
            {tab.id === 'alerts' && unreadCount > 0 && (
              <span className='absolute -top-1 -right-1 w-5 h-5 bg-gov-copper text-white text-[10px] font-bold rounded-full flex items-center justify-center'>
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <AnimatePresence mode='wait'>
        {/* ──── Profile ──── */}
        {activeTab === 'profile' && (
          <motion.div
            key='profile'
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            className='bg-white/80 backdrop-blur-md border border-gov-sage/15 rounded-2xl p-6 shadow-sm'>
            <div className='flex items-center gap-4 mb-8'>
              <div className='w-16 h-16 rounded-2xl bg-gradient-to-br from-gov-sage to-gov-forest flex items-center justify-center text-white text-2xl font-bold shadow-lg'>
                {(user?.display_name || user?.email || 'C')[0].toUpperCase()}
              </div>
              <div>
                <h2 className='text-xl font-bold text-gov-dark'>
                  {user?.display_name || 'Citizen'}
                </h2>
                <p className='text-gov-forest/60 text-sm'>{user?.email}</p>
              </div>
            </div>

            <div className='space-y-5'>
              <div>
                <label className='block text-xs font-semibold uppercase tracking-wider text-gov-forest/50 mb-1.5'>
                  Display Name
                </label>
                <input
                  type='text'
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  className='w-full px-4 py-3 rounded-xl bg-gov-sand/60 border border-gov-sage/20 text-gov-dark placeholder:text-gov-forest/30 focus:outline-none focus:ring-2 focus:ring-gov-sage/40 transition-all'
                  placeholder='Your display name'
                />
              </div>

              <div className='flex items-center gap-3'>
                <button
                  onClick={handleSaveProfile}
                  disabled={saving}
                  className='flex items-center gap-2 px-6 py-3 rounded-xl bg-gov-sage text-white font-semibold hover:bg-gov-sage/90 active:scale-[0.98] transition-all disabled:opacity-60 shadow-md'>
                  {saving ? (
                    <Loader2 className='w-4 h-4 animate-spin' />
                  ) : (
                    <Settings className='w-4 h-4' />
                  )}
                  Save Changes
                </button>
                {saveMsg && (
                  <span
                    className={`text-sm font-medium ${
                      saveMsg === 'Saved!' ? 'text-green-600' : 'text-gov-copper'
                    }`}>
                    {saveMsg}
                  </span>
                )}
              </div>
            </div>

            {/* Role badges */}
            <div className='mt-8 pt-6 border-t border-gov-sage/10'>
              <p className='text-xs font-semibold uppercase tracking-wider text-gov-forest/40 mb-2'>
                Roles
              </p>
              <div className='flex flex-wrap gap-2'>
                {user?.roles.map((role) => (
                  <span
                    key={role}
                    className='px-3 py-1 bg-gov-sage/15 text-gov-forest text-xs font-semibold rounded-full border border-gov-sage/20'>
                    {role}
                  </span>
                ))}
              </div>
            </div>
          </motion.div>
        )}

        {/* ──── Watchlist ──── */}
        {activeTab === 'watchlist' && (
          <motion.div
            key='watchlist'
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}>
            {watchlistLoading ? (
              <div className='flex justify-center py-20'>
                <Loader2 className='w-6 h-6 animate-spin text-gov-sage' />
              </div>
            ) : watchlist.length === 0 ? (
              <div className='text-center py-20 bg-white/60 backdrop-blur-md rounded-2xl border border-gov-sage/15'>
                <Bookmark className='w-12 h-12 mx-auto text-gov-sage/30 mb-4' />
                <h3 className='text-lg font-bold text-gov-dark mb-2'>No items yet</h3>
                <p className='text-gov-forest/50 text-sm max-w-md mx-auto'>
                  Browse County Explorer or Budget & Spending and tap the{' '}
                  <Bookmark className='inline w-4 h-4 align-text-bottom' /> button to start tracking
                  items.
                </p>
              </div>
            ) : (
              <div className='space-y-3'>
                {watchlist.map((item) => (
                  <motion.div
                    key={item.id}
                    layout
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, x: -40 }}
                    className='flex items-center justify-between p-4 bg-white/80 backdrop-blur-md border border-gov-sage/15 rounded-xl shadow-sm hover:shadow-md transition-shadow'>
                    <div className='flex items-center gap-3'>
                      <div
                        className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                          item.item_type === 'county'
                            ? 'bg-gov-sage/15 text-gov-sage'
                            : 'bg-gov-gold/15 text-gov-gold'
                        }`}>
                        <MapPin className='w-5 h-5' />
                      </div>
                      <div>
                        <p className='font-semibold text-gov-dark text-sm'>{item.label}</p>
                        <p className='text-xs text-gov-forest/50 capitalize'>
                          {item.item_type.replace('_', ' ')}
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={() => handleRemoveWatch(item.id)}
                      className='p-2 text-gov-copper/60 hover:text-gov-copper hover:bg-gov-copper/10 rounded-lg transition-colors'
                      title='Remove from watchlist'>
                      <Trash2 className='w-4 h-4' />
                    </button>
                  </motion.div>
                ))}
              </div>
            )}
          </motion.div>
        )}

        {/* ──── Alerts ──── */}
        {activeTab === 'alerts' && (
          <motion.div
            key='alerts'
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}>
            {alertsLoading ? (
              <div className='flex justify-center py-20'>
                <Loader2 className='w-6 h-6 animate-spin text-gov-sage' />
              </div>
            ) : alerts.length === 0 ? (
              <div className='text-center py-20 bg-white/60 backdrop-blur-md rounded-2xl border border-gov-sage/15'>
                <BellOff className='w-12 h-12 mx-auto text-gov-sage/30 mb-4' />
                <h3 className='text-lg font-bold text-gov-dark mb-2'>No alerts</h3>
                <p className='text-gov-forest/50 text-sm max-w-md mx-auto'>
                  When data changes for your watchlist items, you&apos;ll see notifications here.
                </p>
              </div>
            ) : (
              <>
                {unreadCount > 0 && (
                  <div className='flex justify-end mb-4'>
                    <button
                      onClick={handleMarkAllRead}
                      className='flex items-center gap-1.5 text-xs font-semibold text-gov-sage hover:text-gov-forest transition-colors'>
                      <CheckCheck className='w-4 h-4' />
                      Mark all read
                    </button>
                  </div>
                )}
                <div className='space-y-3'>
                  {alerts.map((alert) => (
                    <motion.div
                      key={alert.id}
                      layout
                      className={`p-4 rounded-xl border transition-all cursor-pointer ${
                        alert.read
                          ? 'bg-white/60 border-gov-sage/10 opacity-70'
                          : 'bg-white/90 border-gov-sage/20 shadow-sm'
                      }`}
                      onClick={() => !alert.read && handleMarkRead(alert.id)}>
                      <div className='flex items-start gap-3'>
                        {!alert.read && (
                          <div className='w-2.5 h-2.5 rounded-full bg-gov-sage mt-1.5 flex-shrink-0' />
                        )}
                        <div className='flex-1 min-w-0'>
                          <p className='font-semibold text-gov-dark text-sm'>{alert.title}</p>
                          {alert.body && (
                            <p className='text-gov-forest/60 text-xs mt-1 line-clamp-2'>
                              {alert.body}
                            </p>
                          )}
                          <p className='text-gov-forest/40 text-xs mt-2'>
                            {new Date(alert.created_at).toLocaleDateString('en-KE', {
                              day: 'numeric',
                              month: 'short',
                              year: 'numeric',
                            })}
                          </p>
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </div>
              </>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
