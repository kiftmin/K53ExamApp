import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type { StudyRule } from "@shared/schema";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { BadgeCheck, Check, Pencil, Search } from "lucide-react";
import { cn } from "@/lib/utils";
import RuleForm from "./rule-form";

export default function RuleImportReview() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState<StudyRule | null>(null);
  const [formOpen, setFormOpen] = useState(false);

  const { data: unreviewed = [], isLoading } = useQuery<StudyRule[]>({
    queryKey: ["/api/rules?unreviewed=true"],
    queryFn: async () => {
      const r = await fetch("/api/rules?unreviewed=true");
      if (!r.ok) throw new Error(`${r.status}: ${await r.text()}`);
      return r.json();
    },
  });

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return unreviewed;
    return unreviewed.filter(
      (r) =>
        r.body.toLowerCase().includes(q) ||
        r.section_ref.toLowerCase().includes(q) ||
        r.subheading.toLowerCase().includes(q)
    );
  }, [unreviewed, search]);

  // Group by subheading, unreviewed-first is inherent (list is all unreviewed)
  const grouped = useMemo(() => {
    const map = new Map<string, StudyRule[]>();
    for (const r of filtered) {
      const key = r.subheading || "(no subheading)";
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(r);
    }
    return Array.from(map.entries()).sort(([a], [b]) => a.localeCompare(b));
  }, [filtered]);

  const approveMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("PATCH", `/api/rules/${id}`, { is_reviewed: true });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/rules?unreviewed=true"] });
      queryClient.invalidateQueries({ queryKey: ["/api/rules"] });
      toast({ title: "Marked reviewed" });
    },
    onError: (e: Error) => toast({ title: "Failed", description: e.message, variant: "destructive" }),
  });

  const approveAllMutation = useMutation({
    mutationFn: async (ids: number[]) => {
      for (const id of ids) {
        await apiRequest("PATCH", `/api/rules/${id}`, { is_reviewed: true });
      }
    },
    onSuccess: (_d, ids) => {
      queryClient.invalidateQueries({ queryKey: ["/api/rules?unreviewed=true"] });
      queryClient.invalidateQueries({ queryKey: ["/api/rules"] });
      toast({ title: `Marked ${ids.length} reviewed` });
    },
    onError: (e: Error) => toast({ title: "Failed", description: e.message, variant: "destructive" }),
  });

  if (isLoading) return <p className="text-sm text-muted-foreground py-8 text-center">Loading review queue…</p>;

  if (unreviewed.length === 0) {
    return (
      <div className="glass-card rounded-2xl p-10 text-center space-y-2">
        <BadgeCheck className="h-8 w-8 text-green-600 mx-auto" />
        <p className="font-bold">All rules reviewed</p>
        <p className="text-sm text-muted-foreground">Nothing pending from the import.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4 max-w-4xl">
      <div className="glass-card rounded-2xl p-4 space-y-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search section, subheading, body…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 h-11 bg-background/60 rounded-xl"
          />
        </div>
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>{filtered.length} unreviewed of {unreviewed.length}</span>
          <button
            className="font-bold text-primary hover:underline"
            onClick={() => approveAllMutation.mutate(filtered.map((r) => r.id))}
            disabled={approveAllMutation.isPending}
          >
            {approveAllMutation.isPending ? "Approving…" : `Approve all shown (${filtered.length})`}
          </button>
        </div>
      </div>

      {grouped.map(([subheading, rules]) => (
        <div key={subheading} className="space-y-2">
          <p className="text-[11px] font-black uppercase tracking-widest text-muted-foreground px-1">{subheading}</p>
          {rules.map((r) => (
            <div key={r.id} className="rounded-2xl border border-border bg-card p-4 space-y-2">
              <div className="flex items-start gap-2">
                <span className="text-xs font-mono font-bold text-muted-foreground shrink-0 pt-0.5">{r.section_ref}</span>
                <p className="text-sm flex-1 leading-snug">{r.body}</p>
              </div>
              <div className="flex flex-wrap gap-1 items-center">
                {(r.applicable_codes || []).map((c) => (
                  <span key={c} className="text-[10px] font-mono bg-muted px-1.5 py-0.5 rounded">
                    {c === 0 ? "all" : c === 1 ? "moto" : c === 2 ? "light" : "heavy"}
                  </span>
                ))}
                <span className="text-[10px] text-amber-700 bg-amber-100 px-1.5 py-0.5 rounded font-semibold">unreviewed</span>
              </div>
              <div className="flex gap-2 pt-1">
                <Button
                  size="sm"
                  className="h-8 text-xs brand-gradient border-none font-bold"
                  onClick={() => approveMutation.mutate(r.id)}
                  disabled={approveMutation.isPending}
                >
                  <Check className="h-3.5 w-3.5 mr-1" /> Approve
                </Button>
                <Button size="sm" variant="outline" className="h-8 text-xs" onClick={() => { setEditing(r); setFormOpen(true); }}>
                  <Pencil className="h-3.5 w-3.5 mr-1" /> Edit
                </Button>
              </div>
            </div>
          ))}
        </div>
      ))}

      <RuleForm open={formOpen} onClose={() => { setFormOpen(false); setEditing(null); }} rule={editing} />
    </div>
  );
}
