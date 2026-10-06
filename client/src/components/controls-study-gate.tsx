import { useState } from "react";
import {
  getControlsLicenceCode,
  setControlsLicenceCode,
  clearControlsLicenceCode,
  clearControlsGearbox,
  type ControlLicenceCode,
  type ControlGearbox,
} from "@/lib/control-storage";

/**
 * Session gate for Vehicle Controls: licence code (1 motorcycle / 2 light vehicle / 3 light+heavy).
 * Controls are manual-only across codes; gearbox selection removed.
 */
export default function ControlsStudyGate({
  children,
}: {
  children: (licence: ControlLicenceCode, gearbox: ControlGearbox | null, reset: () => void) => React.ReactNode;
}) {
  const [licence, setLicence] = useState<ControlLicenceCode | null>(() => getControlsLicenceCode());

  const reset = () => {
    clearControlsLicenceCode();
    clearControlsGearbox();
    setLicence(null);
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

  return <>{children(licence, null, reset)}</>;
}
