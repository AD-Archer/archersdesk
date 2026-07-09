import { NextRequest, NextResponse } from "next/server";
import { isUser, requireUser } from "@/lib/api";
import { isActionableService, isProxyService, runIntegration, runIntegrationAction } from "@/lib/integrations";
import { getDeviceSettings } from "@/lib/settings";

export async function GET(req: NextRequest, ctx: { params: Promise<{ service: string }> }) {
  const user = requireUser(req);
  if (!isUser(user)) return user;

  const { service } = await ctx.params;
  if (!isProxyService(service))
    return NextResponse.json({ error: `unknown integration "${service}"` }, { status: 404 });

  const { settings, device } = getDeviceSettings(user.id, req.nextUrl.searchParams.get("device"));
  const body = await runIntegration(service, user.id, settings, device.location);
  return NextResponse.json(body);
}

export async function POST(req: NextRequest, ctx: { params: Promise<{ service: string }> }) {
  const user = requireUser(req);
  if (!isUser(user)) return user;

  const { service } = await ctx.params;
  if (!isActionableService(service))
    return NextResponse.json({ error: `"${service}" has no actions` }, { status: 400 });

  const { action, payload } = (await req.json().catch(() => ({}))) as { action?: string; payload?: unknown };
  if (!action) return NextResponse.json({ error: "missing action" }, { status: 400 });

  const { settings, device } = getDeviceSettings(user.id, req.nextUrl.searchParams.get("device"));
  const body = await runIntegrationAction(service, user.id, settings, device.location, action, payload);
  return NextResponse.json(body);
}
