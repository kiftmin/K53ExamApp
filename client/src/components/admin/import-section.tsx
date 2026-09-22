import { useState, type ChangeEvent } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Source } from "@shared/schema";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { Upload, Layers, FileCheck2 } from "lucide-react";
import { cn } from "@/lib/utils";

export default function ImportSection() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [pendingImportData, setPendingImportData] = useState<Record<string, unknown>[]>([]);
  const [importSourceId, setImportSourceId] = useState<string>("none");

  const { data: sources } = useQuery<Source[]>({
    queryKey: ["/api/sources"],
  });

  const confirmImportMutation = useMutation({
    mutationFn: async (data: Record<string, unknown>[]) => {
      await apiRequest("POST", "/api/questions/bulk", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/questions"] });
      toast({ title: "Successfully imported questions!" });
      setPendingImportData([]);
    },
    onError: (error: Error) => {
      toast({ title: "Import failed", description: error.message, variant: "destructive" });
    },
  });

  const handleFileUpload = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      const rawData = text.replace(/^\uFEFF/, "");
      const parsed = JSON.parse(rawData);
      if (Array.isArray(parsed)) {
        setPendingImportData(parsed);
      } else {
        toast({ title: "Invalid format", description: "JSON must be an array of questions", variant: "destructive" });
      }
    } catch (error) {
      console.error(error);
      toast({ title: "Parse failed", description: "Could not read the JSON file.", variant: "destructive" });
    }
    event.target.value = '';
  };

  const handleConfirmImport = () => {
    const sourceId = importSourceId === "none" ? null : parseInt(importSourceId);
    const dataWithSource = pendingImportData.map((q) => ({ ...q, source_id: sourceId }));
    confirmImportMutation.mutate(dataWithSource);
  };

  return (
    <div className="space-y-4 max-w-2xl">
      <div>
        <h2 className="text-xl font-display font-bold tracking-tight">Import Questions</h2>
        <p className="text-sm text-muted-foreground">Bulk-load questions from a JSON export.</p>
      </div>

      <div className="glass-card rounded-2xl p-6 space-y-6">
        {pendingImportData.length > 0 ? (
          <div className="flex items-center justify-between p-4 bg-primary/5 rounded-xl border border-primary/20">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-primary/10 text-primary rounded-lg">
                <FileCheck2 className="h-5 w-5" />
              </div>
              <div className="flex flex-col">
                <span className="text-[10px] font-black text-primary uppercase tracking-wider">Validated Questions</span>
                <span className="text-2xl font-display font-extrabold tracking-tight">{pendingImportData.length}</span>
              </div>
            </div>
            <Button
              variant="ghost"
              onClick={() => setPendingImportData([])}
              className="h-8 text-xs font-bold uppercase"
            >
              Change File
            </Button>
          </div>
        ) : (
          <div>
            <input
              type="file"
              id="import-json-upload"
              accept=".json"
              onChange={handleFileUpload}
              className="hidden"
            />
            <label
              htmlFor="import-json-upload"
              className={cn(
                "flex flex-col items-center justify-center p-10 border-2 border-dashed rounded-2xl cursor-pointer transition-all active:scale-[0.98]",
                "border-border hover:border-primary hover:bg-accent"
              )}
            >
              <div className="p-3 bg-muted text-muted-foreground rounded-full mb-4">
                <Upload className="h-6 w-6" />
              </div>
              <span className="font-display font-bold">Drop a JSON file here or click to browse</span>
              <span className="text-[11px] text-muted-foreground font-bold uppercase tracking-widest mt-1">UTF-8 array export only</span>
            </label>
          </div>
        )}

        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Layers className="h-4 w-4 text-muted-foreground" />
            <span className="text-xs font-black uppercase tracking-wider">Assign to source</span>
          </div>
          <Select value={importSourceId} onValueChange={setImportSourceId}>
            <SelectTrigger className="h-12 bg-background/60 font-semibold rounded-xl">
              <SelectValue placeholder="Select target source" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none" className="font-semibold text-muted-foreground">None (Leave Unassigned)</SelectItem>
              {sources?.map((src) => (
                <SelectItem key={src.id} value={src.id.toString()} className="font-semibold">
                  {src.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {pendingImportData.length > 0 && (
            <p className="text-xs text-muted-foreground italic">
              This will apply to all {pendingImportData.length} records in the current buffer.
            </p>
          )}
        </div>

        <div className="flex gap-3">
          <Button
            variant="ghost"
            onClick={() => setPendingImportData([])}
            className="flex-1 h-11 rounded-xl"
          >
            Cancel
          </Button>
          <Button
            onClick={handleConfirmImport}
            disabled={confirmImportMutation.isPending || pendingImportData.length === 0}
            className="flex-1 h-11 brand-gradient border-none rounded-xl font-bold disabled:opacity-50"
          >
            {confirmImportMutation.isPending ? "Importing..." : "Import Questions"}
          </Button>
        </div>
      </div>
    </div>
  );
}
