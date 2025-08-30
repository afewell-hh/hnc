# Agent‑First UX — Elicitation Worksheet (Fill Me In)

> Use this as the **single source** to capture intent. Keep answers concise (bullets ok). We’ll branch feature folders later. If a box doesn’t apply, write “N/A”.

---

## 0) Elevator Pitch (≤2 sentences)

* **Product:** Hedgehog NetCommand (HNC) — a wireframe‑first, state‑driven app that designs a single ONF fabric and maintains its CR “wiring diagram” via GitOps.
* **For whom:** Kubernetes/platform engineers and network teams who need to co‑design and manage ONF fabrics without deep cross‑domain skills.

## **Success in 60 days looks like:**

* v0.1 lets a user enter a minimal topology spec (spine/leaf models, one endpoint profile, oversubscription), computes a valid Clos layout, generates a minimal wiring‑diagram CR set into a local FGD stub, and edits it in a GUI with a deterministic preview. Model‑based tests + one golden E2E lock the core logic.

---

## 1) Primary Users & Top Tasks (ranked)

List 2–3 user archetypes and their top 3 tasks.

| Archetype                             | Goals (ranked)                                                                                                 | Biggest pain today                                                |
| ------------------------------------- | -------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------- |
| **Platform Engineer (K8s/GitOps)**    | 1) Create a new fabric spec 2) Generate wiring‑diagram CRs 3) Edit + save via GUI                              | Doesn’t grok switch/port math; afraid of violating topology rules |
| **Network Engineer (Switch‑focused)** | 1) Import an existing wiring diagram (later) 2) Validate port/uplink layout 3) See drift & fix via Git (later) | Not fluent in Git/K8s/CRDs; overwhelmed by GitOps                 |
| **Hedgehog/Partner SE**               | 1) Quick quote + initial config 2) Share minimal artifacts                                                     | Time pressure; wants guardrailed defaults                         |

## **Non‑users to ignore (anti‑persona):**

* Users who want to bypass GitOps entirely or manage non‑ONF L3/campus networks.
* Users needing multi‑fabric orchestration and DCI in v0.1 (explicitly out of scope).

---

## 2) Core Objects & Data Model (v0.1 only)

Name the 1–2 domain objects we must support in v0.1. Keep properties minimal.

**Objects**

* `Fabric` → `id`, `name`, `status: 'draft'|'computed'|'saved'`, `fgdRef?` *(stub only in v0.1)*
* `TopologySpec` → `spineModelId`, `leafModelId`, `uplinksPerLeaf: number`, `endpointProfiles: EndpointProfile[]`
* `EndpointProfile` → `name`, `count`, `nicCount`, `nicSpeedGbps`
* `DerivedTopology` (computed) → `leavesNeeded`, `spines: 2` *(fixed in v0.1)*, `uplinksPerLeaf`, `totalEndpointNICs`, `issues: string[]`
* `WiringDiagram` (generated CR set) → `servers[]`, `switches[]`, `connections[]` *(minimal stubs in v0.1)*

## **Relationships**

* `Fabric` 1→1 `TopologySpec`
* `TopologySpec` →1 `DerivedTopology` (compute)
* `Fabric` 1→1 `WiringDiagram` (generate from `DerivedTopology`)

## **Config surface (editable fields)**

* `fabric.name`
* `spineModelId` *(select from spine‑capable catalog)*
* `leafModelId` *(select from leaf‑capable catalog)*
* `uplinksPerLeaf` *(integer input; step 2)*
* read‑only **O/S ratio** display
* `endpointProfiles[]` rows: `{ name, count, nicCount, nicSpeedGbps }`

---

## 3) Golden Path Scenario (one happy flow)

Narrate the single most valuable end‑to‑end path.

1. User opens app in state `ready(config, clean)` with a static switch catalog loaded.
2. User selects `spineModelId`, `leafModelId`, sets `oversubscription`, and adds one `endpointProfile` (e.g., "compute‑nodes", 100 servers × 1×100G NIC).
3. System computes a Clos outline (`DerivedTopology`) and drafts a minimal `WiringDiagram` (servers/switches/connections as stubs).
4. User reviews counts and validity in **Preview** (even uplink distribution; no capacity conflicts).
5. User clicks **Save** → spec + derived diagram persist to the local FGD stub.
6. Done: state returns to `clean`; model‑based tests and the golden E2E pass deterministically.

## **Out‑of‑scope for v0.1**

