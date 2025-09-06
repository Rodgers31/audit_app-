/**
 * CountyMarker - Animated location marker for the active county
 * Shows pulsing circle animation at county coordinates
 */
'use client';

import { County } from '@/types';
import { motion } from 'framer-motion';
import { Marker } from 'react-simple-maps';

interface CountyMarkerProps {
  county: County;
}

export default function CountyMarker({ county }: CountyMarkerProps) {
  // Don't render if no coordinates available
  if (!county?.coordinates) return null;

  return (
    <Marker coordinates={county.coordinates}>
      <g
        fill='none'
        stroke='#059669'
        strokeWidth='2'
        strokeLinecap='round'
        strokeLinejoin='round'
        transform='translate(-12, -24)'>
        {/* Inner pulsing circle */}
        <motion.circle
          cx='12'
          cy='12'
          r='3'
          fill='#059669'
          initial={{ scale: 0 }}
          animate={{ scale: [1, 1.3, 1] }}
          transition={{ repeat: Infinity, duration: 2 }}
        />

        {/* Outer expanding circle */}
        <motion.circle
          cx='12'
          cy='12'
          r='8'
          fill='none'
          stroke='#059669'
          strokeWidth='2'
          opacity='0.6'
          initial={{ scale: 0, opacity: 0 }}
          animate={{
            scale: [1, 1.5, 1],
            opacity: [0.6, 0, 0.6],
          }}
          transition={{
            repeat: Infinity,
            duration: 2,
            delay: 0.5,
          }}
        />
      </g>
    </Marker>
  );
}
