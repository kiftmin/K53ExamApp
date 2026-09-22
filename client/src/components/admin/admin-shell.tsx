import type { ReactNode } from "react";
import { Link } from "wouter";
import { ListChecks, Database, KeyRound, Upload, ArrowLeft } from "lucide-react";
import { cn } from "@/lib/utils";

export type AdminSection = "questions" | "sources" | "codes" | "import";

const NAV: { id: AdminSection; label: string; icon: typeof ListChecks }[] = [
  { id: "questions", label: "Question Bank", icon: ListChecks },
  { id: "sources", label: "Sources", icon: Database },
  { id: "codes", label: "Access Codes", icon: KeyRound },
  { id: "import", label: "Import", icon: Upload },
];

interface AdminShellProps {
  active: AdminSection;
  onNavigate: (s: AdminSection) => void;
  children: ReactNode;
}

export default function AdminShell({ active, onNavigate, children }: AdminShellProps) {
  return (
    <div className="min-h-screen flex flex-col md:flex-row">
      {/* Desktop sidebar */}
      <aside className="hidden md:flex w-60 shrink-0 flex-col border-r border-border bg-card/80 backdrop-blur-md sticky top-0 h-screen">
        <div className="flex items-center gap-3 px-5 pt-6 pb-5">
          <div className="brand-gradient h-9 w-9 rounded-xl flex items-center justify-center text-white font-display font-extrabold text-sm shadow-lg">
            K53
          </div>
          <div>
            <p className="font-display font-bold leading-none">K53 Admin</p>
            <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-widest mt-1">
              Control Centre
            </p>
          </div>
        </div>

        <nav className="flex-1 px-3 space-y-1">
          {NAV.map((item) => {
            const Icon = item.icon;
            const isActive = active === item.id;
            return (
              <button
                key={item.id}
                onClick={() => onNavigate(item.id)}
                className={cn(
                  "hover-elevate w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold text-left border-l-4",
                  isActive
                    ? "border-l-primary bg-accent text-foreground"
                    : "border-l-transparent text-muted-foreground hover:text-foreground hover:bg-accent/50"
                )}
              >
                <Icon className={cn("h-4 w-4", isActive && "text-primary")} />
                {item.label}
              </button>
            );
          })}
        </nav>

        <div className="p-4 border-t border-border">
          <Link
            href="/"
            className="hover-elevate flex items-center gap-2 px-3 py-2.5 rounded-xl text-sm font-semibold text-muted-foreground hover:text-foreground hover:bg-accent/50"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to app
          </Link>
        </div>
      </aside>

      {/* Mobile top bar */}
      <div className="md:hidden sticky top-0 z-30 bg-card/90 backdrop-blur-md border-b border-border">
        <div className="flex items-center justify-between px-4 pt-3">
          <div className="flex items-center gap-2">
            <div className="brand-gradient h-8 w-8 rounded-lg flex items-center justify-center text-white font-display font-extrabold text-xs">
              K53
            </div>
            <span className="font-display font-bold">K53 Admin</span>
          </div>
          <Link
            href="/"
            className="flex items-center gap-1 text-xs font-semibold text-muted-foreground px-2 py-1"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            App
          </Link>
        </div>
        <nav className="flex gap-1 px-3 pb-3 pt-2 overflow-x-auto">
          {NAV.map((item) => {
            const Icon = item.icon;
            const isActive = active === item.id;
            return (
              <button
                key={item.id}
                onClick={() => onNavigate(item.id)}
                className={cn(
                  "flex items-center gap-1.5 px-3 py-2 rounded-full text-xs font-bold whitespace-nowrap transition-colors",
                  isActive
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground bg-muted/60"
                )}
              >
                <Icon className="h-3.5 w-3.5" />
                {item.label}
              </button>
            );
          })}
        </nav>
      </div>

      {/* Content */}
      <main className="flex-1 min-w-0">
        <div className="max-w-6xl mx-auto p-4 md:p-8 pb-32 space-y-6">{children}</div>
      </main>
    </div>
  );
}
