import argon2 from "argon2";
import type { Prisma } from "@prisma/client";

import { prisma } from "@apgms/shared/db";

type CreateUserInput = Omit<Prisma.UserCreateInput, "passwordHash"> & { password: string };

export async function createUser(input: CreateUserInput) {
  const { password, ...data } = input;
  const hash = await argon2.hash(password, { type: argon2.argon2id });

  return prisma.user.create({
    data: {
      ...data,
      passwordHash: hash,
    },
  });
}
