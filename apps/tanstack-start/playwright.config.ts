import { defineConfig } from "@playwright/test";

export const DEMO_STATE = "e2e/.auth/demo.json";

const mobile = { isMobile: true, hasTouch: true, deviceScaleFactor: 3 };
const signedIn = { storageState: DEMO_STATE };

export default defineConfig({
  testDir: "e2e",
  // `.e2e.ts` keeps these files out of Vitest's default `*.spec.ts` glob.
  testMatch: /\.e2e\.ts$/,
  use: { baseURL: "http://localhost:3000", trace: "retain-on-failure" },
  webServer: {
    command: "pnpm dev",
    url: "http://localhost:3000/login",
    reuseExistingServer: true,
  },
  projects: [
    { name: "setup", testMatch: /auth\.setup\.ts$/ },
    {
      name: "mobile-360",
      use: { ...mobile, ...signedIn, viewport: { width: 360, height: 780 } },
      dependencies: ["setup"],
    },
    {
      name: "mobile-375",
      use: { ...mobile, ...signedIn, viewport: { width: 375, height: 812 } },
      dependencies: ["setup"],
    },
    {
      name: "desktop",
      use: { ...signedIn, viewport: { width: 1280, height: 800 } },
      dependencies: ["setup"],
    },
  ],
});
