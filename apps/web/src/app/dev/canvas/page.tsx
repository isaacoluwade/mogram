import { notFound } from "next/navigation";
import { isLocalDevelopment } from "@/server/env";
import { DevCanvas } from "./dev-canvas";

/** Renderer check for local development only. */
export default function Page() {
  if (!isLocalDevelopment()) notFound();
  return <DevCanvas />;
}
