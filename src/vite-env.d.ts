/// <reference types="vite/client" />

import type { HiplyApi } from "./shared/types";

declare global {
  interface Window {
    hiply: HiplyApi;
  }
}

export {};
