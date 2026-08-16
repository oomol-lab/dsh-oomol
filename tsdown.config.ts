import { defineConfig } from "tsdown"

const pluginId = "dsh-oomol"

export default defineConfig({
  name: `${pluginId}/client`,
  entry: { client: "src/client/index.tsx" },
  outDir: "lib",
  format: "cjs",
  platform: "browser",
  target: "es2022",
  dts: false,
  clean: false,
  sourcemap: true,
  deps: {
    neverBundle: ["react", "react/jsx-runtime"],
  },
  outputOptions: {
    entryFileNames: "client.js",
    banner: `window.__ModuleLoader__.load({ id: ${JSON.stringify(pluginId)}, factory: (require) => {`,
    footer: "return module.exports; } });",
    intro: "var module = { exports: {} }; var exports = module.exports;",
  },
})
