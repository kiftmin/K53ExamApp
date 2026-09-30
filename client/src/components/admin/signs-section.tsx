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
import { BadgeCheck, ImageOff, Pencil, Plus, Search, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import SignForm from "./sign-form";
import SignImportPanel from "./sign-import";

function codesMissingImage(s: StudySign): string[] {
  const covered = new Set((s.images || []).map((i) => i.code));
  return (s.codes || []).filter((c) => !covered.has(c));
}

function SignCard({ sign, onEdit, onDelete }: { sign: StudySign; onEdit: () => void; onDelete: () => void }) {
  const thumb = sign.images?.[0]?.image_url;
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
  const [editing, setEditing] = useState<StudySign | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [deleting, setDeleting] = useState<StudySign | null>(null);

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
      if (q && !(s.name.toLowerCase().includes(q) || (s.codes || []).some((c) => c.toLowerCase().includes(q)))) return false;
      return true;
    });
  }, [signs, heading, subheading, search, missingOnly, unverifiedOnly]);

  const missingCount = useMemo(() => signs.filter((s) => codesMissingImage(s).length > 0).length, [signs]);

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
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-display font-bold tracking-tight">Road Signs</h2>
          <p className="text-sm text-muted-foreground">
            {signs.length} signs{missingCount > 0 && ` · ${missingCount} missing images`}
          </p>
        </div>
        <Button onClick={openNew} className="brand-gradient border-none rounded-xl font-bold">
          <Plus className="h-4 w-4 mr-1" /> New sign
        </Button>
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

        <TabsContent value="import">
          <SignImportPanel />
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
    </div>
  );
}
