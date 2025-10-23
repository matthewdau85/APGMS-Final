import Fastify from "fastify";
import adminDataRoutes from "./src/routes/admin.data";

const buildToken = (principal) => `Bearer ${Buffer.from(JSON.stringify(principal)).toString("base64url")}`;

const buildTestDb = () => ({
  user: {
    findFirst: async () => ({
      id: "user-99",
      email: "subject@example.com",
      createdAt: new Date("2022-05-05T00:00:00.000Z"),
      org: { id: "org-123", name: "Example Org" },
    }),
  },
  bankLine: {
    count: async () => 5,
  },
  accessLog: {
    create: async (...args) => {
      console.log("accessLog", args);
      return {};
    },
  },
});

const app = Fastify({ logger: true });
const secLogCalls = [];
app.decorate("db", buildTestDb());
app.decorate("secLog", (entry) => {
  secLogCalls.push(entry);
});
await adminDataRoutes(app);
await app.ready();

const response = await app.inject({
  method: "POST",
  url: "/admin/data/export",
  payload: { orgId: "org-123", email: "subject@example.com" },
  headers: {
    authorization: buildToken({
      id: "admin-1",
      orgId: "org-123",
      role: "admin",
      email: "admin@example.com",
    }),
  },
});

console.log("status", response.statusCode);
console.log("body", response.body);
console.log("secLog", secLogCalls);

await app.close();
