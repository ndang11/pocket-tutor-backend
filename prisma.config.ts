import "dotenv/config";
import { defineConfig } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  datasource: {
    // This tells the CLI to use the Session Pooler URL from your .env
    url: process.env.DATABASE_URL,
  },
});