import { defineConfig } from "vite";
import { svelte } from "@sveltejs/vite-plugin-svelte";

const host = process.env.TAURI_DEV_HOST;

// https://vitejs.dev/config/ — tuned for Tauri (see https://tauri.app)
export default defineConfig({
  plugins: [svelte()],

  // Tauri expects a fixed port and surfaces Rust errors, so don't clear them.
  clearScreen: false,
  server: {
    port: 1420,
    strictPort: true,
    host: host || false,
    hmr: host
      ? {
          protocol: "ws",
          host,
          port: 1421,
        }
      : undefined,
    watch: {
      // Don't reload the frontend when the Rust side changes.
      ignored: ["**/src-tauri/**"],
    },
  },

  // Produce a leaner bundle; split the heavy mermaid chunk out.
  build: {
    target: "esnext",
    chunkSizeWarningLimit: 1500,
  },
});
