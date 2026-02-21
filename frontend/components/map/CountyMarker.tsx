/**
 * CountyMarker – animated pulsing dot at the active county's coordinates.
 * Uses gov-forest green with a ripple ring for visibility.
 */
'use client';

import { County } from '@/types';
import { motion } from 'framer-motion';
import { Marker } from 'react-simple-maps';

interface CountyMarkerProps {
  county: County;
}

export default function CountyMarker({ county }: CountyMarkerProps) {
  if (!county?.coordinates) return null;

  return (
    <Marker coordinates={county.coordinates}>
      <g transform='translate(0, 0)'>
        {/* Expanding ripple ring */}
        <motion.circle
          r={10}
          fill='none'
          stroke='#1B3A2A'
          strokeWidth={1.5}
          initial={{ r: 4, opacity: 0.7 }}
          animate={{ r: 14, opacity: 0 }}
          transition={{ repeat: Infinity, duration: 2, ease: 'easeOut' }}
        />
        {/* Solid centre dot */}
        <motion.circle
          r={4}
          fill='#1B3A2A'
          stroke='#fff'
          strokeWidth={1.5}
          initial={{ scale: 0.8 }}
          animate={{ scale: [1, 1.15, 1] }}
          transition={{ repeat: Infinity, duration: 2.5, ease: 'easeInOut' }}
        />
      </g>
    </Marker>
  );
}
