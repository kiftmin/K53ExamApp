import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type { StudyControl, ControlDiagram } from "@shared/schema";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { BadgeCheck, Pencil, Plus, Search, Trash2 } from "lucide-react";
import ControlForm from "./control-form";
import ControlImportPanel from "./control-import";
import ControlReviewPanel from "./control-review";
import DiagramPlacementPanel from "./diagram-placement";

export default function ControlsSection() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [tab, setTab] = useState("browse");
  const [search, setSearch] = useState("");
  const [vehicleType, setVehicleType] = useState("all");
  const [reviewedOnly, setReviewedOnly] = useState(false);
  const [editing, setEditing] = useState<StudyControl | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [deleting, setDeleting] = useState<StudyControl | null>(null);

  const { data: controls = [], isLoading } = useQuery<StudyControl[]>({ queryKey: ["/api/controls"] });
  const { data: diagrams = [] } = useQuery<ControlDiagram[]>({ queryKey: ["/api/control-diagrams"] });

  const diagramById = useMemo(() => new Map(diagrams.map((d) => [d.id, d])), [diagrams]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return controls.filter((c) => {
      const d = diagramById.get(c.diagram_id);
      if (vehicleType !== "all" && d?.vehicle_type !== vehicleType) return false;
      if (reviewedOnly && !c.is_reviewed) return false;
      if (q && !(c.component_name.toLowerCase().includes(q) || String(c.component_number ?? "").includes(q) || (c.function_notes || "").toLowerCase().includes(q))) return false;
      return true;
    });
  }, [controls, search, vehicleType, reviewedOnly, diagramById]);

  // Group by diagram label
  const groups = useMemo(() => {
    const map = new Map<string, StudyControl[]>();
    for (const c of filtered) {
      const label = diagramById.get(c.diagram_id)?.label || `Diagram ${c.diagram_id}`;
      if (!map.has(label)) map.set(label, []);
      map.get(label)!.push(c);
    }
    return Array.from(map.entries()).sort(([a], [b]) => a.localeCompare(b));
  }, [filtered, diagramById]);

  const unreviewedCount = useMemo(() => controls.filter((c) => !c.is_reviewed).length, [controls]);

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `/api/controls/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/controls"] });
      toast({ title: "Control deleted" });
      setDeleting(null);
    },
    onError: (e: Error) => toast({ title: "Delete failed", description: e.message, variant: "destructive" }),
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-display font-bold tracking-tight">Vehicle Controls</h2>
          <p className="text-sm text-muted-foreground">
            {controls.length} components{unreviewedCount > 0 && ` · ${unreviewedCount} awaiting review`}
          </p>
        </div>
        <Button onClick={() => { setEditing(null); setFormOpen(true); }} className="brand-gradient border-none rounded-xl font-bold">
          <Plus className="h-4 w-4 mr-1" /> New control
        </Button>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="browse">Browse</TabsTrigger>
          <TabsTrigger value="diagrams">Diagrams</TabsTrigger>
          <TabsTrigger value="import">Import</TabsTrigger>
          <TabsTrigger value="review">Review queue{unreviewedCount > 0 ? ` (${unreviewedCount})` : ""}</TabsTrigger>
        </TabsList>

        <TabsContent value="diagrams" className="space-y-4">
          <DiagramPlacementPanel />
        </TabsContent>

        <TabsContent value="import" className="space-y-4">
          <ControlImportPanel />
        </TabsContent>

        <TabsContent value="review" className="space-y-4">
          <ControlReviewPanel />
        </TabsContent>

        <TabsContent value="browse" className="space-y-4">
          <div className="glass-card rounded-2xl p-4 space-y-3">
            <div className="flex flex-col md:flex-row gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search name, number, function…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-9 h-11 bg-background/60 rounded-xl"
                />
              </div>
              <select
                value={vehicleType}
                onChange={(e) => setVehicleType(e.target.value)}
                className="h-11 rounded-xl border border-border bg-background/60 px-3 text-sm font-semibold"
              >
                <option value="all">All types</option>
                <option value="motorcycle">Motorcycle</option>
                <option value="lmv">Light vehicle</option>
                <option value="hmv">Heavy vehicle</option>
              </select>
            </div>
            <div className="flex items-center gap-2">
              <Switch id="reviewed-controls" checked={reviewedOnly} onCheckedChange={setReviewedOnly} />
              <Label htmlFor="reviewed-controls" className="text-xs font-semibold">Reviewed only</Label>
            </div>
          </div>

          {isLoading ? (
            <p className="text-sm text-muted-foreground py-8 text-center">Loading controls…</p>
          ) : groups.length === 0 ? (
            <div className="glass-card rounded-2xl p-10 text-center space-y-2">
              <p className="font-bold">No components found</p>
              <p className="text-sm text-muted-foreground">Import the bundle from the Import tab to get started.</p>
            </div>
          ) : (
            groups.map(([label, items]) => {
              const numbered = items.filter((i) => i.component_number != null).sort((a, b) => (a.component_number ?? 0) - (b.component_number ?? 0));
              const recognition = items.filter((i) => i.component_number == null);
              return (
                <Card key={label}>
                  <CardContent className="p-4 space-y-2">
                    <p className="text-[11px] font-black uppercase tracking-widest text-muted-foreground">{label}</p>
                    {numbered.map((c) => (
                      <div key={c.id} className="flex items-start justify-between gap-2 py-1.5 border-b border-border/50 last:border-0">
                        <div className="flex items-start gap-2 flex-1">
                          <span className="w-6 h-6 rounded-md bg-primary/10 text-primary text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">{c.component_number}</span>
                          <div className="flex-1">
                            <p className="text-sm font-semibold">{c.component_name}</p>
                            {c.function_notes && <p className="text-xs text-muted-foreground">{c.function_notes}</p>}
                            <div className="flex gap-1 mt-1">
                              {c.is_verified_exam_question && <BadgeCheck className="h-3.5 w-3.5 text-green-600" />}
                              {!c.is_reviewed && <span className="text-[10px] font-semibold text-amber-700 bg-amber-100 px-1.5 py-0.5 rounded">unreviewed</span>}
                            </div>
                          </div>
                        </div>
                        <div className="flex gap-1">
                          <Button size="sm" variant="outline" className="h-8 w-8 p-0" onClick={() => { setEditing(c); setFormOpen(true); }}><Pencil className="h-3.5 w-3.5" /></Button>
                          <Button size="sm" variant="ghost" className="h-8 w-8 p-0 text-destructive" onClick={() => setDeleting(c)}><Trash2 className="h-3.5 w-3.5" /></Button>
                        </div>
                      </div>
                    ))}
                    {recognition.length > 0 && (
                      <>
                        <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground pt-2">Recognition-only</p>
                        {recognition.map((c) => (
                          <div key={c.id} className="flex items-start justify-between gap-2 py-1.5">
                            <div className="flex-1">
                              <p className="text-sm font-semibold">{c.component_name}</p>
                              {c.function_notes && <p className="text-xs text-muted-foreground">{c.function_notes}</p>}
                            </div>
                            <div className="flex gap-1">
                              <Button size="sm" variant="outline" className="h-8 w-8 p-0" onClick={() => { setEditing(c); setFormOpen(true); }}><Pencil className="h-3.5 w-3.5" /></Button>
                              <Button size="sm" variant="ghost" className="h-8 w-8 p-0 text-destructive" onClick={() => setDeleting(c)}><Trash2 className="h-3.5 w-3.5" /></Button>
                            </div>
                          </div>
                        ))}
                      </>
                    )}
                  </CardContent>
                </Card>
              );
            })
          )}
        </TabsContent>
      </Tabs>

      <ControlForm open={formOpen} onClose={() => { setFormOpen(false); setEditing(null); }} control={editing} />

      <AlertDialog open={!!deleting} onOpenChange={(o) => !o && setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this component?</AlertDialogTitle>
            <AlertDialogDescription>“{deleting?.component_name}” and its question links will be removed.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive text-destructive-foreground" onClick={() => deleting && deleteMutation.mutate(deleting.id)}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
