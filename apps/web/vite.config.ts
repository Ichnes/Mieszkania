import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import { fileURLToPath } from "node:url";

const envDir = fileURLToPath(new URL("../../", import.meta.url));
export default defineConfig(({ mode }) => {
  const env = { ...loadEnv(mode, envDir, ""), ...process.env };
  const target = env.API_PROXY_TARGET || `http://localhost:${env.PORT || 3001}`;
  return {
    envDir,
    plugins: [react()],
    server: {
      host: "0.0.0.0",
      port: Number(env.WEB_PORT || 5173),
      strictPort: true,
      allowedHosts: ["otomieszkanie", "otomieszkanie.local"],
      proxy: {
        "/api": { target, changeOrigin: false },
        "/health": { target, changeOrigin: true },
      },
    },
  };
});
