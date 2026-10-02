import { useState, type ChangeEvent } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { FileJson, CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";

export default function RuleImportPanel() {
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
      if (!Array.isArray(parsed)) throw new Error("JSON must be an array of rule records.");
      const res = await apiRequest("POST", "/api/rules/import", parsed);
      const data = (await res.json()) as { message: string };
      setLastImport(data.message);
      toast({ title: "Rules imported", description: data.message });
      queryClient.invalidateQueries({ queryKey: ["/api/rules"] });
      queryClient.invalidateQueries({ queryKey: ["/api/rules?unreviewed=true"] });
    } catch (err: any) {
      toast({ title: "Import failed", description: err.message, variant: "destructive" });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="glass-card rounded-2xl p-6 space-y-4 max-w-2xl">
      <div>
        <h3 className="font-bold text-sm">Bulk import rule cards</h3>
        <p className="text-xs text-muted-foreground">
          Upload a JSON array of <code className="font-mono">{`{section_ref, heading, subheading, body, applicable_codes}`}</code>.
          Imported cards land unreviewed and appear in the Review queue.
        </p>
      </div>
      <input type="file" id="rules-json-upload" accept=".json" className="hidden" onChange={handleFile} disabled={busy} />
      <label
        htmlFor="rules-json-upload"
        className={cn(
          "flex flex-col items-center justify-center p-10 border-2 border-dashed rounded-2xl cursor-pointer transition-all active:scale-[0.98]",
          "border-border hover:border-primary hover:bg-accent"
        )}
      >
        <div className="p-3 bg-muted text-muted-foreground rounded-full mb-4">
          <FileJson className="h-6 w-6" />
        </div>
        <span className="font-display font-bold">{busy ? "Importing…" : "Drop a JSON file here or click to browse"}</span>
        <span className="text-[11px] text-muted-foreground font-bold uppercase tracking-widest mt-1">Same shape as rules-of-the-road-cards.json</span>
      </label>
      {lastImport && (
        <p className="text-xs text-green-700 font-semibold flex items-center gap-1">
          <CheckCircle2 className="h-3.5 w-3.5" /> {lastImport}
        </p>
      )}
    </div>
  );
}
