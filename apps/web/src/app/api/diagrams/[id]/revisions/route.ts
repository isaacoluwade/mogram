import { checkpointBody } from "@/lib/api/contracts";
import { checkpointDiagram, listRevisions } from "@/server/diagrams/service";
import { json, notFound, readBody, withUser } from "@/server/http";

type Context = { params: Promise<{ id: string }> };

export async function GET(request: Request, { params }: Context): Promise<Response> {
  const { id } = await params;
  return withUser(request, async (user) => {
    const revisions = await listRevisions(user.id, id);
    return revisions === null ? notFound() : json({ revisions });
  });
}

/** Names the diagram as it is now (a named version). */
export async function POST(request: Request, { params }: Context): Promise<Response> {
  const { id } = await params;
  return withUser(request, async (user) => {
    const body = await readBody(request, checkpointBody);
    if (body instanceof Response) return body;
    return (await checkpointDiagram(user.id, id, body.name))
      ? new Response(null, { status: 204 })
      : notFound();
  });
}
