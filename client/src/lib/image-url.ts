const CLOUDINARY_UPLOAD = "/image/upload/";
const CLOUDINARY_TRANSFORM = "f_auto,q_auto,w_1000,c_limit";

// Cloudinary stores the originals; ask its CDN for a WebP/AVIF, quality-adjusted
// copy capped at 1000px. Local sign images are negotiated to WebP on the server.
export function optimizedImageUrl(url: string | null | undefined): string {
  if (!url || !url.includes("res.cloudinary.com") || !url.includes(CLOUDINARY_UPLOAD)) return url ?? "";
  if (/\/image\/upload\/(?:[^/]*[,_])?(?:f_auto|q_auto)/.test(url)) return url;
  return url.replace(CLOUDINARY_UPLOAD, `${CLOUDINARY_UPLOAD}${CLOUDINARY_TRANSFORM}/`);
}
