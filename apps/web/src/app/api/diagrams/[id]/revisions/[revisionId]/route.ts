import { versionNameBody } from "@/lib/api/contracts";
import { getRevisionFiles, renameRevision } from "@/server/diagrams/service";
import { json, notFound, readBody, withUser } from "@/server/http";

type Context = { params: Promise<{ id: string; revisionId: string }> };

export async function GET(request: Request, { params }: Context): Promise<Response> {
  const { id, revisionId } = await params;
  return withUser(request, async (user) => {
    const files = await getRevisionFiles(user.id, id, revisionId);
    return files === null ? notFound() : json({ files });
  });
}

/** Names a version, or clears its name (`null`). */
export async function PATCH(request: Request, { params }: Context): Promise<Response> {
  const { id, revisionId } = await params;
  return withUser(request, async (user) => {
    const body = await readBody(request, versionNameBody);
    if (body instanceof Response) return body;
    return (await renameRevision(user.id, id, revisionId, body.name))
      ? new Response(null, { status: 204 })
      : notFound();
  });
}
