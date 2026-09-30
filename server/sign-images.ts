import fs from "fs";
import path from "path";

// Filename-safe slug for sign codes: `(R)511` -> `_R_511`, `GA5.011` -> `GA5_011`
export function slugifyCode(code: string): string {
  return code.replace(/[^A-Za-z0-9]/g, "_");
}

const ALLOWED_EXTS = new Set([".png", ".jpg", ".jpeg", ".webp", ".gif", ".svg"]);

function moduleDir(): string {
  // Bundled CJS (dist/index.cjs): __dirname === dist/ at runtime.
  // tsx dev: cwd is the repo root, so server/ is <cwd>/server.
  if (typeof __dirname !== "undefined") return __dirname;
  return path.resolve(process.cwd(), "server");
}

// Resolves to the served static dir in every runtime:
// - production bundle (dist/index.cjs) -> <dist>/public/assets/signs
// - dev (tsx server/)                -> <repo>/client/public/assets/signs
export function signsBaseDir(): string {
  const dir = moduleDir();
  const prodPublic = path.resolve(dir, "public");
  if ((process.env.NODE_ENV as string) === "production" || fs.existsSync(prodPublic)) {
    return path.join(prodPublic, "assets/signs");
  }
  return path.resolve(process.cwd(), "client/public/assets/signs");
}

export function stagingDir(): string {
  return path.join(signsBaseDir(), "_staging");
}

function ensureDir(p: string): void {
  fs.mkdirSync(p, { recursive: true });
}

export interface StagedImage {
  filename: string;
  slug: string; // filename without extension
  url: string; // preview URL served by express.static
  size: number;
}

export function listStagedImages(): StagedImage[] {
  const dir = stagingDir();
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir)
    .filter((f) => ALLOWED_EXTS.has(path.extname(f).toLowerCase()))
    .map((filename) => {
      const stat = fs.statSync(path.join(dir, filename));
      return {
        filename,
        slug: path.basename(filename, path.extname(filename)),
        url: `/assets/signs/_staging/${filename}`,
        size: stat.size,
      };
    })
    .sort((a, b) => a.filename.localeCompare(b.filename));
}

function parseDataUrl(dataUrl: string): { ext: string; buffer: Buffer } {
  const m = /^data:(image\/(png|jpe?g|webp|gif|svg\+xml));base64,([\s\S]+)$/.exec(dataUrl.trim());
  if (!m) {
    throw new Error("Invalid image data URL (expected base64 png/jpg/webp/gif/svg).");
  }
  const mime = m[1];
  const ext =
    mime === "image/png"
      ? ".png"
      : mime === "image/jpeg"
        ? ".jpg"
        : mime === "image/webp"
          ? ".webp"
          : mime === "image/gif"
            ? ".gif"
            : ".svg";
  return { ext, buffer: Buffer.from(m[3], "base64") };
}

function extOfFilename(filename: string): string {
  const ext = path.extname(filename).toLowerCase();
  if (!ALLOWED_EXTS.has(ext)) {
    throw new Error(`Unsupported image type for "${filename}". Use png/jpg/webp/gif/svg.`);
  }
  return ext === ".jpeg" ? ".jpg" : ext;
}

function safeBase(name: string): string {
  return path.basename(name).replace(/[^A-Za-z0-9._-]/g, "_").slice(0, 120) || "image";
}

// Stage an uploaded file (raw upload, not yet paired to a code)
export function stageImageUpload(filename: string, dataUrl: string): StagedImage {
  const { buffer } = parseDataUrl(dataUrl);
  const ext = extOfFilename(filename);
  const dir = stagingDir();
  ensureDir(dir);
  let base = safeBase(path.basename(filename, path.extname(filename)));
  let target = `${base}${ext}`;
  let i = 1;
  while (fs.existsSync(path.join(dir, target))) {
    target = `${base}_${i}${ext}`;
    i++;
  }
  fs.writeFileSync(path.join(dir, target), buffer);
  return {
    filename: target,
    slug: path.basename(target, path.extname(target)),
    url: `/assets/signs/_staging/${target}`,
    size: buffer.length,
  };
}

// Promote a staged file to a final code asset. Returns the public URL.
export function attachStagedToCode(stagedFilename: string, code: string): string {
  const staged = path.join(stagingDir(), path.basename(stagedFilename));
  if (!fs.existsSync(staged)) {
    throw new Error(`Staged image "${stagedFilename}" not found.`);
  }
  const ext = extOfFilename(stagedFilename);
  const slug = slugifyCode(code);
  const base = signsBaseDir();
  ensureDir(base);
  const target = `${slug}${ext}`;
  fs.copyFileSync(staged, path.join(base, target));
  fs.unlinkSync(staged);
  return `/assets/signs/${target}`;
}

// Save a fresh upload directly against a code. Returns the public URL.
export function saveImageForCode(code: string, filename: string, dataUrl: string): string {
  const { buffer } = parseDataUrl(dataUrl);
  const ext = extOfFilename(filename);
  const slug = slugifyCode(code);
  const base = signsBaseDir();
  ensureDir(base);
  const target = `${slug}${ext}`;
  fs.writeFileSync(path.join(base, target), buffer);
  return `/assets/signs/${target}`;
}

export function deleteStagedImage(stagedFilename: string): boolean {
  const p = path.join(stagingDir(), path.basename(stagedFilename));
  if (!fs.existsSync(p)) return false;
  fs.unlinkSync(p);
  return true;
}
