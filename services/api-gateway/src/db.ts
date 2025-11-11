import { PrismaClient } from "@prisma/client";

import { instrumentPrisma } from "./observability/prisma-metrics.js";

const prismaClient = new PrismaClient();

export const prisma = instrumentPrisma(prismaClient);
