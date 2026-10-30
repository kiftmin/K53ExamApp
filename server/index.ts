import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { serveSignWebp, serveStatic } from "./static";
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

// nginx terminates TLS in front of the app; without this, client IPs seen by
// rate limiters would be the proxy's.
app.set("trust proxy", 1);

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

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      // Response bodies are deliberately not logged: several endpoints return
      // access codes or learner PII.
      log(`${req.method} ${path} ${res.statusCode} in ${duration}ms`);
    }
  });

  next();
});

(async () => {
  // Migrations are explicit (see documents/DB-MIGRATIONS.md); boot never runs DDL.
  // Fail fast instead of serving against a database that is missing tables.
  const REQUIRED_TABLES = [
    "access_codes",
    "control_diagrams",
    "control_questions",
    "learner_profiles",
    "learner_progress",
    "learner_test_runs",
    "questions",
    "rule_questions",
    "sign_questions",
    "sources",
    "study_controls",
    "study_rules",
    "study_signs",
    "suspended_mobiles",
  ];
  const tableRows = await client`
    SELECT table_name FROM information_schema.tables WHERE table_schema = 'public';
  `;
  const present = new Set<string>(tableRows.map((r) => r.table_name as string));
  const missing = REQUIRED_TABLES.filter((t) => !present.has(t));
  if (missing.length > 0) {
    throw new Error(
      `Database is missing required tables: ${missing.join(", ")}. Apply migrations before starting the server.`,
    );
  }

  await registerRoutes(httpServer, app);

  app.use((err: any, _req: Request, res: Response, next: NextFunction) => {
    const status = err.status || err.statusCode || 500;

    console.error("Internal Server Error:", err);

    if (res.headersSent) {
      return next(err);
    }

    // Never echo driver/SMTP internals to the client; they stay in the log above.
    const message = status >= 500 ? "Internal Server Error" : err.message || "Request failed";

    return res.status(status).json({ message });
  });

  serveSignWebp(app);

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
