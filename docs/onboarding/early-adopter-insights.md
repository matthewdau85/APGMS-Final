# Early Adopter Interviews

To better understand onboarding friction, we ran structured interviews with six design partners that represent payroll, retail, and field-service operators. Each session followed the same script: trigger (what brought you here), first-day tasks, blockers, handoffs, and desired outcomes. The synthesized findings below inform the setup and migration guides in this folder.

## Personas Interviewed

| Persona | Org Type | Size | Key Stakeholders | Notes |
| --- | --- | --- | --- | --- |
| Payroll administrator | Regional payroll bureau | 35 specialists | HRIS director, compliance lead | Already automated tax filing but lacks APIs |
| Franchise operator | Multi-site quick-service restaurant | 120 locations | COO, IT director | Heavy POS customization |
| Field technician manager | Industrial services | 420 technicians | Ops excellence lead | Data lives in spreadsheets |
| Staffing platform PM | Marketplace startup | 2 eng squads | CTO, data lead | API-first expectations |
| Retail finance analyst | Specialty retail | 60 stores | Finance VP | Concerned with historical ledger accuracy |
| Hospitality HR manager | Boutique hotels | 12 properties | HRIS analyst | Needs guided walkthroughs |

## Journey Mapping Highlights

1. **Account activation lag** – Waiting on security reviews and network allow-listing stalls onboarding for 7–10 days. Customers want a one-page checklist they can share internally.
2. **Sandbox confidence gap** – Early adopters struggle to validate mappings without realistic data. They asked for seeded datasets plus log streaming so they can see every sync payload.
3. **Mapping literacy** – Payroll/POS schemas differ wildly. Interviewees requested opinionated starter adapters showing how to normalize gross pay, with inline validation examples.
4. **Change-management friction** – Legacy teams prefer staged migrations with dry-run reports. They want detailed rollback instructions and auditable change logs.
5. **SDK ergonomics** – Teams expect TypeScript and Python SDKs that hide auth signing and exponential backoff. They specifically cited `npm install @company/sdk` familiarity.

## Pain Point Heat Map

| Phase | Severity | Pain Point | Recommended Action |
| --- | --- | --- | --- |
| Pre-contract | Medium | Security review takes too long | Provide SOC 2 + pen-test package and VPC/IP details |
| Kickoff | High | No single source of onboarding truth | Create end-to-end setup guide with linked checklists |
| Build | High | Schema mapping unclear | Release payroll/POS adapter samples |
| Test | Medium | Lack of synthetic data | Offer downloadable fixtures + log tailing |
| Launch | High | Migration risks poorly documented | Document rollback strategy + smoke tests |

## Next Steps

* Operationalize these findings via the setup and migration guides.
* Feed SDK requirements into the sdk-* packages so customers avoid reimplementing auth/backoff.
* Convert adapter requests into living examples covering two payroll systems and one POS vendor.
* Schedule follow-up interviews two weeks post-launch to validate improvements.
