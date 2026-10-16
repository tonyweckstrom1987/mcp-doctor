import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["test/**/*.test.ts"],
    // Testit käynnistävät oikeita stdio-palvelimia aliprosesseina.
    testTimeout: 30000,
  },
});
