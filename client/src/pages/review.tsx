import { useEffect, useState, useCallback } from "react";
import { useLocation, Link } from "wouter";
import { useQuiz } from "@/lib/quiz-context";
import { Layout } from "@/components/layout";
import { Button } from "@/components/ui/button";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, CheckCircle2, XCircle, AlertTriangle } from "lucide-react";
import { CATEGORY_NAMES } from "@shared/schema";

const getCategoryLabel = (cat: number) => {
  return CATEGORY_NAMES[cat] || `Category ${cat}`;
};

const getLicenseLabel = (code: string) => {
  switch (code) {
    case "01": return "Code 01";
    case "02": return "Code 02";
    case "03": return "Code 03";
    default: return null;
  }
};

export default function Review() {
  const [_, setLocation] = useLocation();
  const { user, filteredQuestions, answers, isComplete } = useQuiz();
  const [failedImages, setFailedImages] = useState<Set<number>>(() => new Set());

  const handleImageError = useCallback((questionNumber: number) => {
    setFailedImages((prev) => new Set(prev).add(questionNumber));
  }, []);

  useEffect(() => {
    if (!user || !isComplete) {
      setLocation("/");
    }
  }, [user, isComplete, setLocation]);

  if (!user || !isComplete) return null;

  return (
    <Layout>
      <div className="w-full space-y-6 animate-in fade-in duration-500">
        <div className="flex items-center gap-4">
          <Link href="/results">
            <Button variant="ghost" size="icon" className="rounded-full hover:bg-background">
              <ArrowLeft className="w-5 h-5" />
            </Button>
          </Link>
          <div>
            <h2 className="text-2xl font-display font-bold">Detailed Review</h2>
            <p className="text-sm text-muted-foreground">Review your performance on each question</p>
          </div>
        </div>

        <div className="bg-card rounded-2xl border border-border shadow-sm overflow-hidden">
          <Accordion type="multiple" className="w-full">
            {filteredQuestions.map((q, index) => {
              const userAnswerNum = answers[q.question_number];
              const correctOption = q.options.find(opt => opt.correct_answer);
              const isCorrect = userAnswerNum === correctOption?.answer_number;
              const isUnanswered = !userAnswerNum;

              return (
                <AccordionItem key={q.question_number} value={`item-${q.question_number}`} className="border-b last:border-0">
                  <AccordionTrigger className="px-6 py-4 hover:bg-muted/50 transition-colors">
                    <div className="flex items-start text-left gap-4 pr-4">
                      <div className="mt-1 flex-shrink-0">
                        {isCorrect ? (
                          <CheckCircle2 className="w-5 h-5 text-success" />
                        ) : (
                          <XCircle className={`w-5 h-5 ${isUnanswered ? 'text-muted-foreground' : 'text-destructive'}`} />
                        )}
                      </div>
                      <div>
                        <div className="flex flex-wrap gap-2 mb-2 justify-end">
                          <Badge variant="secondary" className="px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider bg-neutral-100 text-neutral-600 border-none">
                            {getCategoryLabel(q.category)}
                          </Badge>
                          {q.is_official && (
                            <Badge className="px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider bg-blue-500 text-white hover:bg-blue-600 border-none shadow-sm">
                              Braindump
                            </Badge>
                          )}
                          {getLicenseLabel(q.license_code) && (
                            <Badge variant="outline" className="px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider border-2 border-primary/20 text-primary">
                              {getLicenseLabel(q.license_code)}
                            </Badge>
                          )}
                        </div>
                        <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground block mb-1">
                          Question {index + 1}
                        </span>
                        <span className={`font-medium leading-relaxed ${isCorrect ? 'text-success' : 'text-foreground'}`}>
                          {q.question_text}
                        </span>
                      </div>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent className="px-6 pb-6 pt-2 bg-muted/30">

                    {q.contains_image && q.image_link && (
                      <div className="mb-6 rounded-lg overflow-hidden border bg-white flex items-center justify-center max-w-sm mx-auto min-h-[150px]">
                        {failedImages.has(q.question_number) ? (
                          <div className="flex flex-col items-center justify-center text-muted-foreground py-6">
                            <svg className="w-8 h-8 mb-2" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <rect width="18" height="18" x="3" y="3" rx="2" ry="2" />
                              <circle cx="9" cy="9" r="2" />
                              <path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21" />
                            </svg>
                            <p className="text-sm">Image not available</p>
                          </div>
                        ) : (
                          <img src={q.image_link} alt="Question visual" className="w-full h-auto object-contain max-h-[200px]" onError={() => handleImageError(q.question_number)} />
                        )}
                      </div>
                    )}

                    <div className="space-y-3 pl-9">
                      {q.options.map(opt => {
                        const isThisCorrect = opt.correct_answer;
                        const isThisUserSelected = opt.answer_number === userAnswerNum;

                        let optionStyle = "border-border bg-card";
                        let icon = null;

                        if (isThisCorrect) {
                          optionStyle = "border-success bg-success/10 text-success-foreground";
                          icon = <CheckCircle2 className="w-5 h-5 text-success absolute right-4 top-1/2 -translate-y-1/2" />;
                        } else if (isThisUserSelected && !isThisCorrect) {
                          optionStyle = "border-destructive bg-destructive/10 text-destructive-foreground";
                          icon = <XCircle className="w-5 h-5 text-destructive absolute right-4 top-1/2 -translate-y-1/2" />;
                        }

                        return (
                          <div key={opt.answer_number} className={`relative flex items-center p-3 rounded-xl border-2 transition-colors ${optionStyle}`}>
                            <span className={`flex items-center justify-center w-7 h-7 rounded-full text-sm font-bold mr-3 shrink-0 ${isThisCorrect ? 'bg-success text-white' : isThisUserSelected ? 'bg-destructive text-white' : 'bg-secondary text-secondary-foreground'}`}>
                              {opt.answer_number}
                            </span>
                            <span className={`font-medium pr-8 ${isThisCorrect ? 'text-success font-bold' : isThisUserSelected ? 'text-destructive font-bold' : 'text-foreground'}`}>
                              {opt.answer_text}
                            </span>
                            {icon}
                          </div>
                        );
                      })}

                      {isUnanswered && (
                        <div className="mt-4 inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-muted text-muted-foreground text-sm font-medium">
                          <AlertTriangle className="w-4 h-4" />
                          You did not answer this question.
                        </div>
                      )}
                    </div>
                  </AccordionContent>
                </AccordionItem>
              );
            })}
          </Accordion>
        </div>
      </div>
    </Layout>
  );
}
