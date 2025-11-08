import type { JournalEntry } from "./DiscrepancyJournal";

export type PlanRemissionPackContext = {
  orgId: string;
  requestedBy: string;
  planSummary: string;
  remissionNotes: string;
  journalEntries: JournalEntry[];
};

export type PlanRemissionPackManifest = {
  schema: "apgms.plan-remission-pack";
  schemaVersion: string;
  generatedAt: string;
  orgId: string;
  requestedBy: string;
  planSummary: string;
  remissionNotes: string;
  journal: {
    entries: number;
    latestObservation: string | null;
  };
  manifestDigest: string | null;
  files: Array<{
    name: string;
    mimeType: string;
    kind: "pdf" | "manifest";
    sha256: string | null;
    size: number;
  }>;
};

export type PlanRemissionPackResult = {
  bundle: Blob;
  bundleName: string;
  bundleMimeType: string;
  pdfBlob: Blob;
  manifestBlob: Blob;
  manifest: PlanRemissionPackManifest;
  hashes: {
    pdf: string | null;
    manifest: string | null;
    manifestCanonical: string | null;
  };
};

const PACK_MIME = "application/vnd.apgms.plan-remission+mixed";

export async function generatePlanRemissionPack(
  context: PlanRemissionPackContext,
): Promise<PlanRemissionPackResult> {
  const issuedAt = new Date();
  const pdfBytes = createPdfDocument(context, issuedAt);
  const pdfBlob = new Blob([pdfBytes], { type: "application/pdf" });
  const pdfHash = await digestBlob(pdfBlob);
  const pdfName = `plan-remission-${context.orgId}-${issuedAt.toISOString()}.pdf`;

  const baseManifest: Omit<PlanRemissionPackManifest, "manifestDigest"> = {
    schema: "apgms.plan-remission-pack",
    schemaVersion: "2024-11-05",
    generatedAt: issuedAt.toISOString(),
    orgId: context.orgId,
    requestedBy: context.requestedBy,
    planSummary: context.planSummary,
    remissionNotes: context.remissionNotes,
    journal: {
      entries: context.journalEntries.length,
      latestObservation: context.journalEntries[0]?.observedAt ?? null,
    },
    files: [
      {
        name: pdfName,
        mimeType: "application/pdf",
        kind: "pdf",
        sha256: pdfHash,
        size: pdfBlob.size,
      },
    ],
  };

  const canonicalManifestBlob = new Blob([
    JSON.stringify({ ...baseManifest, manifestDigest: null }, null, 2),
  ], {
    type: "application/json",
  });
  const canonicalDigest = await digestBlob(canonicalManifestBlob);

  const manifestWithDigest: PlanRemissionPackManifest = {
    ...baseManifest,
    manifestDigest: canonicalDigest,
    files: [
      ...baseManifest.files,
      {
        name: "manifest.json",
        mimeType: "application/json",
        kind: "manifest",
        sha256: canonicalDigest,
        size: canonicalManifestBlob.size,
      },
    ],
  };

  let manifestBlob = new Blob([JSON.stringify(manifestWithDigest, null, 2)], {
    type: "application/json",
  });
  let manifestHash = await digestBlob(manifestBlob);

  let manifestFinal: PlanRemissionPackManifest = {
    ...manifestWithDigest,
    files: manifestWithDigest.files.map((file) =>
      file.kind === "manifest" ? { ...file, size: manifestBlob.size } : file,
    ),
  };

  manifestBlob = new Blob([JSON.stringify(manifestFinal, null, 2)], {
    type: "application/json",
  });
  manifestHash = await digestBlob(manifestBlob);

  const manifestSize = manifestBlob.size;
  const manifestEntry = manifestFinal.files.find((file) => file.kind === "manifest");
  if (manifestEntry && manifestEntry.size !== manifestSize) {
    manifestFinal = {
      ...manifestFinal,
      files: manifestFinal.files.map((file) =>
        file.kind === "manifest" ? { ...file, size: manifestSize } : file,
      ),
    };
    manifestBlob = new Blob([JSON.stringify(manifestFinal, null, 2)], {
      type: "application/json",
    });
    manifestHash = await digestBlob(manifestBlob);
  }

  const boundary = `apgms-plan-remission-${issuedAt.getTime()}`;
  const bundleParts: BlobPart[] = [
    `--${boundary}\r\n` +
      `Content-Type: application/pdf\r\n` +
      `Content-Disposition: attachment; filename="${pdfName}"\r\n\r\n`,
    pdfBlob,
    `\r\n--${boundary}\r\n` +
      `Content-Type: application/json\r\n` +
      `Content-Disposition: attachment; filename="manifest.json"\r\n\r\n`,
    manifestBlob,
    `\r\n--${boundary}--`,
  ];
  const bundleMimeType = `${PACK_MIME}; boundary=${boundary}`;
  const bundle = new Blob(bundleParts, { type: bundleMimeType });
  const bundleName = `apgms-plan-remission-pack-${context.orgId}-${issuedAt.getTime()}.bundle`;

  return {
    bundle,
    bundleName,
    bundleMimeType,
    pdfBlob,
    manifestBlob,
    manifest: manifestFinal,
    hashes: {
      pdf: pdfHash,
      manifest: manifestHash,
      manifestCanonical: canonicalDigest,
    },
  };
}

