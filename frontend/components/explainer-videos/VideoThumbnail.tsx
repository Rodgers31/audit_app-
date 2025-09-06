/**
 * VideoThumbnail - Animated thumbnail generator for different video types
 * Creates visually appealing thumbnails with appropriate icons and animations
 */
'use client';

import { motion } from 'framer-motion';
import { Building, DollarSign, Eye, TrendingUp } from 'lucide-react';

interface VideoThumbnailProps {
  thumbnail: string;
  className?: string;
}

export default function VideoThumbnail({ thumbnail, className = '' }: VideoThumbnailProps) {
  const getThumbnailComponent = (thumbnailType: string) => {
    const thumbnailComponents = {
      budget: (
        <div
          className={`w-full h-full bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center relative overflow-hidden ${className}`}>
          <motion.div
            className='absolute inset-0 opacity-20'
            animate={{ scale: [1, 1.1, 1] }}
            transition={{ duration: 3, repeat: Infinity }}>
            <div className='w-full h-full bg-white/10 rounded-full' />
          </motion.div>
          <DollarSign size={48} className='text-white z-10' />
        </div>
      ),
      debt: (
        <div
          className={`w-full h-full bg-gradient-to-br from-red-400 to-red-600 flex items-center justify-center relative ${className}`}>
          <motion.div
            className='absolute'
            animate={{ rotate: 360 }}
            transition={{ duration: 10, repeat: Infinity, ease: 'linear' }}>
            <TrendingUp size={48} className='text-white' />
          </motion.div>
        </div>
      ),
      audit: (
        <div
          className={`w-full h-full bg-gradient-to-br from-green-400 to-green-600 flex items-center justify-center ${className}`}>
          <Eye size={48} className='text-white' />
        </div>
      ),
      taxes: (
        <div
          className={`w-full h-full bg-gradient-to-br from-purple-400 to-purple-600 flex items-center justify-center ${className}`}>
          <Building size={48} className='text-white' />
        </div>
      ),
      gdp: (
        <div
          className={`w-full h-full bg-gradient-to-br from-emerald-400 to-emerald-600 flex items-center justify-center ${className}`}>
          <TrendingUp size={48} className='text-white' />
        </div>
      ),
      county: (
        <div
          className={`w-full h-full bg-gradient-to-br from-indigo-400 to-indigo-600 flex items-center justify-center ${className}`}>
          <Building size={48} className='text-white' />
        </div>
      ),
    };

    return (
      thumbnailComponents[thumbnailType as keyof typeof thumbnailComponents] ||
      thumbnailComponents.budget
    );
  };

  return getThumbnailComponent(thumbnail);
}
