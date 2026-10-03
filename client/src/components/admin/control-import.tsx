import { useState, type ChangeEvent } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { FileJson, CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";

export default function ControlImportPanel() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [busy, setBusy] = useState(false);
  const [lastImport, setLastImport] = useState<string | null>(null);

  const handleFile = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setBusy(true);
    setLastImport(null);
    try {
      const text = (await file.text()).replace(/^\uFEFF/, "");
      const parsed = JSON.parse(text);
      const res = await apiRequest("POST", "/api/controls/import", parsed);
      const data = (await res.json()) as { message: string };
      setLastImport(data.message);
      toast({ title: "Controls imported", description: data.message });
      queryClient.invalidateQueries({ queryKey: ["/api/controls"] });
      queryClient.invalidateQueries({ queryKey: ["/api/control-diagrams"] });
      queryClient.invalidateQueries({ queryKey: ["/api/questions"] });
    } catch (err: any) {
      toast({ title: "Import failed", description: err.message, variant: "destructive" });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="glass-card rounded-2xl p-6 space-y-4 max-w-2xl">
      <div>
        <h3 className="font-bold text-sm">Bulk import Vehicle Controls bundle</h3>
        <p className="text-xs text-muted-foreground">
          Upload vehicle-controls-import.json. Runs two passes: diagrams + components first, then sample questions (options shuffled) linked to the new components. Everything imports unreviewed.
        </p>
      </div>
      <input type="file" id="controls-json-upload" accept=".json" className="hidden" onChange={handleFile} disabled={busy} />
      <label
        htmlFor="controls-json-upload"
        className={cn(
          "flex flex-col items-center justify-center p-10 border-2 border-dashed rounded-2xl cursor-pointer transition-all active:scale-[0.98]",
          "border-border hover:border-primary hover:bg-accent"
        )}
      >
        <div className="p-3 bg-muted text-muted-foreground rounded-full mb-4">
          <FileJson className="h-6 w-6" />
        </div>
        <span className="font-display font-bold">{busy ? "Importing…" : "Drop vehicle-controls-import.json here"}</span>
      </label>
      {lastImport && (
        <p className="text-xs text-green-700 font-semibold flex items-center gap-1">
          <CheckCircle2 className="h-3.5 w-3.5" /> {lastImport}
        </p>
      )}
      <div className="text-xs text-muted-foreground border-t pt-3 space-y-1">
        <p className="font-bold uppercase tracking-wider text-[10px] text-amber-700">Flagged for review in the bundle notes:</p>
        <ul className="list-disc pl-4 space-y-0.5">
          <li>HMV — Automatic Gearbox diagram (hmv_a) is inferred from LMV-automatic by analogy; every component notes "INFERRED".</li>
          <li>Most LMV sample_questions default to the manual variant (lmv_m); a manual/automatic split decision is unresolved.</li>
          <li>All distractor options in sample questions were generated, not taken from the source manual.</li>
        </ul>
      </div>
    </div>
  );
}
