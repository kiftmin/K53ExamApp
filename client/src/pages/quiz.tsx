import { useEffect, useState, useCallback, useRef } from "react";
import { useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { useQuiz } from "@/lib/quiz-context";
import { Layout } from "@/components/layout";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Card, CardContent } from "@/components/ui/card";
import { ChevronRight, ShieldAlert, RotateCcw, ChevronLeft, Clock } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

export default function Quiz() {
  const [_, setLocation] = useLocation();
  const { filteredQuestions, currentIndex, answerQuestion, goToPrevious, isComplete, user, resetQuiz, getElapsedSeconds, answers } = useQuiz();
  const [direction, setDirection] = useState(1); // 1 for forward
  const [elapsedDisplay, setElapsedDisplay] = useState(0);
  const [failedImages, setFailedImages] = useState<Set<number>>(() => new Set());

  const handleImageError = useCallback((questionNumber: number) => {
    setFailedImages((prev) => new Set(prev).add(questionNumber));
  }, []);

  useEffect(() => {
    // Redirect if accessing directly without starting
    if (!user || filteredQuestions.length === 0) {
      setLocation("/");
    }
  }, [user, filteredQuestions, setLocation]);

  useEffect(() => {
    if (isComplete) {
      const timer = setTimeout(() => setLocation("/results"), 400);
      return () => clearTimeout(timer);
    }
  }, [isComplete, setLocation]);

  // Live timer — ticks every second while the quiz is active
  useEffect(() => {
    if (isComplete) return;
    const interval = setInterval(() => {
      setElapsedDisplay(getElapsedSeconds());
    }, 1000);
    return () => clearInterval(interval);
  }, [isComplete, getElapsedSeconds]);

  if (!user || filteredQuestions.length === 0 || isComplete) return null;

  const currentQ = filteredQuestions[currentIndex];
  const progress = (currentIndex / filteredQuestions.length) * 100;

  const handleAnswer = (answerNum: string) => {
    setDirection(1);
    answerQuestion(answerNum);
  };

  const handlePrevious = () => {
    setDirection(-1);
    goToPrevious();
  };

  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60).toString().padStart(2, "0");
    const s = (secs % 60).toString().padStart(2, "0");
    return `${m}:${s}`;
  };

  const variants = {
    enter: (direction: number) => ({
      x: direction > 0 ? 50 : -50,
      opacity: 0,
      scale: 0.95
    }),
    center: {
      zIndex: 1,
      x: 0,
      opacity: 1,
      scale: 1,
    },
    exit: (direction: number) => ({
      zIndex: 0,
      x: direction < 0 ? 50 : -50,
      opacity: 0,
      scale: 0.95
    })
  };

  return (
    <Layout>
      <div className="w-full space-y-6">

        {/* Progress Header */}
        <div className="space-y-2">
          <div className="flex justify-between items-end">
            <div className="flex items-center gap-4">
              <span className="text-sm font-bold text-muted-foreground uppercase tracking-wider">
                Question {currentIndex + 1} of {filteredQuestions.length}
              </span>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 px-2 text-xs gap-1.5 text-muted-foreground"
                disabled={currentIndex === 0}
                onClick={handlePrevious}
              >
                <ChevronLeft className="w-3.5 h-3.5" />
                Previous
              </Button>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="ghost" size="sm" className="h-7 px-2 text-xs gap-1.5 text-muted-foreground hover:text-destructive">
                    <RotateCcw className="w-3.5 h-3.5" />
                    Restart
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Restart Test?</AlertDialogTitle>
                    <AlertDialogDescription>
                      This will reset your current progress and take you back to the start.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={() => {
                        resetQuiz();
                        setLocation("/");
                      }}
                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    >
                      Restart
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
            <div className="flex items-center gap-3">
              <span className="flex items-center gap-1 text-sm text-muted-foreground font-medium">
                <Clock className="w-3.5 h-3.5" />
                {formatTime(elapsedDisplay)}
              </span>
              <span className="text-sm font-semibold text-primary">
                {Math.round(progress)}%
              </span>
            </div>
          </div>
          <Progress value={progress} className="h-2.5 rounded-full bg-secondary" />
        </div>

        {/* Question Container */}
        <div className="relative min-h-[400px]">
          <AnimatePresence mode="wait" custom={direction}>
            <motion.div
              key={currentIndex}
              custom={direction}
              variants={variants}
              initial="enter"
              animate="center"
              exit="exit"
              transition={{
                x: { type: "spring", stiffness: 300, damping: 30 },
                opacity: { duration: 0.2 },
                scale: { duration: 0.2 }
              }}
              className="absolute w-full"
            >
              <Card className="glass-card overflow-hidden shadow-xl border-t-4 border-t-primary">
                <CardContent className="p-6 sm:p-8 space-y-8">

                  <h3 className="text-xl sm:text-2xl font-display font-medium text-foreground leading-snug">
                    {currentQ.question_text}
                  </h3>

                  {currentQ.contains_image && currentQ.image_link && (
                    <div className="relative rounded-xl overflow-hidden border bg-muted flex items-center justify-center min-h-[200px]">
                      {failedImages.has(currentQ.question_number) ? (
                        <div className="flex flex-col items-center justify-center text-muted-foreground py-8">
                          <svg className="w-10 h-10 mb-2" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <rect width="18" height="18" x="3" y="3" rx="2" ry="2" />
                            <circle cx="9" cy="9" r="2" />
                            <path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21" />
                          </svg>
                          <p className="text-sm">Image not available</p>
                        </div>
                      ) : (
                        <img
                          src={currentQ.image_link}
                          alt="Question reference"
                          className="w-full h-auto max-h-[300px] object-contain"
                          onError={() => handleImageError(currentQ.question_number)}
                        />
                      )}
                    </div>
                  )}

                  <div className="space-y-3">
                    {currentQ.options.map((opt: any) => {
                      const isSelected = answers[currentQ.question_number] === opt.answer_number;
                      return (
                        <button
                          key={opt.answer_number}
                          onClick={() => handleAnswer(opt.answer_number)}
                          className={cn(
                            "w-full text-left flex items-center p-4 rounded-xl border-2 transition-all duration-200 group relative",
                            isSelected 
                              ? "border-primary bg-primary/10" 
                              : "border-border bg-card hover:border-primary hover:bg-primary/5"
                          )}
                        >
                          <span className={cn(
                            "flex items-center justify-center w-8 h-8 rounded-full font-bold mr-4 transition-colors shrink-0",
                            isSelected
                              ? "bg-primary text-primary-foreground"
                              : "bg-secondary text-secondary-foreground group-hover:bg-primary group-hover:text-primary-foreground"
                          )}>
                            {opt.answer_number}
                          </span>
                          <span className={cn(
                            "font-medium text-foreground pr-8 flex-1",
                            isSelected && "font-bold"
                          )}>
                            {opt.answer_text}
                          </span>
                          <ChevronRight className={cn(
                            "w-5 h-5 absolute right-4 transition-all text-primary",
                            isSelected ? "opacity-100 translate-x-0" : "opacity-0 -translate-x-2 group-hover:opacity-100 group-hover:translate-x-0"
                          )} />
                        </button>
                      );
                    })}
                  </div>

                </CardContent>
              </Card>
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
    </Layout>
  );
}