* Account/signup, multi‑fabric management, import flows, multiple leaf classes, MC‑LAG/ES‑LAG, DCI/gateway, BOM export, Git integration, K8s/FKS connectivity/drift. *(All planned post‑v0.1.)*

---

## 4) Statechart Sketch (v0.1 only)

> We’ll refine into a strict FSM. Start with 5–7 states max.

## **States** (names only):

* `uninitialized`, `loadingCatalog`, `ready` *(parallel: `view: config|preview`, `data: clean|dirty`)*, `computing`, `saving`, `error`

**Events** (user/system) with payloads:

* `LOAD_OK(catalog)` / `LOAD_ERR(message)`
* `EDIT(field, value)` *(includes `uplinksPerLeaf`)*
* `NAV(view: 'config'|'preview')`
* `COMPUTE` / `COMPUTE_OK(derived, wiring)` / `COMPUTE_ERR(message)`
* `SAVE` / `SAVE_OK()` / `SAVE_ERR(message)`
* `RESET()`

## **Guards** (boolean conditions to allow transitions):

* `isValidSpec(spec)` (models chosen, endpoint count > 0, `uplinksPerLeaf` within bounds)
* `evenDistributionPossible(derived)` (`uplinksPerLeaf % spines == 0`)
* `capacityAvailable(derived)` (leaf/spine port capacity sufficient)

## **Effects** (side effects, IO calls):

* `fetchCatalog()`
* `deriveTopology(spec)` *(uses `uplinksPerLeaf`)*
* `generateWiringDiagram(spec, derived)`
* `persistToFGDStub(files)`

## **States** (names only):

* `uninitialized`, `loadingCatalog`, `ready` *(parallel: `view: config|preview`, `data: clean|dirty`)*, `computing`, `saving`, `error`

**Events** (user/system) with payloads:

* `LOAD_OK(catalog)` / `LOAD_ERR(message)`
* `EDIT(field, value)`
* `NAV(view: 'config'|'preview')`
* `COMPUTE` / `COMPUTE_OK(derived, wiring)` / `COMPUTE_ERR(message)`
* `SAVE` / `SAVE_OK()` / `SAVE_ERR(message)`
* `RESET()`

## **Guards** (boolean conditions to allow transitions):

* `isValidSpec(spec)` (models chosen, endpoint count > 0, enum ranges ok)
* `evenDistributionPossible(derived)` (uplinks multiple of spine count)
* `capacityAvailable(derived)` (leaf endpoint capacity ≥ endpoints per leaf)

## **Effects** (side effects, IO calls):

* `fetchCatalog()`
* `deriveTopology(spec)`
* `generateWiringDiagram(spec, derived)`
* `persistToFGDStub(files)`

---

## 5) Screens & Wireframes (grayscale only)

> Describe panels and what changes when.

**Screen: Config → Preview**

* **Left (Config form)**: `fabric.name`, `spineModelId` (select), `leafModelId` (select), `oversubscription` (select), `endpointProfiles[]` (small table: name, count, nicCount, nicSpeedGbps; add/remove rows)
* **Right (Live Preview)**: derived counts (leaves, spines=2, uplinks per leaf, total NICs), feasibility badges, and a "generated files" list (server/switch/connection stubs)
* **Footer**: \[Reset] \[Save] \[Next]

**Visibility/Enablement rules**

* Disable **Save** until `isValidSpec` and last compute succeeded.
* Show read‑only **O/S ratio** computed from `uplinksPerLeaf` and endpoint profile speeds.
* If `oversubscription == '1:1'` hide non‑MVP advanced tuning.
* Show `warningBanner` if `evenDistributionPossible == false` or `capacityAvailable == false`.

---

## 6) Derived Logic (make it explicit)

> Formulas/computations driving the preview or validation. *(Simplified for v0.1; we’ll replace with real switch\_profile.go ingestion later.)*

* `totalEndpointNICs = Σ(profile.count × profile.nicCount)`
* Catalog provides: `leaf.endpointPortsPerSwitch`, `leaf.maxUplinkPortsPerSwitch`, `spine.uplinkPortCapacity`
* * Given catalog: `leaf.endpointPortsPerSwitch`, `leaf.maxUplinkPortsPerSwitch`, `leaf.uplinkPortSpeedGbps`, `leaf.endpointPortSpeedGbps`, `spine.uplinkPortCapacity`, `spine.uplinkPortSpeedGbps`
* `leavesNeeded = ceil(totalEndpointNICs / leaf.endpointPortsPerSwitch)`
* **Input:** `uplinksPerLeaf` (user-entered). Must satisfy: `uplinksPerLeaf > 0`, `uplinksPerLeaf ≤ leaf.maxUplinkPortsPerSwitch`, and `uplinksPerLeaf % spines == 0`.
* **Computed (read‑only):**

  * `endpointsPerLeaf = ceil(totalEndpointNICs / leavesNeeded)`
  * `downlinkGbpsPerLeaf = endpointsPerLeaf × endpointNicSpeedGbps`
  * `uplinkGbpsPerLeaf = uplinksPerLeaf × leaf.uplinkPortSpeedGbps`
  * `osRatio = downlinkGbpsPerLeaf / uplinkGbpsPerLeaf` (display only)
