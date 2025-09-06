/**
 * TermAnimation - Animated visual components for different glossary terms
 * Creates contextual animations based on term type and color
 */
'use client';

import { motion } from 'framer-motion';

interface TermAnimationProps {
  animation: string;
  color: string;
}

export default function TermAnimation({ animation, color }: TermAnimationProps) {
  const colorClasses = {
    blue: 'text-blue-600',
    red: 'text-red-600',
    orange: 'text-orange-600',
    green: 'text-green-600',
    purple: 'text-purple-600',
    indigo: 'text-indigo-600',
    emerald: 'text-emerald-600',
    cyan: 'text-cyan-600',
  };

  const colorClass = colorClasses[color as keyof typeof colorClasses] || 'text-gray-600';

  const getAnimationComponent = () => {
    switch (animation) {
      case 'budget':
        return (
          <div className='flex items-center justify-center space-x-2'>
            <motion.div
              className={`w-8 h-8 border-2 border-current rounded ${colorClass}`}
              animate={{ scale: [1, 1.2, 1] }}
              transition={{ duration: 2, repeat: Infinity }}
            />
            <motion.div className={`text-sm ${colorClass}`}>Money In</motion.div>
            <motion.div
              className={`w-4 h-1 ${colorClass.replace('text-', 'bg-')}`}
              animate={{ x: [0, 20, 0] }}
              transition={{ duration: 2, repeat: Infinity }}
            />
            <motion.div className={`text-sm ${colorClass}`}>Money Out</motion.div>
          </div>
        );

      case 'debt':
        return (
          <div className='flex items-center justify-center'>
            <motion.div
              className={`w-12 h-12 rounded-full border-4 border-current ${colorClass}`}
              animate={{ rotate: 360 }}
              transition={{ duration: 3, repeat: Infinity, ease: 'linear' }}>
              <div
                className={`w-full h-full flex items-center justify-center text-xs font-bold ${colorClass}`}>
                IOU
              </div>
            </motion.div>
          </div>
        );

      case 'deficit':
        return (
          <div className='flex items-center justify-center space-x-1'>
            <motion.div
              className={`w-6 h-6 border-2 border-current rounded ${colorClass}`}
              animate={{ scale: [1, 0.8, 1] }}
              transition={{ duration: 1.5, repeat: Infinity }}
            />
            <motion.div className={`text-lg ${colorClass}`}>-</motion.div>
            <motion.div
              className={`w-6 h-6 border-2 border-current rounded ${colorClass}`}
              animate={{ scale: [1, 1.2, 1] }}
              transition={{ duration: 1.5, repeat: Infinity, delay: 0.5 }}
            />
          </div>
        );

      case 'audit':
        return (
          <div className='flex items-center justify-center'>
            <motion.div
              className={`w-10 h-10 border-2 border-current rounded ${colorClass} flex items-center justify-center`}
              animate={{ rotateY: [0, 180, 360] }}
              transition={{ duration: 3, repeat: Infinity }}>
              <motion.div
                className={`text-lg ${colorClass}`}
                animate={{ opacity: [1, 0, 1] }}
                transition={{ duration: 1.5, repeat: Infinity }}>
                ✓
              </motion.div>
            </motion.div>
          </div>
        );

      case 'revenue':
        return (
          <div className='flex items-center justify-center'>
            <motion.div className={`relative w-12 h-12 ${colorClass}`}>
              {[...Array(3)].map((_, i) => (
                <motion.div
                  key={i}
                  className={`absolute w-3 h-3 rounded-full border-2 border-current ${colorClass}`}
                  animate={{
                    x: [0, 20, 0],
                    y: [0, -10, 0],
                  }}
                  transition={{
                    duration: 2,
                    repeat: Infinity,
                    delay: i * 0.3,
                  }}
                  style={{ top: 4 + i * 4, left: 4 }}
                />
              ))}
            </motion.div>
          </div>
        );

      case 'expenditure':
        return (
          <div className='flex items-center justify-center'>
            <motion.div
              className={`w-10 h-10 border-2 border-current rounded-lg ${colorClass} flex items-center justify-center relative overflow-hidden`}>
              <motion.div
                className={`absolute inset-0 ${colorClass.replace('text-', 'bg-')} opacity-20`}
                animate={{ scale: [0, 1.5] }}
                transition={{ duration: 2, repeat: Infinity }}
              />
              <motion.div className={`text-lg font-bold ${colorClass} z-10`}>$</motion.div>
            </motion.div>
          </div>
        );

      case 'gdp':
        return (
          <div className='flex items-center justify-center'>
            <motion.div className='relative w-12 h-12'>
              {[...Array(4)].map((_, i) => (
                <motion.div
                  key={i}
                  className={`absolute w-2 rounded-t ${colorClass.replace('text-', 'bg-')}`}
                  style={{
                    left: i * 8 + 2,
                    bottom: 0,
                    height: (i + 1) * 8,
                  }}
                  animate={{
                    height: [(i + 1) * 8, (i + 1) * 12, (i + 1) * 8],
                    opacity: [0.7, 1, 0.7],
                  }}
                  transition={{
                    duration: 2,
                    repeat: Infinity,
                    delay: i * 0.2,
                  }}
                />
              ))}
            </motion.div>
          </div>
        );

      case 'taxation':
        return (
          <div className='flex items-center justify-center'>
            <motion.div
              className={`w-10 h-10 border-2 border-current rounded-lg ${colorClass} flex items-center justify-center`}
              animate={{
                borderRadius: ['8px', '50%', '8px'],
                rotate: [0, 180, 360],
              }}
              transition={{ duration: 4, repeat: Infinity }}>
              <motion.div
                className={`text-sm font-bold ${colorClass}`}
                animate={{ rotate: [0, -180, -360] }}
                transition={{ duration: 4, repeat: Infinity }}>
                %
              </motion.div>
            </motion.div>
          </div>
        );

      default:
        return (
          <motion.div
            className={`w-12 h-12 rounded-xl border-2 border-current ${colorClass} flex items-center justify-center`}
            animate={{ y: [0, -10, 0] }}
            transition={{ duration: 2, repeat: Infinity }}>
            <div className={`text-lg font-bold ${colorClass}`}>?</div>
          </motion.div>
        );
    }
  };

  return <div>{getAnimationComponent()}</div>;
}
