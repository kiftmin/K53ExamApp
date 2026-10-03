import { useState } from "react";
import {
  getControlsLicenceCode,
  setControlsLicenceCode,
  getControlsGearbox,
  setControlsGearbox,
  clearControlsLicenceCode,
  clearControlsGearbox,
  type ControlLicenceCode,
  type ControlGearbox,
} from "@/lib/control-storage";

/**
 * Two-step session gate for Vehicle Controls:
 * 1. licence code (1 motorcycle / 2 light vehicle / 3 light+heavy)
 * 2. gearbox — only when code is 2 or 3. Code 1 (motorcycle) skips straight through.
 * Both are stored in localStorage and re-selectable.
 */
export default function ControlsStudyGate({
  children,
}: {
  children: (licence: ControlLicenceCode, gearbox: ControlGearbox | null, reset: () => void) => React.ReactNode;
}) {
  const [licence, setLicence] = useState<ControlLicenceCode | null>(() => getControlsLicenceCode());
  const [gearbox, setGearbox] = useState<ControlGearbox | null>(() => getControlsGearbox());

  const needGearbox = licence === 2 || licence === 3;

  const reset = () => {
    clearControlsLicenceCode();
    clearControlsGearbox();
    setLicence(null);
    setGearbox(null);
  };

  if (!licence) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center gap-4 px-6 text-center">
        <h2 className="text-xl font-display font-bold">Which licence code are you driving?</h2>
        <p className="text-sm text-muted-foreground">Controls differ by vehicle type. You can change this later.</p>
        <div className="grid grid-cols-3 gap-3 w-full max-w-sm">
          {([1, 2, 3] as ControlLicenceCode[]).map((c) => (
            <button
              key={c}
              onClick={() => { setControlsLicenceCode(c); setLicence(c); }}
              className="rounded-2xl border-2 border-border p-4 hover:border-primary hover:bg-primary/5 transition-colors"
            >
              <p className="text-2xl font-display font-extrabold">{c}</p>
              <p className="text-[10px] text-muted-foreground font-semibold mt-1">
                {c === 1 ? "Motorcycle" : c === 2 ? "Light Vehicle" : "Light + Heavy"}
              </p>
            </button>
          ))}
        </div>
      </div>
    );
  }

  if (needGearbox && !gearbox) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center gap-4 px-6 text-center">
        <h2 className="text-xl font-display font-bold">Manual or automatic gearbox?</h2>
        <p className="text-sm text-muted-foreground">Code {licence} has separate LMV/HMV manual and automatic layouts.</p>
        <div className="grid grid-cols-2 gap-3 w-full max-w-sm">
          {(["manual", "automatic"] as ControlGearbox[]).map((g) => (
            <button
              key={g}
              onClick={() => { setControlsGearbox(g); setGearbox(g); }}
              className="rounded-2xl border-2 border-border p-4 hover:border-primary hover:bg-primary/5 transition-colors"
            >
              <p className="text-lg font-display font-extrabold capitalize">{g}</p>
            </button>
          ))}
        </div>
        <button onClick={() => { clearControlsLicenceCode(); setLicence(null); }} className="text-xs text-muted-foreground">
          Change licence code
        </button>
      </div>
    );
  }

  return <>{children(licence, needGearbox ? gearbox : null, reset)}</>;
}
