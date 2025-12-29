await prisma.user.create({
  data: {
    email: "admin@test.local",
    passwordHash: hash("admin123"),
    role: "admin",
    orgId: "org-test",
    mfaCompleted: true
  }
});
