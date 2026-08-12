# Specifikace požadavků: FluxNova šablony + integrace AI Governance Framework

**Datum:** 2026-03-14
**Stav:** Návrh požadavků — práce zahájena
**Cíl:** Vstup pro roadmapu CalmStudio
**Verze schématu CALM:** 1.2 (aktuální)
**Závislosti:** calm-core, extensions, studio app (canvas, palette, validation, io, stores)

---

## Přehled

Do CalmStudio mají přibýt dvě sady funkcí:

1. **FluxNova architektonické šablony** — Předpřipravené CALM vzory pro nasazení FluxNova BPM a blueprinty pro finanční služby
2. **AIGF governance v době návrhu** — Kontextové návrhy rizik a mitigací z AI Governance Frameworku, když architekti pracují s AI komponentami

**Cílové datum dema:** OSFF Toronto, 13.–14. dubna 2026

### Strategie upstream příspěvků (fázovaně)

Práce vychází z přístupu **nejdřív implementovat, pak navrhnout**:

- **Fáze 1 (teď → duben):** Implementace v CalmStudio/CalmGuard nad existujícími konstrukty CALM 1.2 (controls, decorators, evidence). Dodání funkcí bez čekání na změny specifikace.
- **Fáze 2 (OSFF Toronto, 13.–14. dubna):** Demo fungující implementace. Návrh tří upstream příspěvků:
  1. **AIGF Control Pack** → adresář CALM `controls/` v `finos/architecture-as-code` (standardizované definice control klíčů pro všech 23 AIGF mitigací)
  2. **AIGF referenční vzory** → `finos-labs/ai-reference-architecture-library` (CALM vzory pro RAG, single-agent, multi-agent s AIGF controls)
  3. **FluxNova + AIGF vzory** → `finos/fluxnova-examples` (CALM architektonické soubory spárované s BPMN blueprinty)
- **Fáze 3 (po OSFF):** Návrh rozšíření specifikace CALM:
  - **Risk annotations** — vlastnost `risks` na uzlech (paralelně k `controls`) s odkazem na AIGF risk ID
  - **Governance profiles** — top-level blok `governance` deklarující, které control packy musí být splněny
  - **Control pack schema** — formální schéma pro znovupoužitelné sady controls

