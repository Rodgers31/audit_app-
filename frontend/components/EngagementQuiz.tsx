/**
 * EngagementQuiz - Main quiz component with multiple choice questions about government finance
 * Manages quiz state, question progression, and score tracking
 */
'use client';

import { Brain } from 'lucide-react';
import { useState } from 'react';
import DidYouKnowSection from './quiz/DidYouKnowSection';
import QuizCard from './quiz/QuizCard';
import QuizQuestion from './quiz/QuizQuestion';
import QuizResults from './quiz/QuizResults';

interface EngagementQuizProps {
  searchTerm: string;
}

interface Question {
  question: string;
  options: string[];
  correctAnswer: number;
  explanation: string;
  funFact: string;
}

interface Quiz {
  id: string;
  title: string;
  description: string;
  difficulty: 'beginner' | 'intermediate';
  estimatedTime: string;
  category: string;
  icon: string;
  questions: Question[];
}

export default function EngagementQuiz({ searchTerm }: EngagementQuizProps) {
  // Quiz state management
  const [currentQuiz, setCurrentQuiz] = useState<string | null>(null);
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [answers, setAnswers] = useState<number[]>([]);
  const [showResult, setShowResult] = useState(false);
  const [selectedAnswer, setSelectedAnswer] = useState<number | null>(null);
  const [quizCompleted, setQuizCompleted] = useState<string[]>([]);

  // Quiz data configuration
  const quizzes: Quiz[] = [
    {
      id: 'budget-basics',
      title: 'Budget Basics Quiz',
      description: 'Test your knowledge of government budgets and spending',
      difficulty: 'beginner',
      estimatedTime: '3 min',
      category: 'budgets',
      icon: '💰',
      questions: [
        {
          question: 'What is a government budget?',
          options: [
            'A list of all government employees',
            'A plan for how government will collect and spend money',
            "A report of last year's expenses",
            'A prediction of economic growth',
          ],
          correctAnswer: 1,
          explanation:
            'A budget is like a spending plan - it shows how much money government expects to collect (mainly from taxes) and how they plan to spend it on services like education, healthcare, and infrastructure.',
          funFact:
            "Kenya's national budget for 2024 is about KES 3.7 trillion - that's roughly KES 75,000 per person!",
        },
        {
          question:
            'If your county collects KES 10 billion in taxes but spends KES 12 billion, what happened?',
          options: [
            'The county made a profit',
            'The county balanced its budget',
            'The county has a deficit of KES 2 billion',
            'The county has a surplus',
          ],
          correctAnswer: 2,
          explanation:
            'When spending exceeds income, it creates a deficit. The county would need to borrow money or use savings to cover the KES 2 billion shortfall.',
          funFact:
            'Many counties in Kenya struggle with budget deficits, especially in their first few years after devolution.',
        },
        {
          question: 'Which of these is typically the largest source of government revenue?',
          options: [
            'Foreign aid',
            'Taxes from citizens and businesses',
            'Government business profits',
            'Fees and fines',
          ],
          correctAnswer: 1,
          explanation:
            'Taxes are the main source of government revenue in most countries. In Kenya, taxes provide about 85% of government revenue.',
          funFact:
            'The average Kenyan pays about 25-30% of their income in various taxes (income tax, VAT, fuel levy, etc.)',
        },
      ],
    },
    {
      id: 'debt-knowledge',
      title: 'National Debt Quiz',
      description: 'Understand government borrowing and what it means for Kenya',
      difficulty: 'intermediate',
      estimatedTime: '4 min',
      category: 'debt',
      icon: '📊',
      questions: [
        {
          question: 'Why do governments borrow money?',
          options: [
            'To pay government salaries',
            'To fund large infrastructure projects',
            'To cover daily operating expenses',
            'All of the above',
          ],
          correctAnswer: 3,
          explanation:
            'Governments borrow for various reasons: large infrastructure projects (like SGR), economic emergencies, development programs, and sometimes to cover budget deficits.',
          funFact:
            'The Standard Gauge Railway (SGR) from Mombasa to Nairobi cost about $3.8 billion, mostly financed through Chinese loans.',
        },
        {
          question: "What percentage of Kenya's GDP is the national debt approximately?",
          options: ['About 30%', 'About 50%', 'About 70%', 'About 90%'],
          correctAnswer: 2,
          explanation:
            "Kenya's debt-to-GDP ratio is around 70%, which is considered high by international standards. The IMF recommends keeping this below 55% for developing countries.",
          funFact:
            "If Kenya's debt was divided equally among all citizens, each person would owe about KES 230,000!",
        },
        {
          question: "What happens if a country can't pay its debts?",
          options: [
            'Nothing serious happens',
            'The country goes bankrupt like a business',
            'International lenders may impose conditions on future lending',
            'Other countries take over the government',
          ],
          correctAnswer: 2,
          explanation:
            "Countries don't go bankrupt like companies, but they may face restricted access to international markets and lenders may impose economic reforms as conditions for help.",
          funFact:
            'Sri Lanka recently experienced a debt crisis and had to seek help from the IMF, leading to economic reforms and reduced government spending.',
        },
      ],
    },
    {
      id: 'accountability',
      title: 'Government Accountability Quiz',
      description: 'Learn about audits and how government is held accountable',
      difficulty: 'beginner',
      estimatedTime: '3 min',
      category: 'accountability',
      icon: '🔍',
      questions: [
        {
          question: 'What does the Auditor-General do?',
          options: [
            'Collects taxes from citizens',
            'Checks if government spent money properly',
            'Creates the national budget',
            'Manages government investments',
          ],
          correctAnswer: 1,
          explanation:
            'The Auditor-General is like an independent financial detective who checks if government officials spent taxpayer money according to the law and achieved intended results.',
          funFact:
            "Kenya's Auditor-General audits over 1,000 government entities every year, from ministries to county governments!",
        },
        {
          question:
            'If an audit finds that KES 50 million meant for schools was spent on personal items, what should happen?',
          options: [
            "Nothing, it's too late to recover the money",
            'The officials should repay the money and face legal action',
            'Just warn the officials not to do it again',
            'Transfer the officials to different departments',
          ],
          correctAnswer: 1,
          explanation:
            'Misuse of public funds should result in recovery of the money and prosecution. This is called accountability - making sure public officials face consequences for misusing taxpayer money.',
          funFact:
            "In 2023, Kenya's audit reports identified over KES 100 billion in questionable expenditures across various government entities.",
        },
      ],
    },
  ];

  // Educational facts for the "Did You Know" section
  const didYouKnowFacts = [
    {
      icon: '🏦',
      fact: 'Kenya has 47 county governments, each with its own budget',
      detail:
        'Counties manage about 15% of the national budget for local services like health, water, and agriculture.',
    },
    {
      icon: '📈',
      fact: 'Government spends about KES 300 billion on salaries every year',
      detail:
        'This includes teachers, doctors, police officers, and all other government employees.',
    },
    {
      icon: '🛣️',
      fact: 'Building 1 kilometer of tarmac road costs about KES 60-80 million',
      detail: 'This is why road projects are such a big part of government budgets.',
    },
    {
      icon: '🏥',
      fact: 'Kenya spends only about 4% of GDP on healthcare',
      detail: 'The WHO recommends at least 5% of GDP for adequate healthcare funding.',
    },
    {
      icon: '📚',
      fact: 'Free primary education costs the government about KES 200 billion annually',
      detail: 'This covers teacher salaries, learning materials, and school infrastructure.',
    },
  ];

  // Filter quizzes based on search term
  const filteredQuizzes = quizzes.filter(
    (quiz) =>
      searchTerm === '' ||
      quiz.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      quiz.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
      quiz.category.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Quiz interaction handlers
  const startQuiz = (quizId: string) => {
    setCurrentQuiz(quizId);
    setCurrentQuestion(0);
    setAnswers([]);
    setShowResult(false);
    setSelectedAnswer(null);
  };

  const selectAnswer = (answerIndex: number) => {
    setSelectedAnswer(answerIndex);
  };

  const submitAnswer = () => {
    if (selectedAnswer === null) return;

    const newAnswers = [...answers, selectedAnswer];
    setAnswers(newAnswers);

    const quiz = quizzes.find((q) => q.id === currentQuiz);
    if (!quiz) return;

    // Move to next question or show results
    if (currentQuestion < quiz.questions.length - 1) {
      setCurrentQuestion(currentQuestion + 1);
      setSelectedAnswer(null);
    } else {
      setShowResult(true);
      if (currentQuiz && !quizCompleted.includes(currentQuiz)) {
        setQuizCompleted([...quizCompleted, currentQuiz]);
      }
    }
  };

  const resetQuiz = () => {
    setCurrentQuiz(null);
    setCurrentQuestion(0);
    setAnswers([]);
    setShowResult(false);
    setSelectedAnswer(null);
  };

  // Helper functions
  const getCurrentQuiz = () => quizzes.find((q) => q.id === currentQuiz);
  const getScore = () => {
    const quiz = getCurrentQuiz();
    if (!quiz) return 0;
    return answers.reduce(
      (score, answer, index) =>
        answer === quiz.questions[index].correctAnswer ? score + 1 : score,
      0
    );
  };

  // Render quiz interface
  if (currentQuiz) {
    const quiz = getCurrentQuiz();
    if (!quiz) return null;

    // Show results screen
    if (showResult) {
      return (
        <div className='bg-white rounded-3xl p-8 shadow-xl border border-gray-200'>
          <QuizResults
            score={getScore()}
            totalQuestions={quiz.questions.length}
            answers={answers}
            questions={quiz.questions}
            quizTitle={quiz.title}
            onRetake={() => startQuiz(quiz.id)}
            onBackToQuizzes={resetQuiz}
          />
        </div>
      );
    }

    // Show question interface
    const currentQ = quiz.questions[currentQuestion];

    return (
      <div className='bg-white rounded-3xl p-8 shadow-xl border border-gray-200'>
        <div className='flex items-center justify-between mb-8'>
          <div>
            <h2 className='text-2xl font-bold text-gray-900'>{quiz.title}</h2>
            <p className='text-gray-600'>
              Question {currentQuestion + 1} of {quiz.questions.length}
            </p>
          </div>
          <button onClick={resetQuiz} className='text-gray-400 hover:text-gray-600'>
            ✕
          </button>
        </div>

        <QuizQuestion
          question={currentQ.question}
          options={currentQ.options}
          selectedAnswer={selectedAnswer}
          onAnswerSelect={selectAnswer}
          onSubmit={submitAnswer}
          currentIndex={currentQuestion}
          totalQuestions={quiz.questions.length}
        />
      </div>
    );
  }

  // Show quiz selection screen
  return (
    <div className='bg-white rounded-3xl p-8 shadow-xl border border-gray-200'>
      <div className='flex items-center gap-3 mb-8'>
        <Brain size={32} className='text-purple-600' />
        <h2 className='text-3xl font-bold text-gray-900'>Interactive Quizzes</h2>
      </div>

      {/* Quiz Cards Grid */}
      <div className='grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-12'>
        {filteredQuizzes.map((quiz, index) => (
          <QuizCard
            key={quiz.id}
            id={quiz.id}
            title={quiz.title}
            description={quiz.description}
            difficulty={quiz.difficulty}
            estimatedTime={quiz.estimatedTime}
            icon={quiz.icon}
            questionCount={quiz.questions.length}
            isCompleted={quizCompleted.includes(quiz.id)}
            onStart={startQuiz}
          />
        ))}
      </div>

      {/* Educational Facts Section */}
      <DidYouKnowSection facts={didYouKnowFacts} />

      {/* No Results Message */}
      {filteredQuizzes.length === 0 && (
        <div className='text-center py-12'>
          <Brain size={48} className='text-gray-300 mx-auto mb-4' />
          <h3 className='text-xl font-semibold text-gray-600 mb-2'>No quizzes found</h3>
          <p className='text-gray-500'>Try adjusting your search term</p>
        </div>
      )}
    </div>
  );
}
