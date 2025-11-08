import { PrismaClient } from "@prisma/client";

import { attachPrismaMetrics } from "./observability/prisma-metrics.js";

const baseClient = new PrismaClient();

export const prisma = attachPrismaMetrics(baseClient);
