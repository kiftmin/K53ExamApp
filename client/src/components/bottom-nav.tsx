import { useLocation } from "wouter";
import { House, BookOpen, Settings } from "lucide-react";
import { cn } from "@/lib/utils";

const TABS = [
  { path: "/", label: "Home", icon: House },
  { path: "/study", label: "Study", icon: BookOpen },
  { path: "/admin", label: "Admin", icon: Settings },
];

export function BottomNav() {
  const [location, setLocation] = useLocation();

  // Keep the exam flow clean — no nav while in a test / results / review.
  const hidden = ["/quiz", "/results", "/review"].some((p) => location.startsWith(p));
  if (hidden) return null;

  return (
    <nav className="fixed bottom-0 inset-x-0 z-40 border-t border-border bg-background/95 backdrop-blur">
      <div className="max-w-2xl mx-auto grid grid-cols-3 px-4 py-2 pb-[max(env(safe-area-inset-bottom),0.5rem)]">
        {TABS.map(({ path, label, icon: Icon }) => {
          const active = location === path || (path !== "/" && location.startsWith(path));
          return (
            <button
              key={path}
              onClick={() => setLocation(path)}
              className={cn(
                "flex flex-col items-center gap-0.5 py-1 text-[11px] font-semibold transition-colors",
                active ? "text-primary" : "text-muted-foreground"
              )}
            >
              <Icon className={cn("h-5 w-5", active && "fill-primary/10")} />
              {label}
            </button>
          );
        })}
      </div>
    </nav>
  );
}
