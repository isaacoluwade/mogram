import { duplicateDiagram } from "@/server/diagrams/service";
import { json, notFound, withUser } from "@/server/http";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const { id } = await params;
  return withUser(request, async (user) => {
    const result = await duplicateDiagram(user.id, id);
    return result.ok ? json({ diagram: result.value }, 201) : notFound();
  });
}
