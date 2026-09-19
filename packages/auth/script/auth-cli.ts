// Schema generation only; runtime authentication uses src/index.ts.

import { initAuth } from "../src/index";

export const auth = initAuth({
  baseUrl: "http://localhost:3000",
  secret: "secret",
});
