import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      // Dynamic proxy target based on request header or query param
      // Client should send header: x-target: https://<user-host>/v2
      "/api": {
        // Use a REAL, resolvable default to avoid DNS errors before router() overrides
        target: "https://wfo-bruneck.digitalesregister.it/v2",
        changeOrigin: true,
        secure: true,
        // Rewrite upstream cookie attributes so the browser stores them for localhost
        cookieDomainRewrite: "localhost",
        cookiePathRewrite: "/",
        router: (req) => {
          try {
            const headerTarget = req.headers["x-target"]; // e.g., https://domain.tld/v2
            const url = new URL(req.url || "", "http://localhost");
            const qpTarget = url.searchParams.get("x-target");
            const chosen =
              (Array.isArray(headerTarget) ? headerTarget[0] : headerTarget) ||
              qpTarget;
            // eslint-disable-next-line no-console
            console.log("[proxy] ->", chosen || "<default>", "path:", req.url);
            return chosen || "https://wfo-bruneck.digitalesregister.it/v2";
          } catch {
            return "https://wfo-bruneck.digitalesregister.it/v2";
          }
        },
        onProxyReq(proxyReq, req) {
          // Do not forward control headers/query to upstream
          if (proxyReq.removeHeader) proxyReq.removeHeader("x-target");
        },
        // If upstream expects paths without the /api prefix, you can rewrite here
        // rewrite: (path) => path.replace(/^\/api/, ""),
      },
    },
  },
});
