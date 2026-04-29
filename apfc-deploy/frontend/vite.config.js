import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Served from /calculator/ subdirectory on the main marketing site
export default defineConfig({
  plugins: [react()],
  base: "/calculator/",
});
