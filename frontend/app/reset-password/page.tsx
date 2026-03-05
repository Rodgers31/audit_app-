'use client';

import { useAuth } from '@/lib/auth/AuthProvider';
import { AnimatePresence, motion } from 'framer-motion';
import {
  AlertCircle,
  ArrowRight,
  CheckCircle2,
  Eye,
  EyeOff,
  Loader2,
  Lock,
  ShieldCheck,
} from 'lucide-react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Suspense, useCallback, useState } from 'react';

/* ── Minimum password requirements ── */
function getPasswordStrength(pw: string) {
  const checks = [
    { label: 'At least 8 characters', met: pw.length >= 8 },
    { label: 'Contains a number', met: /\d/.test(pw) },
    { label: 'Contains uppercase letter', met: /[A-Z]/.test(pw) },
    { label: 'Contains lowercase letter', met: /[a-z]/.test(pw) },
  ];
  return checks;
}

function ResetPasswordForm() {
  const { updatePassword, isAuthenticated, isLoading: authLoading } = useAuth();
  const searchParams = useSearchParams();
  const linkError = searchParams.get('error');

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [error, setError] = useState(linkError || '');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);

  const strength = getPasswordStrength(password);
  const allMet = strength.every((c) => c.met);
  const passwordsMatch = password === confirmPassword && confirmPassword.length > 0;

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      setError('');

      if (!allMet) {
        setError('Password does not meet all requirements.');
        return;
      }
      if (!passwordsMatch) {
        setError('Passwords do not match.');
        return;
      }

      setIsSubmitting(true);
      try {
        await updatePassword(password);
        setSuccess(true);
      } catch (err: any) {
        setError(
          err?.message ||
            'Failed to update password. The link may have expired — please request a new one.'
        );
      } finally {
        setIsSubmitting(false);
      }
    },
    [password, confirmPassword, allMet, passwordsMatch, updatePassword]
  );

  // If auth is still loading, show spinner
  if (authLoading) {
    return (
      <div className='flex items-center justify-center min-h-[60vh]'>
        <Loader2 className='w-8 h-8 animate-spin text-gov-sage' />
      </div>
    );
  }

  return (
    <div className='min-h-screen bg-gradient-to-b from-gov-cream to-white flex items-center justify-center px-4 py-16'>
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className='w-full max-w-md'>
        {/* Card */}
        <div className='bg-white rounded-2xl shadow-xl border border-gov-sage/10 overflow-hidden'>
          {/* Header band */}
          <div className='bg-gradient-to-r from-gov-dark to-gov-forest px-6 py-8 text-center'>
            <div className='w-14 h-14 rounded-2xl bg-white/10 flex items-center justify-center mx-auto mb-4 border border-white/20'>
              <ShieldCheck className='w-7 h-7 text-gov-gold' />
            </div>
            <h1 className='text-xl font-bold text-white'>
              {success ? 'Password Updated' : 'Choose a New Password'}
            </h1>
            <p className='text-white/60 text-sm mt-2'>
              {success
                ? 'Your password has been reset successfully.'
                : 'Enter your new password below. Make it strong and unique.'}
            </p>
          </div>

          <div className='p-6'>
            {/* ── Success state ── */}
            {success ? (
              <motion.div
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                className='text-center'>
                <CheckCircle2 className='w-16 h-16 mx-auto text-gov-sage mb-4' />
                <p className='text-gov-forest/70 text-sm mb-6'>
                  You can now sign in with your new password. Your account is secure.
                </p>
                <Link
                  href='/'
                  className='inline-flex items-center gap-2 px-6 py-3 bg-gov-sage text-white font-semibold rounded-xl hover:bg-gov-sage/90 transition-colors shadow-md'>
                  Go to Homepage
                  <ArrowRight className='w-4 h-4' />
                </Link>
              </motion.div>
            ) : linkError && !isAuthenticated ? (
              /* ── Link-error state (expired/invalid token) ── */
              <motion.div
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                className='text-center'>
                <AlertCircle className='w-16 h-16 mx-auto text-gov-copper/60 mb-4' />
                <p className='text-gov-copper text-sm font-medium mb-2'>{linkError}</p>
                <p className='text-gov-forest/50 text-xs mb-6'>
                  Password reset links expire after 1 hour for security.
                </p>
                <Link
                  href='/'
                  className='inline-flex items-center gap-2 px-6 py-3 bg-gov-sage text-white font-semibold rounded-xl hover:bg-gov-sage/90 transition-colors shadow-md'>
                  Back to Homepage
                  <ArrowRight className='w-4 h-4' />
                </Link>
              </motion.div>
            ) : (
              /* ── Password form ── */
              <form onSubmit={handleSubmit} className='space-y-5'>
                {/* New Password */}
                <div>
                  <label className='block text-xs font-semibold uppercase tracking-wider text-gov-forest/50 mb-1.5'>
                    New Password
                  </label>
                  <div className='relative'>
                    <Lock className='absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gov-forest/30' />
                    <input
                      type={showPassword ? 'text' : 'password'}
                      required
                      minLength={8}
                      value={password}
                      onChange={(e) => {
                        setPassword(e.target.value);
                        setError('');
                      }}
                      placeholder='Enter new password'
                      className='w-full pl-10 pr-12 py-3 rounded-xl bg-gov-cream/40 border border-gov-sage/20 text-gov-dark placeholder:text-gov-forest/30 focus:outline-none focus:ring-2 focus:ring-gov-sage/40 focus:border-transparent transition-all'
                      autoComplete='new-password'
                    />
                    <button
                      type='button'
                      onClick={() => setShowPassword(!showPassword)}
                      className='absolute right-3 top-1/2 -translate-y-1/2 text-gov-forest/30 hover:text-gov-forest/60 transition-colors'>
                      {showPassword ? <EyeOff className='w-4 h-4' /> : <Eye className='w-4 h-4' />}
                    </button>
                  </div>
                </div>

                {/* Password strength indicators */}
                {password.length > 0 && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    className='space-y-1.5'>
                    {strength.map((check) => (
                      <div key={check.label} className='flex items-center gap-2 text-xs'>
                        <div
                          className={`w-1.5 h-1.5 rounded-full transition-colors ${
                            check.met ? 'bg-gov-sage' : 'bg-gov-forest/20'
                          }`}
                        />
                        <span
                          className={
                            check.met ? 'text-gov-sage font-medium' : 'text-gov-forest/40'
                          }>
                          {check.label}
                        </span>
                      </div>
                    ))}
                  </motion.div>
                )}

                {/* Confirm Password */}
                <div>
                  <label className='block text-xs font-semibold uppercase tracking-wider text-gov-forest/50 mb-1.5'>
                    Confirm Password
                  </label>
                  <div className='relative'>
                    <Lock className='absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gov-forest/30' />
                    <input
                      type={showConfirm ? 'text' : 'password'}
                      required
                      minLength={8}
                      value={confirmPassword}
                      onChange={(e) => {
                        setConfirmPassword(e.target.value);
                        setError('');
                      }}
                      placeholder='Re-enter new password'
                      className={`w-full pl-10 pr-12 py-3 rounded-xl bg-gov-cream/40 border text-gov-dark placeholder:text-gov-forest/30 focus:outline-none focus:ring-2 focus:ring-gov-sage/40 focus:border-transparent transition-all ${
                        confirmPassword.length > 0 && !passwordsMatch
                          ? 'border-gov-copper/40'
                          : confirmPassword.length > 0 && passwordsMatch
                            ? 'border-gov-sage/40'
                            : 'border-gov-sage/20'
                      }`}
                      autoComplete='new-password'
                    />
                    <button
                      type='button'
                      onClick={() => setShowConfirm(!showConfirm)}
                      className='absolute right-3 top-1/2 -translate-y-1/2 text-gov-forest/30 hover:text-gov-forest/60 transition-colors'>
                      {showConfirm ? <EyeOff className='w-4 h-4' /> : <Eye className='w-4 h-4' />}
                    </button>
                  </div>
                  {confirmPassword.length > 0 && !passwordsMatch && (
                    <p className='text-gov-copper text-xs mt-1.5'>Passwords do not match</p>
                  )}
                </div>

                {/* Error */}
                <AnimatePresence>
                  {error && !linkError && (
                    <motion.div
                      initial={{ opacity: 0, y: -8 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -8 }}
                      className='flex items-start gap-2 p-3 rounded-xl bg-gov-copper/10 border border-gov-copper/20 text-gov-copper text-sm'>
                      <AlertCircle className='w-4 h-4 mt-0.5 flex-shrink-0' />
                      <span>{error}</span>
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Submit */}
                <button
                  type='submit'
                  disabled={isSubmitting || !allMet || !passwordsMatch}
                  className='flex items-center justify-center gap-2 w-full py-3.5 rounded-xl bg-gov-sage text-white font-semibold hover:bg-gov-sage/90 active:scale-[0.98] focus:outline-none focus:ring-2 focus:ring-gov-sage/40 focus:ring-offset-2 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg'>
                  {isSubmitting ? (
                    <Loader2 className='w-5 h-5 animate-spin' />
                  ) : (
                    <>
                      Reset Password
                      <ArrowRight className='w-4 h-4' />
                    </>
                  )}
                </button>
              </form>
            )}
          </div>
        </div>

        {/* Security note */}
        <p className='text-center text-gov-forest/30 text-xs mt-6'>
          For your security, password reset links expire after 1 hour.
          <br />
          If you didn&apos;t request this reset, you can safely ignore this page.
        </p>
      </motion.div>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense
      fallback={
        <div className='flex items-center justify-center min-h-screen'>
          <Loader2 className='w-8 h-8 animate-spin text-gov-sage' />
        </div>
      }>
      <ResetPasswordForm />
    </Suspense>
  );
}
