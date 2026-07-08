import { NextRequest, NextResponse } from "next/server";
import { isUser, requireUser } from "@/lib/api";
import { isProxyService, runIntegration } from "@/lib/integrations";
import { getUserSettings } from "@/lib/settings";

export async function GET(req: NextRequest, ctx: { params: Promise<{ service: string }> }) {
  const user = requireUser(req);
  if (!isUser(user)) return user;

  const { service } = await ctx.params;
  if (!isProxyService(service))
    return NextResponse.json({ error: `unknown integration "${service}"` }, { status: 404 });

  const settings = getUserSettings(user.id);
  const body = await runIntegration(service, user.id, settings);
  return NextResponse.json(body);
}
