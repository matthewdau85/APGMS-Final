export { SecureConnectorVault, createSecureVault } from "./secure-vault.js";
if (process.argv[1] && process.argv[1].includes("connectors")) {
    const vault = createSecureVault();
    void vault
        .upsert({
        id: "demo-connector",
        orgId: "demo-org",
        provider: "sandbox-banking",
        credentials: {
            clientId: "demo",
            clientSecret: "redacted",
            webhookSigningKey: "sandbox",
        },
    })
        .then(async () => {
        const connector = await vault.get("demo-connector");
        console.log("Loaded connector with kms envelope", {
            id: connector?.id,
            provider: connector?.provider,
            hasSecret: Boolean(connector?.credentials?.clientSecret),
        });
    })
        .catch((error) => {
        console.error("Demo vault bootstrap failed", error);
        process.exitCode = 1;
    });
}
