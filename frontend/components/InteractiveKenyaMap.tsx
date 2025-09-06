/**
 * InteractiveKenyaMap - Main map component with county selection and hover interactions
 * Displays Kenya counties with financial health color coding and interactive tooltips
 */
'use client';

import { KENYA_COUNTIES_GEOJSON } from '@/data/kenya-counties.geojson';
import { County } from '@/types';
import { AnimatePresence, motion } from 'framer-motion';
import { useEffect, useRef, useState } from 'react';
import { ComposableMap, Geographies, Geography } from 'react-simple-maps';
import CountyMarker from './map/CountyMarker';
import MapTooltip from './map/MapTooltip';
import { getCountyByName, getCountyColor, getNextAnimationMode } from './map/MapUtilities';

interface InteractiveKenyaMapProps {
  counties: County[];
  onCountySelect: (county: County) => void;
  selectedCounty: County | null;
  currentCountyIndex: number;
  onCountyIndexChange: (index: number) => void;
  isInteractingWithDetails?: boolean;
  className?: string;
}

export default function InteractiveKenyaMap({
  counties,
  onCountySelect,
  selectedCounty,
  currentCountyIndex,
  onCountyIndexChange,
  isInteractingWithDetails = false,
  className = '',
}: InteractiveKenyaMapProps) {
  // Hover and tooltip state
  const [hoveredCounty, setHoveredCounty] = useState<string | null>(null);
  const [showTooltip, setShowTooltip] = useState(false);
  const [animationMode, setAnimationMode] = useState<'slideshow' | 'pulse' | 'wave'>('slideshow');
  const [visualMode, setVisualMode] = useState<'focus' | 'overview'>('focus');
  const [hideTimeoutId, setHideTimeoutId] = useState<NodeJS.Timeout | null>(null);

  // Refs for tracking hover state during timeouts
  const isOverlayHoveredRef = useRef(false);
  const isProcessingLeaveRef = useRef(false);

  // Kenya Geo/TopoJSON sources (with fallback)
  const externalTopoUrl =
    'https://raw.githubusercontent.com/deldersveld/topojson/master/countries/kenya/kenya-counties.json';
  const localGeoUrl = '/kenya_counties_official.json'; // optional local full dataset if provided
  const placeholderGeoUrl = '/kenya-counties.json'; // minimal placeholder (in repo)

  const [geoData, setGeoData] = useState<any | null>(null);

  // Load map data with resilient fallbacks
  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      const tryFetch = async (url: string) => {
        try {
          const res = await fetch(url, { cache: 'force-cache' });
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          return await res.json();
        } catch (e) {
          return null;
        }
      };

      // 1) External TopoJSON
      const ext = await tryFetch(externalTopoUrl);
      if (!cancelled && ext) return setGeoData(ext);

      // 2) Local official dataset (if present)
      const local = await tryFetch(localGeoUrl);
      if (!cancelled && local) return setGeoData(local);

      // 3) Repo placeholder (simple boxes)
      const placeholder = await tryFetch(placeholderGeoUrl);
      if (!cancelled && placeholder) return setGeoData(placeholder);

      // 4) Embedded minimal fallback (ensures something renders offline)
      if (!cancelled) setGeoData(KENYA_COUNTIES_GEOJSON as any);
    };

    load();
    return () => {
      cancelled = true;
    };
  }, []);

  // Handle visualization mode change
  const handleVisualizationModeChange = (mode: 'focus' | 'overview') => {
    setVisualMode(mode);
  };

  // Handle county hover start - show tooltip immediately
  const handleCountyMouseEnter = (countyName: string, county: any) => {
    if (hideTimeoutId) {
      clearTimeout(hideTimeoutId);
      setHideTimeoutId(null);
    }

    isProcessingLeaveRef.current = false;
    setHoveredCounty(countyName);
    setShowTooltip(!!county);
  };

  // Handle county hover end - hide tooltip with delay
  const handleCountyMouseLeave = () => {
    if (isProcessingLeaveRef.current) return;

    isProcessingLeaveRef.current = true;

    if (hideTimeoutId) {
      clearTimeout(hideTimeoutId);
      setHideTimeoutId(null);
    }

    // Hide after 1 second unless hovering overlay
    const timeoutId = setTimeout(() => {
      if (!isOverlayHoveredRef.current) {
        setHoveredCounty(null);
        setShowTooltip(false);
      }
      isProcessingLeaveRef.current = false;
    }, 1000);

    setHideTimeoutId(timeoutId);
  };

  // Handle tooltip overlay hover - prevent hiding
  const handleOverlayMouseEnter = () => {
    isOverlayHoveredRef.current = true;
    if (hideTimeoutId) {
      clearTimeout(hideTimeoutId);
      setHideTimeoutId(null);
    }
  };

  // Handle tooltip overlay leave - start hide timer
  const handleOverlayMouseLeave = () => {
    isOverlayHoveredRef.current = false;
    const timeoutId = setTimeout(() => {
      setHoveredCounty(null);
      setShowTooltip(false);
    }, 1500);
    setHideTimeoutId(timeoutId);
  };

  // Auto-rotate through counties when not manually selected
  useEffect(() => {
    if (selectedCounty || isInteractingWithDetails || !counties || counties.length === 0) return;

    const interval = setInterval(() => {
      const nextIndex = currentCountyIndex === 0 ? counties.length - 1 : currentCountyIndex - 1;
      onCountyIndexChange(nextIndex);
    }, 4000);

    return () => clearInterval(interval);
  }, [selectedCounty, isInteractingWithDetails, currentCountyIndex, onCountyIndexChange, counties]);

  // Cycle animation modes every 15 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      setAnimationMode(getNextAnimationMode);
    }, 15000);

    return () => clearInterval(interval);
  }, []);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (hideTimeoutId) clearTimeout(hideTimeoutId);
    };
  }, [hideTimeoutId]);

  // Handle county selection
  const handleCountyClick = (county: County) => {
    onCountySelect(county);
    if (counties) {
      onCountyIndexChange(counties.findIndex((c) => c.id === county.id));
    }
  };

  const currentAutoCounty =
    !selectedCounty && counties && counties.length > 0 ? counties[currentCountyIndex] : null;

  return (
    <div className={`relative w-full h-full ${className}`} style={{ minHeight: '620px' }}>
      {/* Main Map Container - Full Width */}
      <div
        className='relative w-full bg-gradient-to-br from-slate-100/20 via-blue-50/30 to-indigo-100/20 rounded-xl overflow-hidden backdrop-blur-sm border border-white/20 shadow-inner'
        // Fixed height avoids content overlaps with elements that follow the map
        style={{ height: 600 }}>
        {/* Map Controls Header */}
        {/* Removed MapControls from here for cleaner map appearance */}

        {/* Interactive Map */}
        <ComposableMap
          projection='geoMercator'
          projectionConfig={{
            // Scaled up to better occupy vertical space
            scale: 5500,
            center: [37.8, -0.2],
          }}
          width={1100}
          height={1100}
          className='w-full h-full drop-shadow-lg'>
          <defs>
            <linearGradient id='mapGradient' x1='0%' y1='0%' x2='100%' y2='100%'>
              <stop offset='0%' stopColor='rgba(59, 130, 246, 0.03)' />
              <stop offset='50%' stopColor='rgba(99, 102, 241, 0.05)' />
              <stop offset='100%' stopColor='rgba(139, 92, 246, 0.03)' />
            </linearGradient>
            <filter id='glow' x='-50%' y='-50%' width='200%' height='200%'>
              <feGaussianBlur stdDeviation='3' result='coloredBlur' />
              <feMerge>
                <feMergeNode in='coloredBlur' />
                <feMergeNode in='SourceGraphic' />
              </feMerge>
            </filter>
          </defs>
          <rect width='100%' height='100%' fill='url(#mapGradient)' />
          <Geographies geography={geoData ?? externalTopoUrl}>
            {({ geographies }) => {
              return geographies.map((geo, index) => {
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
                  (!selectedCounty && currentAutoCounty?.id === county?.id);

                // Wave animation offset for visual effect
                const waveDelay = animationMode === 'wave' ? index * 0.1 : 0;

                return (
                  <motion.g
                    key={geo.rsmKey}
                    initial={{ scale: 1 }}
                    animate={{
                      scale: isActive ? 1.05 : 1,
                      y:
                        animationMode === 'wave' && isActive
                          ? Math.sin(Date.now() / 1000 + waveDelay) * 2
                          : 0,
                    }}
                    transition={{ duration: 0.3, delay: waveDelay }}>
                    <Geography
                      geography={geo}
                      onMouseEnter={() => handleCountyMouseEnter(geoCountyName, county)}
                      onMouseLeave={handleCountyMouseLeave}
                      onClick={() => county && handleCountyClick(county)}
                      style={{
                        default: {
                          fill: getCountyColor(
                            geoCountyName,
                            counties || [],
                            index,
                            selectedCounty,
                            currentCountyIndex,
                            hoveredCounty,
                            animationMode,
                            visualMode
                          ),
                          stroke: '#1f2937',
                          strokeWidth: isActive ? 2.5 : 1.2,
                          outline: 'none',
                          filter: isActive
                            ? 'url(#glow) drop-shadow(0 4px 6px rgba(0, 0, 0, 0.2))'
                            : 'none',
                        },
                        hover: {
                          fill: getCountyColor(
                            geoCountyName,
                            counties || [],
                            index,
                            selectedCounty,
                            currentCountyIndex,
                            geoCountyName, // Set as hovered
                            animationMode,
                            visualMode
                          ),
                          stroke: '#1f2937',
                          strokeWidth: 2,
                          outline: 'none',
                          filter: 'url(#glow)',
                        },
                        pressed: {
                          fill: '#1d4ed8',
                          stroke: '#374151',
                          strokeWidth: 2,
                          outline: 'none',
                        },
                      }}
                      className={`cursor-pointer transition-all duration-300 ${
                        county ? 'hover:opacity-90' : ''
                      }`}
                    />
                  </motion.g>
                );
              });
            }}
          </Geographies>

          {/* Active County Marker */}
          {currentAutoCounty && <CountyMarker county={currentAutoCounty} />}
        </ComposableMap>

        {/* Hover Tooltip */}
        <AnimatePresence>
          {showTooltip &&
            hoveredCounty &&
            (() => {
              const county = getCountyByName(hoveredCounty, counties || []);
              return county ? (
                <MapTooltip
                  county={county}
                  onMouseEnter={handleOverlayMouseEnter}
                  onMouseLeave={handleOverlayMouseLeave}
                  onCountyClick={handleCountyClick}
                />
              ) : null;
            })()}
        </AnimatePresence>
      </div>

      {/* Bottom Section with Quick Stats and Audit Opinions */}
      <div className='space-y-1.5 mt-3 mb-1'>
        {/* Map Controls - Integrated with stats */}
        <div className='bg-white/90 rounded-lg p-1.5 shadow-md border border-gray-200'>
          <div className='flex items-center justify-between'>
            <div className='flex items-center gap-2'>
              <div className='text-xs text-slate-600'>
                <span className='capitalize text-blue-600 font-medium'>{animationMode}</span>{' '}
                animation
              </div>
              <div className='text-xs text-slate-500'>Click counties • Hover for details</div>
            </div>
            <button
              onClick={() =>
                handleVisualizationModeChange(visualMode === 'focus' ? 'overview' : 'focus')
              }
              className={`
                flex items-center gap-1.5 px-2 py-1 rounded-md text-xs font-medium transition-all duration-200
                ${
                  visualMode === 'focus'
                    ? 'bg-blue-500 text-white shadow-sm'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }
              `}
              title={visualMode === 'focus' ? 'Switch to Overview Mode' : 'Switch to Focus Mode'}>
              {visualMode === 'focus' ? 'Focus Mode' : 'Overview Mode'}
            </button>
          </div>
        </div>

        {/* Stats Grid */}
        <div className='grid grid-cols-2 gap-2'>
          {/* Quick Stats - Left Column */}
          <div className='bg-white/90 rounded-lg p-1.5 shadow-md border border-gray-200'>
            <h3 className='text-xs font-semibold text-gray-700 mb-1'>County Statistics</h3>
            <div className='grid grid-cols-3 gap-1 text-xs'>
              <div className='text-center'>
                <span className='text-gray-600 text-xs'>Total</span>
                <div className='font-bold text-gray-800'>{counties?.length || 0}</div>
              </div>
              <div className='text-center'>
                <span className='text-gray-600 text-xs'>Clean</span>
                <div className='font-bold text-emerald-600'>
                  {counties?.filter((c) => c.auditStatus === 'clean').length || 0}
                </div>
              </div>
              <div className='text-center'>
                <span className='text-gray-600 text-xs'>Qualified</span>
                <div className='font-bold text-yellow-600'>
                  {counties?.filter((c) => c.auditStatus === 'qualified').length || 0}
                </div>
              </div>
              <div className='text-center'>
                <span className='text-gray-600 text-xs'>Adverse</span>
                <div className='font-bold text-orange-600'>
                  {counties?.filter((c) => c.auditStatus === 'adverse').length || 0}
                </div>
              </div>
              <div className='text-center'>
                <span className='text-gray-600 text-xs'>Disclaimer</span>
                <div className='font-bold text-red-600'>
                  {counties?.filter((c) => c.auditStatus === 'disclaimer').length || 0}
                </div>
              </div>
              <div className='text-center'>
                <span className='text-gray-600 text-xs'>Pending</span>
                <div className='font-bold text-gray-500'>
                  {counties?.filter((c) => c.auditStatus === 'pending').length || 0}
                </div>
              </div>
            </div>
          </div>

          {/* Audit Opinions Legend - Right Column */}
          <div className='bg-white/90 rounded-lg p-1.5 shadow-md border border-gray-200'>
            <h3 className='text-xs font-semibold text-gray-700 mb-1'>Audit Opinions</h3>
            <div className='space-y-0.5 text-xs'>
              <div className='flex items-center gap-1.5'>
                <div className='w-2 h-2 rounded-full bg-emerald-500'></div>
                <span className='text-gray-600'>Clean - No issues found</span>
              </div>
              <div className='flex items-center gap-1.5'>
                <div className='w-2 h-2 rounded-full bg-yellow-500'></div>
                <span className='text-gray-600'>Qualified - Minor issues</span>
              </div>
              <div className='flex items-center gap-1.5'>
                <div className='w-2 h-2 rounded-full bg-orange-500'></div>
                <span className='text-gray-600'>Adverse - Significant issues</span>
              </div>
              <div className='flex items-center gap-1.5'>
                <div className='w-2 h-2 rounded-full bg-red-500'></div>
                <span className='text-gray-600'>Disclaimer - Unable to verify</span>
              </div>
              <div className='flex items-center gap-1.5'>
                <div className='w-2 h-2 rounded-full bg-gray-400'></div>
                <span className='text-gray-600'>Pending - Under review</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
