import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type { StudySign } from "@shared/schema";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
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
import { isTemporaryCode, orderImages } from "@/lib/sign-codes";
import { BadgeCheck, CheckCheck, ImageOff, Pencil, Plus, Search, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import SignForm from "./sign-form";
import SignImportPanel, { SignShortTextImportPanel } from "./sign-import";

function codesMissingImage(s: StudySign): string[] {
  const covered = new Set((s.images || []).map((i) => i.code));
  return (s.codes || []).filter((c) => !covered.has(c));
}

function SignCard({ sign, onEdit, onDelete }: { sign: StudySign; onEdit: () => void; onDelete: () => void }) {
  const thumb = orderImages(sign.images || [])[0]?.image_url;
  const missing = codesMissingImage(sign);
  return (
    <Card className="overflow-hidden group">
      <div className="aspect-[16/9] bg-muted flex items-center justify-center overflow-hidden">
        {thumb ? (
          <img src={thumb} alt={sign.name} className="h-full w-full object-contain bg-white" loading="lazy" />
        ) : (
          <div className="flex flex-col items-center gap-1 text-muted-foreground">
            <ImageOff className="h-6 w-6" />
            <span className="text-[11px] font-semibold">No image</span>
          </div>
        )}
      </div>
      <CardContent className="p-3 space-y-2">
        <div className="flex items-start justify-between gap-2">
          <p className="text-sm font-bold leading-snug flex-1">{sign.name}</p>
          {sign.is_verified_exam_question && (
            <BadgeCheck className="h-4 w-4 shrink-0 text-green-600" aria-label="Verified exam question" />
          )}
        </div>
        <div className="flex flex-wrap gap-1">
          <Badge variant="secondary" className="text-[10px]">{sign.heading}</Badge>
          {(sign.codes || []).map((c) => (
            <Badge
              key={c}
              variant="outline"
              className={cn("text-[10px] font-mono", missing.includes(c) && "border-dashed border-amber-500 text-amber-700")}
            >
              {c}
              {isTemporaryCode(c) && (
                <span className="ml-1 text-[9px] font-bold uppercase tracking-wide bg-amber-100 text-amber-700 rounded px-1 normal-case">Temporary</span>
              )}
            </Badge>
          ))}
        </div>
        <p className="text-[11px] text-muted-foreground truncate">{sign.subheading}</p>
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

export default function SignsSection() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [tab, setTab] = useState("browse");
  const [heading, setHeading] = useState("all");
  const [subheading, setSubheading] = useState("all");
  const [search, setSearch] = useState("");
  const [missingOnly, setMissingOnly] = useState(false);
  const [unverifiedOnly, setUnverifiedOnly] = useState(false);
  const [shortTextFilter, setShortTextFilter] = useState<"all" | "missing" | "draft" | "approved">("all");
  const [needsSplitOnly, setNeedsSplitOnly] = useState(false);
  const [temporaryOnly, setTemporaryOnly] = useState(false);
  const [editing, setEditing] = useState<StudySign | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [deleting, setDeleting] = useState<StudySign | null>(null);
  const [approveOpen, setApproveOpen] = useState(false);
  const [reviewed, setReviewed] = useState(false);

  const { data: signs = [], isLoading } = useQuery<StudySign[]>({
    queryKey: ["/api/signs"],
  });

  const headings = useMemo(() => Array.from(new Set(signs.map((s) => s.heading))).sort(), [signs]);
  const subheadings = useMemo(
    () => Array.from(new Set(signs.filter((s) => heading === "all" || s.heading === heading).map((s) => s.subheading))).sort(),
    [signs, heading]
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return signs.filter((s) => {
      if (heading !== "all" && s.heading !== heading) return false;
      if (subheading !== "all" && s.subheading !== subheading) return false;
      if (missingOnly && codesMissingImage(s).length === 0) return false;
      if (unverifiedOnly && s.is_verified_exam_question) return false;
      if (shortTextFilter === "missing" && !!s.short_meaning) return false;
      if (shortTextFilter === "draft" && (!s.short_meaning || s.short_reviewed)) return false;
      if (shortTextFilter === "approved" && !s.short_reviewed) return false;
      if (needsSplitOnly && !s.needs_split) return false;
      if (temporaryOnly && !(s.codes || []).every(isTemporaryCode)) return false;
      if (q && !(s.name.toLowerCase().includes(q) || (s.codes || []).some((c) => c.toLowerCase().includes(q)))) return false;
      return true;
    });
  }, [signs, heading, subheading, search, missingOnly, unverifiedOnly, shortTextFilter, needsSplitOnly, temporaryOnly]);

  const missingCount = useMemo(() => signs.filter((s) => codesMissingImage(s).length > 0).length, [signs]);
  const draftCount = useMemo(
    () => signs.filter((s) => !!s.short_meaning?.trim() && !s.short_reviewed).length,
    [signs]
  );

  const approveMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/signs/short-text/approve");
      return (await res.json()) as { approved: number };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/signs"] });
      toast({
        title: `${data.approved} sign${data.approved === 1 ? "" : "s"} approved`,
        description: "Learners now see the short reveal on these cards.",
      });
    },
    onError: (e: Error) => toast({ title: "Approve failed", description: e.message, variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `/api/signs/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/signs"] });
      toast({ title: "Sign deleted" });
      setDeleting(null);
    },
    onError: (e: Error) => toast({ title: "Delete failed", description: e.message, variant: "destructive" }),
  });

  const openNew = () => {
    setEditing(null);
    setFormOpen(true);
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h2 className="text-xl font-display font-bold tracking-tight">Road Signs</h2>
          <p className="text-sm text-muted-foreground">
            {signs.length} signs{missingCount > 0 && ` · ${missingCount} missing images`}
            {draftCount > 0 && ` · ${draftCount} short-text drafts`}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="outline"
            onClick={() => setApproveOpen(true)}
            disabled={draftCount === 0 || approveMutation.isPending}
            className="rounded-xl font-bold"
          >
            <CheckCheck className="h-4 w-4 mr-1" />
            {approveMutation.isPending ? "Approving…" : `Approve drafted (${draftCount})`}
          </Button>
          <Button onClick={openNew} className="brand-gradient border-none rounded-xl font-bold">
            <Plus className="h-4 w-4 mr-1" /> New sign
          </Button>
        </div>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="browse">Browse</TabsTrigger>
          <TabsTrigger value="import">Import &amp; reconcile</TabsTrigger>
        </TabsList>

        <TabsContent value="browse" className="space-y-4">
          <div className="glass-card rounded-2xl p-4 space-y-3">
            <div className="flex flex-col md:flex-row gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search name or code…"
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
            </div>
            <div className="flex flex-wrap gap-4">
              <div className="flex items-center gap-2">
                <Switch id="missing-img" checked={missingOnly} onCheckedChange={setMissingOnly} />
                <Label htmlFor="missing-img" className="text-xs font-semibold">Missing image</Label>
              </div>
              <div className="flex items-center gap-2">
                <Switch id="unverified" checked={unverifiedOnly} onCheckedChange={setUnverifiedOnly} />
                <Label htmlFor="unverified" className="text-xs font-semibold">Unverified only</Label>
              </div>
              <div className="flex items-center gap-2">
                <Switch id="needs-split" checked={needsSplitOnly} onCheckedChange={setNeedsSplitOnly} />
                <Label htmlFor="needs-split" className="text-xs font-semibold">Needs splitting</Label>
              </div>
              <div className="flex items-center gap-2">
                <Switch id="temp-only" checked={temporaryOnly} onCheckedChange={setTemporaryOnly} />
                <Label htmlFor="temp-only" className="text-xs font-semibold">Temporary only</Label>
              </div>
              <Select value={shortTextFilter} onValueChange={(v) => setShortTextFilter(v as typeof shortTextFilter)}>
                <SelectTrigger className="h-10 w-44 rounded-xl font-semibold text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Short text: all</SelectItem>
                  <SelectItem value="missing">Short text: missing</SelectItem>
                  <SelectItem value="draft">Short text: draft</SelectItem>
                  <SelectItem value="approved">Short text: approved</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {isLoading ? (
            <p className="text-sm text-muted-foreground py-8 text-center">Loading signs…</p>
          ) : filtered.length === 0 ? (
            <div className="glass-card rounded-2xl p-10 text-center space-y-2">
              <p className="font-bold">No signs found</p>
              <p className="text-sm text-muted-foreground">
                {signs.length === 0
                  ? "Import Allsigns.json from the Import & reconcile tab to get started."
                  : "Try widening the filters."}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3">
              {filtered.map((s) => (
                <SignCard
                  key={s.id}
                  sign={s}
                  onEdit={() => { setEditing(s); setFormOpen(true); }}
                  onDelete={() => setDeleting(s)}
                />
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="import" className="space-y-4">
          <SignImportPanel />
          <SignShortTextImportPanel />
        </TabsContent>
      </Tabs>

      <SignForm
        open={formOpen}
        onClose={() => { setFormOpen(false); setEditing(null); }}
        sign={editing}
      />

      <AlertDialog open={!!deleting} onOpenChange={(o) => !o && setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this sign?</AlertDialogTitle>
            <AlertDialogDescription>
              “{deleting?.name}” and its question links will be removed. Image files stay on disk.
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

      <AlertDialog
        open={approveOpen}
        onOpenChange={(open) => {
          setApproveOpen(open);
          setReviewed(false);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Approve all drafted short text?</AlertDialogTitle>
            <AlertDialogDescription>
              This makes <span className="font-bold">{draftCount}</span> drafted short texts visible to learners
              straight away, including any not shown in the current list. Only continue if you've reviewed them.
              A wrong action on a road sign can mislead learners.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="flex items-start gap-2 py-1">
            <Checkbox
              id="approve-reviewed"
              checked={reviewed}
              onCheckedChange={(v) => setReviewed(v === true)}
              className="mt-0.5"
            />
            <Label htmlFor="approve-reviewed" className="text-sm font-semibold leading-snug">
              I have reviewed these drafts
            </Label>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={!reviewed || approveMutation.isPending}
              onClick={() => approveMutation.mutate()}
            >
              {approveMutation.isPending ? "Approving…" : `Approve ${draftCount} sign${draftCount === 1 ? "" : "s"}`}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
