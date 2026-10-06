import { useMemo, useRef, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type { StudyControl, ControlDiagram } from "@shared/schema";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { MapPin, Pencil } from "lucide-react";
import ControlDiagramView from "@/components/control-diagram-view";
import ControlForm from "./control-form";

export default function DiagramPlacementPanel() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [diagramId, setDiagramId] = useState<number | null>(null);
  const [armedId, setArmedId] = useState<number | null>(null);
  const [editing, setEditing] = useState<StudyControl | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const pendingMoves = useRef(new Map<number, { x: number; y: number; t?: any }>());

  const { data: diagrams = [] } = useQuery<ControlDiagram[]>({ queryKey: ["/api/control-diagrams"] });
  const { data: controls = [] } = useQuery<StudyControl[]>({ queryKey: ["/api/controls"] });

  const diagram = useMemo(() => diagrams.find((d) => d.id === diagramId) ?? diagrams[0], [diagrams, diagramId]);
  const diagramControls = useMemo(
    () => controls.filter((c) => c.diagram_id === diagram?.id).sort((a, b) => (a.component_number ?? 999) - (b.component_number ?? 999)),
    [controls, diagram]
  );
  const unplaced = diagramControls.filter((c) => c.position_x == null || c.position_y == null);

  const patchControl = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: any }) => {
      await apiRequest("PATCH", `/api/controls/${id}`, data);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/controls"] }),
    onError: (e: Error) => toast({ title: "Update failed", description: e.message, variant: "destructive" }),
  });

  const placeMutation = useMutation({
    mutationFn: async ({ id, pos }: { id: number; pos: { x: number; y: number } }) => {
      await apiRequest("PATCH", `/api/controls/${id}`, { position_x: pos.x, position_y: pos.y });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/controls"] });
      toast({ title: "Position saved" });
    },
    onError: (e: Error) => toast({ title: "Save failed", description: e.message, variant: "destructive" }),
  });

  const uploadMutation = useMutation({
    mutationFn: async ({ id, filename, dataUrl }: { id: number; filename: string; dataUrl: string }) => {
      const res = await apiRequest("POST", `/api/control-diagrams/${id}/image`, { filename, dataUrl });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/control-diagrams"] });
      toast({ title: "Diagram image saved" });
    },
    onError: (e: Error) => toast({ title: "Upload failed", description: e.message, variant: "destructive" }),
  });

  const handleMarkerMove = (controlId: number, pos: { x: number; y: number }) => {
    queryClient.setQueryData<StudyControl[]>(["/api/controls"], (old) =>
      (old ?? []).map((c) => (c.id === controlId ? { ...c, position_x: pos.x, position_y: pos.y } : c))
    );
    const entry = pendingMoves.current.get(controlId) ?? { x: pos.x, y: pos.y };
    entry.x = pos.x;
    entry.y = pos.y;
    if (entry.t) clearTimeout(entry.t);
    entry.t = setTimeout(() => {
      patchControl.mutate({ id: controlId, data: { position_x: entry.x, position_y: entry.y } });
      pendingMoves.current.delete(controlId);
    }, 400);
    pendingMoves.current.set(controlId, entry);
  };

  if (diagrams.length === 0) {
    return <p className="text-sm text-muted-foreground py-8 text-center">No diagrams found.</p>;
  }

  return (
    <div className="space-y-4">
      <select
        value={diagram?.id ?? ""}
        onChange={(e) => { setDiagramId(parseInt(e.target.value, 10)); setArmedId(null); }}
        className="h-11 rounded-xl border border-border bg-background/60 px-3 text-sm font-semibold w-full md:w-auto"
      >
        {diagrams.map((d) => (
          <option key={d.id} value={d.id}>
            {d.label}{d.is_inferred ? " (inferred)" : ""}
          </option>
        ))}
      </select>

      <div className="grid md:grid-cols-[1fr_240px] gap-4 items-start">
        <ControlDiagramView
          diagram={diagram!}
          controls={diagramControls}
          mode="place"
          armedControlId={armedId}
          onUpload={(filename, dataUrl) => diagram && uploadMutation.mutate({ id: diagram.id, filename, dataUrl })}
          onImageClick={(pos) => {
            if (armedId == null) return;
            placeMutation.mutate({ id: armedId, pos });
            setArmedId(null);
          }}
          onMarkerMove={handleMarkerMove}
          onMarkerSelect={(c) => { setEditing(c); setFormOpen(true); }}
        />

        <div className="glass-card rounded-2xl p-3 space-y-2">
          <p className="text-[11px] font-black uppercase tracking-widest text-muted-foreground">
            {unplaced.length} of {diagramControls.length} need a position
          </p>
          {diagramControls.map((c) => {
            const isUnplaced = c.position_x == null || c.position_y == null;
            return (
              <button
                key={c.id}
                onClick={() => setArmedId(armedId === c.id ? null : c.id)}
                className={`w-full text-left flex items-center gap-2 rounded-xl border px-2.5 py-2 text-xs font-semibold transition-colors ${
                  armedId === c.id ? "border-amber-400 bg-amber-50" : isUnplaced ? "border-dashed border-border bg-muted/30" : "border-border bg-card"
                }`}
              >
                <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 ${isUnplaced ? "bg-muted text-muted-foreground" : "bg-primary/10 text-primary"}`}>
                  {c.component_number ?? "•"}
                </span>
                <span className="flex-1 truncate">{c.component_name}</span>
                {isUnplaced ? <MapPin className="h-3 w-3 text-muted-foreground" /> : <Pencil className="h-3 w-3 text-muted-foreground" />}
              </button>
            );
          })}
        </div>
      </div>

      <ControlForm open={formOpen} onClose={() => { setFormOpen(false); setEditing(null); }} control={editing} />
    </div>
  );
}
