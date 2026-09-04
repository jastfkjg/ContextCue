/** Keep the writing envelope out of the visible Markdown stream. */
export class AskOutput {
  private pending = "";
  private mode: "pending" | "answer" | "draft" = "pending";
  static readonly marker = "CONTEXTCUE_DRAFT";

  constructor(private readonly emit: (delta: string) => void) {}

  push(delta: string): void {
    if (this.mode === "draft") return;
    if (this.mode === "answer") { this.emit(delta); return; }
    this.pending += delta;
    const start = this.pending.trimStart();
    if ([AskOutput.marker, `${AskOutput.marker}\n`, `${AskOutput.marker}\r\n`].some((prefix) => prefix.startsWith(start))) return;
    if (start.startsWith(`${AskOutput.marker}\n`) || start.startsWith(`${AskOutput.marker}\r\n`)) {
      this.mode = "draft";
    } else {
      this.mode = "answer";
      this.emit(this.pending);
    }
    this.pending = "";
  }

  finish(raw: string): string | null {
    const start = raw.trim();
    if (this.mode === "draft" || start === AskOutput.marker) {
      return start.slice(AskOutput.marker.length).trim();
    }
    if (this.pending) this.emit(this.pending);
    this.pending = "";
    return null;
  }
}
