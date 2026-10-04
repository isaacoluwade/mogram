import { saveDiagramBody, updateDiagramBody } from "@/lib/api/contracts";
import { deleteDiagram, getDiagram, saveDiagram, updateDiagram } from "@/server/diagrams/service";
import { apiError, json, notFound, readBody, withUser } from "@/server/http";

type Context = { params: Promise<{ id: string }> };

export async function GET(request: Request, { params }: Context): Promise<Response> {
  const { id } = await params;
  return withUser(request, async (user) => {
    const diagram = await getDiagram(user.id, id);
    return diagram === null ? notFound() : json({ diagram });
  });
}

/** Saves the working copy. 409 when someone saved a newer version first. */
export async function PUT(request: Request, { params }: Context): Promise<Response> {
  const { id } = await params;
  return withUser(request, async (user) => {
    const body = await readBody(request, saveDiagramBody);
    if (body instanceof Response) return body;
    const result = await saveDiagram(user.id, id, body);
    if (result.ok) return json(result.value);
    if (result.code === "not_found") return notFound();
    if (result.code === "conflict")
      return apiError(409, "conflict", result.message, { currentVersion: result.currentVersion });
    return apiError(400, result.code, result.message);
  });
}

/** Rename and/or new thumbnail. */
export async function PATCH(request: Request, { params }: Context): Promise<Response> {
  const { id } = await params;
  return withUser(request, async (user) => {
    const body = await readBody(request, updateDiagramBody);
    if (body instanceof Response) return body;
    const result = await updateDiagram(user.id, id, body);
    return result.ok ? json({ diagram: result.value }) : notFound();
  });
}

export async function DELETE(request: Request, { params }: Context): Promise<Response> {
  const { id } = await params;
  return withUser(request, async (user) =>
    (await deleteDiagram(user.id, id)) ? new Response(null, { status: 204 }) : notFound(),
  );
}
