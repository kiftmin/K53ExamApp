import express, { type Request, type Response, type NextFunction } from "express";
import { registerRoutes } from "../server/routes";
import { createServer } from "http";

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// Logging middleware for Vercel logs
app.use((req: any, res: any, next: any) => {
    const start = Date.now();
    res.on("finish", () => {
        const duration = Date.now() - start;
        const path = req.path || req.url;
        if (path.startsWith("/api")) {
            console.log(`${req.method} ${path} ${res.statusCode} in ${duration}ms`);
        }
    });
    if (typeof next === 'function') next();
});

const httpServer = createServer(app);

// Initialize routes using top-level await (supported in Node.js 18+ ESM)
await registerRoutes(httpServer as any, app as any);

// Global Error Handler
app.use((err: any, _req: any, res: any, _next: any) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";
    console.error("Vercel API Error:", err);
    res.status(status).json({ message });
});

export default app;
