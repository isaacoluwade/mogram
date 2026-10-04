import { getSharedDiagram } from "@/server/diagrams/service";
import { apiError } from "@/server/http";

/** Public read of a shared diagram (SH-1). Private or unknown links are simply not found. */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ shareId: string }> },
): Promise<Response> {
  const { shareId } = await params;
  const shared = await getSharedDiagram(shareId);
  if (shared === null)
    return apiError(404, "not_found", "This link doesn't open a shared diagram.");
  return Response.json(
    { diagram: shared },
    { headers: { "Cache-Control": "no-store", "X-Robots-Tag": "noindex" } },
  );
}
