import { NextRequest, NextResponse } from "next/server";
import { isUser, requireUser } from "@/lib/api";
import { importImage, storeImage } from "@/lib/images";

// Add a button image: upload a file (multipart "file") or send {url} to have
// the server download it. Either way it comes back compressed (see lib/images).

export async function POST(req: NextRequest) {
  const user = requireUser(req);
  if (!isUser(user)) return user;

  try {
    if ((req.headers.get("content-type") ?? "").includes("multipart/form-data")) {
      const file = (await req.formData()).get("file");
      if (!(file instanceof Blob)) return NextResponse.json({ error: "no file in the upload" }, { status: 400 });
      return NextResponse.json(await storeImage(user.id, Buffer.from(await file.arrayBuffer())));
    }
    const { url } = (await req.json().catch(() => ({}))) as { url?: string };
    if (!url) return NextResponse.json({ error: "send a file or an image url" }, { status: 400 });
    return NextResponse.json(await importImage(user.id, url));
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "couldn't save that image" }, { status: 400 });
  }
}
