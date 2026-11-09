import { redirectTo } from "@/lib/redirect";
import { getSession } from "@/lib/session";

export async function POST() {
  const session = await getSession();
  session.destroy();
  return redirectTo("/", { status: 303 });
}
