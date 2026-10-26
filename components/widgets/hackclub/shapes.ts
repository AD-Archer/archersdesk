// cont.d's cells: the four shapes its landing page draws its field and its
// wordmark from (ShapeWaves over there), and the lifecycle each stands for on
// that page: a triangle is a project tossed in, a square one picked up and
// remade, a circle one shipped. "mixed" is the hero's own field, every shape
// at once. Shared by ShapeFigure and ShapeColumns so a figure and its chart
// are built from the same cells.

export type CellShape = "circle" | "square" | "triangle" | "cross";
export type ShapeKind = CellShape | "mixed";

const MIXED: CellShape[] = ["circle", "square", "triangle", "cross"];

/** The same pseudo-random the hero uses, so a cell keeps its shape between draws. */
function hash(x: number, y: number) {
  const s = Math.sin(x * 127.1 + y * 311.7) * 43758.5453;
  return s - Math.floor(s);
}

export const shapeAt = (kind: ShapeKind, x: number, y: number): CellShape =>
  kind === "mixed" ? MIXED[Math.floor(hash(x, y) * MIXED.length)] : kind;

/** One cell's shape, centred on (cx, cy), `size` across. */
export function drawCell(ctx: CanvasRenderingContext2D, shape: CellShape, cx: number, cy: number, size: number) {
  const r = size / 2;
  ctx.beginPath();
  switch (shape) {
    case "circle":
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      break;
    case "square":
      ctx.rect(cx - r * 0.9, cy - r * 0.9, size * 0.9, size * 0.9);
      break;
    case "triangle":
      ctx.moveTo(cx, cy - r);
      ctx.lineTo(cx + r, cy + r * 0.85);
      ctx.lineTo(cx - r, cy + r * 0.85);
      ctx.closePath();
      break;
    case "cross": {
      const t = size / 3;
      ctx.rect(cx - r, cy - t / 2, size, t);
      ctx.rect(cx - t / 2, cy - r, t, size);
      break;
    }
  }
  ctx.fill();
}

/** The hero's grey, for unlit cells. */
export const FIELD_RGB = "162,162,162";
