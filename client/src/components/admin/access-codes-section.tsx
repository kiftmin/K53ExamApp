import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { KeyRound, CalendarSearch, Copy } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import AccessCodeManager from "@/components/access-code-manager";

export default function AccessCodesSection() {
  const { toast } = useToast();
  const [todayCode, setTodayCode] = useState("");
  const [todayDate, setTodayDate] = useState("");
  const [countdown, setCountdown] = useState("");
  const [lookupDate, setLookupDate] = useState("");
  const [lookupCode, setLookupCode] = useState("");

  useEffect(() => {
    const fetchCode = async () => {
      try {
        const res = await fetch('/api/access-code/today');
        const data = await res.json();
        setTodayCode(data.code);
        setTodayDate(data.date);
      } catch (err) {
        console.error('Failed to fetch access code:', err);
      }
    };
    fetchCode();
  }, []);

  useEffect(() => {
    const updateCountdown = () => {
      const now = new Date();
      const sast = new Date(now.getTime() + 2 * 60 * 60 * 1000);
      const endOfDay = new Date(sast);
      endOfDay.setHours(23, 59, 59, 999);
      const diff = endOfDay.getTime() - sast.getTime();
      const h = Math.floor(diff / 3600000);
      const m = Math.floor((diff % 3600000) / 60000);
      const s = Math.floor((diff % 60000) / 1000);
      setCountdown(`${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`);
    };
    updateCountdown();
    const interval = setInterval(updateCountdown, 1000);
    return () => clearInterval(interval);
  }, []);

  const copy = (code: string, label: string) => {
    navigator.clipboard.writeText(code);
    toast({ title: label });
  };

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-xl font-display font-bold tracking-tight">Access Codes</h2>
        <p className="text-sm text-muted-foreground">Daily codes learners need to start a session.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="glass-card rounded-2xl p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="p-1.5 bg-primary/10 text-primary rounded-lg">
                <KeyRound className="h-3.5 w-3.5" />
              </div>
              <span className="text-[11px] font-black text-muted-foreground uppercase tracking-wider">Today</span>
            </div>
            <span className="text-[11px] font-mono font-bold text-primary bg-primary/10 px-2.5 py-1 rounded-full">
              Expires in {countdown}
            </span>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex-1 text-3xl font-black font-mono tracking-[0.2em] text-center uppercase py-4 rounded-xl bg-accent border border-primary/20">
              {todayCode || "-------"}
            </div>
            <Button
              variant="outline"
              size="icon"
              aria-label="Copy today's code"
              onClick={() => copy(todayCode, "Copied to clipboard")}
              className="h-12 w-12 rounded-xl shrink-0"
            >
              <Copy className="h-4 w-4" />
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            Valid for {todayDate || "today"}
          </p>
        </div>

        <div className="glass-card rounded-2xl p-6 space-y-4">
          <div className="flex items-center gap-2">
            <div className="p-1.5 bg-primary/10 text-primary rounded-lg">
              <CalendarSearch className="h-3.5 w-3.5" />
            </div>
            <span className="text-[11px] font-black text-muted-foreground uppercase tracking-wider">Look up a past code</span>
          </div>
          <div className="flex items-center gap-2">
            <Input
              type="date"
              value={lookupDate}
              onChange={(e) => setLookupDate(e.target.value)}
              className="h-11 bg-background/60"
            />
            <Button
              onClick={async () => {
                if (!lookupDate) return;
                const res = await fetch(`/api/access-code/lookup?date=${lookupDate}`);
                const data = await res.json();
                setLookupCode(data.code);
              }}
              disabled={!lookupDate}
              className="h-11 shrink-0"
            >
              Look Up
            </Button>
          </div>
          {lookupCode ? (
            <div className="flex items-center gap-2 animate-in fade-in slide-in-from-top-2">
              <div className="flex-1 font-mono font-black tracking-[0.2em] text-center uppercase py-3 rounded-xl bg-accent border border-primary/20">
                {lookupCode}
              </div>
              <Button
                variant="ghost"
                size="icon"
                aria-label="Copy looked-up code"
                onClick={() => copy(lookupCode, "Copied lookup code")}
                className="h-10 w-10 shrink-0"
              >
                <Copy className="h-3.5 w-3.5" />
              </Button>
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">Select a date to reveal its code.</p>
          )}
        </div>
      </div>

      <AccessCodeManager />
    </div>
  );
}
