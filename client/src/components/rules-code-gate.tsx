import { useState } from "react";
import { getRulesLicenceCode, setRulesLicenceCode, clearRulesLicenceCode } from "@/lib/rule-storage";

/**
 * Licence-code gate for the Rules study module.
 * Renders the 3-option picker when no code is chosen, remembers the choice,
 * and exposes `code === null` while unselected. Controlled-internal:
 * `children` receives the current code, `onReset` re-opens the picker.
 */
export default function RulesCodeGate({
  children,
}: {
  children: (code: number, reset: () => void) => React.ReactNode;
}) {
  const [code, setCode] = useState<number | null>(() => getRulesLicenceCode());
  const reset = () => {
    clearRulesLicenceCode();
    setCode(null);
  };
  if (code) return <>{children(code, reset)}</>;
  return (
    <div className="min-h-[60vh] flex flex-col items-center justify-center gap-4 px-6 text-center">
      <h2 className="text-xl font-display font-bold">Which licence code are you studying?</h2>
      <p className="text-sm text-muted-foreground">Rules are filtered to your code. You can change this anytime.</p>
      <div className="grid grid-cols-3 gap-3 w-full max-w-sm">
        {[1, 2, 3].map((c) => (
          <button
            key={c}
            onClick={() => { setRulesLicenceCode(c); setCode(c); }}
            className="rounded-2xl border-2 border-border p-4 hover:border-primary hover:bg-primary/5 transition-colors"
          >
            <p className="text-2xl font-display font-extrabold">{c}</p>
            <p className="text-[10px] text-muted-foreground font-semibold mt-1">
              {c === 1 ? "Motorcycle" : c === 2 ? "Light Motor" : "Light + Heavy"}
            </p>
          </button>
        ))}
      </div>
    </div>
  );
}
