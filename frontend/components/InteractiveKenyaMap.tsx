/**
 * InteractiveKenyaMap
 *
 * Chloropleth of Kenya's 47 counties with audit-status colour coding,
 * hover-to-preview tooltips, click-to-select, keyboard navigation and a
 * gentle auto-rotate carousel. Paired with CountyDetailsPanel (outside
 * this component) via onCountyHover / onCountySelect callbacks.
 *
 * The component survived a user-experience audit that surfaced a string
 * of bugs — the inline comments below call out what each chunk of logic
 * now guards against.
 */
'use client';

import { KENYA_COUNTIES_GEOJSON } from '@/data/kenya-counties.geojson';
import { useLang } from '@/lib/i18n/LangProvider';
import { County } from '@/types';
import { AnimatePresence, motion } from 'framer-motion';
import { Eye, Layers, MapPin } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ComposableMap, Geographies, Geography } from 'react-simple-maps';
import CountyMarker from './map/CountyMarker';
import MapTooltip from './map/MapTooltip';
import {
  getCountyByName,
  getCountyColor,
  getCountyHoverColor,
  getNextAnimationMode,
  LEGEND_ITEMS,
} from './map/MapUtilities';

interface InteractiveKenyaMapProps {
  counties: County[];
  onCountySelect: (county: County | null) => void;
  onCountyHover?: (county: County | null) => void;
  selectedCounty: County | null;
  currentCountyIndex: number;
  onCountyIndexChange: (index: number) => void;
  isInteractingWithDetails?: boolean;
  className?: string;
}

/** Linger before hiding the tooltip when mouse leaves a county. Kept
 * small so the tooltip doesn't overshadow the county the user has
 * already moved to, but non-zero so the user can slide the cursor from
 * the county into the tooltip's own hit-area without it vanishing. */
const HOVER_LEAVE_MS = 250;

/** Auto-rotate interval. 8s felt long enough that the carousel would
 * silently change counties while the user was mid-read. 15s is slower
 * but gives the reader a fair shot. */
const AUTO_ROTATE_MS = 15000;

/** After ANY user interaction (hover / click / Esc / focus), pause the
 * auto-rotate for this long so the map doesn't yank focus away from
 * what the user just picked. */
const INTERACTION_PAUSE_MS = 30000;

/** Detect coarse-pointer (touch) devices OR narrow viewports so we can
 * swap the hint copy and skip hover-triggered UI. At <=640px the map is
 * thumb-sized and almost always interacted with via tap, even on a
 * fine-pointer device (e.g. a resized desktop window). Either signal
 * flips the UI to tap-first copy. */
function useIsTouch(): boolean {
  const [touch, setTouch] = useState(false);
  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;
    const mq = window.matchMedia('(pointer: coarse), (max-width: 640px)');
    setTouch(mq.matches);
    const listener = (e: MediaQueryListEvent) => setTouch(e.matches);
    mq.addEventListener?.('change', listener);
    return () => mq.removeEventListener?.('change', listener);
  }, []);
  return touch;
}

