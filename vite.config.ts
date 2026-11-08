import react from "@vitejs/plugin-react";
import { defineConfig, loadEnv } from "vite";

import { netlifyHeaders, petioleApi } from "./server/vite-plugin.ts";

// The dev and preview servers answer /api/* as the Netlify Function does,
// with PETIOLE_API_KEY from .env when it is set (as the site's own key, for
// a request that brings none). PETIOLE_MOCK_URL is the tests': the Prism
// mock to call instead of the Petiole API. Neither reaches the page: Vite
// gives the page only variables that start with VITE_.
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "PETIOLE_");
  return {
    plugins: [
      react(),
      petioleApi({ apiKey: env.PETIOLE_API_KEY || undefined, upstream: env.PETIOLE_MOCK_URL || undefined }),
    ],
    preview: { headers: netlifyHeaders() },
  };
});
