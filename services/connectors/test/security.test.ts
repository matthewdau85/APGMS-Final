import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { createSign } from "node:crypto";

import { ReplayProtector } from "../src/security/replay-protector.js";
import { SignatureVerifier } from "../src/security/signature-verifier.js";

const TEST_PRIVATE_KEY = `-----BEGIN PRIVATE KEY-----
MIIEvQIBADANBgkqhkiG9w0BAQEFAASCBKcwggSjAgEAAoIBAQDfgfryCmwEsMPA
hEM66DzWPiPLCK/3Ep9nPus5+GrWgVypsdOnXZRZq77TQSTVE3ra++4xRVBkbonM
SBLnj+65CbdSby5gvLZoSpIW7nipprxIM9uwt3v6ETKbPpSEES9F0eN0Y5bu8BQl
9vnS/CA+6ySVmJIlXe6xmDcLLLfxxLMYn/E03y9v1Ms7KURk+JtTzlYHXm/TaVhS
0BGZnfIBHSXhDFyR80X2r+J5ZtJf0WcA6eOPeW6G45XFM0hRwY0sxWNhV4gN4hGE
uSRgFUt0AQLs49ypshW2ibRuBVbIGMC3rrXjkWsnSe3h8MujHccRCNTl4Npr9Q34
h68P38s/AgMBAAECggEADz9+ZnZBqpClczxzz9zTSHdONJC5QPp3WTrDWwBpqHfI
MTROAT68rhiQ3r2wtwImh3bTuHLQNCujst7LJSjnWgK/k0ywpWbw5QZoJjM5wf3k
1dnCZDILWAixppChs3XyPES+baafBxoNl5NRXjStH+Mp7AHDm/rO1HtqLnOTMtdX
eSgU/Etz5amgyPl1dscTx4HQAjVSJzDPDeBoLX9trdW4x2bTSeB47GnZwk6q7F4C
ma0mhOjVYqJFWZt5c5zIplruclSLThlktUPGnrBEy3JW+24cIajwpcZvkiHbnV5I
PpnBkG1ULgBCKXcWqDvsgkd5jMuFxH31xo+9XiO4FQKBgQD+HtvaZkPChkjj3aBR
fz60pK8c+3aUuy3PwslCUoDTmVDcPO0F0ThsjLNmYRcsyZD7nE49wAm9hn/+X71Y
UzHUhiXcnFOL4c0u1z3r2L5nDBzMCYJ1MJSiygGt/YMq4YF2p54Rny3eMRmXhyCb
YWZCy8XINeZBapshV0XFlskP2QKBgQDeglgSvS9TkAe56JBh4mIzo+p0b+o2fIH4
wi1du1YgTpmEO8y+ge3ohD7phYxEr0F+elPVFsZwpfyQBE+L6uzjWCCJ54zo4eKu
oA2FXogbRO5mXllsfv73jAISdwlOvyfXJnSs2oJCGWXvjzpvP2Ve0ybx8avmQ5fx
MHSOG4PQgwKBgQDDy6LEgaFCyuFUW4p29AXH67hP9r9Ga/Ks8MPgSNobQ4z6Yk0C
yrbYkSSeu9YctTk7fmk4aoUxCawp8lLQbrF+em18i1B4XGl52R9bknjXi+ch0BXc
1i4khMbW0R2Se9aetMdA0rW3rf4bI9A7HZTcP2BlkGJpzBXJkIvpPv5obQKBgGFw
uV/m37ZD9WOYZ5Iu4sGqRgBtvur9lqOUHkpWSRF+/O2Y43jzcQulpZsqJaYj/vGa
zy7EP+mkgRypBto5EUdQ4sOdJloQPU3v7VYto/yllCMQd3bN3pNVWyHyTNhW6GxP
g6i558mOaYhGhUQKyClWpbn8hm987HhOSMBzVinFAoGAev1YQl7wTfxKkvMoyNfH
DLV6BM2pCvGf9U9A4XBpS9lA666H4nvYeTPIdJfVG37qjriAfEy4Eddc5l9kLm2R
QIrBr6UIdTYDMz5zAc6WRHyFiZ4+KLP5ZjSviWDV+yJhpcBvSoChvKy49YPFovhT
ysdamyD11gVqryntpjgEBpg=
-----END PRIVATE KEY-----`;

