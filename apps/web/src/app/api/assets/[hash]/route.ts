import { uploadAsset } from "@/server/assets/service";
import { withUser } from "@/server/http";

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ hash: string }> },
): Promise<Response> {
  const { hash } = await params;
  return withUser(request, (user) => uploadAsset(user.id, hash, request));
}
