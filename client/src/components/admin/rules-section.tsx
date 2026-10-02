import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type { StudyRule } from "@shared/schema";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
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
import { BadgeCheck, Pencil, Plus, Search, Trash2, Link2Off } from "lucide-react";
import { cn } from "@/lib/utils";
import RuleForm from "./rule-form";
import RuleImportReview from "./rule-import-review";

const CODE_LABELS: Record<number, string> = { 0: "All", 1: "Moto", 2: "Light", 3: "Heavy" };

function RuleCard({ rule, onEdit, onDelete }: { rule: StudyRule; onEdit: () => void; onDelete: () => void }) {
  return (
    <Card className="group">
      <CardContent className="p-4 space-y-2">
        <div className="flex items-start justify-between gap-2">
          <p className="text-xs font-mono font-bold text-muted-foreground">{rule.section_ref}</p>
          <div className="flex items-center gap-1.5">
            {rule.is_verified_exam_question && (
              <BadgeCheck className="h-4 w-4 text-green-600" aria-label="Verified exam question" />
            )}
            {!rule.is_reviewed && (
              <span className="text-[10px] font-semibold text-amber-700 bg-amber-100 px-1.5 py-0.5 rounded">unreviewed</span>
            )}
          </div>
        </div>
        <p className="text-sm leading-snug line-clamp-4">{rule.title || rule.body}</p>
        <div className="flex flex-wrap gap-1">
          <Badge variant="secondary" className="text-[10px]">{rule.heading}</Badge>
          <Badge variant="outline" className="text-[10px]">{rule.subheading}</Badge>
          {(rule.applicable_codes || []).map((c) => (
            <Badge key={c} variant="outline" className="text-[10px] font-mono">
              {CODE_LABELS[c] ?? c}
            </Badge>
          ))}
        </div>
        <div className="flex gap-1 pt-1 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity">
          <Button size="sm" variant="outline" className="flex-1 h-8 text-xs" onClick={onEdit}>
            <Pencil className="h-3.5 w-3.5 mr-1" /> Edit
          </Button>
          <Button size="sm" variant="ghost" className="h-8 text-xs text-destructive" onClick={onDelete}>
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

export default function RulesSection() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [tab, setTab] = useState("browse");
  const [heading, setHeading] = useState("all");
  const [subheading, setSubheading] = useState("all");
  const [search, setSearch] = useState("");
  const [code, setCode] = useState("all");
  const [unverifiedOnly, setUnverifiedOnly] = useState(false);
  const [missingQuestionOnly, setMissingQuestionOnly] = useState(false);
  const [reviewedOnly, setReviewedOnly] = useState(false);
  const [editing, setEditing] = useState<StudyRule | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [deleting, setDeleting] = useState<StudyRule | null>(null);

  const { data: rules = [], isLoading } = useQuery<StudyRule[]>({
    queryKey: ["/api/rules"],
  });

  const headings = useMemo(() => Array.from(new Set(rules.map((r) => r.heading))).sort(), [rules]);
  const subheadings = useMemo(
    () => Array.from(new Set(rules.filter((r) => heading === "all" || r.heading === heading).map((r) => r.subheading))).sort(),
    [rules, heading]
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    // Map UI code filter to the same expansion the server applies
    const allowed = code === "all" ? null : code === "1" ? [0, 1] : code === "2" ? [0, 2] : [0, 2, 3];
    return rules.filter((r) => {
      if (heading !== "all" && r.heading !== heading) return false;
      if (subheading !== "all" && r.subheading !== subheading) return false;
      if (allowed && !(r.applicable_codes || []).some((c) => allowed.includes(c))) return false;
      if (unverifiedOnly && r.is_verified_exam_question) return false;
      if (reviewedOnly && !r.is_reviewed) return false;
      if (q && !(r.body.toLowerCase().includes(q) || r.section_ref.toLowerCase().includes(q) || (r.title || "").toLowerCase().includes(q))) return false;
      return true;
    });
  }, [rules, heading, subheading, search, code, unverifiedOnly, reviewedOnly]);

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `/api/rules/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/rules"] });
      toast({ title: "Rule deleted" });
      setDeleting(null);
    },
    onError: (e: Error) => toast({ title: "Delete failed", description: e.message, variant: "destructive" }),
  });

  const unreviewedCount = useMemo(() => rules.filter((r) => !r.is_reviewed).length, [rules]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-display font-bold tracking-tight">Rules of the Road</h2>
          <p className="text-sm text-muted-foreground">
            {rules.length} rules{unreviewedCount > 0 && ` · ${unreviewedCount} awaiting review`}
          </p>
        </div>
        <Button onClick={() => { setEditing(null); setFormOpen(true); }} className="brand-gradient border-none rounded-xl font-bold">
          <Plus className="h-4 w-4 mr-1" /> New rule
        </Button>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="browse">Browse</TabsTrigger>
          <TabsTrigger value="review">Review queue{unreviewedCount > 0 ? ` (${unreviewedCount})` : ""}</TabsTrigger>
        </TabsList>

        <TabsContent value="browse" className="space-y-4">
          <div className="glass-card rounded-2xl p-4 space-y-3">
            <div className="flex flex-col md:flex-row gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search rule, section, or keyword…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-9 h-11 bg-background/60 rounded-xl"
                />
              </div>
              <Select value={heading} onValueChange={(v) => { setHeading(v); setSubheading("all"); }}>
                <SelectTrigger className="h-11 md:w-56 bg-background/60 rounded-xl font-semibold">
                  <SelectValue placeholder="Heading" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All headings</SelectItem>
                  {headings.map((h) => (
                    <SelectItem key={h} value={h}>{h}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={subheading} onValueChange={setSubheading}>
                <SelectTrigger className="h-11 md:w-56 bg-background/60 rounded-xl font-semibold">
                  <SelectValue placeholder="Subheading" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All subheadings</SelectItem>
                  {subheadings.map((s) => (
                    <SelectItem key={s} value={s}>{s}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={code} onValueChange={setCode}>
                <SelectTrigger className="h-11 md:w-44 bg-background/60 rounded-xl font-semibold">
                  <SelectValue placeholder="Licence code" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All codes</SelectItem>
                  <SelectItem value="1">Code 1 (moto)</SelectItem>
                  <SelectItem value="2">Code 2 (light)</SelectItem>
                  <SelectItem value="3">Code 3 (light+heavy)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-wrap gap-4">
              <div className="flex items-center gap-2">
                <Switch id="unverified-rules" checked={unverifiedOnly} onCheckedChange={setUnverifiedOnly} />
                <Label htmlFor="unverified-rules" className="text-xs font-semibold">Unverified only</Label>
              </div>
              <div className="flex items-center gap-2">
                <Switch id="reviewed-rules" checked={reviewedOnly} onCheckedChange={setReviewedOnly} />
                <Label htmlFor="reviewed-rules" className="text-xs font-semibold">Reviewed only</Label>
              </div>
            </div>
          </div>

          {isLoading ? (
            <p className="text-sm text-muted-foreground py-8 text-center">Loading rules…</p>
          ) : filtered.length === 0 ? (
            <div className="glass-card rounded-2xl p-10 text-center space-y-2">
              <p className="font-bold">No rules found</p>
              <p className="text-sm text-muted-foreground">
                {rules.length === 0 ? "Import rules-of-the-road-cards.json to get started." : "Try widening the filters."}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
              {filtered.map((r) => (
                <RuleCard
                  key={r.id}
                  rule={r}
                  onEdit={() => { setEditing(r); setFormOpen(true); }}
                  onDelete={() => setDeleting(r)}
                />
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="review">
          <RuleImportReview />
        </TabsContent>
      </Tabs>

      <RuleForm open={formOpen} onClose={() => { setFormOpen(false); setEditing(null); }} rule={editing} />

      <AlertDialog open={!!deleting} onOpenChange={(o) => !o && setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this rule?</AlertDialogTitle>
            <AlertDialogDescription>
              “{deleting?.body.slice(0, 60)}…” and its question links will be removed.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground"
              onClick={() => deleting && deleteMutation.mutate(deleting.id)}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
