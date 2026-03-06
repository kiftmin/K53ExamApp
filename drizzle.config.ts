import { defineConfig } from "drizzle-kit";

export default defineConfig({
    dialect: "postgresql",
    schema: "./server/db.ts",
    out: "./drizzle",
    dbCredentials: {
        url: process.env.DATABASE_URL as string,
    },
});
