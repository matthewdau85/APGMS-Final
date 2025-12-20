if (process.platform !== "linux") {
  console.error(
    "Prisma generate is restricted to WSL/Linux. Run this command from WSL.",
  );
  process.exit(1);
}
