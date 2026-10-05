import { importVersionsBody } from "@/lib/api/contracts";
import { importRevisions } from "@/server/diagrams/service";
import { apiError, json, notFound, readBody, withUser } from "@/server/http";

/** A draft's earlier versions, uploaded with it when it's saved to the account. */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const { id } = await params;
  return withUser(request, async (user) => {
    const body = await readBody(request, importVersionsBody);
    if (body instanceof Response) return body;
    const result = await importRevisions(user.id, id, body.versions);
    if (result.ok) return json(result.value);
    return result.code === "not_found" ? notFound() : apiError(400, result.code, result.message);
  });
}
