import { useEffect } from "react";
import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import type { StudySign } from "@shared/schema";
import { Layout } from "@/components/layout";
import { Card, CardContent } from "@/components/ui/card";
import { BookOpen, Car, Signpost, TrafficCone, ArrowLeft } from "lucide-react";

export function useStudyGate(): boolean {
  const [, setLocation] = useLocation();
  const allowed = typeof sessionStorage !== "undefined" && !!sessionStorage.getItem("k53_access_code");
  useEffect(() => {
    if (!allowed) setLocation("/");
  }, [allowed, setLocation]);
  return allowed;
}

export default function Study() {
  const [, setLocation] = useLocation();
  const allowed = useStudyGate();
  const { data: signs = [] } = useQuery<StudySign[]>({
    queryKey: ["/api/signs"],
    enabled: allowed,
  });

  if (!allowed) return null;

  return (
    <Layout>
      <div className="py-6 px-1 space-y-5">
        <button
          onClick={() => setLocation("/")}
          className="flex items-center gap-1 text-xs font-semibold text-muted-foreground"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> Home
        </button>

        <div className="text-center space-y-1">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-primary/10 text-primary text-xs font-semibold">
            <BookOpen className="h-3.5 w-3.5" /> Cold-study modules
          </div>
          <h1 className="text-2xl font-display font-extrabold tracking-tight">Study</h1>
          <p className="text-sm text-muted-foreground">Learn the material before you test yourself.</p>
        </div>

        <div className="space-y-3">
          <Card
            className="glass-card border-none shadow-xl rounded-3xl cursor-pointer transition-transform hover:-translate-y-0.5"
            onClick={() => setLocation("/study/signs")}
          >
            <CardContent className="p-5 flex items-center gap-4">
              <div
                className="h-12 w-12 rounded-2xl flex items-center justify-center text-white shrink-0"
                style={{ background: "linear-gradient(135deg, #E53E1A, #F5A623)" }}
              >
                <Signpost className="h-6 w-6" />
              </div>
              <div className="flex-1">
                <p className="font-display font-bold">Road Signs</p>
                <p className="text-xs text-muted-foreground">
                  {signs.length > 0 ? `${signs.length} signs · browse & flashcards` : "Browse & flashcards"}
                </p>
              </div>
              <span className="text-[10px] font-black uppercase tracking-widest text-green-600 bg-green-500/10 px-2 py-1 rounded-full">
                Active
              </span>
            </CardContent>
          </Card>

          {[
            { icon: TrafficCone, title: "Rules of the Road", desc: "Prose-based module" },
            { icon: Car, title: "Vehicle Controls", desc: "Prose-based module" },
          ].map((m) => (
            <Card key={m.title} className="rounded-3xl opacity-60">
              <CardContent className="p-5 flex items-center gap-4">
                <div className="h-12 w-12 rounded-2xl bg-muted flex items-center justify-center text-muted-foreground shrink-0">
                  <m.icon className="h-6 w-6" />
                </div>
                <div className="flex-1">
                  <p className="font-display font-bold">{m.title}</p>
                  <p className="text-xs text-muted-foreground">{m.desc}</p>
                </div>
                <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground bg-muted px-2 py-1 rounded-full">
                  Coming soon
                </span>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </Layout>
  );
}
