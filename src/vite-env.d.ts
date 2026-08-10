/// <reference types="vite/client" />

import type { ContextCueApi } from "./shared/types";

declare global {
  interface Window {
    contextCue: ContextCueApi;
  }
}

export {};
