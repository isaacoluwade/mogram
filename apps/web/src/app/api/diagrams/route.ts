import { createDiagramBody } from "@/lib/api/contracts";
import { createDiagram, listDiagrams } from "@/server/diagrams/service";
import { apiError, json, readBody, withUser } from "@/server/http";

export async function GET(request: Request): Promise<Response> {
  return withUser(request, async (user) => json({ diagrams: await listDiagrams(user.id) }));
}

export async function POST(request: Request): Promise<Response> {
  return withUser(request, async (user) => {
    const body = await readBody(request, createDiagramBody);
    if (body instanceof Response) return body;
    const result = await createDiagram(user.id, body);
    if (!result.ok) return apiError(400, result.code, result.message);
    return json({ diagram: result.value }, 201);
  });
}