Tím se CalmStudio/CalmGuard pozicuje jako referenční implementace integrace AIGF–CALM sledované v [GitHub issue #139](https://github.com/finos/ai-readiness/issues/139).

---

## Kontext schématu CALM 1.2

**Cílová verze specifikace: CALM 1.2** (`https://calm.finos.org/release/1.2/`)

CALM 1.2 oproti 1.1 přidává dvě funkce přímo relevantní pro integraci AIGF:

### Decorators (nové v 1.2)

Decorators připojují doplňující informace k více uzlům a vztahům **bez úpravy jádra architektonické definice**. Hodí se pro aplikaci AIGF governance metadat na všechny AI uzly najednou.

```json
{
  "unique-id": "aigf-governance-decorator",
  "type": "aigf-governance",
  "target": ["architecture.json"],
  "applies-to": ["llm-service", "agent-node", "mcp-server"],
  "data": {
    "framework-version": "2.0",
    "risks": ["AIR-OP-004", "AIR-SEC-026", "AIR-SEC-024"],
    "applied-mitigations": ["mi-10", "mi-20", "mi-18"],
    "governance-score": 85
  }
}
```

Schéma: `https://calm.finos.org/release/1.2/meta/decorators.json`
- `unique-id` (string, povinné)
- `type` (string, povinné) — volná kategorie, např. `"aigf-governance"`, `"threat-model"`, `"deployment"`
- `target` (string[], povinné) — cesty k souborům nebo URL odkazující na CALM dokumenty
- `applies-to` (string[], povinné) — unique-id uzlů, vztahů, flows
- `data` (object, povinné) — volný JSON payload

**Použití pro AIGF:** Decorators pro architekturu-wide governance overlay. Controls pro vynucení mitigace na konkrétním uzlu. Oba přístupy se doplňují.

### Evidence (nové v 1.2)

Propojuje compliance evidence artefakty s controls. To CalmGuard potřebuje pro audit-ready compliance reporty.

```json
{
  "evidence": {
    "unique-id": "ev-aigf-mi-20-proof",
    "evidence-paths": ["reports/mcp-security-audit-2026-03.pdf", "ci/aigf-scan-results.json"],
    "control-config-url": "https://air-governance-framework.finos.org/mitigations/mi-20"
  }
}
```

Schéma: `https://calm.finos.org/release/1.2/meta/evidence.json`
- `unique-id` (string, povinné) — pro propojení
- `evidence-paths` (string[], povinné) — cesty k evidence artefaktům
- `control-config-url` (string, povinné) — URI controlu, ke kterému se evidence vztahuje

### Controls (beze změny oproti 1.1)

```json
"controls": {
  "aigf-mcp-security": {
    "description": "MCP Server Security Governance (AIGF mi-20)",
    "requirements": [{
      "requirement-url": "https://air-governance-framework.finos.org/mitigations/mi-20"
    }]
  }
}
```

Schéma: `https://calm.finos.org/release/1.2/meta/control.json`
- Klíče odpovídají `^[a-zA-Z0-9-]+$`
- Každý control má `description` (string, povinné) a `requirements` (pole, povinné)
- Každý requirement má `requirement-url` (povinné) + buď `config-url`, nebo `config` (oneOf)

### Control Requirement (1.2)

Samostatné definice control requirementů:
```json
{
  "control-id": "CR-AIGF-MI-20",
  "name": "MCP Server Security Governance",
  "description": "Comprehensive security controls for MCP servers in agentic AI systems"
}
```

Schéma: `https://calm.finos.org/release/1.2/meta/control-requirement.json`
- `control-id` (string, povinné)
- `name` (string, povinné)
- `description` (string, povinné)

### Typy uzlů CALM 1.2

Základní typy: `actor`, `ecosystem`, `system`, `service`, `database`, `network`, `ldap`, `webclient`, `data-asset`

Rozšiřující typy (s dvojtečkou): `fluxnova:engine`, `ai:llm`, `aws:lambda` atd.

### Typy vztahů CALM 1.2

`connects`, `interacts`, `deployed-in`, `composed-of`, `options`

### Protokoly CALM 1.2

`HTTP`, `HTTPS`, `FTP`, `SFTP`, `JDBC`, `WebSocket`, `SocketIO`, `LDAP`, `AMQP`, `TLS`, `mTLS`, `TCP`

---

## Část A: FluxNova šablony

### A1. FluxNova extension pack

**Co:** Nový extension pack (`fluxnova`) registrovaný vedle stávajících packů (core, aws, gcp, azure, kubernetes, ai).

**Umístění:** `packages/extensions/src/packs/fluxnova.ts`

**Typy uzlů k definici:**

| typeId | Label | Popis | isContainer |
|---|---|---|---|
| `fluxnova:engine` | BPM Engine | FluxNova BPMN 2.0 engine pro běh procesů | false |
| `fluxnova:rest-api` | REST API | FluxNova REST API vrstva (200+ endpointů, OpenAPI) | false |
| `fluxnova:cockpit` | Cockpit | Dashboard pro monitoring a provoz procesů | false |
| `fluxnova:admin` | Admin | Konzole pro správu uživatelů/skupin/tenantů a autorizaci | false |
| `fluxnova:tasklist` | Tasklist | UI pro přiřazování úkolů a správu jejich životního cyklu | false |
| `fluxnova:modeler` | Modeler | Vizuální nástroj pro modelování BPMN/DMN | false |
| `fluxnova:external-task-worker` | External Task Worker | Polyglot služba, která polluje a vykonává external tasks | false |
| `fluxnova:dmn-engine` | DMN Engine | Rules engine pro Decision Model and Notation | false |
| `fluxnova:process-db` | Process Database | Perzistentní úložiště stavu procesů, historie a audit logů | false |
| `fluxnova:platform` | FluxNova Platform | Kontejner pro celé nasazení FluxNova | true |

**Barva packu:** Oranžová/amber rodina pro odlišení od ostatních packů:
```typescript
const fluxnovaColor: PackColor = {
  bg: '#fff7ed',
  border: '#f97316',
  stroke: '#ea580c',
  badge: '[FN]',
};
```

**Ikony:** Vytvořit `packages/extensions/src/icons/fluxnova.ts` se SVG ikonami 16x16 viewBox ve stroke stylu podle vzoru z `icons/ai.ts`.

**Registrace:** Přidat do `packages/extensions/src/index.ts`:
- Export `fluxnovaPack` z `./packs/fluxnova.js`
- Import a volání `registerPack(fluxnovaPack)` v `initAllPacks()`

**Akceptační kritéria:**
- [ ] FluxNova pack se zobrazí v NodePalette vedle stávajících packů
- [ ] Všech 10 typů uzlů lze přetáhnout na canvas
- [ ] Uzly se vykreslí se správnými ikonami, barvami a popisky
- [ ] Kontejnerový uzel (`fluxnova:platform`) přijímá podřízené uzly

---

### A2. Systém šablon

**Co:** Systém načítání šablon, ze kterého uživatelé startují z předpřipravených CALM architektonických vzorů místo prázdného canvasu.

**Proč:** CalmStudio dnes podporuje jen prázdný canvas nebo import souboru. Šablony dávají ošetřené výchozí body pro běžné architektury.

#### A2.1 Formát dat šablony

Každá šablona je JSON soubor odpovídající existujícímu typu `CalmArchitecture` z `calm-core`, rozšířený o metadata šablony:

```typescript
// packages/calm-core/src/types.ts (extend)
interface CalmTemplate {
  /** Template metadata — not part of the CALM spec, stripped on export */
  _template: {
    id: string;           // e.g. 'fluxnova-kyc-onboarding'
    name: string;         // e.g. 'FluxNova: KYC Onboarding'
    description: string;  // One-line description
    category: string;     // e.g. 'fluxnova', 'ai-governance', 'general'
    tags: string[];       // e.g. ['fluxnova', 'kyc', 'pre-trade', 'financial-services']
    version: string;      // semver
    author: string;       // e.g. 'CalmStudio Contributors'
    /** Source reference for blueprints derived from external projects */
    sourceRef?: string;   // e.g. 'finos/fluxnova-examples/process-examples/financial-services/kyc'
  };
  /** Standard CALM architecture */
  nodes: CalmNode[];
  relationships: CalmRelationship[];
}
```

#### A2.2 Soubory šablon

**Umístění:** `apps/studio/src/lib/templates/`

**Šablony k vytvoření (priorita):**

**1. `fluxnova-platform.json`** — Základní topologie nasazení FluxNova
- Uzly: engine, rest-api, cockpit, admin, tasklist, process-db
- Vztahy: engine→process-db (JDBC), rest-api→engine (internal), cockpit/admin/tasklist→rest-api (HTTPS)
- Kontejner: fluxnova:platform obalující všechny komponenty
- Controls: audit-logging na engine, encryption-in-transit na DB spojení

**2. `fluxnova-kyc-onboarding.json`** — KYC pre-trade blueprint
- Rozšíření platform šablony
- Další uzly: identity-verification-svc (service), sanctions-screening-svc (service), document-mgmt-svc (service), notification-svc (service), kyc-database (database, PII classification)
- Vztahy: engine orchestruje všechny služby přes HTTPS, služby se připojují ke kyc-database
- Controls: data-classification (PII) na kyc-database a identity-verification, audit-logging na všech service spojeních
- Source ref: Scott Logic KYC blueprint z `finos/fluxnova-examples`

**3. `fluxnova-flash-risk.json`** — Flash risk management blueprint
- Rozšíření platform šablony
- Další uzly: risk-compute-onprem (service), risk-compute-cloud (service), risk-aggregation-svc (service), cloud-provisioner (service)
- Vztahy: engine orchestruje paralelní výpočet přes gateway, agregace sbírá výsledky
- Controls: data-classification (Confidential) na compute uzlech
- Source ref: Scott Logic Flash Risk blueprint

**4. `fluxnova-settlement.json`** — Post-trade settlement blueprint
- Rozšíření platform šablony
- Další uzly: counterparty-gateway (service), clearing-house-connector (service), regulatory-reporting-svc (service), settlement-db (database)
- Vztahy: engine sekvencuje settlement flow, připojení na externí counterparty systémy
- Controls: audit-logging, encryption, regulatory-compliance na všech externích spojeních

**5. `fluxnova-ai-agent.json`** — FluxNova orchestrující AI agenty (z FluxNova roadmapy)
- Rozšíření platform šablony
- Další uzly: ai:agent, ai:llm, ai:guardrail, ai:tool
- Vztahy: engine orchestruje běh agenta, guardrail validuje výstupy agenta
- Controls: AIGF controls na AI uzlech (navazuje na část B)

**6. `fluxnova-microservices.json`** — FluxNova orchestrující mikroslužby přes external tasks
- Rozšíření platform šablony
- Další uzly: 3 external-task-workers, message-broker (service), api-gateway (service)
- Vztahy: workers polují engine REST API, broker obsluhuje async eventy

#### A2.3 UI výběru šablony

**Co:** Dialog/panel v CalmStudio pro procházení a načítání šablon.

**Umístění:** `apps/studio/src/lib/templates/TemplatePicker.svelte`

**Chování:**
1. Přístup z toolbaru (nové tlačítko „Templates") a z prázdného canvasu („Start from template")
2. Karty šablon seskupené podle kategorie (FluxNova, AI, General)
3. Každá karta zobrazí: název, popis, tagy, počet uzlů, náhledový thumbnail
4. Klik na kartu načte šablonu na canvas (nahradí aktuální obsah — s potvrzením, pokud je canvas dirty)
5. Metadata šablony (`_template`) se při exportu odstraní z CALM architektury

**Registr šablon:**
```typescript
// apps/studio/src/lib/templates/registry.ts
import type { CalmTemplate } from '@calmstudio/calm-core';

const templates = new Map<string, CalmTemplate>();

export function registerTemplate(template: CalmTemplate): void { ... }
export function getTemplatesByCategory(category: string): CalmTemplate[] { ... }
export function getAllCategories(): string[] { ... }
export function loadTemplate(id: string): CalmArchitecture { ... } // strips _template
```

**Akceptační kritéria:**
- [ ] Výběr šablony je dostupný z toolbaru a prázdného canvasu
- [ ] Všech 6 FluxNova šablon se správně načte na canvas
- [ ] Uzly se vykreslí se správnými ikonami/barvami FluxNova packu
- [ ] Vztahy se vykreslí se správnými protokoly a popisky
- [ ] Controls jsou viditelné v panelu vlastností uzlu
- [ ] Export produkuje validní CALM JSON bez metadat `_template`
- [ ] Dirty stav canvasu vyžádá potvrzení před načtením šablony

---

### A3. Podpora controls v calm-core

**Co:** Typy `CalmNode` a `CalmRelationship` v `calm-core` zatím nemají vlastnost `controls`. Specifikace CALM definuje controls jako objekty klíčované vzorem na uzlech i vztazích. To je potřeba doplnit.

**Změny v `packages/calm-core/src/types.ts`:**

```typescript
/** A single CALM control requirement */
interface CalmControlRequirement {
  'requirement-url': string;
  'config-url'?: string;
  config?: Record<string, unknown>;
}

/** A CALM control definition */
interface CalmControl {
  description: string;
  requirements: CalmControlRequirement[];
}

/** Controls object — keys are control identifiers matching ^[a-zA-Z0-9-]+$ */
type CalmControls = Record<string, CalmControl>;

// Update CalmNode
interface CalmNode {
  'unique-id': string;
  'node-type': CalmNodeType | string;
  name: string;
  description?: string;
  interfaces?: CalmInterface[];
  controls?: CalmControls;           // ADD
  'data-classification'?: string;     // ADD
  metadata?: Record<string, unknown>; // ADD
  customMetadata?: Record<string, string>;
}

// Update CalmRelationship
interface CalmRelationship {
  'unique-id': string;
  'relationship-type': CalmRelationshipType;
  source: string;
  destination: string;
  protocol?: string;
  description?: string;
  controls?: CalmControls;            // ADD
  metadata?: Record<string, unknown>; // ADD
}
```

**Úpravy validace:** `packages/calm-core/src/validation.ts` musí validovat, že klíče controls odpovídají `^[a-zA-Z0-9-]+$` a requirements mají `requirement-url`.

**Panel vlastností:** `apps/studio/src/lib/properties/` musí vykreslovat controls jako editovatelné key-value sekce na vybraných uzlech/vztazích.

**Akceptační kritéria:**
- [ ] Controls projdou roundtrip import → canvas → export bez ztráty dat
- [ ] Controls jsou viditelné a editovatelné v panelu vlastností
- [ ] Neplatné klíče controls validace označí
- [ ] `data-classification` se vykreslí jako badge/tag na uzlech canvasu
- [ ] Šablony s controls se správně načtou

---

## Část B: AIGF governance v době návrhu

### B1. AIGF datový balíček

**Co:** Strukturovaný datový balíček s plným katalogem AIGF v2.0 rizik a mitigací, parsovatelný v době návrhu.

**Umístění:** `packages/calm-core/src/aigf/` (nebo nový balíček `packages/aigf/`, pokud je preferována izolace)

#### B1.1 Datový model

```typescript
// packages/calm-core/src/aigf/types.ts

type AIGFRiskType = 'OP' | 'SEC' | 'RC';
type AIGFMitigationType = 'PREV' | 'DET';

interface AIGFExternalRefs {
  owaspLlm?: string[];
  owaspMl?: string[];
  ffiec?: string[];
  euAiAct?: string[];
  nistSp80053r5?: string[];
  iso42001?: string[];
  nistAi600?: string[];
  mitreAtlas?: string[];
}

interface AIGFRisk {
  id: string;               // 'AIR-OP-004'
  sequence: number;         // 4
  title: string;            // 'Hallucination and Inaccurate Outputs'
  type: AIGFRiskType;       // 'OP'
  description: string;      // One-paragraph summary
  externalRefs: AIGFExternalRefs;
  relatedRisks: string[];   // ['AIR-OP-006', 'AIR-OP-020']
}

interface AIGFMitigation {
  id: string;                // 'mi-20'
  sequence: number;          // 20
  title: string;             // 'MCP Server Security Governance'
  type: AIGFMitigationType;  // 'PREV'
  description: string;       // One-paragraph summary
  externalRefs: AIGFExternalRefs;
  mitigates: string[];       // ['AIR-SEC-026', 'AIR-SEC-008', 'AIR-RC-001']
  relatedMitigations: string[];
  /** CALM control key to embed when this mitigation is applied */
  calmControlKey: string;    // 'aigf-mcp-security'
  /** Whether this mitigation has tiered implementation guidance */
  hasTiers: boolean;
}

/** Maps node type patterns to applicable AIGF risks */
interface AIGFNodeRiskMapping {
  /** Glob-like pattern matching node typeIds, e.g. 'ai:*', 'ai:llm', 'ai:agent' */
  nodeTypePattern: string;
  /** Risk IDs that apply when this node type is used */
  applicableRisks: string[];
  /** Mitigation IDs recommended for this node type */
  recommendedMitigations: string[];
}
```

#### B1.2 Katalogová data

**Umístění:** `packages/calm-core/src/aigf/catalogue.ts`

Statický datový soubor se všemi 23 riziky a 23 mitigacemi, zdrojem je YAML frontmatter z AIGF GitHub repozitáře. Export:

```typescript
export const aigfRisks: AIGFRisk[] = [ ... ];
export const aigfMitigations: AIGFMitigation[] = [ ... ];
```

#### B1.3 Mapování uzel → riziko

**Umístění:** `packages/calm-core/src/aigf/mappings.ts`

Mapuje typy uzlů CalmStudio na relevantní AIGF rizika a doporučené mitigace:

| Vzor typu uzlu | Relevantní rizika | Doporučené mitigace |
|---|---|---|
| `ai:llm` | AIR-OP-004 (hallucination), AIR-OP-005 (versioning), AIR-OP-006 (non-deterministic), AIR-RC-001 (data leakage) | mi-10 (version pinning), mi-3 (firewalling), mi-1 (data leakage prevention), mi-15 (LLM-as-judge) |
| `ai:agent` | AIR-SEC-024 (auth bypass), AIR-OP-018 (model overreach), AIR-OP-028 (trust boundaries) | mi-18 (least privilege), mi-21 (decision audit), mi-22 (isolation) |
| `ai:orchestrator` | AIR-OP-028 (trust boundaries), AIR-SEC-025 (tool chain manipulation) | mi-22 (isolation), mi-19 (tool chain validation), mi-21 (decision audit) |
| `ai:vector-store` | AIR-SEC-002 (info leaked to vector store), AIR-SEC-009 (data poisoning) | mi-2 (data filtering), mi-12 (RBAC), mi-14 (encryption at rest), mi-6 (data classification) |
| `ai:tool` | AIR-SEC-025 (tool chain manipulation) | mi-19 (tool chain validation) |
| `ai:memory` | AIR-SEC-027 (state persistence poisoning) | mi-23 (credential protection), mi-14 (encryption at rest) |
| `ai:guardrail` | (none — guardrails ARE the mitigation) | — |
| `ai:rag-pipeline` | AIR-OP-004 (hallucination), AIR-SEC-002 (vector store leak) | mi-13 (citations), mi-2 (data filtering), mi-6 (data classification) |
| `ai:knowledge-base` | AIR-SEC-009 (data poisoning), AIR-OP-019 (data quality) | mi-6 (data classification), mi-16 (source data ACLs) |
| `ai:embedding-model` | AIR-SEC-008 (tampering with model), AIR-OP-005 (versioning) | mi-10 (version pinning), mi-5 (acceptance testing) |
| `ai:api-gateway` | AIR-SEC-010 (prompt injection), AIR-OP-007 (availability) | mi-3 (firewalling), mi-17 (AI firewall), mi-8 (QoS/DDoS) |
| `ai:human-in-the-loop` | (none — HITL IS the mitigation for mi-11) | — |
| `ai:eval-monitor` | (none — eval IS the mitigation for mi-4, mi-15) | — |

**Speciální případ — MCP vzory:**

Když má uzel vztah k externí službě s popisem obsahujícím „MCP", nebo když `customMetadata` uzlu obsahuje `mcp: true`:
- Zobrazit AIR-SEC-026 (MCP supply chain compromise)
- Doporučit mi-20 (MCP Server Security Governance)

```typescript
export const aigfNodeRiskMappings: AIGFNodeRiskMapping[] = [ ... ];

/** Resolve risks and mitigations for a given node type */
export function getAIGFForNodeType(nodeType: string): {
  risks: AIGFRisk[];
  mitigations: AIGFMitigation[];
};
```

---

### B2. Panel návrhů governance

**Co:** Kontextový panel v CalmStudio, který při výběru nebo umístění AI uzlů zobrazí AIGF rizika a doporučené mitigace.

**Umístění:** `apps/studio/src/lib/governance/GovernancePanel.svelte`

#### B2.1 Chování panelu

1. **Spouštěč:** Panel se aktualizuje při změně výběru na canvasu nebo při dropu nového uzlu
2. **Obsah:** Pro vybrané uzly zobrazí:
   - Relevantní AIGF rizika se severity indikátory (OP=amber, SEC=red, RC=blue)
   - Doporučené mitigace s type badges (PREV=shield, DET=magnifying glass)
   - Zda je každá mitigace už aplikována jako control na vybraném uzlu
   - Reference na externí frameworky (článek EU AI Act, klauzule ISO 42001 atd.)
3. **Akce:** Tlačítko „Apply mitigation", které přidá odpovídající CALM control na vybraný uzel
4. **Pohled na úrovni architektury:** Souhrn všech nezmírněných rizik v celé architektuře

#### B2.2 Aplikace mitigace

Po kliknutí na „Apply" u mitigace CalmStudio:

1. Přidá control na vybraný uzel pomocí `calmControlKey` mitigace:
   ```json
   {
     "controls": {
       "aigf-mcp-security": {
         "description": "MCP Server Security Governance (AIGF mi-20)",
         "requirements": [{
           "requirement-url": "https://air-governance-framework.finos.org/mitigations/mi-20"
         }]
       }
     }
   }
   ```
2. V governance panelu označí riziko jako „mitigated" pro daný uzel
3. Control přetrvá v CALM JSON exportu
4. CalmGuard později může ověřit, že tyto controls existují

#### B2.3 Governance skóre architektury

**Co:** Celkový indikátor připravenosti governance pro architekturu.

**Výpočet:**
- Spočítat všechny AI-related uzly v architektuře
- U každého zkontrolovat, které AIGF mitigace jsou doporučené vs. aplikované (jako controls)
- Skóre = (aplikované mitigace / doporučené mitigace) * 100
- Zobrazení jako gauge/badge: zelená (>80 %), amber (50–80 %), červená (<50 %)

**Umístění:** V hlavičce governance panelu a volitelně v toolbaru.

**Akceptační kritéria:**
- [ ] Governance panel se zobrazí při výběru AI uzlů
- [ ] Rizika se správně mapují podle tabulky uzel → riziko
- [ ] „Apply mitigation" přidá validní CALM control na uzel
- [ ] Controls přežijí roundtrip (canvas → export → import → canvas)
- [ ] Governance skóre architektury se aktualizuje v reálném čase
- [ ] Panel zobrazuje reference na externí frameworky (EU AI Act, ISO 42001 atd.)
- [ ] U ne-AI uzlů se governance návrhy nezobrazí (panel skrytý nebo prázdný)

---

### B3. AIGF validační pravidla

**Co:** Validační pravidla označující mezery v governance architektury.

**Umístění:** `apps/studio/src/lib/validation/aigf-rules.ts`

**Integrace:** Napojení do stávajícího `ValidationPanel.svelte` a store `validation.svelte.ts`.

**Pravidla:**

| Rule ID | Severity | Popis |
|---|---|---|
| `aigf-001` | warning | AI uzel `{name}` nemá aplikované AIGF governance controls |
| `aigf-002` | warning | LLM uzel `{name}` postrádá control pro version pinning (mi-10) |
| `aigf-003` | warning | Vector store `{name}` postrádá data classification (mi-6) |
| `aigf-004` | error | Agent uzel `{name}` postrádá least privilege control (mi-18) — povinné pro agentic architektury |
| `aigf-005` | error | Detekováno MCP spojení, ale chybí MCP security governance control (mi-20) |
| `aigf-006` | warning | Detekován multi-agent vzor, ale chybí isolation/segmentation control (mi-22) |
| `aigf-007` | info | RAG pipeline `{name}` — zvažte přidání citation traceability (mi-13) |
| `aigf-008` | warning | AI data store `{name}` postrádá encryption at rest control (mi-14) |
| `aigf-009` | warning | Agent `{name}` je připojen k externím nástrojům bez tool chain validation control (mi-19) |
| `aigf-010` | info | Governance skóre architektury je {score} % — {count} doporučených mitigací zatím není aplikováno |

**Konfigurace pravidel:** Pravidla by měla jít zapínat/vypínat v nastavení. Organizace mohou chtít warningy povýšit na error nebo potlačit info pravidla.

**Akceptační kritéria:**
- [ ] Validační pravidla se zobrazí ve ValidationPanel vedle stávajících strukturálních validací
- [ ] Pravidla se spouští správně podle typů uzlů a aplikovaných controls
- [ ] Klik na validační issue vybere příslušný uzel na canvasu
- [ ] Jednotlivá pravidla lze zapínat/vypínat
- [ ] Error pravidla při zapnutí blokují export (nebo zobrazí potvrzení)

---

## Část C: Průřezové záležitosti

### C1. Soulad se specifikací CALM

Všechna rozšíření musí odpovídat CALM spec v1.1:
- Controls používají klíčový vzor `^[a-zA-Z0-9-]+$`
- `requirement-url` je povinné v control requirements
- `data-classification` je string vlastnost na uzlech
- Metadata je `Record<string, unknown>`

### C2. Kompatibilita exportu

- Šablony při exportu CALM JSON odstraní metadata `_template`
- AIGF controls se exportují jako standardní CALM controls (bez AIGF-specifických rozšíření schématu)
- Exportovaný CALM JSON musí projít `calm-cli validate`

### C3. Integrace MCP serveru

Stávající MCP server CalmStudio (21 nástrojů) by měl vystavit schopnosti šablon a governance:

**Nové MCP nástroje (nižší priorita, po MVP):**

| Nástroj | Popis |
|---|---|
| `list-templates` | Vrátí dostupné šablony s metadaty |
| `load-template` | Načte šablonu na canvas podle ID |
| `get-governance-status` | Vrátí aktuální governance skóre architektury a nezmírněná rizika |
| `apply-mitigation` | Aplikuje AIGF mitigační control na zadaný uzel |
| `get-aigf-risks` | Vrátí relevantní AIGF rizika pro daný typ uzlu |

### C4. Testování

- Unit testy pro AIGF datový model a mapování uzel → riziko
- Unit testy pro načítání šablon a odstraňování metadat
- Unit testy pro validaci controls v calm-core
- Komponentové testy pro GovernancePanel.svelte s mock stavem canvasu
- E2E test: načíst FluxNova šablonu → přidat AI uzel → aplikovat AIGF mitigaci → export → validovat CALM JSON

---

## Priorita implementace

**MVP pro OSFF Toronto (13.–14. dubna):**

1. **P0 — FluxNova extension pack** (A1) — uzly v paletě
2. **P0 — Controls v calm-core** (A3) — předpoklad pro vše ostatní
3. **P0 — 2–3 FluxNova šablony** (A2) — platform + KYC + flash risk
4. **P1 — UI výběru šablony** (A2.3) — načtení šablon na canvas
5. **P1 — AIGF datový balíček** (B1) — katalog rizik/mitigací
6. **P1 — Panel návrhů governance** (B2) — kontextové návrhy
7. **P2 — AIGF validační pravidla** (B3) — integrace validace
8. **P2 — Zbývající šablony** (A2) — settlement, microservices, ai-agent
9. **P3 — MCP nástroje pro šablony/governance** (C3) — po MVP

---

## Otevřené otázky

1. **Ukládání šablon:** Mají šablony žít v `apps/studio/` (na úrovni aplikace), nebo v `packages/` (znovupoužitelné)? Pokud plánujeme sdílení šablon přes FINOS příspěvek, balíček je lepší volba.
2. **Aktuálnost AIGF dat:** Katalog AIGF se bude vyvíjet. Máme se připnout na v2.0, nebo postavit mechanismus aktualizace?
3. **UX controls:** Kolik detailů má panel vlastností pro controls zobrazovat? Plné requirement URL? Nebo zjednodušený pohled s odkazem „View details" na AIGF web?
4. **Import FluxNova BPMN:** Má CalmStudio časem importovat `.bpmn` XML a automaticky generovat hostitelskou CALM architekturu? Stretch goal, ale byl by to ideální most.
5. **Governance policy profily:** Mají organizace moci definovat, která AIGF pravidla jsou error vs. warning? To mapuje na hranici open-core (free = výchozí profil, commercial = vlastní profily).
