import { defineConfig } from "vite";

// base: "./" makes the built asset URLs relative, so the game runs from any
// GitHub Pages project subpath (e.g. https://user.github.io/fuckerie-2d/).
export default defineConfig({
  base: "./",
  build: {
    target: "es2022",
    outDir: "dist",
  },
});
