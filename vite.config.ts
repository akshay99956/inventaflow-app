import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
  },
  plugins: [react(), mode === "development" && componentTagger()].filter(Boolean),
  build: {
    // Widened target for cross-browser compatibility (older Safari, Firefox ESR, etc.)
    target: ["es2017", "edge88", "firefox78", "chrome87", "safari13"],
    cssTarget: ["chrome87", "firefox78", "safari13", "edge88"],
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
}));
