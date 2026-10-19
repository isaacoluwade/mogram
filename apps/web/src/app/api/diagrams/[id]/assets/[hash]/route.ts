import { readDiagramAsset } from "@/server/assets/service";
import { withUser } from "@/server/http";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string; hash: string }> },
): Promise<Response> {
  const { id, hash } = await params;
  return withUser(request, (user) => readDiagramAsset({ id, ownerId: user.id }, hash));
}
