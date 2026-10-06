import { useRef, useState, type CSSProperties } from "react";
import type { StudyControl, ControlDiagram } from "@shared/schema";
import { ImagePlus, MousePointerClick } from "lucide-react";
import { cn } from "@/lib/utils";

interface ControlDiagramViewProps {
  diagram: ControlDiagram;
  controls: StudyControl[];
  /** explore: tap markers to preview. place: click image to move/arm a control. preview: markers highlighted */
  mode?: "explore" | "place" | "preview";
  /** which control to highlight (preview mode) — all others dimmed */
  highlightControlId?: number | null;
  /** multiple controls to highlight (preview mode) — all others dimmed */
  highlightControlIds?: number[];
  onMarkerSelect?: (control: StudyControl) => void;
  onImageClick?: (pos: { x: number; y: number }) => void;
  /** called continuously while dragging a marker in place mode */
  onMarkerMove?: (controlId: number, pos: { x: number; y: number }) => void;
  /** admin: upload diagram image */
  onUpload?: (filename: string, dataUrl: string) => void;
  /** admin: which control is armed for placement */
  armedControlId?: number | null;
}

function readAsDataUrl(file: File): Promise<string> {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error("Could not read file"));
    reader.readAsDataURL(file);
  });
}

export default function ControlDiagramView({
  diagram,
  controls,
  mode = "explore",
  highlightControlId,
  highlightControlIds,
  onMarkerSelect,
  onImageClick,
  onMarkerMove,
  onUpload,
  armedControlId,
}: ControlDiagramViewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [dragId, setDragId] = useState<number | null>(null);
  const dragged = useRef(false);

  const computePos = (e: React.MouseEvent | React.TouchEvent | MouseEvent | TouchEvent) => {
    const el = containerRef.current;
    if (!el) return null;
    const rect = el.getBoundingClientRect();
    const clientX = (e as any).touches?.[0]?.clientX ?? (e as any).changedTouches?.[0]?.clientX ?? (e as any).clientX;
    const clientY = (e as any).touches?.[0]?.clientY ?? (e as any).changedTouches?.[0]?.clientY ?? (e as any).clientY;
    if (clientX == null || clientY == null) return null;
    return {
      x: Math.min(100, Math.max(0, ((clientX - rect.left) / rect.width) * 100)),
      y: Math.min(100, Math.max(0, ((clientY - rect.top) / rect.height) * 100)),
    };
  };

  const placed = controls.filter((c) => c.position_x != null && c.position_y != null);

  return (
    <div className="space-y-2">
      {mode === "place" && onUpload && !diagram.image_url && (
        <label className="flex items-center justify-center gap-2 h-10 rounded-xl border border-dashed border-border cursor-pointer hover:bg-accent text-sm font-bold">
          <ImagePlus className="h-4 w-4" /> Upload diagram image
          <input type="file" accept="image/*" className="hidden" onChange={(e) => {
            const f = e.target.files?.[0];
            if (!f) return;
            readAsDataUrl(f).then((dataUrl) => onUpload(f.name, dataUrl));
            e.target.value = "";
          }} />
        </label>
      )}

      <div
        ref={containerRef}
        className={cn("relative w-full rounded-2xl border border-border bg-white overflow-hidden", !diagram.image_url && "bg-muted/40")}
        style={{ minHeight: diagram.image_url ? undefined : 200 }}
        onClick={(e) => {
          if (mode !== "place") return;
          if (armedControlId == null) return;
          const pos = computePos(e);
          if (pos && onImageClick) onImageClick(pos);
        }}
      >
        {diagram.image_url ? (
          <img src={diagram.image_url} alt={diagram.label} className="w-full block" draggable={false} />
        ) : (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-muted-foreground">
            <ImagePlus className="h-8 w-8" />
            <p className="text-xs font-semibold">No diagram image yet</p>
          </div>
        )}

        {/* Markers */}
        {placed.map((c) => {
          const highlighted =
            highlightControlIds != null
              ? highlightControlIds.includes(c.id)
              : highlightControlId === c.id;
          const dim = mode === "preview" && (highlightControlIds ? highlightControlIds.length > 0 : highlightControlId != null) && !highlighted;
          const highlight = mode === "preview" && highlighted;
          const armed = mode === "place" && armedControlId === c.id;
          const style: CSSProperties = { left: `${c.position_x}%`, top: `${c.position_y}%` };
          return (
            <button
              key={c.id}
              type="button"
              title={`${c.component_number ?? ""} ${c.component_name}`}
              onClick={(e) => {
                e.stopPropagation();
                if (dragged.current) { dragged.current = false; return; }
                onMarkerSelect?.(c);
              }}
              onPointerDown={(e) => {
                if (mode !== "place") return;
                e.stopPropagation();
                setDragId(c.id);
                dragged.current = false;
                (e.currentTarget as Element).setPointerCapture?.(e.pointerId);
              }}
              onPointerMove={(e) => {
                if (mode !== "place" || dragId !== c.id) return;
                const pos = computePos(e);
                if (pos) {
                  dragged.current = true;
                  onMarkerMove?.(c.id, pos);
                }
              }}
              onPointerUp={() => setDragId(null)}
              onPointerLeave={() => setDragId(null)}
              className={cn(
                "absolute -translate-x-1/2 -translate-y-1/2 w-7 h-7 rounded-full border-2 flex items-center justify-center text-[11px] font-bold transition-all",
                dim ? "opacity-40 bg-muted text-muted-foreground border-muted-foreground/30" : "bg-primary text-primary-foreground border-white shadow",
                highlight && "ring-4 ring-primary/30 animate-pulse",
                armed && "ring-4 ring-amber-400",
              )}
              style={style}
            >
              {c.component_number ?? "•"}
            </button>
          );
        })}

        {mode === "place" && armedControlId != null && diagram.image_url && (
          <div className="absolute top-2 left-2 bg-amber-400/90 text-amber-900 text-[11px] font-bold px-2 py-1 rounded-md flex items-center gap-1">
            <MousePointerClick className="h-3.5 w-3.5" /> Click the image to place
          </div>
        )}
      </div>
      {mode === "place" && (
        <p className="text-[11px] text-muted-foreground italic">
          Tap a component in the list to arm it, then tap the image to place it. Drag a marker to reposition it.
        </p>
      )}
    </div>
  );
}
