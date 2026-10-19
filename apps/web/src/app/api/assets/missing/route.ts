import { missingAssets, missingAssetsBody } from "@/server/assets/service";
import { json, readBody, withUser } from "@/server/http";

/** Which of a project's assets the signed-in person hasn't stored yet (D-101). */
export async function POST(request: Request): Promise<Response> {
  return withUser(request, async (user) => {
    const body = await readBody(request, missingAssetsBody);
    if (body instanceof Response) return body;
    return json({ missing: await missingAssets(user.id, body.hashes) });
  });
}
