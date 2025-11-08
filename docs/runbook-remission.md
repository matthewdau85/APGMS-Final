# Remission & discrepancy runbook

This runbook documents how to generate the regulator-ready remission pack and discrepancy journal for
ATO conversations. It supplements the standard evidence library workflow and should be followed
whenever a remission request is raised or updated.

## Prerequisites

- Access to the Regulator Portal with an active sandbox session.
- At least one evidence artifact that anchors the remediation conversation (for example the most
  recent "Designated Accounts Snapshot" entry).
- Details of the discrepancies, plan status, and remission notes gathered from the customer call.

## Steps

1. **Open the evidence artifact**
   - Sign in to the Regulator Portal and navigate to **Evidence Library**.
   - Select the artifact that best represents the remediation conversation. The payload is displayed
     alongside hash verification controls.

2. **Capture discrepancies**
   - Scroll to the **Discrepancy journal** section.
   - For each discrepancy discussed with the ATO:
     - Record the system/control affected, the owner, severity, and status.
     - Document the summary of the issue and follow-up actions.
   - Use the “Export journal (.json)” control to save a timestamped JSON file. Attach this export to
     the case notes and to the WORM evidence upload to preserve the audit trail.

3. **Review plan/remission context**
   - The pack generator surfaces any plan or remission snippets found in the artifact payload. If the
     payload does not include the required context, add the relevant notes directly in the
     discrepancy journal entries (these notes are embedded in the generated PDF).

4. **Generate the remission pack**
   - Press **Generate pack** once the journal contains every discrepancy that was discussed.
   - The portal will: 
     - Create a PDF summary covering the plan/remission notes and the first 12 journal entries.
     - Produce a manifest (`manifest.json`) that lists each bundled file alongside its SHA-256 digest.
     - Assemble both files into a multi-part bundle and automatically download it. A secondary
       “Download bundle again” link is shown for repeat access.

5. **Verify hashes**
   - The UI displays both the PDF and manifest hashes along with the canonical manifest digest (the
     hash of the manifest before the digest field is populated). Record these values in the case log
     so the receiving regulator can independently verify integrity.

6. **Log in the evidence library**
   - Upload the exported discrepancy journal JSON, the PDF summary, and the manifest JSON to the
     evidence system. Reference the hash values to confirm integrity during peer review.

## Troubleshooting

- **Generate button disabled** – ensure at least one journal entry is logged. The pack cannot be
  minted with an empty discrepancy set.
- **Hash values unavailable** – if the browser cannot access `SubtleCrypto` the manifest hash will be
  reported as “Unavailable”. Re-run the generator in a Chromium-based browser or use the CLI packer
  to regenerate.
- **Payload lacks plan/remission context** – the generator still produces a pack. Enrich the journal
  entries with the required narrative and reference the relevant upstream systems in the follow-up
  field.
