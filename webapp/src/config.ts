export const appConfig = {
  featureFlags: {
    adminPrototype:
      (import.meta.env.VITE_ENABLE_ADMIN_PROTOTYPE ?? "")
        .toString()
        .toLowerCase() === "true",
  },
} as const;

export type AppConfig = typeof appConfig;
