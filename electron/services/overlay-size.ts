import type { OverlayResizeEdge } from "../../src/shared/types";

type Size = { width: number; height: number };
type Bounds = Size & { x: number; y: number };
type Mode = "suggestions" | "ask" | "loading" | "error";
interface WindowBounds {
  getBounds(): Bounds;
  setBounds(bounds: Bounds, animate: boolean): void;
}

const DEFAULTS: Record<Mode, Size> = {
  suggestions: { width: 420, height: 140 },
  ask: { width: 420, height: 336 },
  loading: { width: 420, height: 96 },
  error: { width: 420, height: 150 }
};
const EDGES = new Set<OverlayResizeEdge>(["top", "bottom", "left", "right", "top-left", "top-right", "bottom-left", "bottom-right"]);

// Keep the reading width across suggestions, but fit each new candidate's height.
export class OverlaySizer {
  private mode: Mode = "loading";
  private contentHeight = DEFAULTS.suggestions.height;
  private preferred: Partial<Record<Mode, Size>> = {};
  private manualSuggestionHeight = false;
  constructor(
    private window: WindowBounds,
    private workArea: (bounds: Bounds) => Bounds
  ) {}

  private get editable(): boolean { return this.mode === "suggestions" || this.mode === "ask"; }

  private constrain(bounds: Bounds): Bounds {
    const area = this.workArea(this.window.getBounds());
    const width = Math.min(Math.max(340, Math.round(bounds.width)), area.width - 36);
    const minimumHeight = this.mode === "ask" ? 260 : this.mode === "suggestions" ? 140 : 96;
    const height = Math.min(Math.max(minimumHeight, Math.round(bounds.height)), area.height - 36);
    return {
      width, height,
      x: Math.max(area.x + 18, Math.min(Math.round(bounds.x), area.x + area.width - width - 18)),
      y: Math.max(area.y + 18, Math.min(Math.round(bounds.y), area.y + area.height - height - 18))
    };
  }

  private apply(size: Size): void {
    this.window.setBounds(this.constrain({ ...this.window.getBounds(), ...size }), false);
  }

  show(mode: Mode): void {
    this.mode = mode;
    const size = this.preferred[mode] ?? DEFAULTS[mode];
    if (mode === "suggestions") {
      this.manualSuggestionHeight = false;
      this.apply({ width: size.width, height: Math.min(360, this.contentHeight) });
    } else this.apply(size);
  }

  fitContent(height: number, newCandidate = false, editing = false): boolean {
    if (this.mode !== "suggestions" || !Number.isFinite(height) || height <= 0) return false;
    this.contentHeight = height;
    if (newCandidate) this.manualSuggestionHeight = false;
    if (this.manualSuggestionHeight) return false;
    const current = this.window.getBounds();
    const next = this.constrain({ ...current, height: Math.min(editing ? 540 : 360, height) });
    if (next.height === current.height) return false;
    this.window.setBounds(next, false);
    return true;
  }

  resizeBy(edge: OverlayResizeEdge, deltaX: number, deltaY: number): void {
    if (!this.editable || !EDGES.has(edge) || !Number.isFinite(deltaX) || !Number.isFinite(deltaY)) return;
    if (!deltaX && !deltaY) return;
    const old = this.window.getBounds();
    const left = edge.includes("left"), right = edge.includes("right");
    const top = edge.includes("top"), bottom = edge.includes("bottom");
    const next = this.constrain({
      ...old,
      width: old.width + (right ? deltaX : left ? -deltaX : 0),
      height: old.height + (bottom ? deltaY : top ? -deltaY : 0)
    });
    // Keep the opposite edge stationary when dragging from the top or left.
    if (left) next.x = old.x + old.width - next.width;
    if (top) next.y = old.y + old.height - next.height;
    const bounds = this.constrain(next);
    this.preferred[this.mode] = { width: bounds.width, height: bounds.height };
    if (this.mode === "suggestions" && (top || bottom) && bounds.height !== old.height) {
      this.manualSuggestionHeight = true;
    }
    this.window.setBounds(bounds, false);
  }
}