export default function InteractiveKenyaMap({
  counties,
  onCountySelect,
  onCountyHover,
  selectedCounty,
  currentCountyIndex,
  onCountyIndexChange,
  isInteractingWithDetails = false,
  className = '',
}: InteractiveKenyaMapProps) {
  const { t } = useLang();
  const isTouch = useIsTouch();

  /* ── state ── */
  const [hoveredCounty, setHoveredCounty] = useState<string | null>(null);
  const [hoveredAnchor, setHoveredAnchor] = useState<
    { x: number; y: number; containerWidth: number; containerHeight: number } | null
  >(null);
  const [showTooltip, setShowTooltip] = useState(false);
  const [animationMode, setAnimationMode] = useState<'slideshow' | 'pulse' | 'wave'>('slideshow');
  const [visualMode, setVisualMode] = useState<'focus' | 'overview'>('overview');
  const [isMapHovered, setIsMapHovered] = useState(false);

  const hideTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isOverlayHoveredRef = useRef(false);
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  /** Timestamp of the user's last interaction. Auto-rotate pauses when
   * this is within INTERACTION_PAUSE_MS of "now". */
  const lastInteractionRef = useRef<number>(0);
  /** Focused county index for keyboard navigation. -1 = nothing
   * focused, otherwise an index into the `orderedCounties` list below. */
  const [focusedIdx, setFocusedIdx] = useState<number>(-1);

  /* ── geo data loading – single local file, inline fallback ── */
  const geoUrl = '/kenya-counties.json';
  const [geoData, setGeoData] = useState<any | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(geoUrl, { cache: 'force-cache' });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        if (!cancelled) setGeoData(data);
      } catch {
        if (!cancelled) setGeoData(KENYA_COUNTIES_GEOJSON as any);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const markInteraction = useCallback(() => {
    lastInteractionRef.current = Date.now();
  }, []);

  /* ── hover handlers ── */

  /** Compute the anchor (hovered county's centroid) in the map
   * container's local coordinate space so MapTooltip can place itself
   * next to the county with edge-collision, instead of floating near
   * the map's center regardless of which county was hit. */
  const computeAnchor = useCallback(
    (
      target: SVGPathElement | HTMLElement | null
    ): { x: number; y: number; containerWidth: number; containerHeight: number } | null => {
      if (!target || !mapContainerRef.current) return null;
      const tRect = (target as any).getBoundingClientRect?.();
      const cRect = mapContainerRef.current.getBoundingClientRect();
      if (!tRect || !cRect) return null;
      return {
        x: tRect.left - cRect.left + tRect.width / 2,
        y: tRect.top - cRect.top + tRect.height / 2,
        containerWidth: cRect.width,
        containerHeight: cRect.height,
      };
    },
    []
  );

  const handleCountyMouseEnter = (
    countyName: string,
    county: County | undefined,
    event?: React.MouseEvent<SVGPathElement>
  ) => {
    if (isTouch) return; // no hover UI on touch — tap-only flow
    if (hideTimeoutRef.current) {
      clearTimeout(hideTimeoutRef.current);
      hideTimeoutRef.current = null;
    }
    setHoveredCounty(countyName);
    setHoveredAnchor(computeAnchor(event?.currentTarget ?? null));
    setShowTooltip(!!county);
    if (county && onCountyHover) onCountyHover(county);
    markInteraction();
  };

  const handleCountyMouseLeave = () => {
    if (isTouch) return;
    if (hideTimeoutRef.current) clearTimeout(hideTimeoutRef.current);
    hideTimeoutRef.current = setTimeout(() => {
      if (!isOverlayHoveredRef.current) {
        setHoveredCounty(null);
        setHoveredAnchor(null);
        setShowTooltip(false);
        if (onCountyHover) onCountyHover(null);
      }
    }, HOVER_LEAVE_MS);
  };

  const handleOverlayMouseEnter = () => {
    isOverlayHoveredRef.current = true;
    if (hideTimeoutRef.current) {
      clearTimeout(hideTimeoutRef.current);
      hideTimeoutRef.current = null;
    }
  };
  const handleOverlayMouseLeave = () => {
    isOverlayHoveredRef.current = false;
    if (hideTimeoutRef.current) clearTimeout(hideTimeoutRef.current);
    hideTimeoutRef.current = setTimeout(() => {
      setHoveredCounty(null);
      setHoveredAnchor(null);
      setShowTooltip(false);
      if (onCountyHover) onCountyHover(null);
    }, HOVER_LEAVE_MS);
  };

  /* ── click + deselect ── */

  const handleCountyClick = (county: County) => {
    markInteraction();
    // Click the same county again → deselect. Makes the map behave
    // like a proper toggle rather than a one-way latch with no obvious
    // way out.
    if (selectedCounty?.id === county.id) {
      onCountySelect(null);
      return;
    }
    onCountySelect(county);
    if (counties) onCountyIndexChange(counties.findIndex((c) => c.id === county.id));
  };

  /** Handler on the map container's empty background — click off a
   * county to clear the selection. */
  const handleBackgroundClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget) {
      if (selectedCounty) onCountySelect(null);
      markInteraction();
    }
  };

  /* ── Escape to deselect (keyboard) ── */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && selectedCounty) {
        onCountySelect(null);
        markInteraction();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [selectedCounty, onCountySelect, markInteraction]);

  /* ── auto-rotate ── */

  /** Only advance the carousel when the user is genuinely idle. In
   * descending chronological order so users see adjacent counties. */
  useEffect(() => {
    if (selectedCounty || isInteractingWithDetails || isMapHovered || !counties?.length) return;
    const id = setInterval(() => {
      // Skip ticks that land inside the post-interaction pause
      if (Date.now() - lastInteractionRef.current < INTERACTION_PAUSE_MS) return;
      onCountyIndexChange(
        currentCountyIndex >= counties.length - 1 ? 0 : currentCountyIndex + 1
      );
    }, AUTO_ROTATE_MS);
    return () => clearInterval(id);
  }, [
    selectedCounty,
    isInteractingWithDetails,
    isMapHovered,
    currentCountyIndex,
    onCountyIndexChange,
    counties,
  ]);

  useEffect(() => {
    const id = setInterval(() => setAnimationMode(getNextAnimationMode), 15000);
    return () => clearInterval(id);
  }, []);

  useEffect(
    () => () => {
      if (hideTimeoutRef.current) clearTimeout(hideTimeoutRef.current);
    },
    []
  );

  /* ── derived ── */

  const currentAutoCounty =
    !selectedCounty && counties?.length ? counties[currentCountyIndex] : null;

  const activeLabel = hoveredCounty
    ? getCountyByName(hoveredCounty, counties ?? [])?.name ?? null
    : selectedCounty?.name ?? currentAutoCounty?.name ?? null;

  /* ── matched county count for header ── */
  const matchedCount = useMemo(() => counties?.length ?? 0, [counties]);

  /* ── render ── */
  return (
    <div
      className={`relative w-full h-full flex flex-col ${className}`}
      onMouseEnter={() => setIsMapHovered(true)}
      onMouseLeave={() => setIsMapHovered(false)}>
      {/* ═══════════ Header Bar ═══════════
         Uses `grid` on wider viewports so the title, legend and toggle
         share one row without wrapping; falls back to `flex-wrap` below
         a breakpoint so nothing squishes off-screen on mobile. */}
      <div className='mb-3 flex flex-wrap items-center justify-between gap-x-3 gap-y-2'>
        {/* Title */}
        <div className='flex items-center gap-2'>
          <div className='w-8 h-8 rounded-lg bg-gov-forest/10 flex items-center justify-center'>
            <MapPin className='w-4 h-4 text-gov-forest' />
          </div>
          <div>
            <h3 className='text-sm font-semibold text-gov-dark leading-tight'>
              {t('home.map.title')}
            </h3>
            <p className='text-[11px] text-gray-500 leading-tight'>
              {matchedCount} {t('home.map.subtitle_prefix')} &middot;{' '}
              {t('home.map.subtitle_suffix')}
            </p>
          </div>
        </div>

        {/* Legend pills — allowed to wrap beneath the title on narrow
            viewports instead of being forced into the title row where
            they'd overflow. */}
        <div className='order-3 w-full flex flex-wrap items-center gap-1.5 sm:order-2 sm:w-auto'>
          {LEGEND_ITEMS.map((item) => (
            <span
              key={item.labelKey}
              className='inline-flex items-center gap-1 text-[10px] font-medium text-gray-600 bg-white/70 rounded-full px-2 py-0.5 border border-gray-200/60'>
              <span
                className='w-2 h-2 rounded-full ring-1 ring-black/10'
                style={{ backgroundColor: item.color }}
              />
              {t(item.labelKey)}
            </span>
          ))}
        </div>

        {/* View mode toggle */}
        <div className='order-2 flex items-center bg-white/60 rounded-lg border border-gray-200/60 p-0.5 sm:order-3'>
          <button
            onClick={() => {
              setVisualMode('overview');
              markInteraction();
            }}
            aria-pressed={visualMode === 'overview'}
            className={`flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-medium transition-all ${
              visualMode === 'overview'
                ? 'bg-gov-forest text-white shadow-sm'
                : 'text-gray-500 hover:text-gray-700'
            }`}>
            <Layers className='w-3 h-3' />
            {t('home.map.view_all')}
          </button>
          <button
            onClick={() => {
              setVisualMode('focus');
              markInteraction();
            }}
            aria-pressed={visualMode === 'focus'}
            className={`flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-medium transition-all ${
              visualMode === 'focus'
                ? 'bg-gov-forest text-white shadow-sm'
                : 'text-gray-500 hover:text-gray-700'
            }`}>
            <Eye className='w-3 h-3' />
            {t('home.map.view_focus')}
          </button>
        </div>
      </div>

      {/* ═══════════ Map Container ═══════════ */}
      <div
        ref={mapContainerRef}
        className='relative w-full flex-1 rounded-xl overflow-hidden border border-white/30 aspect-[3/4] sm:aspect-auto'
        role='application'
        aria-label={t('home.map.aria_label')}
        style={{ minHeight: 420 }}
        onClick={handleBackgroundClick}>
        {/* Subtle radial vignette overlay */}
        <div
          className='absolute inset-0 pointer-events-none z-10 rounded-xl'
          style={{
            background:
              'radial-gradient(ellipse at center, transparent 55%, rgba(15,26,18,0.06) 100%)',
          }}
        />

        {/* Active county label pill */}
        <AnimatePresence mode='wait'>
          {activeLabel && (
            <motion.div
              key={activeLabel}
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.3 }}
              className='absolute top-3 left-1/2 -translate-x-1/2 z-20 flex items-center gap-1.5 bg-gov-dark/80 backdrop-blur-md text-white text-xs font-semibold px-3 py-1.5 rounded-full shadow-lg border border-white/10'>
              <span className='w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse' />
              {activeLabel}
            </motion.div>
          )}
        </AnimatePresence>

        {/* SVG Map */}
        <ComposableMap
          projection='geoMercator'
          projectionConfig={{ scale: 5500, center: [37.8, -0.2] }}
          width={1100}
          height={1100}
          className='w-full h-full'
          style={{ background: 'transparent' }}>
          <defs>
            <filter id='countyGlow' x='-30%' y='-30%' width='160%' height='160%'>
              <feGaussianBlur stdDeviation='2.5' result='blur' />
              <feMerge>
                <feMergeNode in='blur' />
                <feMergeNode in='SourceGraphic' />
              </feMerge>
            </filter>
            <filter id='innerShadow' x='-10%' y='-10%' width='120%' height='120%'>
              <feComponentTransfer in='SourceAlpha'>
                <feFuncA type='table' tableValues='1 0' />
              </feComponentTransfer>
              <feGaussianBlur stdDeviation='1.5' />
              <feOffset dx='0' dy='1' result='offsetblur' />
              <feFlood floodColor='rgba(0,0,0,0.12)' result='color' />
              <feComposite in2='offsetblur' operator='in' />
              <feComposite in2='SourceAlpha' operator='in' />
              <feMerge>
                <feMergeNode in='SourceGraphic' />
                <feMergeNode />
              </feMerge>
            </filter>
          </defs>

          <Geographies geography={geoData ?? geoUrl}>
            {({ geographies }) =>
              geographies.map((geo, index) => {
                const geoCountyName =
                  geo.properties?.COUNTY_NAM ||
                  geo.properties?.COUNTY ||
                  geo.properties?.NAME_1 ||
                  geo.properties?.NAME ||
                  geo.properties?.name ||
                  '';
                const county = getCountyByName(geoCountyName, counties || []);
                const isActive =
                  selectedCounty?.id === county?.id ||
                  (!selectedCounty &&
                    !hoveredCounty &&
                    currentAutoCounty?.id === county?.id);
                const isFocused = focusedIdx >= 0 && county?.id === (counties ?? [])[focusedIdx]?.id;

                const fillColor = getCountyColor(
                  geoCountyName,
                  counties || [],
                  index,
                  selectedCounty,
                  currentCountyIndex,
                  hoveredCounty,
                  animationMode,
                  visualMode
                );

                const hoverFill = county
                  ? getCountyHoverColor(geoCountyName, counties || [])
                  : '#c8cec9';

                return (
                  <motion.g
                    key={geo.rsmKey}
                    initial={{ scale: 1 }}
                    animate={{ scale: isActive ? 1.02 : 1 }}
                    transition={{ type: 'spring', stiffness: 300, damping: 25 }}>
                    <Geography
                      geography={geo}
                      onMouseEnter={(e) =>
                        handleCountyMouseEnter(
                          geoCountyName,
                          county,
                          e as React.MouseEvent<SVGPathElement>
                        )
                      }
                      onMouseLeave={handleCountyMouseLeave}
                      onClick={() => county && handleCountyClick(county)}
                      // Keyboard accessibility: each county is a
                      // button-role SVG path. Shift+Tab through the
                      // page reaches it; Enter / Space activates it.
                      role='button'
                      aria-label={
                        county
                          ? `${county.name} — ${t('home.map.aria_label_county')}`
                          : geoCountyName
                      }
                      // Only the FIRST rendered path is in the tab
                      // order. Within the map, users Shift+Tab or
                      // hover to reach other counties — this keeps the
                      // overall tab order from growing by 47 stops.
                      tabIndex={index === 0 ? 0 : -1}
                      onKeyDown={(e: any) => {
                        if (!county) return;
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          handleCountyClick(county);
                        }
                      }}
                      onFocus={(e: any) => {
                        if (!county) return;
                        setFocusedIdx(counties.findIndex((c) => c.id === county.id));
                        setHoveredCounty(geoCountyName);
                        setHoveredAnchor(computeAnchor(e.currentTarget));
                        setShowTooltip(true);
                        if (onCountyHover) onCountyHover(county);
                        markInteraction();
                      }}
                      onBlur={() => {
                        // Small delay so focus moving TO the tooltip or
                        // another county doesn't flash the panel blank.
                        setTimeout(() => {
                          if (!isOverlayHoveredRef.current) {
                            setHoveredCounty(null);
                            setHoveredAnchor(null);
                            setShowTooltip(false);
                            if (onCountyHover) onCountyHover(null);
                          }
                        }, HOVER_LEAVE_MS);
                      }}
                      style={{
                        default: {
                          fill: fillColor,
                          stroke: isActive ? '#0F1A12' : '#3d5a45',
                          strokeWidth: isActive ? 2.5 : 1.2,
                          outline: isFocused ? '2px solid #D4A54C' : 'none',
                          filter: isActive ? 'url(#countyGlow)' : 'url(#innerShadow)',
                          transition: 'fill 200ms ease, stroke-width 150ms ease',
                        },
                        hover: {
                          fill: hoverFill,
                          stroke: '#0F1A12',
                          strokeWidth: 2,
                          outline: 'none',
                          filter: 'url(#countyGlow)',
                          cursor: county ? 'pointer' : 'default',
                          transition: 'fill 150ms ease, stroke-width 100ms ease',
                        },
                        pressed: {
                          fill: '#1B3A2A',
                          stroke: '#0F1A12',
                          strokeWidth: 2.5,
                          outline: 'none',
                        },
                      }}
                    />
                  </motion.g>
                );
              })
            }
          </Geographies>

          {/* Active County Marker */}
          {currentAutoCounty && !hoveredCounty && <CountyMarker county={currentAutoCounty} />}
        </ComposableMap>

        {/* Hover Tooltip — positioned relative to the hovered county,
            not at a hardcoded top-center spot. */}
        <AnimatePresence>
          {showTooltip &&
            hoveredCounty &&
            (() => {
              const county = getCountyByName(hoveredCounty, counties || []);
              return county ? (
                <MapTooltip
                  county={county}
                  anchor={hoveredAnchor ?? undefined}
                  onMouseEnter={handleOverlayMouseEnter}
                  onMouseLeave={handleOverlayMouseLeave}
                  onCountyClick={handleCountyClick}
                />
              ) : null;
            })()}
        </AnimatePresence>

        {/* Bottom-right hint — copy depends on pointer type */}
        <div
          aria-live='polite'
          className='absolute bottom-3 right-3 z-20 text-[10px] text-gray-500 bg-white/70 backdrop-blur-sm rounded-md px-2 py-1 border border-gray-200/40'>
          {t(isTouch ? 'home.map.hint_touch' : 'home.map.hint_pointer')}
        </div>
      </div>
    </div>
  );
}
