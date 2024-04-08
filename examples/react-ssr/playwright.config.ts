import { defineConfig, devices } from "@playwright/test";

const port = Number(process.env["E2E_PORT"] || 6174);
const command = process.env["E2E_PREVIEW"]
  ? `pnpm preview --port ${port} --strict-port`
  : process.env["E2E_WORKERD"]
    ? `pnpm dev-workerd --port ${port} --strict-port`
    : `pnpm dev --port ${port} --strict-port`;

export default defineConfig({
  testDir: "e2e",
  use: {
    trace: "on-first-retry",
  },
  projects: [
    {
      name: "chromium",
      use: devices["Desktop Chrome"],
    },
  ],
  webServer: {
    command,
    port,
  },
  forbidOnly: !!process.env["CI"],
  retries: process.env["CI"] ? 2 : 0,
  reporter: "list",
});
