import { PrismaClient } from "@prisma/client";

import { attachPrismaMetrics } from "./observability/prisma-metrics.js";

const basePrisma = new PrismaClient();

export const prisma = attachPrismaMetrics(basePrisma);