export function downloadPlanRemissionPack(result: PlanRemissionPackResult) {
  const url = URL.createObjectURL(result.bundle);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = result.bundleName;
  anchor.rel = "noopener";
  anchor.click();
  URL.revokeObjectURL(url);
}

async function digestBlob(blob: Blob): Promise<string | null> {
  const subtle = globalThis.crypto?.subtle;
  if (!subtle) {
    return null;
  }
  const buffer = await blob.arrayBuffer();
  const digest = await subtle.digest("SHA-256", buffer);
  const bytes = new Uint8Array(digest);
  return Array.from(bytes)
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

function createPdfDocument(context: PlanRemissionPackContext, issuedAt: Date): Uint8Array {
  const lines = [
    `Plan & Remission summary for ${context.orgId}`,
    `Generated: ${issuedAt.toISOString()}`,
    "",
    "Plan summary:",
    wrapForPdf(context.planSummary),
    "",
    "Remission notes:",
    wrapForPdf(context.remissionNotes),
    "",
    `Discrepancies logged: ${context.journalEntries.length}`,
    ...context.journalEntries.slice(0, 12).map((entry, index) =>
      `${index + 1}. ${entry.control} (${entry.severity}) – ${entry.status}\n${wrapForPdf(entry.description)}\nFollow-up: ${wrapForPdf(entry.followUp)}`,
    ),
    "",
    "Hashes:",
    "See manifest.json for canonical digests and file metadata.",
  ];

  const text = lines.join("\n\n");
  return encodePdf(text);
}

function wrapForPdf(value: string) {
  if (!value.trim()) {
    return "Not supplied.";
  }
  return value.trim();
}

function encodePdf(content: string): Uint8Array {
  const escapeText = (input: string) =>
    input.replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");
  const sanitized = content
    .split(/\r?\n/)
    .map((line) => escapeText(line))
    .join(") Tj T* (");
  const stream = `BT /F1 12 Tf 50 750 Td (${sanitized}) Tj ET`;

  const objects = [
    "%PDF-1.4\n",
    "1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj\n",
    "2 0 obj << /Type /Pages /Count 1 /Kids [3 0 R] >> endobj\n",
    "3 0 obj << /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >> endobj\n",
    "4 0 obj << /Type /Font /Subtype /Type1 /BaseFont /Helvetica >> endobj\n",
    `5 0 obj << /Length ${stream.length} >> stream\n${stream}\nendstream endobj\n`,
  ];

  let offset = 0;
  const offsets: number[] = [];
  for (const object of objects) {
    offsets.push(offset);
    offset += object.length;
  }

  const xrefStart = offset;
  const xref = ["xref\n", "0 6\n", "0000000000 65535 f \n"];
  for (let index = 0; index < offsets.length; index += 1) {
    xref.push(`${offsets[index].toString().padStart(10, "0")} 00000 n \n`);
  }
  xref.push("trailer\n");
  xref.push("<< /Size 6 /Root 1 0 R >>\n");
  xref.push("startxref\n");
  xref.push(`${xrefStart}\n`);
  xref.push("%%EOF");

  const fullContent = objects.join("") + xref.join("");
  return new TextEncoder().encode(fullContent);
}
