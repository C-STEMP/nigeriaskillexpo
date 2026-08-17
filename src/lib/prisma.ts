import { PrismaClient } from "@prisma/client";

// Standard Next.js dev-mode singleton pattern — without this, every hot
// reload in development spins up a fresh PrismaClient and eventually
// exhausts MySQL's connection limit.
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