* Capacity checks:

  * `leavesNeeded × uplinksPerLeaf ≤ spines × spine.uplinkPortCapacity`
  * `uplinksPerLeaf % spines == 0`
* `leavesNeeded = ceil(totalEndpointNICs / leaf.endpointPortsPerSwitch)`
* `spines = 2` *(fixed in v0.1 to keep distribution logic trivial)*
* Validity checks:

  * `uplinksPerLeaf % spines == 0`
  * `leavesNeeded ≥ 1`
  * `leavesNeeded × uplinksPerLeaf ≤ spines × spine.uplinkPortCapacity`
* Generate minimal CR stubs: one `Switch` per spine/leaf count; one `Server` per endpoint; `Connection` records for leaf↔spine uplinks as evenly distributed pairs.

---

## 7) Error States & Recovery

* **Load errors**: catalog missing/invalid → show blocking banner; allow `Retry` → `loadingCatalog`.
* **Compute errors**: invalid spec or capacity violation → inline errors on fields; stay in `ready(data: dirty)`.
* **Save errors** (stub persistence): toast with reason; revert to last clean snapshot.

---

## 8) Non‑Goals (for real; we will say “no” to these in v0.1)

* Auth/multi‑tenant/multi‑fabric
* Real Git integration or K8s/FKS connectivity/drift
* Import from real wiring‑diagram YAML
* Multiple leaf classes; MC‑LAG/ES‑LAG; DCI/gateway
* BOM/export pricing; metrics/telemetry

---

## 9) Guardrails (we will push back if violated)

* No hidden state in components; all transitions via events
* No more than 7 states in the v0.1 machine
* No E2E beyond the **one golden path**
* No network IO in v0.1 (stub service only)

---

## 10) Acceptance Tests (human‑readable)

> These become model‑based tests + a single Playwright spec.

**Happy path**

* Given the app initialises to `ready(config, clean)` with a static catalog
* When the user selects valid `spineModelId`, `leafModelId`, enters `uplinksPerLeaf = 4`, and adds one endpoint profile (e.g., name "compute", `count=100`, `nicCount=1`, `nicSpeedGbps=100`)
* And the user clicks **Compute** (or edits trigger compute)
* Then the Preview shows: `leavesNeeded ≥ 1`, `spines = 2`, `uplinksPerLeaf % spines == 0`, computed **O/S ratio**, and `issues.length == 0`
* When the user clicks **Save**
* Then state returns to `clean` and the FGD stub contains generated `servers.yaml`, `switches.yaml`, `connections.yaml`

**Edge cases (max 3)**

* Invalid spec (endpoint count 0 or missing models) → inline errors; **Save** disabled
* Insufficient spine capacity or uneven distribution → red badge + cannot Save
* Save throws (stub) → toast + rollback to last clean state

---

## 11) Glossary (disambiguation)

* **Fabric** — A single ONF‑managed Ethernet fabric (one site), spine‑leaf in v0.1
* **FGD (Fabric GitOps Directory)** — Repo path holding CR YAMLs for one fabric
* **FKS (Fabric Kubernetes Server)** — The ONF controller’s K8s; read‑only in future
* **Wiring Diagram** — The CR set describing devices & links (servers/switches/connections)
* **Endpoint/Server** — Any non‑switch device attached to a leaf switch
* **Leaf Class** — Group of leafs with identical uplink profiles (v0.1: single class)
* **Oversubscription** — Ratio of downlink to uplink capacity (v0.1: '1:1' or '2:1')
* **Switch Catalog** — Static JSON describing supported models (v0.1 stub; later parse `switch_profile.go`)
* **Drift** — Difference between FGD CRs and active CRs on FKS (post‑v0.1)

---

## 12) Roadmap After v0.1 (two steps only)

* **v0.2:** Local FS FGD (real YAML read/write), import existing wiring diagram, basic drift *planning* (no K8s), Storybook visual diffs
* **v0.3:** Multiple leaf classes, MC‑LAG/ES‑LAG selection UI (guardrailed), real `switch_profile.go` ingestion, Git repo integration (read/write) behind a feature flag

