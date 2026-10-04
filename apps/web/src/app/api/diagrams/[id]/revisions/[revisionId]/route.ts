import { getRevisionFiles } from "@/server/diagrams/service";
import { json, notFound, withUser } from "@/server/http";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string; revisionId: string }> },
): Promise<Response> {
  const { id, revisionId } = await params;
  return withUser(request, async (user) => {
    const files = await getRevisionFiles(user.id, id, revisionId);
    return files === null ? notFound() : json({ files });
  });
}
