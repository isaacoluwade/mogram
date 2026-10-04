import { shareSettingsBody } from "@/lib/api/contracts";
import { updateShareSettings } from "@/server/diagrams/service";
import { json, notFound, readBody, withUser } from "@/server/http";

/** Share settings (SH-1, SH-3, AC-5): visibility, viewer state changes, link regeneration. */
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const { id } = await params;
  return withUser(request, async (user) => {
    const body = await readBody(request, shareSettingsBody);
    if (body instanceof Response) return body;
    const result = await updateShareSettings(user.id, id, body);
    return result.ok ? json({ diagram: result.value }) : notFound();
  });
}
