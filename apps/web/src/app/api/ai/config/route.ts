import { userFromRequest } from "@/server/auth/session";
import { json } from "@/server/http";
import { publicConfig } from "@/server/ai/service";

/** Whether the assistant is on for this person, and what it's called. */
export async function GET(request: Request): Promise<Response> {
  const user = await userFromRequest(request);
  return json({ assistant: publicConfig(user !== null) });
}
