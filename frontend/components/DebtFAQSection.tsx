'use client';

import { motion } from 'framer-motion';
import { ChevronDown, ChevronUp, HelpCircle } from 'lucide-react';
import { useState } from 'react';

const FAQ_DATA = [
  {
    id: 1,
    question: 'What is debt?',
    answer:
      'Government debt is money that Kenya has borrowed and needs to pay back with interest. Think of it like a loan you might take to buy a house - except Kenya borrows money to build roads, hospitals, schools, and other infrastructure that benefits everyone.',
    icon: '💰',
    simple: true,
  },
  {
    id: 2,
    question: 'Why does it matter?',
    answer:
      "Debt matters because it affects our future. When the government borrows money, it commits future tax revenues to paying it back. Too much debt means less money available for essential services like healthcare and education. It also affects Kenya's credit rating and ability to borrow more money when needed.",
    icon: '⚖️',
    simple: true,
  },
  {
    id: 3,
    question: 'Who do we owe money to?',
    answer:
      'Kenya owes money to various lenders: China (mainly for infrastructure like SGR), World Bank and IMF (for development projects), local banks and pension funds (through treasury bills and bonds), and other countries like Japan and European nations. About 60% is external debt and 40% is domestic.',
    icon: '🌍',
    simple: true,
  },
  {
    id: 4,
    question: "Is Kenya's debt level dangerous?",
    answer:
      "Kenya's debt-to-GDP ratio is around 86%, which international organizations consider high risk. The IMF recommends keeping this below 55% for developing countries. However, it's not immediately dangerous as long as Kenya can service the debt and continues economic growth.",
    icon: '📊',
    simple: false,
  },
  {
    id: 5,
    question: 'How does debt affect ordinary citizens?',
    answer:
      "High debt means more taxes to pay interest, less spending on public services, and potential cuts to social programs. When debt service takes up a large portion of the budget, there's less money for healthcare, education, and infrastructure that directly benefit citizens.",
    icon: '👥',
    simple: true,
  },
  {
    id: 6,
    question: "What happens if Kenya can't pay its debts?",
    answer:
      "If Kenya defaults on its debts, it would face severe consequences: loss of access to international credit markets, economic sanctions, currency devaluation, and potential seizure of assets by creditors. This would severely damage the economy and citizens' welfare.",
    icon: '⚠️',
    simple: false,
  },
];

export default function DebtFAQSection() {
  const [openFAQ, setOpenFAQ] = useState<number | null>(null);

  const toggleFAQ = (id: number) => {
    setOpenFAQ(openFAQ === id ? null : id);
  };

  return (
    <div className='bg-white rounded-2xl p-6 shadow-lg border border-gray-200'>
      <div className='text-center mb-8'>
        <div className='flex items-center justify-center gap-3 mb-4'>
          <HelpCircle className='text-blue-600' size={32} />
          <h3 className='text-2xl font-bold text-gray-900'>Frequently Asked Questions</h3>
        </div>
        <p className='text-gray-600 max-w-2xl mx-auto'>
          Plain answers to common questions about Kenya's debt. No jargon, just facts.
        </p>
      </div>

      <div className='max-w-4xl mx-auto space-y-4'>
        {FAQ_DATA.map((faq, index) => (
          <motion.div
            key={faq.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.1, duration: 0.5 }}
            className={`border rounded-xl overflow-hidden transition-all duration-300 ${
              openFAQ === faq.id
                ? 'border-blue-200 shadow-md'
                : 'border-gray-200 hover:border-gray-300'
            }`}>
            <button
              onClick={() => toggleFAQ(faq.id)}
              className='w-full px-6 py-4 text-left bg-gradient-to-r from-gray-50 to-blue-50 hover:from-gray-100 hover:to-blue-100 transition-all duration-200'>
              <div className='flex items-center justify-between'>
                <div className='flex items-center gap-4'>
                  <div className='text-2xl'>{faq.icon}</div>
                  <div>
                    <h4 className='text-lg font-semibold text-gray-900 mb-1'>{faq.question}</h4>
                    {faq.simple && (
                      <span className='px-2 py-1 bg-green-100 text-green-700 text-xs font-medium rounded-full'>
                        Simple Answer
                      </span>
                    )}
                  </div>
                </div>
                <div className='text-blue-600'>
                  {openFAQ === faq.id ? <ChevronUp size={24} /> : <ChevronDown size={24} />}
                </div>
              </div>
            </button>

            <motion.div
              initial={false}
              animate={{
                height: openFAQ === faq.id ? 'auto' : 0,
                opacity: openFAQ === faq.id ? 1 : 0,
              }}
              transition={{ duration: 0.3, ease: 'easeInOut' }}
              className='overflow-hidden'>
              <div className='px-6 py-4 bg-white'>
                <p className='text-gray-700 leading-relaxed text-base'>{faq.answer}</p>
              </div>
            </motion.div>
          </motion.div>
        ))}
      </div>

      {/* Call to Action */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.8, duration: 0.6 }}
        className='mt-8 text-center bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl p-6'>
        <h4 className='text-xl font-bold text-gray-900 mb-2'>Want to Learn More?</h4>
        <p className='text-gray-600 mb-4'>
          Explore detailed government reports and international assessments about Kenya's debt
          situation.
        </p>
        <div className='flex flex-wrap justify-center gap-3'>
          <a
            href='#'
            className='px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium text-sm'>
            Treasury Reports
          </a>
          <a
            href='#'
            className='px-4 py-2 bg-white text-blue-600 border border-blue-600 rounded-lg hover:bg-blue-50 transition-colors font-medium text-sm'>
            IMF Assessments
          </a>
          <a
            href='#'
            className='px-4 py-2 bg-white text-blue-600 border border-blue-600 rounded-lg hover:bg-blue-50 transition-colors font-medium text-sm'>
            World Bank Data
          </a>
        </div>
      </motion.div>
    </div>
  );
}
