import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { serveStatic } from "./static";
import { client } from "./db";
import { createServer } from "http";

const app = express();
const httpServer = createServer(app);

declare module "http" {
  interface IncomingMessage {
    rawBody: unknown;
  }
}

app.use(
  express.json({
    limit: "10mb",
    verify: (req, _res, buf) => {
      req.rawBody = buf;
    },
  }),
);

app.use(express.urlencoded({ extended: false }));

export function log(message: string, source = "express") {
  const formattedTime = new Date().toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });

  console.log(`${formattedTime} [${source}] ${message}`);
}

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }

      log(logLine);
    }
  });

  next();
});

(async () => {
  // Idempotent DDL for the Road Signs study module (safe on every boot,
  // creates nothing if tables already exist).
  try {
    await client`
      CREATE TABLE IF NOT EXISTS study_signs (
        id SERIAL PRIMARY KEY,
        heading TEXT NOT NULL,
        subheading TEXT NOT NULL,
        name TEXT NOT NULL,
        codes JSONB NOT NULL,
        images JSONB NOT NULL DEFAULT '[]',
        where_text TEXT,
        purpose_text TEXT,
        action_text TEXT,
        is_verified_exam_question BOOLEAN NOT NULL DEFAULT FALSE,
        created_at TIMESTAMP NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP NOT NULL DEFAULT NOW()
      );
    `;
    await client`
      CREATE TABLE IF NOT EXISTS sign_questions (
        id SERIAL PRIMARY KEY,
        sign_id INTEGER NOT NULL REFERENCES study_signs(id) ON DELETE CASCADE,
        question_id INTEGER NOT NULL REFERENCES questions(id) ON DELETE CASCADE
      );
    `;
    await client`
      CREATE TABLE IF NOT EXISTS study_rules (
        id SERIAL PRIMARY KEY,
        section_ref TEXT NOT NULL,
        heading TEXT NOT NULL,
        subheading TEXT NOT NULL,
        title TEXT,
        body TEXT NOT NULL,
        applicable_codes JSONB NOT NULL,
        is_verified_exam_question BOOLEAN NOT NULL DEFAULT FALSE,
        is_reviewed BOOLEAN NOT NULL DEFAULT FALSE,
        created_at TIMESTAMP NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP NOT NULL DEFAULT NOW()
      );
    `;
    await client`
      CREATE TABLE IF NOT EXISTS rule_questions (
        id SERIAL PRIMARY KEY,
        rule_id INTEGER NOT NULL REFERENCES study_rules(id) ON DELETE CASCADE,
        question_id INTEGER NOT NULL REFERENCES questions(id) ON DELETE CASCADE
      );
    `;
    // Pure-additive column migrations (safe to run every boot)
    await client`ALTER TABLE questions ADD COLUMN IF NOT EXISTS explanation TEXT;`;
  } catch (err) {
    console.error("Failed to ensure study tables:", err);
  }

  await registerRoutes(httpServer, app);

  app.use((err: any, _req: Request, res: Response, next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    console.error("Internal Server Error:", err);

    if (res.headersSent) {
      return next(err);
    }

    return res.status(status).json({ message });
  });

  // importantly only setup vite in development and after
  // setting up all the other routes so the catch-all route
  // doesn't interfere with the other routes
  if (process.env.NODE_ENV === "production") {
    serveStatic(app);
  } else {
    const { setupVite } = await import("./vite");
    await setupVite(httpServer, app);
  }

  // ALWAYS serve the app on the port specified in the environment variable PORT
  // Other ports are firewalled. Default to 5000 if not specified.
  // this serves both the API and the client.
  // It is the only port that is not firewalled.
  const port = parseInt(process.env.PORT || "5000", 10);
  httpServer.listen(
    {
      port,
      host: "0.0.0.0",
    },
    () => {
      log(`serving on port ${port}`);
    },
  );
})();
