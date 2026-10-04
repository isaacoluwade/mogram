"use client";

import { useSearchParams } from "next/navigation";
import { DiagramPreview } from "@/features/canvas/diagram-preview";
import { templateById } from "@/features/templates";

/** `/dev/canvas?template=aks&folder=aks&scene=bad_deploy` renders any template level and scene. */
export function DevCanvas() {
  const params = useSearchParams();
  const template = templateById(params.get("template") ?? "web-app");
  return (
    <DiagramPreview
      files={template.files}
      folder={params.get("folder") ?? ""}
      scene={params.get("scene")}
      className="h-dvh w-full"
    />
  );
}
