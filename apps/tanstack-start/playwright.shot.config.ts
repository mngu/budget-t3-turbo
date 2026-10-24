import config from "./playwright.config";

// The e2e server, sign-in and viewports, running `e2e/shot.ts` instead of the specs.
export default {
  ...config,
  projects: config.projects?.map((project) =>
    project.name === "setup" ? project : { ...project, testMatch: /shot\.ts$/ },
  ),
};
