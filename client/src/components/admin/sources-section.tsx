import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Source, Question } from "@shared/schema";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { Pencil, Trash2, Plus } from "lucide-react";
import { cn } from "@/lib/utils";

export default function SourcesSection() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [newSourceName, setNewSourceName] = useState("");
  const [editingSource, setEditingSource] = useState<Source | null>(null);

  const { data: sources, isLoading } = useQuery<Source[]>({
    queryKey: ["/api/sources"],
  });
  const { data: questions } = useQuery<Question[]>({
    queryKey: ["/api/questions"],
  });

  const invalidateAll = () => {
    queryClient.invalidateQueries({ queryKey: ["/api/sources"] });
    queryClient.invalidateQueries({ queryKey: ["/api/sources/active"] });
    queryClient.invalidateQueries({ queryKey: ["/api/sources/active-ids"] });
  };

  const createMutation = useMutation({
    mutationFn: async (name: string) => apiRequest("POST", "/api/sources", { name, is_active: true }),
    onSuccess: () => {
      invalidateAll();
      setNewSourceName("");
      toast({ title: "Source added successfully" });
    },
    onError: (error: Error) => {
      toast({ title: "Failed to add source", description: error.message, variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async (source: Source) => apiRequest("PUT", `/api/sources/${source.id}`, { name: source.name }),
    onSuccess: () => {
      invalidateAll();
      setEditingSource(null);
      toast({ title: "Source updated successfully" });
    },
    onError: (error: Error) => {
      toast({ title: "Failed to update source", description: error.message, variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `/api/sources/${id}`);
    },
    onSuccess: () => {
      invalidateAll();
      toast({ title: "Source deleted successfully" });
    },
    onError: () => {
      toast({ title: "Failed to delete source", variant: "destructive" });
    },
  });

  const toggleActiveMutation = useMutation({
    mutationFn: async ({ id, isActive }: { id: number; isActive: boolean }) =>
      apiRequest("PATCH", `/api/sources/${id}/active`, { isActive }),
    onSuccess: () => {
      invalidateAll();
      toast({ title: "Source status updated" });
    },
    onError: () => {
      toast({ title: "Failed to update source status", variant: "destructive" });
    },
  });

  const countFor = (id: number) => questions?.filter((q) => q.source_id === id).length ?? 0;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-xl font-display font-bold tracking-tight">Sources</h2>
          <p className="text-sm text-muted-foreground">Question sets questions are grouped under.</p>
        </div>
      </div>

      <div className="glass-card rounded-2xl p-4 flex gap-2">
        <Input
          placeholder="New source name..."
          value={newSourceName}
          onChange={(e) => setNewSourceName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && newSourceName.trim()) {
              createMutation.mutate(newSourceName.trim());
            }
          }}
          className="h-11 bg-background/60"
        />
        <Button
          disabled={!newSourceName.trim() || createMutation.isPending}
          onClick={() => createMutation.mutate(newSourceName.trim())}
          className="brand-gradient border-none h-11 shrink-0"
        >
          <Plus className="h-4 w-4 mr-2" /> Add Source
        </Button>
      </div>

      {isLoading ? (
        <p className="text-sm text-muted-foreground italic py-10 text-center">Loading sources...</p>
      ) : sources?.length === 0 ? (
        <p className="text-sm text-muted-foreground italic py-10 text-center">No sources yet — add one above.</p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {sources?.map((source) => {
            const isActive = source.is_active !== false;
            return (
              <div key={source.id} className="glass-card hover-elevate rounded-2xl p-5 space-y-3">
                <div className="flex items-start justify-between gap-3">
                  {editingSource?.id === source.id ? (
                    <Input
                      autoFocus
                      value={editingSource.name}
                      onChange={(e) => setEditingSource({ ...editingSource, name: e.target.value })}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && editingSource.name.trim()) {
                          updateMutation.mutate(editingSource);
                        } else if (e.key === 'Escape') {
                          setEditingSource(null);
                        }
                      }}
                      onBlur={() => {
                        if (editingSource.name.trim() && editingSource.name !== source.name) {
                          updateMutation.mutate(editingSource);
                        } else {
                          setEditingSource(null);
                        }
                      }}
                      className="h-9"
                    />
                  ) : (
                    <h3 className="font-display font-bold leading-snug">{source.name}</h3>
                  )}
                  <div className="flex gap-1 shrink-0">
                    {editingSource?.id !== source.id && (
                      <>
                        <Button variant="ghost" size="icon" aria-label="Rename source" onClick={() => setEditingSource(source)} className="h-8 w-8 rounded-lg">
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          aria-label="Delete source"
                          onClick={() => {
                            if (confirm(`Delete source "${source.name}"? This might affect questions using it.`)) {
                              deleteMutation.mutate(source.id);
                            }
                          }}
                          className="h-8 w-8 rounded-lg text-destructive"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </>
                    )}
                  </div>
                </div>
                <p className="text-sm text-muted-foreground">
                  {countFor(source.id)} questions ·{" "}
                  <span className={cn("font-bold", isActive ? "text-primary" : "text-muted-foreground")}>
                    {isActive ? "Active" : "Inactive"}
                  </span>
                </p>
                <div className="flex items-center justify-between pt-1">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                    Visible to learners
                  </span>
                  <Switch
                    checked={isActive}
                    onCheckedChange={(checked) => toggleActiveMutation.mutate({ id: source.id, isActive: checked })}
                    disabled={toggleActiveMutation.isPending}
                  />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
