import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  optimizeDeps: {
    entries: ["index.html"],
  },
  plugins: [react()],
});
