import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/")({
  component: RouteComponent,
});

function RouteComponent() {
  return (
    <main className="container py-16">
      <h1 className="text-3xl font-bold">Budget — migration en cours</h1>
    </main>
  );
}
