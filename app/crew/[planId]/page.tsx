import { Suspense } from "react";
import { CrewView } from "./CrewView";

export const metadata = { title: "Sombra · Crew" };

// The plan id is read on the client (useParams), so the static shell only needs a loading boundary.
export default function CrewPage() {
  return (
    <Suspense fallback={<main className="p-6 text-xl">Cargando…</main>}>
      <CrewView />
    </Suspense>
  );
}
