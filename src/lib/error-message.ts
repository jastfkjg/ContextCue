/** Electron adds an IPC transport wrapper which is not useful in the UI. */
export function errorMessage(error: unknown): string {
  const message = error instanceof Error ? error.message : typeof error === "string" ? error : "";
  return message
    .replace(/^Error:\s*/, "")
    .replace(/^Error invoking remote method '[^']+':\s*(?:Error:\s*)?/, "")
    .trim() || "Something went wrong. Please try again.";
}