---

# Appendix A — Transition Table Template

> Fill for each state you listed in §4.

| From state             | Event        | Guard                                           | Effect                                        | To state               |
| ---------------------- | ------------ | ----------------------------------------------- | --------------------------------------------- | ---------------------- |
| uninitialized          |              |                                                 | `fetchCatalog()`                              | loadingCatalog         |
| loadingCatalog         | LOAD\_OK     |                                                 |                                               | ready (config, clean)  |
| loadingCatalog         | LOAD\_ERR    |                                                 |                                               | error                  |
| ready (config, dirty)  | COMPUTE      | `isValidSpec`                                   | `deriveTopology()`, `generateWiringDiagram()` | computing              |
| computing              | COMPUTE\_OK  | `evenDistributionPossible && capacityAvailable` |                                               | ready (preview, dirty) |
| computing              | COMPUTE\_ERR |                                                 |                                               | ready (config, dirty)  |
| ready (preview, dirty) | SAVE         |                                                 | `persistToFGDStub()`                          | saving                 |
| saving                 | SAVE\_OK     |                                                 |                                               | ready (preview, clean) |
| saving                 | SAVE\_ERR    |                                                 |                                               | ready (config, dirty)  |
| any                    | RESET        |                                                 | revert to last clean snapshot                 | ready (config, clean)  |

\---------- | ----- | ----- | ------ | -------- |
\|            |       |       |        |          |
\|            |       |       |        |          |

---

# Appendix B — Event Inventory (authoritative)

> Keep alphabetical; events are the only way to change state.

* `COMPUTE`
* `COMPUTE_ERR(message)`
* `COMPUTE_OK(derived, wiring)`
* `EDIT(field, value)`
* `LOAD_ERR(message)`
* `LOAD_OK(catalog)`
* `NAV(view)`
* `RESET()`
* `SAVE`
* `SAVE_ERR(message)`
* `SAVE_OK()`

---

# Appendix C — Minimal Schema Stubs

> We’ll formalize as JSON Schema / Zod in code.

```json
{
  "$id": "FabricSpec",
  "$schemaVersion": 1,
  "type": "object",
  "properties": {
    "name": {"type": "string", "minLength": 1},
    "spineModelId": {"type": "string"},
    "leafModelId": {"type": "string"},
    "uplinksPerLeaf": {"type": "integer", "minimum": 2},
    "endpointProfiles": {
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "name": {"type": "string"},
          "count": {"type": "integer", "minimum": 1},
          "nicCount": {"type": "integer", "minimum": 1},
          "nicSpeedGbps": {"type": "integer", "minimum": 1}
        },
        "required": ["name","count","nicCount","nicSpeedGbps"]
      },
      "minItems": 1
    }
  },
  "required": ["name","spineModelId","leafModelId","uplinksPerLeaf","endpointProfiles"]
}
```

---

# Appendix D — Stub Switch Catalog (v0.1)

```json
{
  "models": [
    {
      "id": "celestica-ds2000",
      "roles": ["leaf"],
      "endpointAssignable": ["E1/1-48"],
      "fabricAssignable": ["E1/49-56"],
      "endpointPortProfile": "SFP28-25G",
      "uplinkPortProfile": "QSFP28-100G",
      "endpointPortSpeedGbps": 25,
      "uplinkPortSpeedGbps": 100,
      "endpointPortsPerSwitch": 48,
      "maxUplinkPortsPerSwitch": 8
    },
    {
      "id": "celestica-ds3000",
      "roles": ["spine"],
      "fabricAssignable": ["E1/1-32"],
      "uplinkPortProfile": "QSFP28-100G",
      "uplinkPortSpeedGbps": 100,
      "uplinkPortCapacity": 32
    }
  ]
}
```

**Notes**

* Ranges are parsed via a tiny DSL (e.g., `E1/1-48`, `E1/49-56`). Overlap allowed in catalog, but **assignment** is exclusive at compute time.
* Breakout optics & mixed speeds are post‑v0.1.

---

# Appendix E — HNC Switch Profile (editable defaults)

* Per model, HNC overlays user‑editable defaults to mark which port ranges are **assignable** to endpoints vs fabric. Overlap is allowed to reflect hardware flexibility; the allocator resolves conflicts.
* In v0.1 these defaults come from the stub catalog; later we’ll **ingest ONF `switch_profile.go`** and synthesize the HNC profile.
