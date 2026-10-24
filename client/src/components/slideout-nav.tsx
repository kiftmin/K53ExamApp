import { useState } from "react";
import { useLocation } from "wouter";
import { House, BookOpen, History, Settings, Menu, X, LogOut } from "lucide-react";
import { cn } from "@/lib/utils";
import { clearSignLocalData } from "@/lib/sign-storage";
import { clearRuleLocalData } from "@/lib/rule-storage";
import { clearControlLocalData } from "@/lib/control-storage";
import { clearQuestionResultsLocalData } from "@/lib/question-results";
import { clearQuizHistoryLocalData } from "@/lib/quiz-history";
import { clearProgressOwner } from "@/lib/progress-owner";

const LINKS = [
  { path: "/", label: "Home", icon: House },
  { path: "/study", label: "Study Modules", icon: BookOpen },
  { path: "/history", label: "Past tests", icon: History },
  { path: "/admin", label: "Admin", icon: Settings },
];

function clearSession() {
  if (typeof sessionStorage !== "undefined") {
    sessionStorage.removeItem("k53_access_code");
    sessionStorage.removeItem("k53_mobile_number");
  }
  if (typeof localStorage !== "undefined") {
    localStorage.removeItem("k53_name");
    localStorage.removeItem("k53_surname");
    localStorage.removeItem("k53_license_code");
    localStorage.removeItem("driving-license-quiz-state");
    clearSignLocalData();
    clearRuleLocalData();
    clearControlLocalData();
    clearQuestionResultsLocalData();
    clearQuizHistoryLocalData();
    clearProgressOwner();
  }
}

export function SlideoutNav() {
  const [open, setOpen] = useState(false);
  const [location, setLocation] = useLocation();

  const handleLogout = () => {
    clearSession();
    setOpen(false);
    setLocation("/");
  };

  return (
    <>
      <button
        aria-label="Open menu"
        onClick={() => setOpen(true)}
        className="fixed top-3 left-3 z-40 h-10 w-10 rounded-xl bg-card border border-border shadow-sm flex items-center justify-center"
      >
        <Menu className="h-5 w-5" />
      </button>

      {open && (
        <div className="fixed inset-0 z-50" onClick={() => setOpen(false)}>
          <div className="absolute inset-0 bg-black/40" />
          <aside
            className="absolute left-0 top-0 h-full w-64 bg-background shadow-xl p-4 space-y-1"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <p className="font-display font-bold text-sm">K53 K-Guide</p>
              <button aria-label="Close menu" onClick={() => setOpen(false)} className="p-1">
                <X className="h-5 w-5" />
              </button>
            </div>
            {LINKS.map(({ path, label, icon: Icon }) => (
              <button
                key={path}
                onClick={() => { setLocation(path); setOpen(false); }}
                className={cn(
                  "w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold",
                  (location === path || (path !== "/" && location.startsWith(path))) ? "bg-primary/10 text-primary" : "text-foreground hover:bg-muted"
                )}
              >
                <Icon className="h-4 w-4" />
                {label}
              </button>
            ))}
            <div className="pt-3 border-t border-border mt-3 space-y-1">
              <button
                onClick={handleLogout}
                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold text-foreground hover:bg-muted hover:text-destructive"
              >
                <LogOut className="h-4 w-4 text-destructive" />
                Logout
              </button>
            </div>
          </aside>
        </div>
      )}
    </>
  );
}
