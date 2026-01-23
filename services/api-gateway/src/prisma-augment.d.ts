// services/api-gateway/src/prisma-augment.d.ts
import "@prisma/client";

// Compile-time augmentation only.
// If your runtime PrismaClient truly does not have this delegate,
// keep the code paths that use it gated/optional (as your routes already may).
declare module "@prisma/client" {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  interface PrismaClient {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    evidenceArtifact: any;
  }
}
