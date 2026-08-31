import { createFileRoute } from "@tanstack/react-router";

import { Test } from "@budget/ui/test";

export const Route = createFileRoute("/_authed/_period-overview/test")({
  component: RouteComponent,
});

function RouteComponent() {
  return (
    <>
      Hello "/_authed/test"!
      <Test />
    </>
  );
}
