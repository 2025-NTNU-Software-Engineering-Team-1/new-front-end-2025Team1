import { fileURLToPath } from "node:url";
import * as path from "path";
import { defineConfig } from "vite";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
import vue from "@vitejs/plugin-vue";
import Pages from "vite-plugin-pages";
import Components from "unplugin-vue-components/vite";
import Icons from "unplugin-icons/vite";
import IconsResolver from "unplugin-icons/resolver";
import tailwindcss from "@tailwindcss/vite";

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    vue(),
    tailwindcss(),
    Pages(),
    Components({
      dts: "./src/auto/components.d.ts",
      resolvers: [IconsResolver()],
    }),
    Icons(),
  ],
  server: {
    proxy: {
      "/api": {
        target: "http://web:8080",
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, ""),
      },
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
      "@framework": path.resolve(__dirname, "src/live2d/Framework/src"),
    },
  },
});
