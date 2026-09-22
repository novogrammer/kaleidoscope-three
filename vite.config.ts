import { defineConfig } from "vite";

export default defineConfig({
  build: {
    rollupOptions: {
      input: {
        main: "index.html",
        mediapipeCheck: "mediapipe-check.html",
      },
    },
  },
});
