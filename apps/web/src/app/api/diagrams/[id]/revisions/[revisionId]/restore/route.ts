import { restoreRevision } from "@/server/diagrams/service";
import { json, notFound, withUser } from "@/server/http";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string; revisionId: string }> },
): Promise<Response> {
  const { id, revisionId } = await params;
  return withUser(request, async (user) => {
    const result = await restoreRevision(user.id, id, revisionId);
    return result.ok ? json(result.value) : notFound();
  });
}
