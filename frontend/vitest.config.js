import { defineConfig } from "vitest/config";

// Bound concurrent jsdom instances to avoid CPU/memory spikes on development laptops.
export default defineConfig({ test: { maxWorkers: 2, environment: "jsdom", include: ["src/**/*.test.{js,jsx}"], restoreMocks: true } });
