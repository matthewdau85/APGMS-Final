const jwt = require("jsonwebtoken");

const secret = process.env.AUTH_DEV_SECRET || "dev-secret-please-change";

const token = jwt.sign(
  {
    sub: "user-123",
    orgId: "test-org",
    roles: ["admin"],
    iss: "apgms-dev",
    aud: "apgms-api",
  },
  secret,
  { algorithm: "HS256", expiresIn: "1h" }
);

console.log(token);
