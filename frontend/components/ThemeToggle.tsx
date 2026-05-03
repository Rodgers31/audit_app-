/**
 * ThemeToggle — pill button that cycles System → Light → Dark.
 *
 * Persists the choice in ``localStorage["theme"]`` so reloads
 * remember it. ``'system'`` (the default for first-time visitors)
 * means "follow the OS"; explicit ``'light'`` / ``'dark'`` override.
 *
 * Pairs with the no-flash boot script in app/layout.tsx — that
 * script sets the right ``<html>`` class BEFORE React hydrates so
 * there's no light-then-dark flicker on a dark-mode user's first
 * paint. After hydration this component is the source of truth.
 */
'use client';

import { Monitor, Moon, Sun } from 'lucide-react';
import { useEffect, useState } from 'react';

type ThemeMode = 'system' | 'light' | 'dark';

const STORAGE_KEY = 'theme';

function readStored(): ThemeMode {
  if (typeof window === 'undefined') return 'system';
  const v = window.localStorage.getItem(STORAGE_KEY);
  return v === 'light' || v === 'dark' ? v : 'system';
}

function applyToHtml(mode: ThemeMode) {
  const root = document.documentElement;
  const systemDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  const shouldBeDark = mode === 'dark' || (mode === 'system' && systemDark);
  root.classList.toggle('dark', shouldBeDark);
}

export default function ThemeToggle({ className = '' }: { className?: string }) {
  // ``mounted`` guards against rendering the wrong icon during the
  // SSR pass — server doesn't know about localStorage. Until the
  // first effect runs we render a neutral placeholder so the
  // hydrated client-vs-server markup stays in sync.
  const [mounted, setMounted] = useState(false);
  const [mode, setMode] = useState<ThemeMode>('system');

  useEffect(() => {
    const initial = readStored();
    setMode(initial);
    applyToHtml(initial);
    setMounted(true);

    // Re-apply when the OS preference changes IF the user is in
    // ``system`` mode (an explicit choice should keep winning).
    const mql = window.matchMedia('(prefers-color-scheme: dark)');
    const onChange = () => {
      if (readStored() === 'system') applyToHtml('system');
    };
    mql.addEventListener('change', onChange);
    return () => mql.removeEventListener('change', onChange);
  }, []);

  function cycle() {
    const next: ThemeMode =
      mode === 'system' ? 'dark' : mode === 'dark' ? 'light' : 'system';
    setMode(next);
    if (next === 'system') {
      window.localStorage.removeItem(STORAGE_KEY);
    } else {
      window.localStorage.setItem(STORAGE_KEY, next);
    }
    applyToHtml(next);
  }

  // Keep the layout stable during hydration: render a same-sized
  // button that matches the live one's ring/padding so there's no
  // shift when the icon swaps in.
  const baseClass =
    'p-2 rounded-full bg-white/5 hover:bg-white/10 text-white/80 hover:text-white transition-colors border border-white/10 backdrop-blur-sm flex items-center justify-center';

  if (!mounted) {
    return (
      <button
        type='button'
        className={`${baseClass} ${className}`}
        aria-hidden='true'
        tabIndex={-1}>
        <Monitor className='w-5 h-5 opacity-0' />
      </button>
    );
  }

  const { Icon, label, hint } = (() => {
    if (mode === 'light')
      return { Icon: Sun, label: 'Light theme', hint: 'Switch to dark theme' };
    if (mode === 'dark')
      return { Icon: Moon, label: 'Dark theme', hint: 'Switch to system theme' };
    return { Icon: Monitor, label: 'System theme', hint: 'Switch to dark theme' };
  })();

  return (
    <button
      type='button'
      onClick={cycle}
      title={hint}
      aria-label={label}
      className={`${baseClass} ${className}`}>
      <Icon className='w-5 h-5' />
    </button>
  );
}
