import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import sharp from "sharp";
import { env } from "./env";

// ── button images ────────────────────────────────────────────────────
// Every image a macapad button shows (pasted url, upload, website logo) is
// squeezed here: at most 512px (a key can be that big on a desktop pad
// page), WebP with its alpha channel kept — usually a fraction of the PNG it
// came from — and stored per user under DATA_DIR, named
// by content hash so the same picture is only kept once. A "-d" suffix marks
// mostly-dark artwork, which the pad sits on a light plate so it stays visible.

const MAX_INPUT = 12 * 1024 * 1024;
const SIZE = 512;

export const IMAGE_NAME = /^[a-f0-9]{24}(-d)?\.webp$/;

function userDir(userId: number) {
  const dir = path.join(env.dataDir, "macapad-images", String(userId));
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

/** An svg, by its markup (sharp would draw it at its own, often tiny, size). */
function isSvg(input: Buffer) {
  return input.subarray(0, 1024).toString("utf8").toLowerCase().includes("<svg");
}

/** Resize + re-encode to WebP, keeping transparency. */
export async function compressImage(input: Buffer, size = SIZE): Promise<Buffer> {
  // svg icons are often drawn at 24–32px: rasterize at the density that makes
  // them `size` across, so they stay sharp
  let density: number | undefined;
  if (isSvg(input)) {
    const { width = 0, height = 0 } = await sharp(input).metadata();
    const side = Math.max(width, height) || 24;
    density = Math.round(Math.min(2400, Math.max(72, (72 * size) / side)));
  }
  return sharp(input, { limitInputPixels: 40_000_000, animated: false, ...(density ? { density } : {}) })
    .rotate() // honour exif orientation from phone photos
    .resize(size, size, { fit: "inside", withoutEnlargement: true })
    .webp({ quality: 82, alphaQuality: 90, effort: 5 })
    .toBuffer();
}

/** Is the visible (non-transparent) part of the image mostly dark? */
async function isDark(image: Buffer): Promise<boolean> {
  const { data } = await sharp(image).resize(32, 32, { fit: "inside" }).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  let weight = 0;
  let light = 0;
  for (let i = 0; i < data.length; i += 4) {
    const a = data[i + 3] / 255;
    weight += a;
    light += a * ((0.2126 * data[i] + 0.7152 * data[i + 1] + 0.0722 * data[i + 2]) / 255);
  }
  return weight > 0 && light / weight < 0.32;
}

export interface StoredImage {
  url: string; // what a button stores: /api/macapad/images/<name>
  bytes: number;
  originalBytes: number;
}

export async function storeImage(userId: number, input: Buffer): Promise<StoredImage> {
  if (input.length > MAX_INPUT) throw new Error("that image is over 12 MB");
  let out: Buffer;
  try {
    out = await compressImage(input);
  } catch {
    throw new Error("couldn't read that image — try a png, jpg, webp, gif or svg");
  }
  const hash = crypto.createHash("sha256").update(out).digest("hex").slice(0, 24);
  const name = `${hash}${(await isDark(out)) ? "-d" : ""}.webp`;
  const file = path.join(userDir(userId), name);
  if (!fs.existsSync(file)) fs.writeFileSync(file, out);
  return { url: `/api/macapad/images/${name}`, bytes: out.length, originalBytes: input.length };
}

/** Download an image (from the server, so any site works) and store it. */
export async function importImage(userId: number, rawUrl: string): Promise<StoredImage> {
  let url: URL;
  try {
    url = new URL(rawUrl.trim());
  } catch {
    throw new Error("that doesn't look like an image link");
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") throw new Error("only http(s) image links work");
  let res: Response;
  try {
    res = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0 (Macintosh) AppleWebKit/537.36 Chrome/120 Safari/537.36", Accept: "image/*" },
      signal: AbortSignal.timeout(10_000),
    });
  } catch {
    throw new Error("couldn't download that image");
  }
  if (!res.ok) throw new Error(`that link answered ${res.status}`);
  if (Number(res.headers.get("content-length") ?? 0) > MAX_INPUT) throw new Error("that image is over 12 MB");
  return storeImage(userId, Buffer.from(await res.arrayBuffer()));
}

export function readImage(userId: number, name: string): Buffer | null {
  if (!IMAGE_NAME.test(name)) return null;
  const file = path.join(userDir(userId), name);
  return fs.existsSync(file) ? fs.readFileSync(file) : null;
}
