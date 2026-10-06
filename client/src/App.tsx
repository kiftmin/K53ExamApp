import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QuizProvider } from "@/lib/quiz-context";

import NotFound from "@/pages/not-found";
import Home from "@/pages/home";
import Quiz from "@/pages/quiz";
import Results from "@/pages/results";
import Review from "@/pages/review";
import Study from "@/pages/study";
import StudySignsBrowse from "@/pages/study-signs";
import StudySignsFlashcards from "@/pages/study-flashcards";
import StudyRulesBrowse from "@/pages/study-rules";
import StudyRulesFlashcards from "@/pages/study-rules-flashcards";
import StudyControlsBrowse from "@/pages/study-controls";
import StudyControlsFlashcards from "@/pages/study-controls-flashcards";

import Admin from "@/pages/admin";
import { BottomNav } from "@/components/bottom-nav";

function Router() {
  return (
    <Switch>
      <Route path="/" component={Home} />
      <Route path="/admin" component={Admin} />
      <Route path="/quiz" component={Quiz} />
      <Route path="/results" component={Results} />
      <Route path="/review" component={Review} />
      <Route path="/study" component={Study} />
      <Route path="/study/signs" component={StudySignsBrowse} />
      <Route path="/study/signs/flashcards" component={StudySignsFlashcards} />
      <Route path="/study/rules" component={StudyRulesBrowse} />
      <Route path="/study/rules/flashcards" component={StudyRulesFlashcards} />
      <Route path="/study/controls" component={StudyControlsBrowse} />
      <Route path="/study/controls/flashcards" component={StudyControlsFlashcards} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <QuizProvider>
          <Router />
          <BottomNav />
        </QuizProvider>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
