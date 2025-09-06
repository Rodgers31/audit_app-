'use client';

import EngagementQuiz from '@/components/EngagementQuiz';
import ExplainerVideos from '@/components/ExplainerVideos';
import InteractiveGlossary from '@/components/InteractiveGlossary';
import WhyThisMatters from '@/components/WhyThisMatters';
import { motion } from 'framer-motion';
import { BookOpen, Brain, Lightbulb, Play, Search, Star } from 'lucide-react';
import { useState } from 'react';

export default function LearningHubPage() {
  const [activeSection, setActiveSection] = useState<
    'glossary' | 'videos' | 'quiz' | 'why-matters'
  >('glossary');
  const [searchTerm, setSearchTerm] = useState('');

  const sections = [
    {
      id: 'glossary' as const,
      title: 'Interactive Glossary',
      description: 'Learn key terms with animations and examples',
      icon: BookOpen,
      color: 'blue',
    },
    {
      id: 'videos' as const,
      title: 'Explainer Videos',
      description: '2-minute animated explanations',
      icon: Play,
      color: 'purple',
    },
    {
      id: 'quiz' as const,
      title: 'Test Your Knowledge',
      description: 'Interactive quizzes and fun facts',
      icon: Brain,
      color: 'green',
    },
    {
      id: 'why-matters' as const,
      title: 'Why This Matters',
      description: 'How government finances affect your daily life',
      icon: Lightbulb,
      color: 'orange',
    },
  ];

  const getSectionClasses = (color: string, isActive: boolean) => {
    const baseClasses = 'p-4 rounded-2xl border transition-all duration-300 cursor-pointer';

    if (isActive) {
      switch (color) {
        case 'blue':
          return `${baseClasses} bg-blue-100 border-blue-300 text-blue-800 shadow-lg scale-105`;
        case 'purple':
          return `${baseClasses} bg-purple-100 border-purple-300 text-purple-800 shadow-lg scale-105`;
        case 'green':
          return `${baseClasses} bg-green-100 border-green-300 text-green-800 shadow-lg scale-105`;
        case 'orange':
          return `${baseClasses} bg-orange-100 border-orange-300 text-orange-800 shadow-lg scale-105`;
        default:
          return `${baseClasses} bg-gray-100 border-gray-300 text-gray-800 shadow-lg scale-105`;
      }
    } else {
      switch (color) {
        case 'blue':
          return `${baseClasses} bg-white border-blue-200 text-blue-700 hover:bg-blue-50 hover:border-blue-300`;
        case 'purple':
          return `${baseClasses} bg-white border-purple-200 text-purple-700 hover:bg-purple-50 hover:border-purple-300`;
        case 'green':
          return `${baseClasses} bg-white border-green-200 text-green-700 hover:bg-green-50 hover:border-green-300`;
        case 'orange':
          return `${baseClasses} bg-white border-orange-200 text-orange-700 hover:bg-orange-50 hover:border-orange-300`;
        default:
          return `${baseClasses} bg-white border-gray-200 text-gray-700 hover:bg-gray-50 hover:border-gray-300`;
      }
    }
  };

  return (
    <div className='min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100'>
      {/* Decorative background pattern */}
      <div className='absolute inset-0 bg-grid-slate-100 [mask-image:linear-gradient(0deg,white,rgba(255,255,255,0.6))] pointer-events-none'></div>

      {/* Main Content */}
      <main className='relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12'>
        {/* Page Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className='text-center mb-12'>
          <h1 className='text-5xl font-bold text-gray-900 mb-6'>Learning Hub</h1>
          <p className='text-xl text-gray-600 max-w-3xl mx-auto'>
            Master government finance concepts with interactive lessons, videos, and real-world
            examples
          </p>
        </motion.div>

        {/* Quick Stats */}
        <motion.section
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2, duration: 0.6 }}
          className='mb-12'>
          <div className='bg-white rounded-3xl p-6 shadow-xl border border-gray-200'>
            <div className='grid grid-cols-1 md:grid-cols-4 gap-6 text-center'>
              <div>
                <div className='text-3xl font-bold text-blue-600 mb-2'>50+</div>
                <div className='text-sm text-gray-600'>Terms Explained</div>
              </div>
              <div>
                <div className='text-3xl font-bold text-purple-600 mb-2'>12</div>
                <div className='text-sm text-gray-600'>Video Lessons</div>
              </div>
              <div>
                <div className='text-3xl font-bold text-green-600 mb-2'>25</div>
                <div className='text-sm text-gray-600'>Quiz Questions</div>
              </div>
              <div>
                <div className='text-3xl font-bold text-orange-600 mb-2'>100%</div>
                <div className='text-sm text-gray-600'>Free Learning</div>
              </div>
            </div>
          </div>
        </motion.section>

        {/* Search Bar */}
        <motion.section
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3, duration: 0.6 }}
          className='mb-12'>
          <div className='bg-white rounded-3xl p-6 shadow-xl border border-gray-200'>
            <div className='relative max-w-2xl mx-auto'>
              <Search
                className='absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400'
                size={20}
              />
              <input
                type='text'
                placeholder='Search for terms like "budget", "debt", "audit"...'
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className='w-full pl-12 pr-4 py-4 border border-gray-200 rounded-2xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors text-lg'
              />
            </div>
          </div>
        </motion.section>

        {/* Section Navigation */}
        <motion.section
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4, duration: 0.6 }}
          className='mb-12'>
          <div className='grid grid-cols-1 md:grid-cols-4 gap-6'>
            {sections.map((section, index) => {
              const Icon = section.icon;
              const isActive = activeSection === section.id;

              return (
                <motion.button
                  key={section.id}
                  onClick={() => setActiveSection(section.id)}
                  className={getSectionClasses(section.color, isActive)}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.5 + index * 0.1, duration: 0.5 }}
                  whileHover={{ scale: isActive ? 1.05 : 1.02 }}
                  whileTap={{ scale: 0.98 }}>
                  <div className='flex items-center gap-3 mb-3'>
                    <div
                      className={`w-12 h-12 rounded-xl flex items-center justify-center ${
                        isActive ? 'bg-white/30' : `bg-${section.color}-100`
                      }`}>
                      <Icon
                        size={24}
                        className={isActive ? 'text-white' : `text-${section.color}-600`}
                      />
                    </div>
                    <div className='text-left'>
                      <h3 className='font-semibold text-lg'>{section.title}</h3>
                      <p className={`text-sm ${isActive ? 'opacity-90' : 'opacity-75'}`}>
                        {section.description}
                      </p>
                    </div>
                  </div>

                  {/* Selection Indicator */}
                  {isActive && (
                    <motion.div
                      layoutId='activeSection'
                      className='absolute inset-0 border-2 border-white/40 rounded-2xl pointer-events-none'
                      transition={{ type: 'spring', bounce: 0.2, duration: 0.6 }}
                    />
                  )}
                </motion.button>
              );
            })}
          </div>
        </motion.section>

        {/* Active Section Content */}
        <motion.section
          key={activeSection}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className='mb-12'>
          {activeSection === 'glossary' && <InteractiveGlossary searchTerm={searchTerm} />}

          {activeSection === 'videos' && <ExplainerVideos searchTerm={searchTerm} />}

          {activeSection === 'quiz' && <EngagementQuiz searchTerm={searchTerm} />}

          {activeSection === 'why-matters' && <WhyThisMatters searchTerm={searchTerm} />}
        </motion.section>

        {/* Featured Content */}
        <motion.section
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.8, duration: 0.6 }}
          className='mb-12'>
          <div className='bg-gradient-to-r from-indigo-600 to-purple-600 rounded-3xl p-8 text-white'>
            <div className='text-center'>
              <Star size={48} className='mx-auto mb-4 text-yellow-300' />
              <h2 className='text-3xl font-bold mb-4'>Did You Know?</h2>
              <p className='text-xl mb-6 opacity-90'>
                Every Kenyan contributes about KES 65,000 per year in taxes. Understanding how this
                money is used helps you hold government accountable.
              </p>
              <div className='grid grid-cols-1 md:grid-cols-3 gap-6 mt-8'>
                <div className='bg-white/10 rounded-2xl p-6 backdrop-blur-sm'>
                  <div className='text-2xl font-bold mb-2'>KES 3.7T</div>
                  <div className='text-sm opacity-80'>Annual National Budget</div>
                </div>
                <div className='bg-white/10 rounded-2xl p-6 backdrop-blur-sm'>
                  <div className='text-2xl font-bold mb-2'>47</div>
                  <div className='text-sm opacity-80'>Counties to Track</div>
                </div>
                <div className='bg-white/10 rounded-2xl p-6 backdrop-blur-sm'>
                  <div className='text-2xl font-bold mb-2'>21%</div>
                  <div className='text-sm opacity-80'>Goes to Education</div>
                </div>
              </div>
            </div>
          </div>
        </motion.section>

        {/* Learning Path */}
        <motion.section
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 1.0, duration: 0.6 }}>
          <div className='bg-white rounded-3xl p-8 shadow-xl border border-gray-200'>
            <h2 className='text-2xl font-bold text-gray-900 mb-6 text-center'>
              Recommended Learning Path
            </h2>

            <div className='grid grid-cols-1 md:grid-cols-4 gap-6'>
              <div className='text-center'>
                <div className='w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4'>
                  <span className='text-2xl font-bold text-blue-600'>1</span>
                </div>
                <h3 className='font-semibold text-gray-900 mb-2'>Start with Basics</h3>
                <p className='text-sm text-gray-600'>Learn key terms in the Interactive Glossary</p>
              </div>

              <div className='text-center'>
                <div className='w-16 h-16 bg-purple-100 rounded-full flex items-center justify-center mx-auto mb-4'>
                  <span className='text-2xl font-bold text-purple-600'>2</span>
                </div>
                <h3 className='font-semibold text-gray-900 mb-2'>Watch & Learn</h3>
                <p className='text-sm text-gray-600'>
                  View short explainer videos for complex topics
                </p>
              </div>

              <div className='text-center'>
                <div className='w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4'>
                  <span className='text-2xl font-bold text-green-600'>3</span>
                </div>
                <h3 className='font-semibold text-gray-900 mb-2'>Test Knowledge</h3>
                <p className='text-sm text-gray-600'>
                  Take quizzes to reinforce what you've learned
                </p>
              </div>

              <div className='text-center'>
                <div className='w-16 h-16 bg-orange-100 rounded-full flex items-center justify-center mx-auto mb-4'>
                  <span className='text-2xl font-bold text-orange-600'>4</span>
                </div>
                <h3 className='font-semibold text-gray-900 mb-2'>Apply Knowledge</h3>
                <p className='text-sm text-gray-600'>Explore real data in our dashboard tools</p>
              </div>
            </div>
          </div>
        </motion.section>
      </main>
    </div>
  );
}
