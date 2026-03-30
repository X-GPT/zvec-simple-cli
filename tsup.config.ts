import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["index.ts"],
  format: ["esm"],
  outDir: "dist",
  banner: {
    js: "#!/usr/bin/env node",
  },
  splitting: false,
  clean: true,
  external: ["@zvec/zvec", "better-sqlite3"],
});
