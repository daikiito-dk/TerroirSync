# TerroirSync

**Compliance & subsidy automation for California premium wine grape growers.**

TerroirSync turns daily vineyard fieldwork — typed once on an iPad — into
auditor-ready sustainability reports (Napa Green, Lodi Rules) and structured
grant-application payloads (CDFA Healthy Soils Program / COMET-Planner).

No more spreadsheets, no more binders of paper for the auditor.

## Why TerroirSync

California's premium wine industry runs on sustainability credentials —
Napa Green, Lodi Rules, CSWA/SIP, CCOF — and on public money for climate-smart
farming: voters approved the Proposition 4 climate bond in November 2024,
allocating **$65 million to CDFA's Healthy Soils Program** ([HSP Block Grant](
https://www.grants.ca.gov/grants/healthy-soils-program-block-grant/)), now
delivered through regional block grants. Meanwhile, California's climate
disclosure laws (SB 253 / SB 261) push large wineries to demand verifiable
emissions data from the growers who supply them — first Scope 1 & 2 reports
are due to CARB in 2026, with Scope 3 to follow.

But the field records behind those programs — tractor diesel, cover crops,
under-vine passes, spray logs — still live on paper and spreadsheets, and get
rebuilt by hand for every audit and grant application. [Napa Green's](
https://napagreen.org/vineyard-certification/) redeveloped vineyard standards
require whole-farm **Carbon Farm Plans** (Carbon Cycle Institute protocol,
built with the Napa County RCD), and [Lodi Rules](https://lodigrowers.com/lodirules/)
growers must keep their annual **PEAS** pesticide environmental-impact score
under a program cap. The data burden keeps growing; the tooling hasn't caught
up.

### The competitive white space

| Player | What they do | What they don't do |
| --- | --- | --- |
| SureHarvest / certifier portals | Backend self-assessment & audit portals (CSWA, Lodi Rules) | Field-first mobile UX; grant/COMET support |
| Semios / Agworld | Pest, irrigation & pesticide-use-reporting compliance at scale | Certification reporting; carbon accounting; HSP grants |
| InnoVint / vintrace / Process2Wine | Winery production ERP (cellar, TTB, COGS) | Vineyard environmental compliance |
| COMET-Planner (free, USDA/CSU) | The GHG calculator CDFA HSP applications require | Data capture, history, or API — numbers are re-entered by hand |
| Consultants, RCDs, grant writers | Hand-holding through audits and applications | They still need the grower to assemble all the underlying data |

No one combines **field-first input** (iPad, offline) with **automatic
conversion** to auditor reports and grant payloads. That gap is TerroirSync.

## The one-screen dashboard

| Pane | What it does |
| --- | --- |
| **Vineyard Profile & Activity Input** | Vineyard name, Block ID, block size (acres), alleyway cover crop, under-vine management, monthly tractor diesel (slider + numeric) |
| **Sustainability & Subsidy Dashboard** | Live metrics: Estimated Carbon Fixed (`acres × 1.63 tCO₂e`), CDFA HSP Grant Eligibility (`acres × $153` with cover crop), Napa Green compliance status badge, 12-month carbon projection chart |
| **Export & API Payload** | One-click Napa Green report (mock PDF) and a live COMET-Planner JSON payload (`tillagePractice`, `coverCropType`, `fuelUsage`, …) ready to copy into grant systems |

Everything recalculates in real time as you type or move the slider.

## Mock coefficients (prototype)

- Perennial crop sequestration: **1.63 tCO₂e/acre/yr**
- CDFA HSP cover-crop incentive: **$153/acre**
- Off-road diesel emissions: **0.0102 tCO₂e/gallon**

These are placeholder values for the MVP — production will integrate real
CDFA/NRCS coefficients and the COMET-Planner API.

## Tech stack

- [Next.js](https://nextjs.org) (App Router, TypeScript)
- [Tailwind CSS v4](https://tailwindcss.com) — burgundy / vine / earth palette, sunlight-readable contrast
- [Lucide Icons](https://lucide.dev)
- [Recharts](https://recharts.org) — carbon projection chart

## Getting started

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

```bash
npm run build   # production build
npm start       # serve production build
```

## Roadmap

- Offline-first PWA field entry (iPad, no cell signal required)
- Geotagged photo + receipt capture, packaged as CDFA HSP reimbursement evidence
- Real-time Lodi Rules PEAS-style spray score against the season cap
- One activity log mapped to multiple certifications (Napa Green, Lodi Rules, CSWA, CCOF)
- CDFA HSP application bundles with direct COMET-Planner parameter mapping
- Block-level carbon-intensity (tCO₂e/ton) reports for winery buyers (Scope 3)
- Multi-block management with per-block history
- Auditor share links with export bundles
