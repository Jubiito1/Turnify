import { PrismaClient } from '@prisma/client';
import { isProduction, isTest } from '../config/env';

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    // Tests assert on constraint violations on purpose; keep their output clean.
    log: isTest ? [] : isProduction ? ['error'] : ['warn', 'error'],
  });

if (!isProduction) globalForPrisma.prisma = prisma;
