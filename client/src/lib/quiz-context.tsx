import React, { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { Question } from "@shared/schema";

export interface UserDetails {
  name: string;
  surname: string;
  licenseCode: string;
  category: number;
  testType: 'category' | 'simulation';
  source?: string;
  onlyOfficial?: boolean;
  activeSourceIds?: number[];
}

// K53 pass thresholds (Absolute number of correct answers required)
const PASS_THRESHOLDS = {
  RULES: 22, // of 28
  SIGNS: 23, // of 28
  CONTROLS: 6, // of 8
};

interface CategoryResult {
  categoryId: number;
  correct: number;
  total: number;
  pass: boolean;
}

interface QuizState {
  user: UserDetails | null;
  filteredQuestions: Question[];
  answers: Record<number, string>; // question_number -> answer_number
  currentIndex: number;
  isComplete: boolean;
  startTime: number | null; // timestamp (ms) when quiz started
}

interface QuizContextType extends QuizState {
  startQuiz: (user: UserDetails, allQuestions: Question[]) => void;
  answerQuestion: (answerNumber: string) => void;
  goToPrevious: () => void;
  resetQuiz: () => void;
  getResults: () => {
    score: { correct: number; total: number; percentage: number };
    categories: CategoryResult[];
    overallPass: boolean;
  };
  getElapsedSeconds: () => number;
}

const QuizContext = createContext<QuizContextType | undefined>(undefined);

const STORAGE_KEY = "driving-license-quiz-state";

export function QuizProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<QuizState>(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        console.error("Failed to parse quiz state from localStorage", e);
      }
    }
    return {
      user: null,
      filteredQuestions: [],
      answers: {},
      currentIndex: 0,
      isComplete: false,
      startTime: null,
    };
  });

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }, [state]);

  const startQuiz = (user: UserDetails, allQuestions: Question[]) => {
    let selectedQuestions: Question[] = [];

    const shuffle = (array: Question[]) => [...array].sort(() => Math.random() - 0.5);
    const sample = (array: Question[], n: number) => shuffle(array).slice(0, n);

    const getQuestionsForCategory = (catId: number, total: number, licenseSpecificMin: number) => {
      let filteredDb = allQuestions;

      // Filter by category first
      filteredDb = filteredDb.filter(q => q.category === catId);

      // Filter by Official if selected
      if (user.onlyOfficial) {
        filteredDb = filteredDb.filter(q => q.is_official);
      }

      // Filter by Source if selected (and not all)
      if (user.source && user.source !== 'all') {
        if (user.source === 'unassigned') {
          filteredDb = filteredDb.filter(q => q.source_id == null);
        } else {
          filteredDb = filteredDb.filter(q => q.source_id?.toString() === user.source);
        }
      } else {
        // If 'all' sources selected, filter by active sources only
        const activeIds = user.activeSourceIds || [];
        if (activeIds.length > 0) {
          filteredDb = filteredDb.filter(q =>
            // Keep questions that have no source, or have a source that is active
            !q.source_id || activeIds.includes(q.source_id)
          );
        }
        if (!user.onlyOfficial) {
          // Also hide known duplicates
          filteredDb = filteredDb.filter(q => !q.is_duplicate);
        }
      }

      // Pool matching questions: both '00' (General) and the user's specific license
      const general = filteredDb.filter(q => q.license_code === "00");
      const specific = filteredDb.filter(q => q.license_code === user.licenseCode);

      // Shuffle pools
      const shuffledSpecific = shuffle(specific);
      const shuffledGeneral = shuffle(general);

      // Take at least licenseSpecificMin from the specific pool if available
      const takenSpecific = shuffledSpecific.slice(0, licenseSpecificMin);

      // Calculate how many more we need to reach the 'total'
      const remainingCount = total - takenSpecific.length;

      // Take the rest from the general pool, then if still not enough, take more from whichever is left
      const takenGeneral = shuffledGeneral.slice(0, remainingCount);

      let finalSelection = [...takenSpecific, ...takenGeneral];

      // fallback: if we still don't have enough, grab anything else that matches the filters
      if (finalSelection.length < total) {
        const alreadyTakenIds = new Set(finalSelection.map(q => q.id));
        const extraPool = shuffle(filteredDb.filter(q => !alreadyTakenIds.has(q.id)));
        finalSelection = [...finalSelection, ...extraPool.slice(0, total - finalSelection.length)];
      }

      return shuffle(finalSelection);
    };

    if (user.testType === 'simulation') {
      // 28 Rules, 28 Signs, 8 Controls
      const rules = getQuestionsForCategory(1, 28, 4);
      const signs = getQuestionsForCategory(2, 28, 4);
      const controls = getQuestionsForCategory(3, 8, 8); // Controls are all from selected license
      selectedQuestions = [...rules, ...signs, ...controls];
    } else {
      // Single category test
      if (user.category === 3) {
        selectedQuestions = getQuestionsForCategory(3, 8, 8);
      } else {
        selectedQuestions = getQuestionsForCategory(user.category, 28, 4);
      }
    }

    setState({
      user,
      filteredQuestions: selectedQuestions,
      answers: {},
      currentIndex: 0,
      isComplete: false,
      startTime: Date.now(),
    });
  };

  const answerQuestion = (answerNumber: string) => {
    setState((prev) => {
      const currentQuestion = prev.filteredQuestions[prev.currentIndex];
      const newAnswers = { ...prev.answers, [currentQuestion.question_number]: answerNumber };

      const nextIndex = prev.currentIndex + 1;
      const isComplete = nextIndex >= prev.filteredQuestions.length;

      return {
        ...prev,
        answers: newAnswers,
        currentIndex: isComplete ? prev.currentIndex : nextIndex,
        isComplete: isComplete || prev.isComplete,
      };
    });
  };

  const goToPrevious = () => {
    setState((prev) => {
      if (prev.currentIndex <= 0) return prev;
      return { ...prev, currentIndex: prev.currentIndex - 1 };
    });
  };

  const resetQuiz = () => {
    setState({
      user: null,
      filteredQuestions: [],
      answers: {},
      currentIndex: 0,
      isComplete: false,
      startTime: null,
    });
    localStorage.removeItem(STORAGE_KEY);
  };

  const getResults = () => {
    if (!state.filteredQuestions.length) return { score: { correct: 0, total: 0, percentage: 0 }, categories: [], overallPass: false };

    const categories: Record<number, CategoryResult> = {
      1: { categoryId: 1, correct: 0, total: 0, pass: false },
      2: { categoryId: 2, correct: 0, total: 0, pass: false },
      3: { categoryId: 3, correct: 0, total: 0, pass: false },
    };

    let totalCorrect = 0;

    state.filteredQuestions.forEach((q) => {
      const userAnswer = state.answers[q.question_number];
      const correctOption = q.options.find((opt) => opt.correct_answer);
      const isCorrect = correctOption && userAnswer === correctOption.answer_number;

      if (isCorrect) totalCorrect++;

      const catResult = categories[q.category];
      if (catResult) {
        catResult.total++;
        if (isCorrect) catResult.correct++;
      }
    });

    // Determine pass/fail for each category
    categories[1].pass = categories[1].correct >= PASS_THRESHOLDS.RULES;
    categories[2].pass = categories[2].correct >= PASS_THRESHOLDS.SIGNS;
    categories[3].pass = categories[3].correct >= PASS_THRESHOLDS.CONTROLS;

    // Filter out categories that weren't in this test
    const relevantCategories = Object.values(categories).filter(c => c.total > 0);

    let overallPass = false;
    if (state.user?.testType === 'simulation') {
      overallPass = relevantCategories.every(c => c.pass);
    } else {
      overallPass = relevantCategories[0]?.pass || false;
    }

    const totalQuestions = state.filteredQuestions.length;

    return {
      score: {
        correct: totalCorrect,
        total: totalQuestions,
        percentage: Math.round((totalCorrect / totalQuestions) * 100),
      },
      categories: relevantCategories,
      overallPass,
    };
  };

  const getElapsedSeconds = () => {
    if (!state.startTime) return 0;
    const endTime = state.isComplete ? Date.now() : Date.now();
    return Math.floor((endTime - state.startTime) / 1000);
  };

  return (
    <QuizContext.Provider
      value={{ ...state, startQuiz, answerQuestion, goToPrevious, resetQuiz, getResults, getElapsedSeconds }}
    >
      {children}
    </QuizContext.Provider>
  );
}

export function useQuiz() {
  const context = useContext(QuizContext);
  if (context === undefined) {
    throw new Error("useQuiz must be used within a QuizProvider");
  }
  return context;
}

