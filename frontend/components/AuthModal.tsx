'use client';

import { useAuth } from '@/lib/auth/AuthProvider';
import { AnimatePresence, motion } from 'framer-motion';
import { AlertCircle, ArrowRight, Eye, EyeOff, Loader2, Mail, User, X } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';

type Mode = 'login' | 'register';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialMode?: Mode;
}

export default function AuthModal({ isOpen, onClose, initialMode = 'login' }: AuthModalProps) {
  const { login, register } = useAuth();
  const [mode, setMode] = useState<Mode>(initialMode);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Reset form when modal opens/closes
  useEffect(() => {
    if (isOpen) {
      setMode(initialMode);
      setEmail('');
      setPassword('');
      setDisplayName('');
      setError('');
      setShowPassword(false);
    }
  }, [isOpen, initialMode]);

  // Close on ESC
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    if (isOpen) window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [isOpen, onClose]);

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      setError('');
      setIsSubmitting(true);

      try {
        if (mode === 'login') {
          await login(email, password);
        } else {
          await register(email, password, displayName || undefined);
        }
        onClose();
      } catch (err: any) {
        // Supabase AuthError has .message directly
        const msg =
          err?.message ||
          (mode === 'login' ? 'Invalid email or password' : 'Registration failed. Try again.');
        setError(typeof msg === 'string' ? msg : JSON.stringify(msg));
      } finally {
        setIsSubmitting(false);
      }
    },
    [mode, email, password, displayName, login, register, onClose]
  );

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className='fixed inset-0 z-[100] bg-black/50 backdrop-blur-sm'
            onClick={onClose}
          />

          {/* Panel */}
          <motion.div
            initial={{ opacity: 0, x: 60 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 60 }}
            transition={{ type: 'spring', stiffness: 300, damping: 30 }}
            className='fixed right-0 top-0 bottom-0 z-[101] w-full max-w-md overflow-y-auto'>
            <div className='min-h-full bg-gradient-to-b from-gov-dark via-gov-forest to-gov-dark p-8 flex flex-col'>
              {/* Close */}
              <button
                onClick={onClose}
                className='self-end p-2 rounded-full bg-white/10 hover:bg-white/20 text-white/80 hover:text-white transition-colors'>
                <X className='w-5 h-5' />
              </button>

              {/* Header */}
              <div className='mt-8 mb-10'>
                <div className='w-14 h-14 rounded-2xl bg-gov-sage/30 flex items-center justify-center mb-6 border border-gov-sage/40'>
                  <span className='text-2xl' suppressHydrationWarning>
                    🇰🇪
                  </span>
                </div>
                <h2 className='text-2xl font-bold text-white'>
                  {mode === 'login' ? 'Welcome back' : 'Create your account'}
                </h2>
                <p className='text-white/60 mt-2 text-sm'>
                  {mode === 'login'
                    ? 'Sign in to access your watchlist, alerts, and saved data.'
                    : 'Track counties, get data alerts, and export reports.'}
                </p>
              </div>

              {/* Form */}
              <form onSubmit={handleSubmit} className='flex-1 flex flex-col space-y-5'>
                {/* Display name (register only) */}
                <AnimatePresence mode='popLayout'>
                  {mode === 'register' && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.2 }}>
                      <label className='block text-xs font-semibold uppercase tracking-wider text-white/50 mb-1.5'>
                        Display Name
                      </label>
                      <div className='relative'>
                        <User className='absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40' />
                        <input
                          type='text'
                          value={displayName}
                          onChange={(e) => setDisplayName(e.target.value)}
                          placeholder='e.g. Wanjiku'
                          className='w-full pl-10 pr-4 py-3 rounded-xl bg-white/10 border border-white/15 text-white placeholder:text-white/30 focus:outline-none focus:ring-2 focus:ring-gov-sage/60 focus:border-transparent transition-all'
                        />
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Email */}
                <div>
                  <label className='block text-xs font-semibold uppercase tracking-wider text-white/50 mb-1.5'>
                    Email
                  </label>
                  <div className='relative'>
                    <Mail className='absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40' />
                    <input
                      type='email'
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder='your@email.com'
                      className='w-full pl-10 pr-4 py-3 rounded-xl bg-white/10 border border-white/15 text-white placeholder:text-white/30 focus:outline-none focus:ring-2 focus:ring-gov-sage/60 focus:border-transparent transition-all'
                      autoComplete='email'
                    />
                  </div>
                </div>

                {/* Password */}
                <div>
                  <label className='block text-xs font-semibold uppercase tracking-wider text-white/50 mb-1.5'>
                    Password
                  </label>
                  <div className='relative'>
                    <input
                      type={showPassword ? 'text' : 'password'}
                      required
                      minLength={8}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder={
                        mode === 'register'
                          ? 'Min 8 characters'
                          : '\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022'
                      }
                      className='w-full pl-4 pr-12 py-3 rounded-xl bg-white/10 border border-white/15 text-white placeholder:text-white/30 focus:outline-none focus:ring-2 focus:ring-gov-sage/60 focus:border-transparent transition-all'
                      autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                    />
                    <button
                      type='button'
                      onClick={() => setShowPassword(!showPassword)}
                      className='absolute right-3 top-1/2 -translate-y-1/2 text-white/40 hover:text-white/70 transition-colors'>
                      {showPassword ? <EyeOff className='w-4 h-4' /> : <Eye className='w-4 h-4' />}
                    </button>
                  </div>
                </div>

                {/* Error */}
                <AnimatePresence>
                  {error && (
                    <motion.div
                      initial={{ opacity: 0, y: -8 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -8 }}
                      className='flex items-start gap-2 p-3 rounded-xl bg-gov-copper/20 border border-gov-copper/30 text-gov-copper text-sm'>
                      <AlertCircle className='w-4 h-4 mt-0.5 flex-shrink-0' />
                      <span>{error}</span>
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Submit */}
                <button
                  type='submit'
                  disabled={isSubmitting}
                  className='flex items-center justify-center gap-2 w-full py-3.5 rounded-xl bg-gov-sage text-white font-semibold hover:bg-gov-sage/90 active:scale-[0.98] focus:outline-none focus:ring-2 focus:ring-gov-sage/60 focus:ring-offset-2 focus:ring-offset-gov-dark transition-all disabled:opacity-60 disabled:cursor-not-allowed shadow-lg'>
                  {isSubmitting ? (
                    <Loader2 className='w-5 h-5 animate-spin' />
                  ) : (
                    <>
                      {mode === 'login' ? 'Sign In' : 'Create Account'}
                      <ArrowRight className='w-4 h-4' />
                    </>
                  )}
                </button>

                {/* Toggle mode */}
                <p className='text-center text-white/50 text-sm pt-2'>
                  {mode === 'login' ? "Don't have an account?" : 'Already have an account?'}{' '}
                  <button
                    type='button'
                    onClick={() => {
                      setMode(mode === 'login' ? 'register' : 'login');
                      setError('');
                    }}
                    className='text-gov-sage hover:text-gov-gold underline underline-offset-2 font-medium transition-colors'>
                    {mode === 'login' ? 'Sign up' : 'Sign in'}
                  </button>
                </p>
              </form>

              {/* Footer */}
              <div className='mt-10 pt-6 border-t border-white/10'>
                <p className='text-white/30 text-xs text-center'>
                  This app is free and open. Accounts unlock watchlists, alerts, and PDF exports.
                </p>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
