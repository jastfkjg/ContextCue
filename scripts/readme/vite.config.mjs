import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Documentation preview only. The desktop entry points are unchanged.
export default defineConfig({
  plugins: [react()],
  server: { host: "127.0.0.1", port: 4187, strictPort: true }
});
