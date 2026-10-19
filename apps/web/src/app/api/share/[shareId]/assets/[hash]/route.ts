import { readDiagramAsset } from "@/server/assets/service";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ shareId: string; hash: string }> },
): Promise<Response> {
  const { shareId, hash } = await params;
  return readDiagramAsset({ shareId }, hash);
}
