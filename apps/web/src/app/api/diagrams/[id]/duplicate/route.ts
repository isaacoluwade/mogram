import { duplicateBody } from "@/lib/api/contracts";
import { duplicateDiagram } from "@/server/diagrams/service";
import { json, notFound, readBody, withUser } from "@/server/http";

/** A copy of the diagram, as it is now or (with `revisionId`) as it was then. */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const { id } = await params;
  return withUser(request, async (user) => {
    const hasBody = (request.headers.get("content-length") ?? "0") !== "0";
    const body = hasBody ? await readBody(request, duplicateBody) : {};
    if (body instanceof Response) return body;
    const result = await duplicateDiagram(user.id, id, body.revisionId);
    return result.ok ? json({ diagram: result.value }, 201) : notFound();
  });
}
