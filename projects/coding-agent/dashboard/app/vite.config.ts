import { defineConfig, loadEnv } from "vite";
import { resolve } from "path";
import react from "@vitejs/plugin-react";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  // Load env vars from repo root (5 levels up: app/ -> dashboard/ -> coding-agent/ -> projects/ -> repo root)
  const repoRoot = resolve(__dirname, "../../../../..");
  const env = loadEnv(mode, repoRoot, "");

  const port = parseInt(
    env.DASHBOARD_PORT || process.env.DASHBOARD_PORT || "3002",
    10,
  );
  const codingAgentPort = env.CODING_AGENT_BACKEND_PORT || "8086";
  const devHostname = env.DEV_HOSTNAME || "localhost";
  const backendUrl = `http://${devHostname}:${codingAgentPort}`;

  return {
    plugins: [react()],
    server: {
      port,
      host: true,
      proxy: {
        "/api": {
          target: backendUrl,
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/api/, "/orchestrator"),
        },
        "/socket.io": {
          target: backendUrl,
          changeOrigin: true,
          ws: true,
        },
      },
    },
    preview: {
      port,
      host: true,
    },
  };
});
