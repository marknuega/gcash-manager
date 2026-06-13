import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// In dev, proxy /api to the local Express server so you can run
// `VITE_MOCK=false npm run dev` against a real database during development.
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      "/api": "http://localhost:4000",
    },
  },
});
