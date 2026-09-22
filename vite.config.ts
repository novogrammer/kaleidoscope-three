import { fileURLToPath } from "node:url";

import { defineConfig } from "vite";

const sourceRoot = fileURLToPath(new URL("./src", import.meta.url));

export default defineConfig({
  root: sourceRoot,
  base: "./",
  publicDir: fileURLToPath(new URL("./public", import.meta.url)),
  build: {
    outDir: fileURLToPath(new URL("./dist", import.meta.url)),
    emptyOutDir: true,
    rollupOptions: {
      input: {
        main: fileURLToPath(new URL("./src/index.html", import.meta.url)),
        mediapipeCheck: fileURLToPath(
          new URL("./src/mediapipe-check/index.html", import.meta.url),
        ),
      },
    },
  },
});
