import { useEffect, useState, useRef } from "react";
import { useLocation, Link } from "wouter";
import { motion } from "framer-motion";
import { useQuiz } from "@/lib/quiz-context";
import { Layout } from "@/components/layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Share2,
  RefreshCw,
  ListChecks,
  Award,
  Trophy,
  AlertTriangle,
  Clock,
  CheckCircle2,
  XCircle,
  RotateCcw,
  FileDown,
  Image as ImageIcon,
  Download
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useQuery } from "@tanstack/react-query";
import { Question, CATEGORY_NAMES } from "@shared/schema";
import html2canvas from 'html2canvas';

const LOGO_URL = "https://res.cloudinary.com/dkhgsi8l7/image/upload/v1773061809/logo_edited_vlgoqy.jpg";

export default function Results() {
  const [_, setLocation] = useLocation();
  const { user, getResults, resetQuiz, isComplete, getElapsedSeconds, startQuiz } = useQuiz();
  const { toast } = useToast();
  const cardRef = useRef<HTMLDivElement>(null);
  const [isExporting, setIsExporting] = useState(false);

  const { data: questions } = useQuery<Question[]>({
    queryKey: ["/api/questions"],
  });

  useEffect(() => {
    if (!user || !isComplete) {
      setLocation("/");
    }
  }, [user, isComplete, setLocation]);

  if (!user || !isComplete) return null;

  const { score, categories, overallPass } = getResults();
  const isPassing = overallPass;

  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60).toString().padStart(2, "0");
    const s = (secs % 60).toString().padStart(2, "0");
    return `${m}:${s}`;
  };
  const elapsedTime = formatTime(getElapsedSeconds());

  const generateImage = async () => {
    if (!cardRef.current) return null;
    try {
      const canvas = await html2canvas(cardRef.current, {
        useCORS: true,
        backgroundColor: '#f8fafc',
        scale: 2,
        logging: false,
        onclone: (document) => {
          // You can perform any DOM manipulations on the cloned document here if needed
        }
      });
      return canvas.toDataURL('image/png', 1.0);
    } catch (err) {
      console.error('Error generating image:', err);
      toast({
        title: "Generation failed",
        description: "Could not capture the report card. Please try again.",
        variant: "destructive",
      });
      return null;
    }
  };

  const handleShare = async () => {
    setIsExporting(true);
    const dataUrl = await generateImage();

    if (!dataUrl) {
      toast({
        title: "Error",
        description: "Could not generate report card image.",
        variant: "destructive",
      });
      setIsExporting(false);
      return;
    }

    const blob = await (await fetch(dataUrl)).blob();
    const file = new File([blob], `K53_Report_Card_${user.name}.png`, { type: 'image/png' });

    let text = "";
    if (user.testType === 'simulation') {
      text = `I just ${isPassing ? 'PASSED' : 'completed'} my K53 Exam Simulation with a total score of ${score.correct}/${score.total}!`;
    } else {
      text = `I just scored ${score.percentage}% (${score.correct}/${score.total}) on my K53 Category Test!`;
    }

    if (navigator.share && navigator.canShare && navigator.canShare({ files: [file] })) {
      try {
        await navigator.share({
          files: [file],
          title: "Jean's Driving School - K53 Results",
          text: text,
        });
      } catch (err) {
        if ((err as Error).name !== 'AbortError') {
          console.error("Error sharing:", err);
        }
      }
    } else {
      // Fallback: Download the image
      const link = document.createElement('a');
      link.download = `K53_Report_Card_${user.name}.png`;
      link.href = dataUrl;
      link.click();
      toast({
        title: "Success",
        description: "Report card downloaded as image. You can now share it manually!",
      });
    }
    setIsExporting(false);
  };


  const handleNextBatch = () => {
    if (!questions) return;
    startQuiz(user, questions);
    setLocation("/quiz");
  };

  const handleRetake = () => {
    resetQuiz();
    setLocation("/");
  };

  const getCategoryName = (id: number) => {
    return CATEGORY_NAMES[id] || "Unknown";
  };

  return (
    <Layout>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: "easeOut" }}
        className="w-full space-y-6"
      >
        <div ref={cardRef}>
          <Card className="glass-card overflow-hidden relative border-none shadow-2xl">
            <div className={`absolute top-0 left-0 w-full h-32 ${isPassing ? 'bg-gradient-to-br from-success to-emerald-400' : 'bg-gradient-to-br from-destructive to-red-400'}`} />

            <CardContent className="pt-4 pb-12 px-6 sm:px-12 flex flex-col items-center relative z-10">
              <div className="mb-14 flex justify-center">
                <img
                  src={LOGO_URL}
                  alt="Driving School Logo"
                  crossOrigin="anonymous"
                  className="h-20 w-auto object-contain rounded-lg shadow-sm bg-white p-1"
                />
              </div>

              <div className="mb-10 text-center">
                <p className="text-sm text-muted-foreground uppercase tracking-[0.3em] font-black">
                  Report Card
                </p>
              </div>

              <div className={`w-24 h-24 rounded-full flex items-center justify-center bg-card shadow-xl mb-6 border-4 ${isPassing ? 'border-success text-success' : 'border-destructive text-destructive'}`}>
                {isPassing ? <Trophy className="w-12 h-12" /> : <AlertTriangle className="w-12 h-12" />}
              </div>

              <h2 className="text-3xl sm:text-4xl font-display font-black text-foreground mb-6">
                {isPassing ? "PASSED!" : "DID NOT PASS"}
              </h2>

              <div className="w-full max-w-sm mb-10 text-center">
                <p className="text-xl font-bold text-foreground">
                  {user.name} {user.surname}
                </p>
                <p className="text-muted-foreground">
                  License Code {user.licenseCode} • {user.testType === 'simulation' ? 'Exam Simulation' : getCategoryName(user.category)}
                </p>
              </div>

              <div className="w-full max-w-sm space-y-4 mb-8">
                {categories.map((cat) => (
                  <div key={cat.categoryId} className="bg-muted/30 rounded-2xl p-4 border border-border/50 flex items-center justify-between">
                    <div className="text-left">
                      <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-0.5">
                        {getCategoryName(cat.categoryId)}
                      </p>
                      <p className="text-sm font-semibold">
                        {cat.correct} / {cat.total}
                      </p>
                    </div>
                    <div className={`flex items-center gap-2 px-3 py-1 rounded-full text-xs font-bold uppercase transition-transform hover:scale-105 ${cat.pass ? 'bg-success/20 text-success' : 'bg-destructive/20 text-destructive'}`}>
                      {cat.pass ? <CheckCircle2 className="w-4 h-4" /> : <XCircle className="w-4 h-4" />}
                      {cat.pass ? 'PASS' : 'FAIL'}
                    </div>
                  </div>
                ))}

                <div className="pt-6 mt-6 border-t flex items-center justify-between">
                  <div className="text-left">
                    <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-0.5">Overall Performance</p>
                    <p className="text-2xl font-black text-foreground">{score.percentage}%</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-0.5">Time Taken</p>
                    <p className="text-lg font-bold text-foreground">{elapsedTime}</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 w-full max-w-md mx-auto">
          <Link href="/review" className="w-full">
            <Button className="w-full h-14 rounded-xl text-base font-semibold shadow-md" variant="secondary">
              <ListChecks className="w-5 h-5 mr-2" />
              Review All
            </Button>
          </Link>

          <Button
            onClick={handleShare}
            disabled={isExporting}
            className="w-full h-14 rounded-xl text-base font-semibold shadow-md overflow-hidden relative"
            variant="default"
            style={{ background: "linear-gradient(135deg, #E53E1A 0%, #F5A623 100%)", border: "none" }}
          >
            {isExporting ? <RotateCcw className="w-5 h-5 mr-2 animate-spin" /> : <Share2 className="w-5 h-5 mr-2" />}
            {isExporting ? "Generating..." : "Share Image"}
          </Button>


          {user.testType === 'category' && (
            <Button onClick={handleNextBatch} className="w-full h-14 rounded-xl text-base font-semibold shadow-md group" variant="default">
              <RotateCcw className="w-5 h-5 mr-2 transition-transform group-hover:-rotate-90" />
              Try Next Batch
            </Button>
          )}

          <Button onClick={handleRetake} className={`w-full h-14 rounded-xl text-base font-semibold shadow-md ${user.testType === 'simulation' ? 'sm:col-span-2' : ''}`} variant="outline">
            <RefreshCw className="w-5 h-5 mr-2" />
            Start New Test
          </Button>
        </div>
      </motion.div>
    </Layout>
  );
}
