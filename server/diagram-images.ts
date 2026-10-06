import fs from "fs";
import path from "path";

const ALLOWED_EXTS = new Set([".png", ".jpg", ".jpeg", ".webp", ".gif", ".svg"]);

function moduleDir(): string {
  if (typeof __dirname !== "undefined") return __dirname;
  return path.resolve(process.cwd(), "server");
}

export function diagramsBaseDir(): string {
  const dir = moduleDir();
  const prodPublic = path.resolve(dir, "public");
  if ((process.env.NODE_ENV as string) === "production" || fs.existsSync(prodPublic)) {
    return path.join(prodPublic, "assets/diagrams");
  }
  return path.resolve(process.cwd(), "client/public/assets/diagrams");
}

function parseDataUrl(dataUrl: string): { ext: string; buffer: Buffer } {
  const m = /^data:(image\/(png|jpe?g|webp|gif|svg\+xml));base64,([\s\S]+)$/.exec(dataUrl.trim());
  if (!m) throw new Error("Invalid image data URL.");
  const mime = m[1];
  const ext =
    mime === "image/png" ? ".png" :
    mime === "image/jpeg" ? ".jpg" :
    mime === "image/webp" ? ".webp" :
    mime === "image/gif" ? ".gif" : ".svg";
  return { ext, buffer: Buffer.from(m[3], "base64") };
}

function normExt(filename: string): string {
  const ext = path.extname(filename).toLowerCase();
  if (!ALLOWED_EXTS.has(ext)) throw new Error(`Unsupported image type "${filename}".`);
  return ext === ".jpeg" ? ".jpg" : ext;
}

// Save an uploaded file against a diagram. Returns the public URL.
export function saveImageForDiagram(diagramId: number | string, filename: string, dataUrl: string): string {
  const { buffer } = parseDataUrl(dataUrl);
  const ext = normExt(filename);
  const base = diagramsBaseDir();
  fs.mkdirSync(base, { recursive: true });
  const target = `diagram_${diagramId}${ext}`;
  fs.writeFileSync(path.join(base, target), buffer);
  return `/assets/diagrams/${target}`;
}