const TEST_CERTIFICATE = `-----BEGIN CERTIFICATE-----
MIIDXTCCAkWgAwIBAgIUPxE0+E3nkZCNP5pfR9/fmqi3n/8wDQYJKoZIhvcNAQEL
BQAwQzELMAkGA1UEBhMCQVUxDTALBgNVBAgMBE5TVzESMBAGA1UECgwJQVBHTXMg
TExDMRMwEQYDVQQDDApUZXN0IFJvb3QwHhcNMjMwMTAxMDAwMDAwWhcNMzMwMTAx
MDAwMDAwWjBDMQswCQYDVQQGEwJBVTENMAsGA1UECAwETlNXMRIwEAYDVQQKDAlB
UEdNcyBMTEMxEzARBgNVBAMMClRlc3QgUm9vdDCCASIwDQYJKoZIhvcNAQEBBQAD
ggEPADCCAQoCggEBAN+B+vIKbASww8CEQzroPNY+I8sIr/cSn2c+6zn4ataBXKmz
06ddlFmrvtNBJPUTetr77jFFUGRuicxIEueP7rkJt1JvLmC8tmhKkhbueKmmvEgz
27C3e/oRMps+lIQR1Po+4Z1VDo63P31S4bP63jNB1BT0hHutDMpAhtCtuPkKs/RR
4P6LXGe2mo6CV1qra97Vbl5Q05K/HHJeoRzRU10kHMqQwi4vTs7X+cYAB9E8lyTf
+9NcskOQfyGomFcUZJ0Wtmqe0pYGNqzP4vEiJyjIs0PBxhMo7lBAsfbMdCjDrJOC
XjPsdcDOfWnvGe7YpD6pocpx/jS2ZFlYogIbrlMCAwEAAaNTMFEwHQYDVR0OBBYE
FBhM8wqQpzcvguWJom5+N6B1UMFWMB8GA1UdIwQYMBaAFBhM8wqQpzcvguWJom5+
N6B1UMFWMA8GA1UdEwEB/wQFMAMBAf8wDQYJKoZIhvcNAQELBQADggEBAJ7EaSYP
j4U3KMlpWjVtqRU9qRSjylWEHymM1CSuTuyPqNtQEuwq+cdf+6HyvKWodn0MOW2R
Qh01fL6N45bM8kG0zxZNPgfNvVMPktvqzm3Ka2BTKfMpl0Z/Am7PYM9VaAiwuvBB
wCzNNJ3IVSBoh1RzuLhWyQ0PXHtWRUUDKJ9qmq9Teg2AxPM9Ex7D6PR8xNPz9z9Q
GJUR42JlPS6HAgkfFTjY6B9a11D1OVN0YVHyIs9LTK8dBcPZzkKo0Hp4s/w9B1Bj
mTno9z/GvdE8p1DJHBluIMT8XRL8RWeQfA5+0mOS/ffnG7Vmx3FJJS4RAeCDuqZM
Wfc97YjmNVJbxBE=
-----END CERTIFICATE-----`;

describe("security controls", () => {
  it("rejects replayed payloads", async () => {
    const protector = new ReplayProtector({ ttlSeconds: 5, clock: () => Date.now() });
    const message = {
      id: "abc",
      payload: { ok: true },
      issuedAt: new Date().toISOString(),
      signature: "ignored",
    };

    await protector.assertNotReplayed(message);

    await assert.rejects(() => protector.assertNotReplayed(message), /Replay detected/);
  });

  it("verifies a valid RSA signature", () => {
    const verifier = new SignatureVerifier({ publicCertificate: TEST_CERTIFICATE });
    const payload = { hello: "world" };
    const message = {
      id: "123",
      payload,
      issuedAt: new Date().toISOString(),
      signatureHeader: "test",
      signature: "",
    };

    const signer = createSign("RSA-SHA256");
    signer.update([message.id, message.issuedAt, message.signatureHeader, JSON.stringify(payload)].join("\n"));
    signer.end();
    message.signature = signer.sign(TEST_PRIVATE_KEY).toString("base64");

    assert.equal(verifier.verify(message), true);
  });
});

