import { useState } from "react";
import { useLocation } from "wouter";
import { House, BookOpen, Settings, Menu, X } from "lucide-react";
import { cn } from "@/lib/utils";

const LINKS = [
  { path: "/", label: "Home", icon: House },
  { path: "/study", label: "Study Modules", icon: BookOpen },
  { path: "/admin", label: "Admin", icon: Settings },
];

export function SlideoutNav() {
  const [open, setOpen] = useState(false);
  const [location, setLocation] = useLocation();

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
          </aside>
        </div>
      )}
    </>
  );
}
