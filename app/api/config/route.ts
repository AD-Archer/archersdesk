import { NextRequest, NextResponse } from "next/server";
import { isUser, requireUser } from "@/lib/api";
import { getUserConfig, parseConfig, saveUserConfig } from "@/lib/config";

export async function GET(req: NextRequest) {
  const user = requireUser(req);
  if (!isUser(user)) return user;
  const { yaml, config } = getUserConfig(user.id);
  return NextResponse.json({ yaml, config });
}

export async function PUT(req: NextRequest) {
  const user = requireUser(req);
  if (!isUser(user)) return user;

  const body = await req.json().catch(() => ({}));
  if (typeof body.yaml !== "string" || body.yaml.length > 32_000)
    return NextResponse.json({ error: "yaml text required" }, { status: 400 });

  const { config, errors } = parseConfig(body.yaml);
  if (errors.length) return NextResponse.json({ errors }, { status: 422 });

  saveUserConfig(user.id, body.yaml);
  return NextResponse.json({ yaml: body.yaml, config });
}
