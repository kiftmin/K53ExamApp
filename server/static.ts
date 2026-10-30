import express, { type Express } from "express";
import fs from "fs";
import path from "path";
import { signsBaseDir } from "./sign-images";

const SIGN_PNG = /^\/([A-Za-z0-9._-]+)\.png$/;

// Sign images keep .png URLs (stored in the database), but most are photographic
// and far smaller as WebP. Serve that variant when the browser supports it and
// fall back to the original PNG otherwise.
export function serveSignWebp(app: Express) {
  app.use("/assets/signs", (req, res, next) => {
    if (req.method !== "GET" && req.method !== "HEAD") return next();
    const match = SIGN_PNG.exec(req.path);
    if (!match) return next();
    res.vary("Accept");
    if (!req.accepts("image/webp")) return next();
    const webpPath = path.join(signsBaseDir(), `${match[1]}.webp`);
    if (!fs.existsSync(webpPath)) return next();
    res.type("image/webp");
    res.sendFile(webpPath, (err) => {
      if (err && !res.headersSent) next();
    });
  });
}

export function serveStatic(app: Express) {
  const distPath = path.resolve(__dirname, "public");
  if (!fs.existsSync(distPath)) {
    throw new Error(
      `Could not find the build directory: ${distPath}, make sure to build the client first`,
    );
  }

  app.use(express.static(distPath));

  // fall through to index.html if the file doesn't exist
  app.use("/{*path}", (_req, res) => {
    res.sendFile(path.resolve(distPath, "index.html"));
  });
}
