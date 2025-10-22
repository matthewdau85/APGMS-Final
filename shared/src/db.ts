import { PrismaClient } from "@prisma/client";

import {
  PASSWORD_VERSION,
  hashPassword,
  isArgon2Hash,
  type UserPasswordRecord,
} from "./passwords";

const prismaClient = new PrismaClient();

prismaClient.$use(async (params, next) => {
  if (params.model !== "User") {
    return next(params);
  }

  if (params.action === "create" || params.action === "update") {
    await prepareUserPassword(params.args?.data);
  } else if (params.action === "upsert") {
    await prepareUserPassword(params.args?.create);
    await prepareUserPassword(params.args?.update);
  } else if (params.action === "createMany") {
    const data = params.args?.data;
    if (Array.isArray(data)) {
      for (const entry of data) {
        await prepareUserPassword(entry);
      }
    } else {
      await prepareUserPassword(data);
    }
  } else if (params.action === "updateMany") {
    await prepareUserPassword(params.args?.data);
  }

  return next(params);
});

async function prepareUserPassword(data: Record<string, unknown> | undefined) {
  if (!data || typeof data !== "object") {
    return;
  }

  if (typeof data.password === "string" && data.password.length > 0) {
    if ((data as UserPasswordRecord).passwordVersion === null) {
      return;
    }
    if (!isArgon2Hash(data.password)) {
      data.password = await hashPassword(data.password);
    }
    (data as UserPasswordRecord).passwordVersion = PASSWORD_VERSION;
  } else if (data.password === null) {
    (data as UserPasswordRecord).passwordVersion = null;
  }
}

export const prisma = prismaClient;
