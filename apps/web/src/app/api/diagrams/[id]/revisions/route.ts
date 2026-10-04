import { listRevisions } from "@/server/diagrams/service";
import { json, notFound, withUser } from "@/server/http";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const { id } = await params;
  return withUser(request, async (user) => {
    const revisions = await listRevisions(user.id, id);
    return revisions === null ? notFound() : json({ revisions });
  });
}
