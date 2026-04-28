// Environment variables:
// - CALM_DB_NAME: Name of the MongoDB database to use (default: calmSchemas)
// - CALM_SCHEMA_BASE_PATH: Base path to load schemas from (default: /calm)
//
// Set environment variables if required, and run `mongosh init-mongo.js` to
// initialize the database with counters, schema, namespaces, and patterns.

// Simple logging functions for better readability of the initialization process
function logSection(title) {
    print(`=== ${title} ===`);
}

function logSuccess(message) {
    print(`  ✅ ${message}`);
}

function logSkip(message) {
    print(`  - ${message}`);
}

function logFail(message) {
    print(`  ❌ ${message}`);
}

const dbName = (typeof process !== 'undefined' && process.env.CALM_DB_NAME)
    ? process.env.CALM_DB_NAME
    : 'calmSchemas';
logSuccess(`Using database: ${dbName}`);
db = db.getSiblingDB(dbName);

logSection("Counters");
// Insert the initial counter document if it doesn't exist
if (db.counters.countDocuments({ _id: "patternStoreCounter" }) === 0) {
    db.counters.insertOne({
        _id: "patternStoreCounter",
        sequence_value: 1
    });
    logSuccess("Initialized patternStoreCounter with sequence_value 1");
} else {
    logSkip("patternStoreCounter already exists, no initialization needed");
}

if (db.counters.countDocuments({ _id: "architectureStoreCounter" }) === 0) {
    db.counters.insertOne({
        _id: "architectureStoreCounter",
        sequence_value: 2
    });
    logSuccess("Initialized architectureStoreCounter with sequence_value 2");
} else {
    logSkip("architectureStoreCounter already exists, no initialization needed");
}

if (db.counters.countDocuments({ _id: "adrStoreCounter" }) === 0) {
    db.counters.insertOne({
        _id: "adrStoreCounter",
        sequence_value: 1
    });
    logSuccess("Initialized adrStoreCounter with sequence_value 1");
} else {
    logSkip("adrStoreCounter already exists, no initialization needed");
}

if (db.counters.countDocuments({ _id: "standardStoreCounter" }) === 0) {
    db.counters.insertOne({
        _id: "standardStoreCounter",
        sequence_value: 1
    });
    logSuccess("Initialized standardStoreCounter with sequence_value 1");
} else {
    logSkip("standardStoreCounter already exists, no initialization needed");
}


if (db.counters.countDocuments({ _id: "flowStoreCounter" }) === 0) {
    db.counters.insertOne({
        _id: "flowStoreCounter",
        sequence_value: 1
    });
    logSuccess("Initialized flowStoreCounter with sequence_value 1");
} else {
    logSkip("flowStoreCounter already exists, no initialization needed");
}

if (db.counters.countDocuments({ _id: "userAccessStoreCounter" }) === 0) {
    db.counters.insertOne({
        _id: "userAccessStoreCounter",
        sequence_value: 6
    });
    logSuccess("Initialized userAccessStoreCounter with sequence_value 6");
} else {
    logSkip("userAccessStoreCounter already exists, no initialization needed");
}

if (db.counters.countDocuments({ _id: "controlStoreCounter" }) === 0) {
    db.counters.insertOne({
        _id: "controlStoreCounter",
        sequence_value: 18
    });
    logSuccess("Initialized controlStoreCounter with sequence_value 18");
} else {
    logSkip("controlStoreCounter already exists, no initialization needed");
}

if (db.counters.countDocuments({ _id: "decoratorStoreCounter" }) === 0) {
    db.counters.insertOne({
        _id: "decoratorStoreCounter",
        sequence_value: 4
    });
    logSuccess("Initialized decoratorStoreCounter with sequence_value 4");
} else {
    logSkip("decoratorStoreCounter already exists, no initialization needed");
}

if (db.counters.countDocuments({ _id: "interfaceStoreCounter" }) === 0) {
    db.counters.insertOne({
        _id: "interfaceStoreCounter",
        sequence_value: 2
    });
    logSuccess("Initialized interfaceStoreCounter with sequence_value 2");
} else {
    logSkip("interfaceStoreCounter already exists, no initialization needed");
}

logSection("Schemas");
// Load schemas dynamically from the CALM release and draft directories.
// Set CALM_SCHEMA_BASE_PATH env var to override the default base path (/calm).
const fs = require('fs');
const basePath = (typeof process !== 'undefined' && process.env.CALM_SCHEMA_BASE_PATH)
    ? process.env.CALM_SCHEMA_BASE_PATH
    : '/calm';

function loadSchemasFromDir(baseDir, prefix) {
    if (!fs.existsSync(baseDir)) {
        logFail(`Schema directory not found at ${baseDir}, skipping`);
        logFail(`Set CALM_SCHEMA_BASE_PATH environment variable to load schemas from a different location`);
        return;
    }
    const versions = fs.readdirSync(baseDir).filter(f =>
        fs.statSync(`${baseDir}/${f}`).isDirectory() && !f.startsWith('.')
    );
    for (const ver of versions) {
        const version = `${prefix}/${ver}`;
        if (db.schemas.countDocuments({ version: version }) === 0) {
            const metaPath = `${baseDir}/${ver}/meta`;
            if (fs.existsSync(metaPath)) {
                const schemaFiles = fs.readdirSync(metaPath).filter(f => f.endsWith('.json'));
                const schemas = {};
                for (const file of schemaFiles) {
                    schemas[file] = JSON.parse(fs.readFileSync(`${metaPath}/${file}`, 'utf8'));
                }
                db.schemas.insertOne({ version, schemas });
                logSuccess(`Inserted schemas for version ${version}`);
            }
        } else {
            logSkip(`Schemas for version ${version} already exist, skipping`);
        }
    }
}

loadSchemasFromDir(`${basePath}/release`, 'release');
loadSchemasFromDir(`${basePath}/draft`, 'draft');

logSection("Namespaces");
// Insert namespaces if they don't exist
if (db.namespaces.countDocuments() === 0) {
    db.namespaces.insertMany([
        { name: "finos", description: "FINOS namespace" },
        { name: "workshop", description: "Workshop namespace" },
        { name: "traderx", description: "TraderX namespace" },
        { name: "ai-governance-v2", description: "AI Governance v2 namespace" }
    ]);
    logSuccess("Initialized namespaces: finos, workshop, traderx, ai-governance-v2");
} else {
    logSkip("Namespaces already exist, no initialization needed");
}

logSection("Domains");
// Insert domains if they don't exist
if (db.domains.countDocuments() === 0) {
    db.domains.insertMany([
        { name: "security" },
        { name: "ai-governance" }
    ]);
    logSuccess("Initialized domains: security, ai-governance");
} else {
    logSkip("Domains already exist, no initialization needed");
}

logSection("Controls");
// Insert controls for security and ai-governance domains (exported from live DB, 2026-04-28)
if (db.controls.countDocuments() === 0) {
    db.controls.insertMany([
        {
            domain: "security",
            controls: [
                {
                    controlId: NumberInt(1),
                    name: "Data Encryption",
                    description: "Ensures all sensitive data is encrypted at rest and in transit using approved algorithms",
                    requirement: {
                        "1-0-0": {
                            "$schema": "https://json-schema.org/draft/2020-12/schema",
                            "$id": "https://calm.finos.org/calm/domains/security/controls/1/requirement/versions/1.0.0",
                            "title": "Data Encryption Control Requirement",
                            "description": "Requirements for data encryption controls within the security domain",
                            "type": "object",
                            "properties": {
                                "control-id": {
                                    "const": "SEC-ENC-001"
                                },
                                "name": {
                                    "const": "Data Encryption"
                                },
                                "description": {
                                    "const": "Ensure that all sensitive data is encrypted at rest and in transit"
                                },
                                "encryption-algorithm": {
                                    "type": "string",
                                    "description": "The encryption algorithm to use",
                                    "enum": ["AES-128", "AES-256", "ChaCha20-Poly1305"]
                                },
                                "key-rotation-period": {
                                    "type": "string",
                                    "description": "How often encryption keys should be rotated",
                                    "enum": ["30-days", "60-days", "90-days", "180-days", "365-days"]
                                },
                                "data-at-rest": {
                                    "type": "boolean",
                                    "description": "Whether data at rest must be encrypted"
                                },
                                "data-in-transit": {
                                    "type": "boolean",
                                    "description": "Whether data in transit must be encrypted"
                                }
                            },
                            "required": [
                                "control-id",
                                "name",
                                "description",
                                "encryption-algorithm",
                                "data-at-rest",
                                "data-in-transit"
                            ]
                        }
                    },
                    configurations: [
                        {
                            configurationId: NumberInt(1),
                            versions: {
                                "1-0-0": {
                                    "control-id": "SEC-ENC-001",
                                    "name": "Data Encryption",
                                    "description": "Ensure that all sensitive data is encrypted at rest and in transit",
                                    "encryption-algorithm": "AES-256",
                                    "key-rotation-period": "90-days",
                                    "data-at-rest": true,
                                    "data-in-transit": true
                                }
                            }
                        }
                    ]
                }
            ]
        },
        {
            domain: "ai-governance",
            controls: [
                {
                    controlId: NumberInt(3),
                    name: "AIR-OP-004 — Hallucination and Inaccurate Outputs",
                    description: "Controls to detect, mitigate and monitor LLM hallucinations and inaccurate outputs in AI systems deployed in financial services.",
                    requirement: {
                        "1-0-0": {
                            "$schema": "https://calm.finos.org/draft/2025-03/meta/control-requirement.json",
                            "id": "AIR-OP-004",
                            "name": "Hallucination and Inaccurate Outputs",
                            "category": "Operational",
                            "source": "FINOS AI Governance Framework v2",
                            "url": "https://air-governance-framework.finos.org/risks/ri-4_hallucination-and-inaccurate-outputs.html",
                            "summary": "LLM hallucinations occur when a model generates confident but incorrect or fabricated information due to its reliance on statistical patterns rather than factual understanding. Techniques like Retrieval-Augmented Generation can reduce hallucinations by providing factual context, but they cannot fully prevent the model from introducing errors or mixing in inaccurate internal knowledge.",
                            "requirements": [
                                "Implement Retrieval-Augmented Generation (RAG) to ground model responses in verified factual sources.",
                                "Deploy output validation pipelines that cross-check AI-generated content against authoritative data sources.",
                                "Provide clear user-facing disclaimers indicating AI-generated content may contain errors.",
                                "Establish human-in-the-loop review processes for high-stakes outputs (e.g., loan decisions, regulatory interpretations).",
                                "Monitor and log hallucination incidents, tracking frequency and business impact.",
                                "Conduct regular red-team exercises to identify hallucination-prone scenarios."
                            ],
                            "contributing_factors": [
                                "Lack of Ground Truth: The model cannot distinguish between accurate and inaccurate data in its training corpus.",
                                "Ambiguous or Incomplete Prompts: Unclear input prompts increase likelihood of fabricated details.",
                                "Confidence Mismatch: LLMs present hallucinated information with high fluency, making errors hard to detect.",
                                "Fine-Tuning or Prompt Bias: Helpfulness-oriented training can increase unsupported statements."
                            ],
                            "references": [
                                "https://arxiv.org/abs/2305.14292",
                                "https://arxiv.org/abs/2401.11817"
                            ]
                        }
                    },
                    configurations: []
                },
                {
                    controlId: NumberInt(4),
                    name: "AIR-OP-005 — Foundation Model Versioning",
                    description: "Controls to manage instability and unpredictable behavioural changes arising from foundation model version updates, silent model changes, and provider-side modifications.",
                    requirement: {
                        "1-0-0": {
                            "$schema": "https://calm.finos.org/draft/2025-03/meta/control-requirement.json",
                            "id": "AIR-OP-005",
                            "name": "Foundation Model Versioning",
                            "category": "Operational",
                            "source": "FINOS AI Governance Framework v2",
                            "url": "https://air-governance-framework.finos.org/risks/ri-5_foundation-model-versioning.html",
                            "summary": "Foundation model instability refers to unpredictable changes in model behavior over time due to external factors like version updates, system prompt modifications, or provider changes. Such variability can undermine testing, reliability, and trust when no version control or change notification mechanisms are in place.",
                            "requirements": [
                                "Pin foundation model versions in production deployments; only upgrade after explicit testing and sign-off.",
                                "Maintain a model version registry documenting deployed versions, change dates, and test results.",
                                "Establish contractual obligations with Technology Service Providers (TSPs) for advance notification of model changes.",
                                "Implement automated regression test suites that run on model version changes to detect behavioural drift.",
                                "Define and enforce a model change management policy including rollback procedures.",
                                "Monitor production outputs continuously to detect unexpected behavioural shifts post-deployment."
                            ],
                            "contributing_factors": [
                                "Silent model updates by providers without customer notification.",
                                "Lack of version pinning mechanisms in model APIs.",
                                "Prompt perturbation sensitivity causing output variability from minor phrasing changes.",
                                "Infrastructure-level changes (hardware, quantization) altering inference behaviour."
                            ],
                            "references": [
                                "https://www.arxiv.org/abs/2408.14595",
                                "https://arxiv.org/abs/2402.07179"
                            ]
                        }
                    },
                    configurations: []
                },
                {
                    controlId: NumberInt(5),
                    name: "AIR-OP-006 — Non-Deterministic Behaviour",
                    description: "Controls to manage the risks arising from non-deterministic LLM behaviour, where identical inputs may produce differing outputs due to probabilistic sampling.",
                    requirement: {
                        "1-0-0": {
                            "$schema": "https://calm.finos.org/draft/2025-03/meta/control-requirement.json",
                            "id": "AIR-OP-006",
                            "name": "Non-Deterministic Behaviour",
                            "category": "Operational",
                            "source": "FINOS AI Governance Framework v2",
                            "url": "https://air-governance-framework.finos.org/risks/ri-6_non-deterministic-behaviour.html",
                            "summary": "LLMs exhibit non-deterministic behaviour, meaning they can generate different outputs for the same input due to probabilistic sampling and internal variability. This unpredictability can lead to inconsistent user experiences, undermine trust, and complicate testing, debugging, and performance evaluation.",
                            "requirements": [
                                "Set deterministic decoding parameters (e.g., temperature=0, fixed random seeds) for consistency-critical applications.",
                                "Define acceptable output variance thresholds and alert when outputs deviate beyond defined bounds.",
                                "Use ensemble approaches or majority-voting across multiple runs for high-stakes decisions.",
                                "Design test suites that account for output variability, using statistical sampling rather than exact-match assertions.",
                                "Document and communicate non-determinism risks to end users and business stakeholders.",
                                "Avoid relying on AI outputs as sole decision inputs where consistency is a regulatory or contractual requirement."
                            ],
                            "contributing_factors": [
                                "Probabilistic sampling: models sample from token probability distributions introducing randomness.",
                                "Temperature and top-p settings amplifying output variability.",
                                "GPU floating-point precision variations affecting inference.",
                                "Context length and prompt position effects on model behaviour."
                            ],
                            "references": [
                                "https://arxiv.org/abs/2308.02828"
                            ]
                        }
                    },
                    configurations: []
                },
                {
                    controlId: NumberInt(6),
                    name: "AIR-OP-007 — Availability of Foundational Model",
                    description: "Controls to ensure availability and resilience of foundation model infrastructure, mitigating risks from Denial of Wallet attacks, TSP outages, and VRAM exhaustion.",
                    requirement: {
                        "1-0-0": {
                            "$schema": "https://calm.finos.org/draft/2025-03/meta/control-requirement.json",
                            "id": "AIR-OP-007",
                            "name": "Availability of Foundational Model",
                            "category": "Operational",
                            "source": "FINOS AI Governance Framework v2",
                            "url": "https://air-governance-framework.finos.org/risks/ri-7_availability-of-foundational-model.html",
                            "summary": "Foundation models often rely on GPU-heavy infrastructure hosted by third-party providers, introducing risks related to service availability and performance. Key threats include Denial of Wallet (DoW), TSP outages, and VRAM exhaustion.",
                            "requirements": [
                                "Implement API rate limiting and token budget controls to prevent Denial of Wallet (DoW) scenarios.",
                                "Define SLAs with model providers and monitor compliance; establish escalation procedures for breaches.",
                                "Design failover strategies including fallback to alternative model providers or degraded-mode operation.",
                                "Monitor VRAM usage and implement auto-scaling or circuit breakers to prevent exhaustion.",
                                "Conduct regular business continuity tests for AI infrastructure outage scenarios.",
                                "Apply prompt length controls and chunking strategies to prevent excessive token consumption."
                            ],
                            "contributing_factors": [
                                "Denial of Wallet: excessive token usage leading to cost spikes or throttling.",
                                "TSP operational immaturity causing unexpected outages.",
                                "Tight coupling to a single proprietary model provider limiting failover options.",
                                "VRAM exhaustion due to memory leaks, caching strategies, or configuration changes."
                            ],
                            "references": [
                                "https://www.prompt.security/blog/denial-of-wallet-on-genai-apps-ddow",
                                "https://ithandbook.ffiec.gov/"
                            ]
                        }
                    },
                    configurations: []
                },
                {
                    controlId: NumberInt(7),
                    name: "AIR-OP-014 — Inadequate System Alignment",
                    description: "Controls to ensure AI systems remain aligned with their intended business purpose, preventing response misalignment, scope boundary violations, and prompt injection via retrieved content.",
                    requirement: {
                        "1-0-0": {
                            "$schema": "https://calm.finos.org/draft/2025-03/meta/control-requirement.json",
                            "id": "AIR-OP-014",
                            "name": "Inadequate System Alignment",
                            "category": "Operational",
                            "source": "FINOS AI Governance Framework v2",
                            "url": "https://air-governance-framework.finos.org/risks/ri-14_inadequate-system-alignment.html",
                            "summary": "LLM-powered RAG systems may generate responses that diverge from their intended business purpose, producing outputs that appear relevant but contain inaccurate financial advice, biased recommendations, or inappropriate tone for the financial context.",
                            "requirements": [
                                "Define and document the authorised scope of each AI system, including prohibited use cases.",
                                "Implement system prompt guardrails that constrain outputs to the intended domain and tone.",
                                "Establish continuous alignment monitoring using automated evaluation against golden datasets.",
                                "Conduct regular knowledge base hygiene reviews to remove outdated, biased, or conflicting content.",
                                "Perform prompt injection testing on retrieved content within RAG pipelines.",
                                "Implement alignment drift detection to trigger re-evaluation when response quality degrades."
                            ],
                            "contributing_factors": [
                                "Retrieval-response disconnect where LLM contradicts or misinterprets retrieved documents.",
                                "Context window limitations causing truncation of critical regulatory caveats.",
                                "Domain knowledge gaps filled with plausible but incorrect training-data knowledge.",
                                "Scope boundary violations providing advice beyond the system's authorised remit.",
                                "Prompt injection via maliciously formatted knowledge base content."
                            ],
                            "references": [
                                "https://arxiv.org/abs/2402.18540",
                                "https://arxiv.org/abs/2402.17358"
                            ]
                        }
                    },
                    configurations: []
                },
                {
                    controlId: NumberInt(8),
                    name: "AIR-OP-016 — Bias and Discrimination",
                    description: "Controls to detect, prevent and remediate bias and discrimination in AI systems used in financial services, ensuring fairness and compliance with anti-discrimination regulations.",
                    requirement: {
                        "1-0-0": {
                            "$schema": "https://calm.finos.org/draft/2025-03/meta/control-requirement.json",
                            "id": "AIR-OP-016",
                            "name": "Bias and Discrimination",
                            "category": "Operational",
                            "source": "FINOS AI Governance Framework v2",
                            "url": "https://air-governance-framework.finos.org/risks/ri-16_bias-and-discrimination.html",
                            "summary": "AI systems can systematically disadvantage protected groups through biased training data, flawed design, or proxy variables that correlate with sensitive characteristics. In financial services, this manifests as discriminatory credit decisions, unfair fraud detection, or biased customer service.",
                            "requirements": [
                                "Conduct bias audits on training data and model outputs prior to deployment and at regular intervals.",
                                "Test AI systems for disparate impact across protected characteristics (race, gender, age, etc.) using statistical fairness metrics.",
                                "Remove or mitigate proxy variables that correlate with protected characteristics from model inputs.",
                                "Establish a bias incident response process including customer remediation procedures.",
                                "Maintain audit trails of AI-assisted decisions to support regulatory review.",
                                "Provide bias and fairness training for AI development and oversight teams."
                            ],
                            "contributing_factors": [
                                "Data Bias: training datasets reflecting historical societal biases or underrepresenting certain populations.",
                                "Algorithmic Bias: model architecture or optimisation functions inadvertently amplifying bias.",
                                "Proxy Discrimination: neutral data points acting as proxies for protected characteristics.",
                                "Feedback Loops: biased outputs fed back into training cycles amplifying existing bias."
                            ],
                            "regulatory_references": [
                                "Equal Credit Opportunity Act (ECOA)",
                                "Fair Housing Act (FHA)",
                                "EU AI Act — High Risk AI Systems",
                                "ISO 42001"
                            ],
                            "references": [
                                "https://en.wikipedia.org/wiki/Disparate_impact"
                            ]
                        }
                    },
                    configurations: []
                },
                {
                    controlId: NumberInt(9),
                    name: "AIR-OP-017 — Lack of Explainability",
                    description: "Controls to ensure AI systems provide sufficient transparency and explainability of their decision-making processes to satisfy regulatory, audit, and stakeholder requirements.",
                    requirement: {
                        "1-0-0": {
                            "$schema": "https://calm.finos.org/draft/2025-03/meta/control-requirement.json",
                            "id": "AIR-OP-017",
                            "name": "Lack of Explainability",
                            "category": "Operational",
                            "source": "FINOS AI Governance Framework v2",
                            "url": "https://air-governance-framework.finos.org/risks/ri-17_lack-of-explainability.html",
                            "summary": "AI systems, particularly those using complex foundation models, often lack transparency, making it difficult to interpret how decisions are made. This limits firms' ability to explain outcomes to regulators, stakeholders, or customers, raising trust and compliance concerns.",
                            "requirements": [
                                "Implement explainability mechanisms (e.g., chain-of-thought prompting, SHAP/LIME for ML models, citation of source documents) for all AI-assisted decisions.",
                                "Provide human-readable rationales for AI-generated recommendations in customer-facing applications.",
                                "Maintain decision logs capturing inputs, outputs, and model version for audit purposes.",
                                "Define explainability requirements per use case risk tier, with stricter requirements for high-risk decisions.",
                                "Engage regulators proactively on explainability methodology for AI systems used in regulated activities.",
                                "Conduct model interpretability assessments as part of the AI system validation lifecycle."
                            ],
                            "contributing_factors": [
                                "Black-box nature of large foundation models producing outputs without traceable rationale.",
                                "Complexity of multi-step RAG pipelines obscuring the source of information in outputs.",
                                "Absence of logging and audit infrastructure capturing decision inputs and rationale.",
                                "Insufficient explainability tooling available for generative AI systems."
                            ],
                            "references": [
                                "https://techxplore.com/news/2024-07-large-language-dont-people.html"
                            ]
                        }
                    },
                    configurations: []
                },
                {
                    controlId: NumberInt(10),
                    name: "AIR-OP-018 — Model Overreach / Expanded Use",
                    description: "Controls to prevent AI systems from being deployed or used beyond their validated and authorised scope, mitigating risks from model overreach, anthropomorphism, and overreliance.",
                    requirement: {
                        "1-0-0": {
                            "$schema": "https://calm.finos.org/draft/2025-03/meta/control-requirement.json",
                            "id": "AIR-OP-018",
                            "name": "Model Overreach / Expanded Use",
                            "category": "Operational",
                            "source": "FINOS AI Governance Framework v2",
                            "url": "https://air-governance-framework.finos.org/risks/ri-18_model-overreach-expanded-use.html",
                            "summary": "Model overreach occurs when AI systems are used beyond their intended purpose, often due to overconfidence in their capabilities. This can lead to poor-quality, non-compliant, or misleading outputs, especially when users apply AI to high-stakes tasks without proper validation or oversight.",
                            "requirements": [
                                "Define and publish an approved use case register for each AI system, with clearly stated scope boundaries.",
                                "Require formal change management approval before repurposing an AI model to new use cases.",
                                "Implement technical guardrails (e.g., topic classifiers, scope filters) that reject out-of-scope queries.",
                                "Train staff on the limitations of AI systems, discouraging anthropomorphism and overreliance.",
                                "Conduct periodic use case audits to detect unauthorised or scope-creeping applications of AI systems.",
                                "Establish escalation paths for queries that fall outside the AI system's authorised scope."
                            ],
                            "contributing_factors": [
                                "Overconfidence in AI capabilities leading to scope creep without validation.",
                                "Anthropomorphism causing users to treat AI outputs as authoritative expert advice.",
                                "Absence of technical enforcement of use case boundaries.",
                                "Insufficient change management processes for AI system repurposing."
                            ],
                            "references": []
                        }
                    },
                    configurations: []
                },
                {
                    controlId: NumberInt(11),
                    name: "AIR-OP-019 — Data Quality and Drift",
                    description: "Controls to maintain the accuracy, freshness and integrity of data used in AI systems, preventing performance degradation and compliance failures due to data drift and stale training data.",
                    requirement: {
                        "1-0-0": {
                            "$schema": "https://calm.finos.org/draft/2025-03/meta/control-requirement.json",
                            "id": "AIR-OP-019",
                            "name": "Data Quality and Drift",
                            "category": "Operational",
                            "source": "FINOS AI Governance Framework v2",
                            "url": "https://air-governance-framework.finos.org/risks/ri-19_data-quality-and-drift.html",
                            "summary": "Generative AI systems rely heavily on the quality and freshness of their training data. Outdated or poor-quality data can lead to inaccurate, biased, or irrelevant outputs, including flawed risk assessments and compliance failures due to data or concept drift.",
                            "requirements": [
                                "Establish a data governance framework defining quality standards, ownership, and lifecycle management for AI training and inference data.",
                                "Implement automated data quality checks (accuracy, completeness, consistency, timeliness) at ingestion and pre-training stages.",
                                "Monitor statistical properties of input data in production to detect data drift and trigger model retraining where thresholds are breached.",
                                "Define data freshness requirements per AI use case and enforce scheduled refresh cycles.",
                                "Conduct periodic data audits to identify and remediate embedded biases in training datasets.",
                                "Maintain data lineage records to support auditability and reproducibility of model behaviour."
                            ],
                            "contributing_factors": [
                                "Stale training data failing to reflect current market conditions, regulations, or customer behaviour.",
                                "Data drift: statistical properties of input data changing over time without model retraining.",
                                "Embedded biases in historical training data amplified at scale by generative systems.",
                                "Absence of data governance frameworks specifically addressing AI system data lifecycles."
                            ],
                            "regulatory_references": [
                                "ISO 42001: Quality of data for AI systems",
                                "ISO 42001: Data for development and enhancement of AI system"
                            ],
                            "references": []
                        }
                    },
                    configurations: []
                },
                {
                    controlId: NumberInt(12),
                    name: "AIR-OP-020 — Reputational Risk",
                    description: "Controls to proactively manage and mitigate reputational risks arising from AI failures, inappropriate outputs, or misuse in customer-facing and decision-critical financial services applications.",
                    requirement: {
                        "1-0-0": {
                            "$schema": "https://calm.finos.org/draft/2025-03/meta/control-requirement.json",
                            "id": "AIR-OP-020",
                            "name": "Reputational Risk",
                            "category": "Operational",
                            "source": "FINOS AI Governance Framework v2",
                            "url": "https://air-governance-framework.finos.org/risks/ri-20_reputational-risk.html",
                            "summary": "AI failures or misuse—especially in customer-facing systems—can quickly escalate into public incidents that damage a firm's reputation and erode trust. Because AI systems can scale errors rapidly, each AI-driven decision reflects directly on brand and conduct.",
                            "requirements": [
                                "Establish an AI incident response plan including public communications playbooks for AI-related failures.",
                                "Implement content moderation and output filtering on all customer-facing AI systems.",
                                "Conduct pre-launch red-team testing to identify outputs that could cause reputational harm.",
                                "Monitor social media and customer feedback channels for AI-related complaints or incidents.",
                                "Define reputational risk thresholds for AI systems and include AI risk in enterprise risk appetite statements.",
                                "Ensure AI-generated content complies with marketing, conduct, and disclosure regulations before publication."
                            ],
                            "contributing_factors": [
                                "Customer-facing AI generating offensive, misleading, or unfair outputs at scale.",
                                "Rapid error propagation: AI flaws can affect thousands of customers simultaneously.",
                                "Public visibility of AI failures through social media and press coverage.",
                                "Regulatory scrutiny of AI-related conduct failures generating additional reputational damage."
                            ],
                            "references": [
                                "https://www.bbc.co.uk/news/technology-68025677"
                            ]
                        }
                    },
                    configurations: []
                },
                {
                    controlId: NumberInt(13),
                    name: "AIR-OP-028 — Multi-Agent Trust Boundary Violations",
                    description: "Controls to prevent security compromises in one AI agent from propagating to other agents within multi-agent systems, enforcing trust boundaries and isolation in financial services deployments.",
                    requirement: {
                        "1-0-0": {
                            "$schema": "https://calm.finos.org/draft/2025-03/meta/control-requirement.json",
                            "id": "AIR-OP-028",
                            "name": "Multi-Agent Trust Boundary Violations",
                            "category": "Operational",
                            "source": "FINOS AI Governance Framework v2",
                            "url": "https://air-governance-framework.finos.org/risks/ri-28_multi-agent-trust-boundary-violations.html",
                            "summary": "In multi-agent systems, compromised agents affect other agents through shared resources, communication channels, or state corruption, leading to systemic failures and cascading security incidents.",
                            "requirements": [
                                "Enforce strict agent isolation using separate security contexts, namespaces, and privilege levels per agent.",
                                "Implement mutual authentication and authorisation for all agent-to-agent communications.",
                                "Apply input validation and sanitisation on all inter-agent messages to prevent injection attacks.",
                                "Restrict shared resource access using fine-grained RBAC policies per agent type and privilege level.",
                                "Deploy comprehensive monitoring of cross-agent interactions with anomaly detection capabilities.",
                                "Define and test incident response procedures specifically for multi-agent cascade compromise scenarios."
                            ],
                            "contributing_factors": [
                                "Insufficient agent isolation lacking proper security boundaries between agent types.",
                                "Weak inter-agent authentication enabling agent impersonation attacks.",
                                "Shared resource security gaps in databases and APIs accessible to multiple agents.",
                                "Cross-agent state management flaws allowing memory contamination.",
                                "Design flaws in agent trust models enabling privilege escalation across the agent network."
                            ],
                            "references": [
                                "https://csrc.nist.gov/publications/detail/sp/800-207/final",
                                "https://ithandbook.ffiec.gov/"
                            ]
                        }
                    },
                    configurations: []
                },
                {
                    controlId: NumberInt(14),
                    name: "AIR-SEC-002 — Information Leaked to Vector Store",
                    description: "Controls to prevent sensitive data leakage through vector stores, embeddings, prompt logs, and other AI pipeline components in LLM-powered applications.",
                    requirement: {
                        "1-0-0": {
                            "$schema": "https://calm.finos.org/draft/2025-03/meta/control-requirement.json",
                            "id": "AIR-SEC-002",
                            "name": "Information Leaked to Vector Store",
                            "category": "Security",
                            "source": "FINOS AI Governance Framework v2",
                            "url": "https://air-governance-framework.finos.org/risks/ri-2_information-leaked-to-vector-store.html",
                            "summary": "LLM applications pose data leakage risks across all components handling derived data—vector stores, embeddings, prompt logs, and caches. These representations can expose sensitive information via inversion or inference attacks when enterprise-grade security controls are absent.",
                            "requirements": [
                                "Apply role-based access control (RBAC) to vector stores, restricting retrieval to data the requesting user is authorised to access.",
                                "Encrypt embeddings and vector store data at rest using approved encryption standards.",
                                "Implement audit logging for all vector store queries, capturing user identity, query content, and retrieved documents.",
                                "Classify data before ingestion into vector stores and enforce classification-based access policies.",
                                "Conduct regular penetration testing targeting embedding inversion and membership inference attack vectors.",
                                "Validate that source document access controls are preserved and enforced at retrieval time."
                            ],
                            "contributing_factors": [
                                "Embedding inversion: attacks can reconstruct sensitive information from stored embeddings.",
                                "Membership inference: adversaries can determine if specific sensitive data exists in the vector store.",
                                "Misconfigured access controls permitting unauthorised embedding retrieval.",
                                "Encryption failures exposing embedding data to storage-layer access.",
                                "Data poisoning via injection of malicious embeddings into the vector store."
                            ],
                            "references": [
                                "https://arxiv.org/abs/2310.06816",
                                "https://arxiv.org/abs/2402.12090"
                            ]
                        }
                    },
                    configurations: []
                },
                {
                    controlId: NumberInt(15),
                    name: "AIR-SEC-010 — Prompt Injection",
                    description: "Controls to detect and prevent prompt injection attacks that attempt to manipulate AI system behaviour through malicious inputs embedded in user queries or retrieved content.",
                    requirement: {
                        "1-0-0": {
                            "$schema": "https://calm.finos.org/draft/2025-03/meta/control-requirement.json",
                            "id": "AIR-SEC-010",
                            "name": "Prompt Injection",
                            "category": "Security",
                            "source": "FINOS AI Governance Framework v2",
                            "url": "https://air-governance-framework.finos.org/risks/ri-10_prompt-injection.html",
                            "summary": "Prompt injection attacks manipulate AI systems by embedding malicious instructions in user inputs or retrieved content, causing the model to bypass safety guardrails, leak sensitive information, or perform unauthorised actions.",
                            "requirements": [
                                "Implement AI firewall solutions to detect and block prompt injection patterns in user inputs.",
                                "Sanitise and validate all external content (retrieved documents, tool outputs, user inputs) before inclusion in LLM prompts.",
                                "Apply strict system prompt separation and instruction hierarchy to prevent user inputs overriding system-level instructions.",
                                "Conduct regular red-team exercises specifically targeting prompt injection attack vectors.",
                                "Monitor model outputs for indicators of successful prompt injection (e.g., data exfiltration patterns, instruction echoing).",
                                "Limit the actions an AI system can take autonomously; require human approval for high-risk operations."
                            ],
                            "contributing_factors": [
                                "Insufficient separation between trusted system instructions and untrusted user inputs.",
                                "Indirect prompt injection via maliciously crafted content in retrieved documents or tool outputs.",
                                "Overly permissive system prompts that can be overridden by user instructions.",
                                "Lack of output validation allowing injected instructions to manifest as harmful actions."
                            ],
                            "references": [
                                "https://owasp.org/www-project-top-10-for-large-language-model-applications/",
                                "https://attack.mitre.org/"
                            ]
                        }
                    },
                    configurations: []
                },
                {
                    controlId: NumberInt(16),
                    name: "AIR-SEC-024 — Agent Action Authorization Bypass",
                    description: "Controls to prevent AI agent actions from being executed without proper authorisation, mitigating risks from agentic systems performing unauthorised operations in financial services environments.",
                    requirement: {
                        "1-0-0": {
                            "$schema": "https://calm.finos.org/draft/2025-03/meta/control-requirement.json",
                            "id": "AIR-SEC-024",
                            "name": "Agent Action Authorization Bypass",
                            "category": "Security",
                            "source": "FINOS AI Governance Framework v2",
                            "url": "https://air-governance-framework.finos.org/risks/ri-24_agent-action-authorization-bypass.html",
                            "summary": "Agentic AI systems may execute actions beyond their authorised scope due to inadequate authorisation controls, malicious instruction injection, or privilege escalation vulnerabilities.",
                            "requirements": [
                                "Enforce least-privilege principles: AI agents must only have permissions required for their specific, defined tasks.",
                                "Implement explicit human-in-the-loop approval gates for irreversible or high-risk agent actions.",
                                "Validate all agent actions against a defined authorisation policy before execution.",
                                "Log all agent actions with sufficient detail to support post-incident forensic analysis.",
                                "Implement agent action sandboxing to limit blast radius of unauthorised action attempts.",
                                "Regularly review and recertify agent permission sets as part of access governance processes."
                            ],
                            "contributing_factors": [
                                "Overly permissive agent privilege assignments enabling unintended action scope.",
                                "Prompt injection attacks redirecting agent actions toward unauthorised operations.",
                                "Absence of human oversight gates for high-risk or irreversible actions.",
                                "Insufficient logging preventing detection of unauthorised agent activities."
                            ],
                            "references": [
                                "https://owasp.org/www-project-top-10-for-large-language-model-applications/"
                            ]
                        }
                    },
                    configurations: []
                },
                {
                    controlId: NumberInt(17),
                    name: "AIR-RC-022 — Regulatory Compliance and Oversight",
                    description: "Controls to ensure AI systems deployed in financial services comply with applicable regulations, maintain required oversight mechanisms, and satisfy regulatory reporting and audit obligations.",
                    requirement: {
                        "1-0-0": {
                            "$schema": "https://calm.finos.org/draft/2025-03/meta/control-requirement.json",
                            "id": "AIR-RC-022",
                            "name": "Regulatory Compliance and Oversight",
                            "category": "Regulatory and Compliance",
                            "source": "FINOS AI Governance Framework v2",
                            "url": "https://air-governance-framework.finos.org/risks/ri-22_regulatory-compliance-and-oversight.html",
                            "summary": "AI systems in financial services must comply with an evolving and complex regulatory landscape. Failure to maintain adequate oversight, documentation, and controls can expose firms to regulatory sanctions, enforcement actions, and reputational damage.",
                            "requirements": [
                                "Maintain an AI system inventory documenting all deployed models, their use cases, risk classifications, and regulatory obligations.",
                                "Map each AI system to applicable regulatory frameworks (EU AI Act, SR 11-7, GDPR, FCA guidance, etc.) and evidence compliance.",
                                "Establish AI governance committees with defined accountability for oversight of AI risk and compliance.",
                                "Implement model risk management (MRM) processes aligned with SR 11-7 or equivalent guidance for all AI models used in regulated activities.",
                                "Produce and maintain model documentation sufficient to support regulatory examination and internal audit.",
                                "Monitor regulatory developments and update AI governance policies and controls in response to new requirements."
                            ],
                            "contributing_factors": [
                                "Rapidly evolving AI regulatory landscape creating compliance gaps.",
                                "Absence of AI-specific model risk management frameworks.",
                                "Insufficient documentation of AI system design, validation, and ongoing performance.",
                                "Lack of board and senior management accountability for AI governance."
                            ],
                            "regulatory_references": [
                                "EU AI Act",
                                "SR 11-7: Guidance on Model Risk Management (US Federal Reserve / OCC)",
                                "FCA Guidance on AI and Machine Learning",
                                "GDPR / UK GDPR",
                                "ISO 42001: AI Management Systems"
                            ],
                            "references": []
                        }
                    },
                    configurations: []
                },
                {
                    controlId: NumberInt(18),
                    name: "AIR-RC-023 — Intellectual Property (IP) and Copyright",
                    description: "Controls to protect against AI systems generating, distributing, or misappropriating third-party intellectual property or copyrighted content in financial services applications.",
                    requirement: {
                        "1-0-0": {
                            "$schema": "https://calm.finos.org/draft/2025-03/meta/control-requirement.json",
                            "id": "AIR-RC-023",
                            "name": "Intellectual Property (IP) and Copyright",
                            "category": "Regulatory and Compliance",
                            "source": "FINOS AI Governance Framework v2",
                            "url": "https://air-governance-framework.finos.org/risks/ri-23_intellectual-property-ip-and-copyright.html",
                            "summary": "AI systems may generate content that infringes third-party intellectual property rights, or may reproduce copyrighted material from training data. Financial institutions must manage IP risks associated with AI-generated outputs.",
                            "requirements": [
                                "Conduct IP risk assessments for all AI systems that generate or reproduce content, identifying copyright exposure.",
                                "Implement content filters to detect and block reproduction of copyrighted material in AI outputs.",
                                "Establish policies governing the use of third-party data and content in AI training datasets, ensuring appropriate licencing.",
                                "Include IP indemnification and liability clauses in contracts with AI model providers.",
                                "Train staff on IP risks associated with AI-generated content and define acceptable use policies.",
                                "Monitor AI outputs for patterns indicating potential copyright infringement and establish remediation procedures."
                            ],
                            "contributing_factors": [
                                "AI models trained on copyrighted content may reproduce or closely paraphrase protected material.",
                                "Ambiguity in copyright law regarding AI-generated content and training data use.",
                                "Insufficient licencing agreements for third-party data used in model training.",
                                "Absence of output monitoring for copyright infringement indicators."
                            ],
                            "regulatory_references": [
                                "Copyright, Designs and Patents Act 1988 (UK)",
                                "EU Copyright Directive",
                                "US Copyright Act"
                            ],
                            "references": []
                        }
                    },
                    configurations: []
                }
            ]
        }
    ]);
    logSuccess("Initialized controls for security and ai-governance domains (16 FINOS AI Governance Framework controls, exported 2026-04-28)");
} else {
    logSkip("Controls already exist, no initialization needed");
}

logSection("Patterns");
if (db.patterns.countDocuments() === 0) {
    db.patterns.insertMany([
        {
            namespace: "finos",
            patterns: [
                {
                    patternId: NumberInt(1),
                    name: "API Gateway Pattern",
                    description: "A pattern for securing and routing API traffic through a gateway with identity provider integration",
                    versions:
                    {
                        "1-0-0": {
                            "$schema": "https://calm.finos.org/calm/schemas/2025-03/meta/calm.json",
                            "$id": "https://calm.finos.org/calm/namespaces/finos/patterns/1/versions/1.0.0",
                            "title": "API Gateway Pattern",
                            "type": "object",
                            "properties": {
                                "nodes": {
                                    "type": "array",
                                    "minItems": 4,
                                    "prefixItems": [
                                        {
                                            "$ref": "https://calm.finos.org/calm/schemas/2025-03/meta/core.json#/defs/node",
                                            "properties": {
                                                "well-known-endpoint": {
                                                    "type": "string"
                                                },
                                                "description": {
                                                    "const": "The API Gateway used to verify authorization and access to downstream system"
                                                },
                                                "node-type": {
                                                    "const": "system"
                                                },
                                                "name": {
                                                    "const": "API Gateway"
                                                },
                                                "unique-id": {
                                                    "const": "api-gateway"
                                                },
                                                "interfaces": {
                                                    "type": "array",
                                                    "minItems": 1,
                                                    "prefixItems": [
                                                        {
                                                            "$ref": "https://calm.finos.org/calm/schemas/2025-03/meta/interface.json#/defs/host-port-interface",
                                                            "properties": {
                                                                "unique-id": {
                                                                    "const": "api-gateway-ingress"
                                                                }
                                                            }
                                                        }
                                                    ]
                                                }
                                            },
                                            "required": [
                                                "well-known-endpoint",
                                                "interfaces"
                                            ]
                                        },
                                        {
                                            "$ref": "https://calm.finos.org/calm/schemas/2025-03/meta/core.json#/defs/node",
                                            "properties": {
                                                "description": {
                                                    "const": "The API Consumer making an authenticated and authorized request"
                                                },
                                                "node-type": {
                                                    "const": "system"
                                                },
                                                "name": {
                                                    "const": "API Consumer"
                                                },
                                                "unique-id": {
                                                    "const": "api-consumer"
                                                }
                                            }
                                        },
                                        {
                                            "$ref": "https://calm.finos.org/calm/schemas/2025-03/meta/core.json#/defs/node",
                                            "properties": {
                                                "description": {
                                                    "const": "The API Producer serving content"
                                                },
                                                "node-type": {
                                                    "const": "system"
                                                },
                                                "name": {
                                                    "const": "API Producer"
                                                },
                                                "unique-id": {
                                                    "const": "api-producer"
                                                },
                                                "interfaces": {
                                                    "type": "array",
                                                    "minItems": 1,
                                                    "prefixItems": [
                                                        {
                                                            "$ref": "https://calm.finos.org/calm/schemas/2025-03/meta/interface.json#/defs/host-port-interface",
                                                            "properties": {
                                                                "unique-id": {
                                                                    "const": "producer-ingress"
                                                                }
                                                            }
                                                        }
                                                    ]
                                                }
                                            },
                                            "required": [
                                                "interfaces"
                                            ]
                                        },
                                        {
                                            "$ref": "https://calm.finos.org/calm/schemas/2025-03/meta/core.json#/defs/node",
                                            "properties": {
                                                "description": {
                                                    "const": "The Identity Provider used to verify the bearer token"
                                                },
                                                "node-type": {
                                                    "const": "system"
                                                },
                                                "name": {
                                                    "const": "Identity Provider"
                                                },
                                                "unique-id": {
                                                    "const": "idp"
                                                }
                                            }
                                        }
                                    ]
                                },
                                "relationships": {
                                    "type": "array",
                                    "minItems": 4,
                                    "prefixItems": [
                                        {
                                            "$ref": "https://calm.finos.org/calm/schemas/2025-03/meta/core.json#/defs/relationship",
                                            "properties": {
                                                "unique-id": {
                                                    "const": "api-consumer-api-gateway"
                                                },
                                                "description": {
                                                    "const": "Issue calculation request"
                                                },
                                                "relationship-type": {
                                                    "const": {
                                                        "connects": {
                                                            "source": {
                                                                "node": "api-consumer"
                                                            },
                                                            "destination": {
                                                                "node": "api-gateway",
                                                                "interfaces": [
                                                                    "api-gateway-ingress"
                                                                ]
                                                            }
                                                        }
                                                    }
                                                },
                                                "parties": {},
                                                "protocol": {
                                                    "const": "HTTPS"
                                                },
                                                "authentication": {
                                                    "const": "OAuth2"
                                                }
                                            }
                                        },
                                        {
                                            "$ref": "https://calm.finos.org/calm/schemas/2025-03/meta/core.json#/defs/relationship",
                                            "properties": {
                                                "unique-id": {
                                                    "const": "api-gateway-idp"
                                                },
                                                "description": {
                                                    "const": "Validate bearer token"
                                                },
                                                "relationship-type": {
                                                    "const": {
                                                        "connects": {
                                                            "source": {
                                                                "node": "api-gateway"
                                                            },
                                                            "destination": {
                                                                "node": "idp"
                                                            }
                                                        }
                                                    }
                                                },
                                                "protocol": {
                                                    "const": "HTTPS"
                                                }
                                            }
                                        },
                                        {
                                            "$ref": "https://calm.finos.org/calm/schemas/2025-03/meta/core.json#/defs/relationship",
                                            "properties": {
                                                "unique-id": {
                                                    "const": "api-gateway-api-producer"
                                                },
                                                "description": {
                                                    "const": "Forward request"
                                                },
                                                "relationship-type": {
                                                    "const": {
                                                        "connects": {
                                                            "source": {
                                                                "node": "api-gateway"
                                                            },
                                                            "destination": {
                                                                "node": "api-producer",
                                                                "interfaces": [
                                                                    "producer-ingress"
                                                                ]
                                                            }
                                                        }
                                                    }
                                                },
                                                "protocol": {
                                                    "const": "HTTPS"
                                                }
                                            }
                                        },
                                        {
                                            "$ref": "https://calm.finos.org/calm/schemas/2025-03/meta/core.json#/defs/relationship",
                                            "properties": {
                                                "unique-id": {
                                                    "const": "api-consumer-idp"
                                                },
                                                "description": {
                                                    "const": "Acquire a bearer token"
                                                },
                                                "relationship-type": {
                                                    "const": {
                                                        "connects": {
                                                            "source": {
                                                                "node": "api-consumer"
                                                            },
                                                            "destination": {
                                                                "node": "idp"
                                                            }
                                                        }
                                                    }
                                                },
                                                "protocol": {
                                                    "const": "HTTPS"
                                                }
                                            }
                                        }
                                    ]
                                }
                            },
                            "required": [
                                "nodes",
                                "relationships"
                            ]
                        }
                    }
                }
            ]
        },
        {
            namespace: "workshop",
            patterns: [
                {
                    patternId: NumberInt(1),
                    name: "Conference Signup Pattern",
                    description: "A reusable architecture pattern for conference signup systems with Kubernetes deployment",
                    versions:
                    {
                        "1-0-0": {
                            "$schema": "https://calm.finos.org/calm/schemas/2025-03/meta/calm.json",
                            "$id": "https://calm.finos.org/calm/namespaces/workshop/patterns/1/versions/1.0.0",
                            "type": "object",
                            "title": "Conference Signup Pattern",
                            "description": "A reusable architecture pattern for conference signup systems with Kubernetes deployment.",
                            "properties": {
                                "nodes": {
                                    "type": "array",
                                    "minItems": 5,
                                    "maxItems": 5,
                                    "prefixItems": [
                                        {
                                            "$ref": "https://calm.finos.org/calm/schemas/2025-03/meta/core.json#/defs/node",
                                            "type": "object",
                                            "properties": {
                                                "unique-id": {
                                                    "const": "conference-website"
                                                },
                                                "name": {
                                                    "const": "Conference Website"
                                                },
                                                "description": {
                                                    "const": "Website to sign up for a conference"
                                                },
                                                "node-type": {
                                                    "const": "webclient"
                                                },
                                                "interfaces": {
                                                    "type": "array",
                                                    "minItems": 1,
                                                    "maxItems": 1,
                                                    "prefixItems": [
                                                        {
                                                            "$ref": "https://calm.finos.org/calm/schemas/2025-03/meta/interface.json#/defs/url-interface",
                                                            "properties": {
                                                                "unique-id": {
                                                                    "const": "conference-website-url"
                                                                }
                                                            }
                                                        }
                                                    ]
                                                }
                                            }
                                        },
                                        {
                                            "$ref": "https://calm.finos.org/calm/schemas/2025-03/meta/core.json#/defs/node",
                                            "type": "object",
                                            "properties": {
                                                "unique-id": {
                                                    "const": "load-balancer"
                                                },
                                                "name": {
                                                    "const": "Load Balancer"
                                                },
                                                "description": {
                                                    "const": "The attendees service, or a placeholder for another application"
                                                },
                                                "node-type": {
                                                    "const": "network"
                                                },
                                                "interfaces": {
                                                    "type": "array",
                                                    "minItems": 1,
                                                    "maxItems": 1,
                                                    "prefixItems": [
                                                        {
                                                            "$ref": "https://calm.finos.org/calm/schemas/2025-03/meta/interface.json#/defs/host-port-interface",
                                                            "properties": {
                                                                "unique-id": {
                                                                    "const": "load-balancer-host-port"
                                                                }
                                                            }
                                                        }
                                                    ]
                                                }
                                            }
                                        },
                                        {
                                            "$ref": "https://calm.finos.org/calm/schemas/2025-03/meta/core.json#/defs/node",
                                            "type": "object",
                                            "properties": {
                                                "unique-id": {
                                                    "const": "attendees"
                                                },
                                                "name": {
                                                    "const": "Attendees Service"
                                                },
                                                "description": {
                                                    "const": "The attendees service, or a placeholder for another application"
                                                },
                                                "node-type": {
                                                    "const": "service"
                                                },
                                                "interfaces": {
                                                    "type": "array",
                                                    "minItems": 2,
                                                    "maxItems": 2,
                                                    "prefixItems": [
                                                        {
                                                            "$ref": "https://calm.finos.org/calm/schemas/2025-03/meta/interface.json#/defs/container-image-interface",
                                                            "properties": {
                                                                "unique-id": {
                                                                    "const": "attendees-image"
                                                                }
                                                            }
                                                        },
                                                        {
                                                            "$ref": "https://calm.finos.org/calm/schemas/2025-03/meta/interface.json#/defs/port-interface",
                                                            "properties": {
                                                                "unique-id": {
                                                                    "const": "attendees-port"
                                                                }
                                                            }
                                                        }
                                                    ]
                                                }
                                            }
                                        },
                                        {
                                            "$ref": "https://calm.finos.org/calm/schemas/2025-03/meta/core.json#/defs/node",
                                            "type": "object",
                                            "properties": {
                                                "unique-id": {
                                                    "const": "attendees-store"
                                                },
                                                "name": {
                                                    "const": "Attendees Store"
                                                },
                                                "description": {
                                                    "const": "Persistent storage for attendees"
                                                },
                                                "node-type": {
                                                    "const": "database"
                                                },
                                                "interfaces": {
                                                    "type": "array",
                                                    "minItems": 2,
                                                    "maxItems": 2,
                                                    "prefixItems": [
                                                        {
                                                            "$ref": "https://calm.finos.org/calm/schemas/2025-03/meta/interface.json#/defs/container-image-interface",
                                                            "properties": {
                                                                "unique-id": {
                                                                    "const": "database-image"
                                                                }
                                                            }
                                                        },
                                                        {
                                                            "$ref": "https://calm.finos.org/calm/schemas/2025-03/meta/interface.json#/defs/port-interface",
                                                            "properties": {
                                                                "unique-id": {
                                                                    "const": "database-port"
                                                                }
                                                            }
                                                        }
                                                    ]
                                                }
                                            }
                                        },
                                        {
                                            "$ref": "https://calm.finos.org/calm/schemas/2025-03/meta/core.json#/defs/node",
                                            "type": "object",
                                            "properties": {
                                                "unique-id": {
                                                    "const": "k8s-cluster"
                                                },
                                                "name": {
                                                    "const": "Kubernetes Cluster"
                                                },
                                                "description": {
                                                    "const": "Kubernetes Cluster with network policy rules enabled"
                                                },
                                                "node-type": {
                                                    "const": "system"
                                                }
                                            }
                                        }
                                    ]
                                },
                                "relationships": {
                                    "type": "array",
                                    "minItems": 4,
                                    "maxItems": 4,
                                    "prefixItems": [
                                        {
                                            "$ref": "https://calm.finos.org/calm/schemas/2025-03/meta/core.json#/defs/relationship",
                                            "type": "object",
                                            "properties": {
                                                "unique-id": {
                                                    "const": "conference-website-load-balancer"
                                                },
                                                "description": {
                                                    "const": "Request attendee details"
                                                },
                                                "protocol": {
                                                    "const": "HTTPS"
                                                },
                                                "relationship-type": {
                                                    "const": {
                                                        "connects": {
                                                            "source": {
                                                                "node": "conference-website"
                                                            },
                                                            "destination": {
                                                                "node": "load-balancer"
                                                            }
                                                        }
                                                    }
                                                }
                                            },
                                            "required": [
                                                "description"
                                            ]
                                        },
                                        {
                                            "$ref": "https://calm.finos.org/calm/schemas/2025-03/meta/core.json#/defs/relationship",
                                            "type": "object",
                                            "properties": {
                                                "unique-id": {
                                                    "const": "load-balancer-attendees-service"
                                                },
                                                "description": {
                                                    "const": "Forward"
                                                },
                                                "protocol": {
                                                    "const": "mTLS"
                                                },
                                                "relationship-type": {
                                                    "const": {
                                                        "connects": {
                                                            "source": {
                                                                "node": "load-balancer"
                                                            },
                                                            "destination": {
                                                                "node": "attendees"
                                                            }
                                                        }
                                                    }
                                                }
                                            },
                                            "required": [
                                                "description"
                                            ]
                                        },
                                        {
                                            "$ref": "https://calm.finos.org/calm/schemas/2025-03/meta/core.json#/defs/relationship",
                                            "type": "object",
                                            "properties": {
                                                "unique-id": {
                                                    "const": "attendees-attendees-store"
                                                },
                                                "description": {
                                                    "const": "Store or request attendee details"
                                                },
                                                "protocol": {
                                                    "const": "JDBC"
                                                },
                                                "relationship-type": {
                                                    "const": {
                                                        "connects": {
                                                            "source": {
                                                                "node": "attendees"
                                                            },
                                                            "destination": {
                                                                "node": "attendees-store"
                                                            }
                                                        }
                                                    }
                                                }
                                            },
                                            "required": [
                                                "description"
                                            ]
                                        },
                                        {
                                            "$ref": "https://calm.finos.org/calm/schemas/2025-03/meta/core.json#/defs/relationship",
                                            "properties": {
                                                "unique-id": {
                                                    "const": "deployed-in-k8s-cluster"
                                                },
                                                "description": {
                                                    "const": "Components deployed on the k8s cluster"
                                                },
                                                "relationship-type": {
                                                    "const": {
                                                        "deployed-in": {
                                                            "container": "k8s-cluster",
                                                            "nodes": [
                                                                "load-balancer",
                                                                "attendees",
                                                                "attendees-store"
                                                            ]
                                                        }
                                                    }
                                                }
                                            },
                                            "required": [
                                                "description"
                                            ]
                                        }
                                    ]
                                }
                            },
                            "required": [
                                "nodes",
                                "relationships"
                            ]
                        }
                    }
                },
                {
                    patternId: NumberInt(2),
                    name: "Conference Secure Signup Pattern",
                    description: "A secure reusable architecture pattern for conference signup systems with Kubernetes deployment",
                    versions:
                    {
                        "1-0-0": {
                            "$schema": "https://calm.finos.org/calm/schemas/2025-03/meta/calm.json",
                            "$id": "https://calm.finos.org/calm/namespaces/workshop/patterns/2/versions/1.0.0",
                            "type": "object",
                            "title": "Conference Secure Signup Pattern",
                            "description": "A secure reusable architecture pattern for conference signup systems with Kubernetes deployment.",
                            "properties": {
                                "nodes": {
                                    "type": "array",
                                    "minItems": 5,
                                    "maxItems": 5,
                                    "prefixItems": [
                                        {
                                            "$ref": "https://calm.finos.org/calm/schemas/2025-03/meta/core.json#/defs/node",
                                            "type": "object",
                                            "properties": {
                                                "unique-id": {
                                                    "const": "conference-website"
                                                },
                                                "name": {
                                                    "const": "Conference Website"
                                                },
                                                "description": {
                                                    "const": "Website to sign up for a conference"
                                                },
                                                "node-type": {
                                                    "const": "webclient"
                                                },
                                                "interfaces": {
                                                    "type": "array",
                                                    "minItems": 1,
                                                    "maxItems": 1,
                                                    "prefixItems": [
                                                        {
                                                            "$ref": "https://calm.finos.org/calm/schemas/2025-03/meta/interface.json#/defs/url-interface",
                                                            "properties": {
                                                                "unique-id": {
                                                                    "const": "conference-website-url"
                                                                }
                                                            }
                                                        }
                                                    ]
                                                }
                                            }
                                        },
                                        {
                                            "$ref": "https://calm.finos.org/calm/schemas/2025-03/meta/core.json#/defs/node",
                                            "type": "object",
                                            "properties": {
                                                "unique-id": {
                                                    "const": "load-balancer"
                                                },
                                                "name": {
                                                    "const": "Load Balancer"
                                                },
                                                "description": {
                                                    "const": "The attendees service, or a placeholder for another application"
                                                },
                                                "node-type": {
                                                    "const": "network"
                                                },
                                                "interfaces": {
                                                    "type": "array",
                                                    "minItems": 1,
                                                    "maxItems": 1,
                                                    "prefixItems": [
                                                        {
                                                            "$ref": "https://calm.finos.org/calm/schemas/2025-03/meta/interface.json#/defs/host-port-interface",
                                                            "properties": {
                                                                "unique-id": {
                                                                    "const": "load-balancer-host-port"
                                                                }
                                                            }
                                                        }
                                                    ]
                                                }
                                            }
                                        },
                                        {
                                            "$ref": "https://calm.finos.org/calm/schemas/2025-03/meta/core.json#/defs/node",
                                            "type": "object",
                                            "properties": {
                                                "unique-id": {
                                                    "const": "attendees"
                                                },
                                                "name": {
                                                    "const": "Attendees Service"
                                                },
                                                "description": {
                                                    "const": "The attendees service, or a placeholder for another application"
                                                },
                                                "node-type": {
                                                    "const": "service"
                                                },
                                                "interfaces": {
                                                    "type": "array",
                                                    "minItems": 2,
                                                    "maxItems": 2,
                                                    "prefixItems": [
                                                        {
                                                            "$ref": "https://calm.finos.org/calm/schemas/2025-03/meta/interface.json#/defs/container-image-interface",
                                                            "properties": {
                                                                "unique-id": {
                                                                    "const": "attendees-image"
                                                                }
                                                            }
                                                        },
                                                        {
                                                            "$ref": "https://calm.finos.org/calm/schemas/2025-03/meta/interface.json#/defs/port-interface",
                                                            "properties": {
                                                                "unique-id": {
                                                                    "const": "attendees-port"
                                                                }
                                                            }
                                                        }
                                                    ]
                                                }
                                            }
                                        },
                                        {
                                            "$ref": "https://calm.finos.org/calm/schemas/2025-03/meta/core.json#/defs/node",
                                            "type": "object",
                                            "properties": {
                                                "unique-id": {
                                                    "const": "attendees-store"
                                                },
                                                "name": {
                                                    "const": "Attendees Store"
                                                },
                                                "description": {
                                                    "const": "Persistent storage for attendees"
                                                },
                                                "node-type": {
                                                    "const": "database"
                                                },
                                                "interfaces": {
                                                    "type": "array",
                                                    "minItems": 2,
                                                    "maxItems": 2,
                                                    "prefixItems": [
                                                        {
                                                            "$ref": "https://calm.finos.org/calm/schemas/2025-03/meta/interface.json#/defs/container-image-interface",
                                                            "properties": {
                                                                "unique-id": {
                                                                    "const": "database-image"
                                                                }
                                                            }
                                                        },
                                                        {
                                                            "$ref": "https://calm.finos.org/calm/schemas/2025-03/meta/interface.json#/defs/port-interface",
                                                            "properties": {
                                                                "unique-id": {
                                                                    "const": "database-port"
                                                                }
                                                            }
                                                        }
                                                    ]
                                                }
                                            }
                                        },
                                        {
                                            "$ref": "https://calm.finos.org/calm/schemas/2025-03/meta/core.json#/defs/node",
                                            "type": "object",
                                            "properties": {
                                                "unique-id": {
                                                    "const": "k8s-cluster"
                                                },
                                                "name": {
                                                    "const": "Kubernetes Cluster"
                                                },
                                                "description": {
                                                    "const": "Kubernetes Cluster with network policy rules enabled"
                                                },
                                                "node-type": {
                                                    "const": "system"
                                                },
                                                "controls": {
                                                    "$ref": "https://calm.finos.org/calm/schemas/2025-03/meta/control.json#/defs/controls",
                                                    "properties": {
                                                        "security": {
                                                            "type": "object",
                                                            "properties": {
                                                                "description": {
                                                                    "const": "Security requirements for the Kubernetes cluster"
                                                                },
                                                                "requirements": {
                                                                    "type": "array",
                                                                    "minItems": 1,
                                                                    "maxItems": 1,
                                                                    "prefixItems": [
                                                                        {
                                                                            "$ref": "https://calm.finos.org/calm/schemas/2025-03/meta/control.json#/defs/control-detail",
                                                                            "properties": {
                                                                                "control-requirement-url": {
                                                                                    "const": "https://calm.finos.org/workshop/controls/micro-segmentation.requirement.json"
                                                                                }
                                                                            },
                                                                            "required": [
                                                                                "control-config-url"
                                                                            ]
                                                                        }
                                                                    ]
                                                                }
                                                            }
                                                        }
                                                    }
                                                }
                                            }
                                        }
                                    ]
                                },
                                "relationships": {
                                    "type": "array",
                                    "minItems": 1,
                                    "prefixItems": [
                                        {
                                            "$ref": "https://calm.finos.org/calm/schemas/2025-03/meta/core.json#/defs/relationship",
                                            "type": "object",
                                            "properties": {
                                                "unique-id": {
                                                    "const": "conference-website-load-balancer"
                                                },
                                                "description": {
                                                    "const": "Request attendee details"
                                                },
                                                "protocol": {
                                                    "const": "HTTPS"
                                                },
                                                "relationship-type": {
                                                    "const": {
                                                        "connects": {
                                                            "source": {
                                                                "node": "conference-website"
                                                            },
                                                            "destination": {
                                                                "node": "load-balancer"
                                                            }
                                                        }
                                                    }
                                                },
                                                "controls": {
                                                    "$ref": "https://calm.finos.org/calm/schemas/2025-03/meta/control.json#/defs/controls",
                                                    "properties": {
                                                        "security": {
                                                            "type": "object",
                                                            "properties": {
                                                                "description": {
                                                                    "const": "Security Controls for the connection"
                                                                },
                                                                "requirements": {
                                                                    "type": "array",
                                                                    "minItems": 1,
                                                                    "maxItems": 1,
                                                                    "prefixItems": [
                                                                        {
                                                                            "$ref": "https://calm.finos.org/calm/schemas/2025-03/meta/control.json#/defs/control-detail",
                                                                            "properties": {
                                                                                "control-requirement-url": {
                                                                                    "const": "https://calm.finos.org/workshop/controls/permitted-connection.requirement.json"
                                                                                }
                                                                            },
                                                                            "required": [
                                                                                "control-config-url"
                                                                            ]
                                                                        }
                                                                    ]
                                                                }
                                                            }
                                                        }
                                                    }
                                                }
                                            },
                                            "required": [
                                                "description"
                                            ]
                                        },
                                        {
                                            "$ref": "https://calm.finos.org/calm/schemas/2025-03/meta/core.json#/defs/relationship",
                                            "type": "object",
                                            "properties": {
                                                "unique-id": {
                                                    "const": "load-balancer-attendees"
                                                },
                                                "description": {
                                                    "const": "Forward"
                                                },
                                                "protocol": {
                                                    "const": "mTLS"
                                                },
                                                "relationship-type": {
                                                    "const": {
                                                        "connects": {
                                                            "source": {
                                                                "node": "load-balancer"
                                                            },
                                                            "destination": {
                                                                "node": "attendees"
                                                            }
                                                        }
                                                    }
                                                },
                                                "controls": {
                                                    "$ref": "https://calm.finos.org/calm/schemas/2025-03/meta/control.json#/defs/controls",
                                                    "properties": {
                                                        "security": {
                                                            "type": "object",
                                                            "properties": {
                                                                "description": {
                                                                    "const": "Security Controls for the connection"
                                                                },
                                                                "requirements": {
                                                                    "type": "array",
                                                                    "minItems": 1,
                                                                    "maxItems": 1,
                                                                    "prefixItems": [
                                                                        {
                                                                            "$ref": "https://calm.finos.org/calm/schemas/2025-03/meta/control.json#/defs/control-detail",
                                                                            "properties": {
                                                                                "control-requirement-url": {
                                                                                    "const": "https://calm.finos.org/workshop/controls/permitted-connection.requirement.json"
                                                                                }
                                                                            },
                                                                            "required": [
                                                                                "control-config-url"
                                                                            ]
                                                                        }
                                                                    ]
                                                                }
                                                            }
                                                        }
                                                    }
                                                }
                                            },
                                            "required": [
                                                "description"
                                            ]
                                        },
                                        {
                                            "$ref": "https://calm.finos.org/calm/schemas/2025-03/meta/core.json#/defs/relationship",
                                            "type": "object",
                                            "properties": {
                                                "unique-id": {
                                                    "const": "attendees-attendees-store"
                                                },
                                                "description": {
                                                    "const": "Store or request attendee details"
                                                },
                                                "protocol": {
                                                    "const": "JDBC"
                                                },
                                                "relationship-type": {
                                                    "const": {
                                                        "connects": {
                                                            "source": {
                                                                "node": "attendees"
                                                            },
                                                            "destination": {
                                                                "node": "attendees-store"
                                                            }
                                                        }
                                                    }
                                                },
                                                "controls": {
                                                    "$ref": "https://calm.finos.org/calm/schemas/2025-03/meta/control.json#/defs/controls",
                                                    "properties": {
                                                        "security": {
                                                            "type": "object",
                                                            "properties": {
                                                                "description": {
                                                                    "const": "Security Controls for the connection"
                                                                },
                                                                "requirements": {
                                                                    "type": "array",
                                                                    "minItems": 1,
                                                                    "maxItems": 1,
                                                                    "prefixItems": [
                                                                        {
                                                                            "$ref": "https://calm.finos.org/calm/schemas/2025-03/meta/control.json#/defs/control-detail",
                                                                            "properties": {
                                                                                "control-requirement-url": {
                                                                                    "const": "https://calm.finos.org/workshop/controls/permitted-connection.requirement.json"
                                                                                }
                                                                            },
                                                                            "required": [
                                                                                "control-config-url"
                                                                            ]
                                                                        }
                                                                    ]
                                                                }
                                                            }
                                                        }
                                                    }
                                                }
                                            },
                                            "required": [
                                                "description",
                                                "controls"
                                            ]
                                        },
                                        {
                                            "$ref": "https://calm.finos.org/calm/schemas/2025-03/meta/core.json#/defs/relationship",
                                            "properties": {
                                                "unique-id": {
                                                    "const": "deployed-in-k8s-cluster"
                                                },
                                                "description": {
                                                    "const": "Components deployed on the k8s cluster"
                                                },
                                                "relationship-type": {
                                                    "const": {
                                                        "deployed-in": {
                                                            "container": "k8s-cluster",
                                                            "nodes": [
                                                                "load-balancer",
                                                                "attendees",
                                                                "attendees-store"
                                                            ]
                                                        }
                                                    }
                                                }
                                            },
                                            "required": [
                                                "description"
                                            ]
                                        }
                                    ]
                                }
                            },
                            "required": [
                                "nodes",
                                "relationships"
                            ]
                        }
                    }
                }
            ]
        }
    ]);
    logSuccess("Initialized patterns for finos and workshop namespaces");
} else {
    logSkip("Patterns already initialized, skipping...");
}

logSection("Flows");
if (db.flows.countDocuments() === 0) {
    db.flows.insertMany([
        {
            namespace: "finos",
            flows: [
                {
                    flowId: NumberInt(1),
                    name: "Flow 1",
                    description: "This is a non-compliant flow document. Just creating something to simulate",
                    versions:
                    {
                        "1-0-0": {
                            "$schema": "https://raw.githubusercontent.com/finos/architecture-as-code/main/calm/draft/2024-04/meta/calm.json",
                            "$id": "https://raw.githubusercontent.com/finos/architecture-as-code/main/calm/flow/flow-1",
                            "title": "Flow 1",
                            "description": "This is a non-compliant flow document. Just creating something to simulate"
                        }
                    }
                },
                {
                    flowId: NumberInt(2),
                    name: "Flow 2",
                    description: "This is a non-compliant flow document. Just creating something to simulate",
                    versions:
                    {
                        "1-0-0": {
                            "$schema": "https://raw.githubusercontent.com/finos/architecture-as-code/main/calm/draft/2024-04/meta/calm.json",
                            "$id": "https://raw.githubusercontent.com/finos/architecture-as-code/main/calm/flow/flow-2",
                            "title": "Flow 2",
                            "description": "This is a non-compliant flow document. Just creating something to simulate"


                        }
                    }
                }
            ]
        },
        {
            namespace: "traderx",
            flows: [
                {
                    flowId: NumberInt(1),
                    name: "Add or Update Account",
                    description: "Flow for adding or updating account information in the database",
                    versions:
                    {
                        "1-0-0": {
                            "$schema": "https://calm.finos.org/draft/2024-10/meta/flow.json",
                            "$id": "https://calm.finos.org/traderx/flows/add-update-account.json",
                            "unique-id": "flow-add-update-account",
                            "name": "Add or Update Account",
                            "description": "Flow for adding or updating account information in the database.",
                            "transitions": [
                                {
                                    "relationship-unique-id": "web-gui-process-uses-accounts-service",
                                    "sequence-number": 1,
                                    "summary": "Submit Account Create/Update"
                                },
                                {
                                    "relationship-unique-id": "accounts-service-uses-traderx-db-for-accounts",
                                    "sequence-number": 2,
                                    "summary": "inserts or updates account"
                                },
                                {
                                    "relationship-unique-id": "web-gui-process-uses-accounts-service",
                                    "sequence-number": 3,
                                    "summary": "Returns Account Create/Update Response Status",
                                    "direction": "destination-to-source"
                                }
                            ],
                            "controls": {
                                "add-update-account-sla": {
                                    "description": "Control requirement for flow SLA",
                                    "requirements": [
                                        {
                                            "control-requirement-url": "https://calm.finos.org/samples/traderx/controls/flow-sla-control-requirement.json",
                                            "control-config": "https://calm.finos.org/samples/traderx/flows/add-update-account/add-update-account-control-configuration.json"
                                        }
                                    ]
                                }
                            }
                        }

                    }
                },
                {
                    flowId: NumberInt(2),
                    name: "Load List of Accounts",
                    description: "Flow for loading a list of accounts from the database to populate the GUI drop-down for user account selection",
                    versions:
                    {
                        "1-0-0": {
                            "$schema": "https://calm.finos.org/draft/2024-10/meta/flow.json",
                            "$id": "https://calm.finos.org/samples/traderx/flows/load-list-of-accounts.json",
                            "unique-id": "flow-load-list-of-accounts",
                            "name": "Load List of Accounts",
                            "description": "Flow for loading a list of accounts from the database to populate the GUI drop-down for user account selection.",
                            "transitions": [
                                {
                                    "relationship-unique-id": "web-gui-process-uses-accounts-service",
                                    "sequence-number": 1,
                                    "summary": "Load list of accounts"
                                },
                                {
                                    "relationship-unique-id": "accounts-service-uses-traderx-db-for-accounts",
                                    "sequence-number": 2,
                                    "summary": "Query for all Accounts"
                                },
                                {
                                    "relationship-unique-id": "accounts-service-uses-traderx-db-for-accounts",
                                    "sequence-number": 3,
                                    "summary": "Returns list of accounts",
                                    "direction": "destination-to-source"
                                },
                                {
                                    "relationship-unique-id": "web-gui-process-uses-accounts-service",
                                    "sequence-number": 4,
                                    "summary": "Returns list of accounts",
                                    "direction": "destination-to-source"
                                }
                            ]
                        }

                    }
                }
            ]
        }
    ]
    );
    logSuccess("Initialized flows for finos and traderx namespaces");
} else {
    logSkip("Flows already initialized, skipping...");
}

logSection("Architectures");
if (db.architectures.countDocuments() === 0) {
    db.architectures.insertMany([
        {
            namespace: "finos",
            architectures: [{
                architectureId: NumberInt(1),
                name: "Architecture 1",
                description: "This is a non-compliant arch document. Just creating something to simulate",
                versions:
                {
                    "1-0-0": {
                        "$schema": "https://raw.githubusercontent.com/finos/architecture-as-code/main/calm/draft/2024-04/meta/calm.json",
                        "$id": "https://raw.githubusercontent.com/finos/architecture-as-code/main/calm/arch-1",
                        "title": "Architecture 1",
                        "description": "This is a non-compliant arch document. Just creating something to simulate"
                    }
                }
            }]
        },
        {
            namespace: "workshop",
            architectures: [
                {
                    architectureId: NumberInt(1),
                    name: "Conference Signup Architecture",
                    description: "Conference signup system with load-balanced services and Kubernetes deployment",
                    versions:
                    {
                        "1-0-0": {
                            "nodes": [
                                {
                                    "unique-id": "conference-website",
                                    "name": "Conference Website",
                                    "description": "Website to sign up for a conference",
                                    "node-type": "webclient",
                                    "interfaces": [
                                        {
                                            "unique-id": "conference-website-url",
                                            "url": "[[ URL ]]"
                                        }
                                    ]
                                },
                                {
                                    "unique-id": "load-balancer",
                                    "name": "Load Balancer",
                                    "description": "The attendees service, or a placeholder for another application",
                                    "node-type": "network",
                                    "interfaces": [
                                        {
                                            "unique-id": "load-balancer-host-port",
                                            "host": "[[ HOST ]]",
                                            "port": -1
                                        }
                                    ]
                                },
                                {
                                    "unique-id": "attendees",
                                    "name": "Attendees Service",
                                    "description": "The attendees service, or a placeholder for another application",
                                    "node-type": "service",
                                    "interfaces": [
                                        {
                                            "unique-id": "attendees-image",
                                            "image": "[[ IMAGE ]]"
                                        },
                                        {
                                            "unique-id": "attendees-port",
                                            "port": -1
                                        }
                                    ]
                                },
                                {
                                    "unique-id": "attendees-store",
                                    "name": "Attendees Store",
                                    "description": "Persistent storage for attendees",
                                    "node-type": "database",
                                    "interfaces": [
                                        {
                                            "unique-id": "database-image",
                                            "image": "[[ IMAGE ]]"
                                        },
                                        {
                                            "unique-id": "database-port",
                                            "port": -1
                                        }
                                    ]
                                },
                                {
                                    "unique-id": "k8s-cluster",
                                    "name": "Kubernetes Cluster",
                                    "description": "Kubernetes Cluster with network policy rules enabled",
                                    "node-type": "system"
                                }
                            ],
                            "relationships": [
                                {
                                    "unique-id": "conference-website-load-balancer",
                                    "description": "Request attendee details",
                                    "protocol": "HTTPS",
                                    "relationship-type": {
                                        "connects": {
                                            "source": {
                                                "node": "conference-website"
                                            },
                                            "destination": {
                                                "node": "load-balancer"
                                            }
                                        }
                                    }
                                },
                                {
                                    "unique-id": "load-balancer-attendees-service",
                                    "description": "Forward",
                                    "protocol": "mTLS",
                                    "relationship-type": {
                                        "connects": {
                                            "source": {
                                                "node": "load-balancer"
                                            },
                                            "destination": {
                                                "node": "attendees"
                                            }
                                        }
                                    }
                                },
                                {
                                    "unique-id": "attendees-attendees-store",
                                    "description": "Store or request attendee details",
                                    "protocol": "JDBC",
                                    "relationship-type": {
                                        "connects": {
                                            "source": {
                                                "node": "attendees"
                                            },
                                            "destination": {
                                                "node": "attendees-store"
                                            }
                                        }
                                    }
                                },
                                {
                                    "unique-id": "deployed-in-k8s-cluster",
                                    "description": "Components deployed on the k8s cluster",
                                    "relationship-type": {
                                        "deployed-in": {
                                            "container": "k8s-cluster",
                                            "nodes": [
                                                "load-balancer",
                                                "attendees",
                                                "attendees-store"
                                            ]
                                        }
                                    }
                                }
                            ],
                            "metadata": [
                                {
                                    "kubernetes": {
                                        "namespace": "conference"
                                    }
                                }
                            ],
                            "adrs": [
                                "https://github.com/org/project/docs/adr/0001-use-load-balancer.md",
                                "https://github.com/org/project/docs/adr/0002-use-kubernetes.md",
                                "/calm/namespaces/workshop/adrs/1"
                            ],
                            "$schema": "https://calm.finos.org/calm/namespaces/workshop/patterns/1/versions/1.0.0"
                        }
                    }
                }
            ]
        },
        {
            namespace: "traderx",
            architectures: [{
                architectureId: NumberInt(1),
                name: "TraderX",
                description: "Simple Trading System architecture",
                versions:
                {
                    "1-0-0": {
                        "$schema": "https://calm.finos.org/draft/2025-03/meta/calm.json",
                        "nodes": [
                            {
                                "unique-id": "traderx-system",
                                "node-type": "system",
                                "name": "TraderX",
                                "description": "Simple Trading System"
                            },
                            {
                                "unique-id": "traderx-trader",
                                "node-type": "actor",
                                "name": "Trader",
                                "description": "Person who manages accounts and executes trades"
                            },
                            {
                                "unique-id": "web-client",
                                "node-type": "webclient",
                                "name": "Web Client",
                                "description": "Browser based web interface for TraderX",
                                "data-classification": "Confidential",
                                "run-as": "user"
                            },
                            {
                                "unique-id": "web-gui-process",
                                "node-type": "service",
                                "name": "Web GUI",
                                "description": "Allows employees to manage accounts and book trades",
                                "data-classification": "Confidential",
                                "run-as": "systemId"
                            },
                            {
                                "unique-id": "position-service",
                                "node-type": "service",
                                "name": "Position Service",
                                "description": "Server process which processes trading activity and updates positions",
                                "data-classification": "Confidential",
                                "run-as": "systemId"
                            },
                            {
                                "unique-id": "traderx-db",
                                "node-type": "database",
                                "name": "TraderX DB",
                                "description": "Database which stores account, trade and position state",
                                "data-classification": "Confidential",
                                "run-as": "systemId"
                            },
                            {
                                "unique-id": "internal-bank-network",
                                "node-type": "network",
                                "name": "Bank ABC Internal Network",
                                "description": "Internal network for Bank ABC",
                                "instance": "Internal Network"
                            },
                            {
                                "unique-id": "reference-data-service",
                                "node-type": "service",
                                "name": "Reference Data Service",
                                "description": "Service which provides reference data",
                                "data-classification": "Confidential",
                                "run-as": "systemId"
                            },
                            {
                                "unique-id": "trading-services",
                                "node-type": "service",
                                "name": "Trading Services",
                                "description": "Service which provides trading services",
                                "data-classification": "Confidential",
                                "run-as": "systemId"
                            },
                            {
                                "unique-id": "trade-feed",
                                "node-type": "service",
                                "name": "Trade Feed",
                                "description": "Message bus for streaming updates to trades and positions",
                                "data-classification": "Confidential",
                                "run-as": "systemId"
                            },
                            {
                                "unique-id": "trade-processor",
                                "node-type": "service",
                                "name": "Trade Processor",
                                "description": "Process incoming trade requests, settle and persist",
                                "data-classification": "Confidential",
                                "run-as": "systemId"
                            },
                            {
                                "unique-id": "accounts-service",
                                "node-type": "service",
                                "name": "Accounts Service",
                                "description": "Service which provides account management",
                                "data-classification": "Confidential",
                                "run-as": "systemId"
                            },
                            {
                                "unique-id": "people-service",
                                "node-type": "service",
                                "name": "People Service",
                                "description": "Service which provides user details management",
                                "data-classification": "Confidential",
                                "run-as": "systemId"
                            },
                            {
                                "unique-id": "user-directory",
                                "node-type": "ldap",
                                "name": "User Directory",
                                "description": "Golden source of user data",
                                "data-classification": "PII",
                                "run-as": "systemId"
                            }
                        ],
                        "relationships": [
                            {
                                "unique-id": "trader-executes-trades",
                                "description": "Executes Trades",
                                "relationship-type": {
                                    "interacts": {
                                        "actor": "traderx-trader",
                                        "nodes": [
                                            "web-client"
                                        ]
                                    }
                                }
                            },
                            {
                                "unique-id": "trader-manages-accounts",
                                "description": "Manage Accounts",
                                "relationship-type": {
                                    "interacts": {
                                        "actor": "traderx-trader",
                                        "nodes": [
                                            "web-client"
                                        ]
                                    }
                                }
                            },
                            {
                                "unique-id": "trader-views-trade-status",
                                "description": "View Trade Status / Positions",
                                "relationship-type": {
                                    "interacts": {
                                        "actor": "traderx-trader",
                                        "nodes": [
                                            "web-client"
                                        ]
                                    }
                                }
                            },
                            {
                                "unique-id": "web-client-uses-web-gui",
                                "description": "Web client interacts with the Web GUI process.",
                                "relationship-type": {
                                    "connects": {
                                        "source": {
                                            "node": "web-client"
                                        },
                                        "destination": {
                                            "node": "web-gui-process"
                                        }
                                    }
                                },
                                "protocol": "HTTPS"
                            },
                            {
                                "unique-id": "web-gui-uses-position-service-for-position-queries",
                                "description": "Load positions for account.",
                                "relationship-type": {
                                    "connects": {
                                        "source": {
                                            "node": "web-gui-process"
                                        },
                                        "destination": {
                                            "node": "position-service"
                                        }
                                    }
                                },
                                "protocol": "HTTPS"
                            },
                            {
                                "unique-id": "web-gui-uses-position-service-for-trade-queries",
                                "description": "Load trades for account.",
                                "relationship-type": {
                                    "connects": {
                                        "source": {
                                            "node": "web-gui-process"
                                        },
                                        "destination": {
                                            "node": "position-service"
                                        }
                                    }
                                },
                                "protocol": "HTTPS"
                            },
                            {
                                "unique-id": "position-service-uses-traderx-db-for-positions",
                                "description": "Looks up default positions for a given account.",
                                "relationship-type": {
                                    "connects": {
                                        "source": {
                                            "node": "position-service"
                                        },
                                        "destination": {
                                            "node": "traderx-db"
                                        }
                                    }
                                },
                                "protocol": "JDBC"
                            },
                            {
                                "unique-id": "position-service-uses-traderx-db-for-trades",
                                "description": "Looks up all trades for a given account.",
                                "relationship-type": {
                                    "connects": {
                                        "source": {
                                            "node": "position-service"
                                        },
                                        "destination": {
                                            "node": "traderx-db"
                                        }
                                    }
                                },
                                "protocol": "JDBC"
                            },
                            {
                                "unique-id": "traderx-system-is-deployed-in-internal-bank-network",
                                "relationship-type": {
                                    "deployed-in": {
                                        "container": "internal-bank-network",
                                        "nodes": [
                                            "traderx-system"
                                        ]
                                    }
                                }
                            },
                            {
                                "unique-id": "traderx-system-is-composed-of",
                                "relationship-type": {
                                    "composed-of": {
                                        "container": "traderx-system",
                                        "nodes": [
                                            "web-client",
                                            "web-gui-process",
                                            "position-service",
                                            "traderx-db",
                                            "people-service",
                                            "reference-data-service",
                                            "trading-services",
                                            "trade-feed",
                                            "trade-processor",
                                            "accounts-service"
                                        ]
                                    }
                                }
                            },
                            {
                                "unique-id": "traderx-system-components-are-deployed-in-internal-bank-network",
                                "relationship-type": {
                                    "deployed-in": {
                                        "container": "internal-bank-network",
                                        "nodes": [
                                            "web-client",
                                            "web-gui-process",
                                            "position-service",
                                            "traderx-db",
                                            "people-service",
                                            "reference-data-service",
                                            "trading-services",
                                            "trade-feed",
                                            "trade-processor",
                                            "accounts-service",
                                            "user-directory"
                                        ]
                                    }
                                }
                            },
                            {
                                "unique-id": "web-gui-process-uses-reference-data-service",
                                "description": "Looks up securities to assist with creating a trade ticket.",
                                "relationship-type": {
                                    "connects": {
                                        "source": {
                                            "node": "web-gui-process"
                                        },
                                        "destination": {
                                            "node": "reference-data-service"
                                        }
                                    }
                                },
                                "protocol": "HTTPS"
                            },
                            {
                                "unique-id": "web-gui-process-uses-trading-services",
                                "description": "Creates new trades and cancels existing trades.",
                                "relationship-type": {
                                    "connects": {
                                        "source": {
                                            "node": "web-gui-process"
                                        },
                                        "destination": {
                                            "node": "trading-services"
                                        }
                                    }
                                },
                                "protocol": "HTTPS"
                            },
                            {
                                "unique-id": "web-gui-process-uses-trade-feed",
                                "description": "Subscribes to trade/position updates feed for currently viewed account.",
                                "relationship-type": {
                                    "connects": {
                                        "source": {
                                            "node": "web-gui-process"
                                        },
                                        "destination": {
                                            "node": "trade-feed"
                                        }
                                    }
                                },
                                "protocol": "WebSocket"
                            },
                            {
                                "unique-id": "trade-processor-connects-to-trade-feed",
                                "description": "Processes incoming trade requests, persist and publish updates.",
                                "relationship-type": {
                                    "connects": {
                                        "source": {
                                            "node": "trade-processor"
                                        },
                                        "destination": {
                                            "node": "trade-feed"
                                        }
                                    }
                                },
                                "protocol": "SocketIO"
                            },
                            {
                                "unique-id": "trade-processor-connects-to-traderx-db",
                                "description": "Looks up current positions when bootstrapping state, persist trade state and position state.",
                                "relationship-type": {
                                    "connects": {
                                        "source": {
                                            "node": "trade-processor"
                                        },
                                        "destination": {
                                            "node": "traderx-db"
                                        }
                                    }
                                },
                                "protocol": "JDBC"
                            },
                            {
                                "unique-id": "web-gui-process-uses-accounts-service",
                                "description": "Creates/Updates accounts. Gets list of accounts.",
                                "relationship-type": {
                                    "connects": {
                                        "source": {
                                            "node": "web-gui-process"
                                        },
                                        "destination": {
                                            "node": "accounts-service"
                                        }
                                    }
                                },
                                "protocol": "HTTPS"
                            },
                            {
                                "unique-id": "web-gui-process-uses-people-service",
                                "description": "Looks up people data based on typeahead from GUI.",
                                "relationship-type": {
                                    "connects": {
                                        "source": {
                                            "node": "web-gui-process"
                                        },
                                        "destination": {
                                            "node": "people-service"
                                        }
                                    }
                                },
                                "protocol": "HTTPS"
                            },
                            {
                                "unique-id": "people-service-connects-to-user-directory",
                                "description": "Looks up people data.",
                                "relationship-type": {
                                    "connects": {
                                        "source": {
                                            "node": "people-service"
                                        },
                                        "destination": {
                                            "node": "user-directory"
                                        }
                                    }
                                },
                                "protocol": "LDAP"
                            },
                            {
                                "unique-id": "trading-services-connects-to-reference-data-service",
                                "description": "Validates securities when creating trades.",
                                "relationship-type": {
                                    "connects": {
                                        "source": {
                                            "node": "trading-services"
                                        },
                                        "destination": {
                                            "node": "reference-data-service"
                                        }
                                    }
                                },
                                "protocol": "HTTPS"
                            },
                            {
                                "unique-id": "trading-services-uses-trade-feed",
                                "description": "Publishes updates to trades and positions after persisting in the DB.",
                                "relationship-type": {
                                    "connects": {
                                        "source": {
                                            "node": "trading-services"
                                        },
                                        "destination": {
                                            "node": "trade-feed"
                                        }
                                    }
                                },
                                "protocol": "HTTPS"
                            },
                            {
                                "unique-id": "trading-services-uses-account-service",
                                "description": "Validates accounts when creating trades.",
                                "relationship-type": {
                                    "connects": {
                                        "source": {
                                            "node": "trading-services"
                                        },
                                        "destination": {
                                            "node": "accounts-service"
                                        }
                                    }
                                },
                                "protocol": "HTTPS"
                            },
                            {
                                "unique-id": "accounts-service-uses-traderx-db-for-accounts",
                                "description": "CRUD operations on account",
                                "relationship-type": {
                                    "connects": {
                                        "source": {
                                            "node": "accounts-service"
                                        },
                                        "destination": {
                                            "node": "traderx-db"
                                        }
                                    }
                                },
                                "protocol": "JDBC"
                            }
                        ]
                    }
                }
            }]
        },
        {
            namespace: "ai-governance-v2",
            architectures: [{
                architectureId: NumberInt(2),
                name: "mcp-api-pipeline",
                description: "User → MCP Server (cloud-hosted) → API Service → Database. FINOS AIR AI Governance controls applied directly on nodes and relationships.",
                versions: {
                    "1-0-0": {
                        "$schema": "https://calm.finos.org/draft/2025-03/meta/calm.json",
                        "unique-id": "mcp-api-pipeline",
                        "name": "MCP Server API Pipeline",
                        "description": "User → MCP Server (cloud-hosted) → API Service → Database. FINOS AIR AI Governance controls applied directly on nodes and relationships.",
                        "nodes": [
                            {
                                "unique-id": "user",
                                "name": "User",
                                "description": "Human end-user interacting with the MCP Server via a client application.",
                                "node-type": "actor",
                                "interfaces": [
                                    {
                                        "unique-id": "user-interface",
                                        "name": "User Client Interface"
                                    }
                                ],
                                "controls": [
                                    {
                                        "control-requirement": {
                                            "$ref": "/calm/domains/ai-governance/controls/12/versions/1-0-0"
                                        },
                                        "control-id": "AIR-OP-020",
                                        "name": "Reputational Risk",
                                        "description": "The User receives all AI-generated outputs. Content filtering, output moderation, and AI disclosure must be applied to prevent harmful or misleading content reaching users at scale.",
                                        "requirements": [
                                            "Implement output content filtering before responses are returned to the User.",
                                            "Display AI disclosure notices to the User at session start.",
                                            "Monitor user feedback channels for harm signals from AI outputs.",
                                            "Establish an AI incident response and user remediation process."
                                        ]
                                    },
                                    {
                                        "control-requirement": {
                                            "$ref": "/calm/domains/ai-governance/controls/9/versions/1-0-0"
                                        },
                                        "control-id": "AIR-OP-017",
                                        "name": "Lack of Explainability",
                                        "description": "Users receiving AI-generated responses must be able to understand the basis of outputs, particularly for high-stakes decisions. Source citations and rationale must be surfaced in the User interface.",
                                        "requirements": [
                                            "Surface citations and source document references in all AI-generated responses shown to the User.",
                                            "Provide human-readable rationales for AI recommendations in the User interface.",
                                            "Enable Users to escalate any AI-generated decision to a human agent."
                                        ]
                                    }
                                ]
                            },
                            {
                                "unique-id": "mcp-server",
                                "name": "MCP Server",
                                "description": "Cloud-hosted Model Context Protocol server. Orchestrates LLM interactions, manages tool calls, and proxies requests to the API Service.",
                                "node-type": "service",
                                "deployment-type": "cloud",
                                "interfaces": [
                                    {
                                        "unique-id": "mcp-server-ingress",
                                        "name": "MCP Server Ingress",
                                        "protocol": "HTTPS",
                                        "port": 443
                                    },
                                    {
                                        "unique-id": "mcp-server-egress",
                                        "name": "MCP Server API Egress",
                                        "protocol": "HTTPS",
                                        "port": 443
                                    }
                                ],
                                "controls": [
                                    {
                                        "control-requirement": {
                                            "$ref": "/calm/domains/ai-governance/controls/15/versions/1-0-0"
                                        },
                                        "control-id": "AIR-SEC-010",
                                        "name": "Prompt Injection",
                                        "description": "The MCP Server ingress is the primary prompt injection attack surface. All user inputs must be validated and sanitised before passing to the LLM or downstream services.",
                                        "requirements": [
                                            "Deploy an AI firewall at the MCP Server ingress to detect and block prompt injection patterns.",
                                            "Sanitise all user-supplied content before inclusion in LLM prompts.",
                                            "Enforce strict system-prompt hierarchy so user messages cannot override system-level instructions.",
                                            "Monitor MCP Server outputs for data exfiltration patterns or instruction-echoing.",
                                            "Conduct regular red-team exercises targeting the MCP Server prompt injection surface."
                                        ]
                                    },
                                    {
                                        "control-requirement": {
                                            "$ref": "/calm/domains/ai-governance/controls/3/versions/1-0-0"
                                        },
                                        "control-id": "AIR-OP-004",
                                        "name": "Hallucination and Inaccurate Outputs",
                                        "description": "The MCP Server is where LLM inference occurs. RAG grounding, output validation, and human-review gates must be applied before responses reach the User.",
                                        "requirements": [
                                            "Implement RAG grounding using verified data sourced from the API Service.",
                                            "Apply output validation pipelines to MCP Server responses before delivery to the User.",
                                            "Route high-stakes outputs through a human-review queue prior to delivery.",
                                            "Log and monitor hallucination incidents by frequency and business impact."
                                        ]
                                    },
                                    {
                                        "control-requirement": {
                                            "$ref": "/calm/domains/ai-governance/controls/4/versions/1-0-0"
                                        },
                                        "control-id": "AIR-OP-005",
                                        "name": "Foundation Model Versioning",
                                        "description": "The MCP Server integrates foundation models whose provider-side updates can cause silent behavioural changes propagating through the entire pipeline.",
                                        "requirements": [
                                            "Pin foundation model versions; only upgrade after regression testing and sign-off.",
                                            "Maintain a model version registry covering all models used by the MCP Server.",
                                            "Obtain advance notification of model changes from providers via contractual obligation.",
                                            "Implement automated regression test suites triggered by model version changes.",
                                            "Define and test rollback procedures to prior pinned model versions."
                                        ]
                                    },
                                    {
                                        "control-requirement": {
                                            "$ref": "/calm/domains/ai-governance/controls/6/versions/1-0-0"
                                        },
                                        "control-id": "AIR-OP-007",
                                        "name": "Availability of Foundational Model",
                                        "description": "The MCP Server depends on GPU-backed third-party model infrastructure. Denial of Wallet attacks, TSP outages, and token exhaustion can render the MCP Server unavailable.",
                                        "requirements": [
                                            "Implement API rate limiting and token budget controls at the MCP Server.",
                                            "Define SLAs with model providers and monitor compliance.",
                                            "Design failover strategies including fallback to alternative model providers.",
                                            "Apply prompt length controls and chunking strategies to prevent token exhaustion."
                                        ]
                                    },
                                    {
                                        "control-requirement": {
                                            "$ref": "/calm/domains/ai-governance/controls/16/versions/1-0-0"
                                        },
                                        "control-id": "AIR-SEC-024",
                                        "name": "Agent Action Authorization Bypass",
                                        "description": "The MCP Server acts as an AI agent invoking tools and calling the API Service. Injected instructions could trigger unauthorised operations without strict authorisation controls.",
                                        "requirements": [
                                            "Assign the MCP Server least-privilege permissions scoped to required tools and operations only.",
                                            "Implement human-in-the-loop approval gates for irreversible or high-risk API actions.",
                                            "Validate all MCP-to-API requests against an authorised action policy before execution.",
                                            "Log all MCP-originated actions with full user context and authorisation decision."
                                        ]
                                    },
                                    {
                                        "control-requirement": {
                                            "$ref": "/calm/domains/ai-governance/controls/7/versions/1-0-0"
                                        },
                                        "control-id": "AIR-OP-014",
                                        "name": "Inadequate System Alignment",
                                        "description": "MCP Server responses must remain aligned with the system's intended scope. Misalignment can cause scope boundary violations and regulatory exposure.",
                                        "requirements": [
                                            "Define the authorised scope of the MCP Server via system prompt guardrails.",
                                            "Implement continuous alignment monitoring against golden evaluation datasets.",
                                            "Perform prompt injection testing on all content retrieved and injected into prompts.",
                                            "Implement alignment drift detection to trigger re-evaluation when quality degrades."
                                        ]
                                    },
                                    {
                                        "control-requirement": {
                                            "$ref": "/calm/domains/ai-governance/controls/8/versions/1-0-0"
                                        },
                                        "control-id": "AIR-OP-016",
                                        "name": "Bias and Discrimination",
                                        "description": "LLM outputs generated by the MCP Server may reflect training data biases, producing discriminatory responses to users.",
                                        "requirements": [
                                            "Conduct bias audits on MCP Server outputs prior to production launch and at regular intervals.",
                                            "Test for disparate impact across protected user characteristics.",
                                            "Establish a bias incident response process including user remediation procedures."
                                        ]
                                    },
                                    {
                                        "control-requirement": {
                                            "$ref": "/calm/domains/ai-governance/controls/18/versions/1-0-0"
                                        },
                                        "control-id": "AIR-RC-023",
                                        "name": "Intellectual Property and Copyright",
                                        "description": "The MCP Server LLM may reproduce copyrighted content from training data in its outputs.",
                                        "requirements": [
                                            "Implement output filters to detect and suppress reproduction of copyrighted material.",
                                            "Ensure model provider contracts include IP indemnification clauses.",
                                            "Train operators on IP risks associated with AI-generated content."
                                        ]
                                    }
                                ]
                            },
                            {
                                "unique-id": "api-service",
                                "name": "API Service",
                                "description": "Backend REST API service that processes requests from the MCP Server, applies business logic, and reads/writes data to the Database.",
                                "node-type": "service",
                                "deployment-type": "cloud",
                                "interfaces": [
                                    {
                                        "unique-id": "api-service-ingress",
                                        "name": "API Service Ingress",
                                        "protocol": "HTTPS",
                                        "port": 443
                                    },
                                    {
                                        "unique-id": "api-service-db-egress",
                                        "name": "API Service Database Egress",
                                        "protocol": "TCP",
                                        "port": 5432
                                    }
                                ],
                                "controls": [
                                    {
                                        "control-requirement": {
                                            "$ref": "/calm/domains/ai-governance/controls/17/versions/1-0-0"
                                        },
                                        "control-id": "AIR-RC-022",
                                        "name": "Regulatory Compliance and Oversight",
                                        "description": "The API Service is the enforcement point for regulatory business rules. It must maintain audit trails and support regulatory examination of AI-assisted decisions.",
                                        "requirements": [
                                            "Maintain an audit log of all MCP Server-originated requests and API Service responses.",
                                            "Enforce data classification and handling policies at the API Service layer.",
                                            "Produce decision records for all AI-assisted actions routed through the API Service.",
                                            "Retain request/response logs for the required regulatory retention period."
                                        ]
                                    },
                                    {
                                        "control-requirement": {
                                            "$ref": "/calm/domains/ai-governance/controls/11/versions/1-0-0"
                                        },
                                        "control-id": "AIR-OP-019",
                                        "name": "Data Quality and Drift",
                                        "description": "The API Service is the data supply layer for the MCP Server RAG pipeline. Data quality issues or staleness here directly degrade AI output accuracy.",
                                        "requirements": [
                                            "Implement automated data quality checks (accuracy, completeness, timeliness) at the API Service ingestion layer.",
                                            "Monitor statistical properties of data served to the MCP Server to detect drift.",
                                            "Define data freshness SLAs per use case and enforce scheduled refresh cycles.",
                                            "Maintain data lineage records to support auditability of AI model inputs."
                                        ]
                                    },
                                    {
                                        "control-requirement": {
                                            "$ref": "/calm/domains/ai-governance/controls/10/versions/1-0-0"
                                        },
                                        "control-id": "AIR-OP-018",
                                        "name": "Model Overreach / Expanded Use",
                                        "description": "The API Service must enforce scope boundaries, rejecting MCP Server requests that exceed the AI system's authorised use cases.",
                                        "requirements": [
                                            "Validate all incoming MCP Server requests against an approved API action register.",
                                            "Reject API calls corresponding to unauthorised or out-of-scope AI operations.",
                                            "Log all scope boundary violations for review by the AI governance function."
                                        ]
                                    }
                                ]
                            },
                            {
                                "unique-id": "database",
                                "name": "Database",
                                "description": "Persistent data store (relational and/or vector store for RAG) used by the API Service.",
                                "node-type": "datastore",
                                "deployment-type": "cloud",
                                "interfaces": [
                                    {
                                        "unique-id": "database-ingress",
                                        "name": "Database Ingress",
                                        "protocol": "TCP",
                                        "port": 5432
                                    }
                                ],
                                "controls": [
                                    {
                                        "control-requirement": {
                                            "$ref": "/calm/domains/ai-governance/controls/14/versions/1-0-0"
                                        },
                                        "control-id": "AIR-SEC-002",
                                        "name": "Information Leaked to Vector Store",
                                        "description": "The Database may function as a vector store for the RAG pipeline. Embeddings can expose sensitive data via inversion or inference attacks without proper security controls.",
                                        "requirements": [
                                            "Enforce RBAC on the Database, scoping retrieval to the requesting user's authorisation.",
                                            "Encrypt all data at rest using AES-256 or equivalent approved standard.",
                                            "Implement comprehensive audit logging for all database queries.",
                                            "Classify all stored data and enforce classification-based retrieval policies.",
                                            "Conduct penetration testing targeting embedding inversion and membership inference attacks."
                                        ]
                                    },
                                    {
                                        "control-requirement": {
                                            "$ref": "/calm/domains/ai-governance/controls/11/versions/1-0-0"
                                        },
                                        "control-id": "AIR-OP-019",
                                        "name": "Data Quality and Drift",
                                        "description": "The Database is the authoritative source of inference data for the RAG pipeline. Poor quality or stale data stored here propagates directly into AI outputs.",
                                        "requirements": [
                                            "Enforce data quality standards at write time including schema validation and completeness checks.",
                                            "Implement scheduled data freshness reviews and automated stale-data flagging.",
                                            "Maintain data lineage metadata for all records used in AI inference pipelines."
                                        ]
                                    }
                                ]
                            }
                        ],
                        "relationships": [
                            {
                                "unique-id": "user-to-mcp",
                                "name": "User to MCP Server",
                                "description": "User sends prompts and receives AI-generated responses via the MCP Server over HTTPS.",
                                "relationship-type": {
                                    "connects": {
                                        "source": {
                                            "node": "user",
                                            "interface": "user-interface"
                                        },
                                        "destination": {
                                            "node": "mcp-server",
                                            "interface": "mcp-server-ingress"
                                        }
                                    }
                                },
                                "protocol": "HTTPS",
                                "controls": [
                                    {
                                        "control-requirement": {
                                            "$ref": "/calm/domains/ai-governance/controls/15/versions/1-0-0"
                                        },
                                        "control-id": "AIR-SEC-010",
                                        "name": "Prompt Injection",
                                        "description": "This channel carries untrusted user input directly into the AI system — the highest-risk prompt injection vector. Input must be validated and firewall-inspected before any content reaches the LLM.",
                                        "requirements": [
                                            "Enforce TLS 1.2+ on the User-to-MCP channel.",
                                            "Apply AI firewall inspection on all user messages before LLM processing.",
                                            "Rate-limit user requests to prevent flooding or token-exhaustion attacks.",
                                            "Authenticate and authorise all user sessions before granting MCP Server access."
                                        ]
                                    },
                                    {
                                        "control-requirement": {
                                            "$ref": "/calm/domains/ai-governance/controls/13/versions/1-0-0"
                                        },
                                        "control-id": "AIR-OP-028",
                                        "name": "Multi-Agent Trust Boundary Violations",
                                        "description": "The User-to-MCP boundary is an external trust boundary. The MCP Server must treat all inbound user messages as untrusted and enforce strict session isolation.",
                                        "requirements": [
                                            "Treat all user-supplied input as untrusted at the MCP Server ingress.",
                                            "Enforce strict context isolation so one user's session cannot influence another's agent context.",
                                            "Implement session-level sandboxing to limit blast radius of any injected instruction."
                                        ]
                                    }
                                ]
                            },
                            {
                                "unique-id": "mcp-to-api",
                                "name": "MCP Server to API Service",
                                "description": "MCP Server makes authenticated API calls to the API Service to fulfil tool calls and retrieve data for RAG grounding.",
                                "relationship-type": {
                                    "connects": {
                                        "source": {
                                            "node": "mcp-server",
                                            "interface": "mcp-server-egress"
                                        },
                                        "destination": {
                                            "node": "api-service",
                                            "interface": "api-service-ingress"
                                        }
                                    }
                                },
                                "protocol": "HTTPS",
                                "controls": [
                                    {
                                        "control-requirement": {
                                            "$ref": "/calm/domains/ai-governance/controls/16/versions/1-0-0"
                                        },
                                        "control-id": "AIR-SEC-024",
                                        "name": "Agent Action Authorization Bypass",
                                        "description": "This channel carries AI agent tool calls from the MCP Server to the API Service. Injected instructions could invoke unauthorised operations without enforcement here.",
                                        "requirements": [
                                            "Authenticate all MCP Server requests to the API Service using short-lived scoped credentials (mTLS or signed tokens).",
                                            "Enforce least-privilege: MCP Server credentials must only permit specifically required API operations.",
                                            "The API Service must validate each inbound request against the authorised action policy before execution.",
                                            "Require human approval for high-risk or irreversible API operations triggered via the MCP Server.",
                                            "Log all calls on this channel with full request context and authorisation outcome."
                                        ]
                                    },
                                    {
                                        "control-requirement": {
                                            "$ref": "/calm/domains/ai-governance/controls/13/versions/1-0-0"
                                        },
                                        "control-id": "AIR-OP-028",
                                        "name": "Multi-Agent Trust Boundary Violations",
                                        "description": "This channel crosses the internal trust boundary between AI orchestration (MCP Server) and the data/logic layer (API Service). MCP Server compromise must not propagate unchecked into the API Service.",
                                        "requirements": [
                                            "Enforce mutual TLS (mTLS) on the MCP-to-API channel.",
                                            "The API Service must independently validate request authorisation — not blindly trust MCP Server-supplied context.",
                                            "Implement circuit breakers to halt MCP Server API calls during detected anomalies or security incidents."
                                        ]
                                    }
                                ]
                            },
                            {
                                "unique-id": "api-to-db",
                                "name": "API Service to Database",
                                "description": "API Service reads and writes data to the Database using an authenticated, encrypted database connection.",
                                "relationship-type": {
                                    "connects": {
                                        "source": {
                                            "node": "api-service",
                                            "interface": "api-service-db-egress"
                                        },
                                        "destination": {
                                            "node": "database",
                                            "interface": "database-ingress"
                                        }
                                    }
                                },
                                "protocol": "TCP",
                                "controls": [
                                    {
                                        "control-requirement": {
                                            "$ref": "/calm/domains/ai-governance/controls/14/versions/1-0-0"
                                        },
                                        "control-id": "AIR-SEC-002",
                                        "name": "Information Leaked to Vector Store",
                                        "description": "This channel carries sensitive embedding queries and raw data between the API Service and the Database. Data in transit must be encrypted and access strictly scoped.",
                                        "requirements": [
                                            "Enforce TLS encryption on the API Service-to-Database connection.",
                                            "Use parameterised queries to prevent SQL and vector injection attacks.",
                                            "Scope database credentials to the minimum required tables and operations.",
                                            "Propagate and audit user context on all data retrieval operations on this channel."
                                        ]
                                    },
                                    {
                                        "control-requirement": {
                                            "$ref": "/calm/domains/ai-governance/controls/11/versions/1-0-0"
                                        },
                                        "control-id": "AIR-OP-019",
                                        "name": "Data Quality and Drift",
                                        "description": "Data flowing from the Database through this channel feeds the MCP Server RAG pipeline. Stale or degraded data directly impacts AI output accuracy.",
                                        "requirements": [
                                            "Implement query-time data freshness checks before returning data to the API Service.",
                                            "Filter records failing quality thresholds before inclusion in RAG context.",
                                            "Monitor query patterns for anomalies indicating data drift or unexpected schema changes."
                                        ]
                                    }
                                ]
                            }
                        ]
                    }
                }
            }]
        }
    ]);
    logSuccess("Initialized architectures for finos, workshop, traderx and ai-governance-v2 namespaces");
} else {
    logSkip("Architectures already initialized, skipping...");
}

logSection("User Access");
if (db.userAccess.countDocuments() === 0) {
    db.userAccess.insertMany([
        {
            "userAccessId": NumberInt(1),
            "username": "demo_admin",
            "permission": "write",
            "namespace": "finos",
            "resourceType": "all"
        },
        {
            "userAccessId": NumberInt(2),
            "username": "demo_admin",
            "permission": "write",
            "namespace": "workshop",
            "resourceType": "patterns"
        },
        {
            "userAccessId": NumberInt(3),
            "username": "demo_admin",
            "permission": "read",
            "namespace": "traderx",
            "resourceType": "all"
        },
        {
            "userAccessId": NumberInt(4),
            "username": "demo",
            "permission": "read",
            "namespace": "finos",
            "resourceType": "all"
        },
        {
            "userAccessId": NumberInt(5),
            "username": "demo",
            "permission": "read",
            "namespace": "traderx",
            "resourceType": "all"
        },
        {
            "userAccessId": NumberInt(6),
            "username": "demo",
            "permission": "read",
            "namespace": "workshop",
            "resourceType": "all"
        }
    ]);
    logSuccess("Initialized user access for demo_admin and demo users");
} else {
    logSkip("User access already initialized, skipping...");
}

logSection("ADRs");
if (db.adrs.countDocuments() === 0) {
    db.adrs.insertMany([
        {
            namespace: 'finos',
            adrs: [
                {
                    adrId: NumberInt(1),
                    revisions: {
                        1: {
                            title: 'Example ADR',
                            status: 'draft',
                            creationDateTime: [2025, 4, 29, 12, 44, 25, 465265627],
                            updateDateTime: [2025, 5, 29, 12, 10, 0, 465338085],
                            contextAndProblemStatement: `**Lorem ipsum dolor sit amet** , consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat. Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur. Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum.  \
    Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat.  
    Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat *nulla pariatur* 

    Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum.
        
    ![An Example Flowchart Image](https://s3-eu-west-1.amazonaws.com/arisexpress/info_site/flowchart.png "an example flowchart image")

    Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat.  \n  \nLorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.
                            `,
                            decisionDrivers: [
                                'Lorem ipsum dolor sit amet.',
                                'Consectetur adipiscing elit.',
                                'Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.',
                            ],
                            consideredOptions: [
                                {
                                    name: 'Making a table to display the considered options',
                                    description: `Lorem ipsum dolor sit amet, **consectetur adipiscing elit**, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. 
    Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex *ea commodo consequat*. Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur.`,
                                    positiveConsequences: [
                                        'Is compact',
                                        'Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor',
                                    ],
                                    negativeConsequences: [
                                        'Very little reusable code',
                                        'Have to set the border of each cell',
                                        'Both the positive and negative consequesnces are both lists so this will not display nicely',
                                    ],
                                },
                                {
                                    name: 'Using a collapsible list to display the considered options',
                                    description:
                                        'Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat.',
                                    positiveConsequences: [
                                        'Looks much better than current design',
                                        'Screen will look less cluttered',
                                    ],
                                    negativeConsequences: [
                                        'Daisy UI will not play ball',
                                    ],
                                },
                            ],
                            decisionOutcome: {
                                chosenOption: {
                                    name: 'Using a collapsible list  to display the considered options',
                                    description:
                                        'Lorem ipsum dolor sit amet, **consectetur adipiscing elit, sed do eiusmod tempor incididunt** ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat.Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat.',
                                    positiveConsequences: [
                                        'Looks much better than current design',
                                        'Screen will look less cluttered',
                                    ],
                                    negativeConsequences: [
                                        'Daisy UI will not play ball',
                                    ],
                                },
                                rationale:
                                    'It looks much nicer than the current design and allows users to collapse and exand options at will',
                            },
                            links: [
                                { rel: 'Daisy UI', href: 'http://my-link.com' },
                                {
                                    rel: 'Suggested table design',
                                    href: 'http://my-link.com',
                                },
                            ],
                        },
                    },
                },
            ],
        },
        {
            namespace: 'workshop',
            adrs: [
                {
                    adrId: NumberInt(1),
                    revisions: {
                        1: {
                            title: 'Use Load Balancer for Traffic Distribution',
                            status: 'accepted',
                            creationDateTime: [2025, 3, 15, 10, 30, 0, 0],
                            updateDateTime: [2025, 3, 20, 14, 0, 0, 0],
                            contextAndProblemStatement: 'The conference signup system needs to handle variable traffic loads during registration periods. We need a strategy to distribute incoming requests across multiple service instances to ensure availability and performance.',
                            decisionDrivers: [
                                'High availability during peak registration periods',
                                'Horizontal scalability of the attendees service',
                                'Even distribution of load across service instances',
                            ],
                            consideredOptions: [
                                {
                                    name: 'DNS Round Robin',
                                    description: 'Use DNS-based load balancing to distribute traffic across service instances.',
                                    positiveConsequences: ['Simple to configure', 'No additional infrastructure required'],
                                    negativeConsequences: ['No health checking', 'Uneven distribution with caching'],
                                },
                                {
                                    name: 'Dedicated Load Balancer',
                                    description: 'Deploy a dedicated load balancer (e.g. NGINX, HAProxy) in front of service instances.',
                                    positiveConsequences: ['Health checking and automatic failover', 'Even traffic distribution', 'SSL termination'],
                                    negativeConsequences: ['Additional infrastructure component', 'Requires configuration management'],
                                },
                            ],
                            decisionOutcome: {
                                chosenOption: {
                                    name: 'Dedicated Load Balancer',
                                    description: 'Deploy a dedicated load balancer in front of the attendees service for health-aware traffic distribution.',
                                    positiveConsequences: ['Health checking and automatic failover', 'Even traffic distribution', 'SSL termination'],
                                    negativeConsequences: ['Additional infrastructure component', 'Requires configuration management'],
                                },
                                rationale: 'A dedicated load balancer provides health checking and automatic failover which are critical for ensuring availability during peak conference registration periods.',
                            },
                            links: [
                                { rel: 'Conference Signup Architecture', href: '/calm/namespaces/workshop/architectures/1/versions/1-0-0' },
                            ],
                        },
                    },
                },
            ],
        },
    ]);
    logSuccess("Initialized ADRs for finos and workshop namespaces");
} else {
    logSkip("ADRs already initialized, skipping...");
}

logSection("Decorators");
if (db.decorators.countDocuments() === 0) {
    db.decorators.insertMany([
        {
            namespace: "finos",
            decorators: [
                {
                    decoratorId: NumberInt(1),
                    decorator: {
                        "$schema": "https://calm.finos.org/draft/2026-03/standards/deployment/deployment.decorator.schema.json",
                        "unique-id": "finos-architecture-1-deployment",
                        "type": "deployment",
                        "target": [
                            "/calm/namespaces/finos/architectures/1/versions/1-0-0"
                        ],
                        "target-type": [
                            "architecture"
                        ],
                        "applies-to": [
                            "example-node"
                        ],
                        "data": {
                            "start-time": "2026-02-23T10:00:00Z",
                            "end-time": "2026-02-23T10:05:30Z",
                            "status": "completed",
                            "observability": "https://grafana.example.com/d/finos-architecture-1",
                            "deployment-url": "https://jenkins.example.com/job/finos-architecture/123/",
                            "notes": "Production deployment of FINOS Architecture 1 with baseline configuration"
                        }
                    }
                },
                {
                    decoratorId: NumberInt(2),
                    decorator: {
                        "$schema": "https://calm.finos.org/draft/2026-03/standards/deployment/deployment.decorator.schema.json",
                        "unique-id": "finos-architecture-1-deployment-v2",
                        "type": "deployment",
                        "target": [
                            "/calm/namespaces/finos/architectures/1/versions/1-0-0"
                        ],
                        "target-type": [
                            "architecture"
                        ],
                        "applies-to": [
                            "example-node"
                        ],
                        "data": {
                            "start-time": "2026-03-04T15:00:00Z",
                            "end-time": "2026-03-04T15:08:15Z",
                            "status": "failed",
                            "notes": "Second production deployment failed during canary rollout because of a configuration regression"
                        }
                    }
                },
                {
                    decoratorId: NumberInt(3),
                    decorator: {
                        "$schema": "https://calm.finos.org/draft/2026-03/standards/deployment/deployment.decorator.schema.json",
                        "unique-id": "finos-architecture-1-deployment-v3",
                        "type": "deployment",
                        "target": [
                            "/calm/namespaces/finos/architectures/1/versions/1-0-0"
                        ],
                        "target-type": [
                            "architecture"
                        ],
                        "applies-to": [
                            "example-node"
                        ],
                        "data": {
                            "start-time": "2026-03-10T11:20:00Z",
                            "status": "in-progress",
                            "helm-chart-version": "finos-architecture-service-2.4.1",
                            "namespace": "finos-prod-core",
                            "deployment-url": "https://argocd.example.com/applications/finos-architecture",
                            "notes": "Third production deployment is currently rolling out with updated Helm chart values"
                        }
                    }
                },
                {
                    decoratorId: NumberInt(4),
                    decorator: {
                        "$schema": "https://calm.finos.org/draft/2026-03/standards/deployment/deployment.decorator.schema.json",
                        "unique-id": "finos-pattern-1-deployment",
                        "type": "deployment",
                        "target": [
                            "/calm/namespaces/finos/patterns/1/versions/1-0-0"
                        ],
                        "target-type": [
                            "pattern"
                        ],
                        "applies-to": [
                            "node-a", "relationship-x"
                        ],
                        "data": {
                            "start-time": "2026-02-15T09:30:00Z",
                            "end-time": "2026-02-15T09:35:20Z",
                            "status": "completed",
                            "deployment-url": "https://github.com/finos/actions/runs/987654321",
                            "notes": "Pattern deployment via GitHub Actions"
                        }
                    }
                }
            ]
        },
        {
            namespace: "workshop",
            decorators: [
                {
                    decoratorId: NumberInt(1),
                    decorator: {
                        "$schema": "https://calm.finos.org/draft/2026-03/standards/deployment/deployment.decorator.schema.json",
                        "unique-id": "workshop-conference-deployment",
                        "type": "deployment",
                        "target": [
                            "/calm/namespaces/workshop/architectures/1/versions/1-0-0"
                        ],
                        "target-type": [
                            "architecture"
                        ],
                        "applies-to": [
                            "conference-website",
                            "load-balancer"
                        ],
                        "data": {
                            "start-time": "2026-03-01T14:30:00Z",
                            "end-time": "2026-03-01T14:35:45Z",
                            "status": "completed",
                            "deployment-url": "https://vercel.com/workshop/deployments/abc123xyz",
                            "notes": "Workshop conference system deployment via Vercel"
                        }
                    }
                },
                {
                    decoratorId: NumberInt(2),
                    decorator: {
                        "$schema": "https://calm.finos.org/draft/2026-03/standards/observability/observability.decorator.schema.json",
                        "unique-id": "workshop-conference-monitoring",
                        "type": "observability",
                        "target": [
                            "/calm/namespaces/workshop/architectures/1/versions/1-0-0"
                        ],
                        "target-type": [
                            "architecture"
                        ],
                        "applies-to": [
                            "conference-website"
                        ],
                        "data": {
                            "dashboard-url": "https://datadog.example.com/dashboard/workshop-conference",
                            "notes": "Monitoring dashboard for workshop conference system"
                        }
                    }
                }
            ]
        }
    ]);
    logSuccess("Initialized decorators for finos and workshop namespaces");
} else {
    logSkip("Decorators already initialized, skipping...");
}

logSection("Interfaces");
// Insert a sample Host Port interface for the finos namespace
if (db.interfaces.countDocuments() === 0) {
    db.interfaces.insertOne({
        namespace: "finos",
        interfaces: [
            {
                interfaceId: NumberInt(1),
                name: "Host Port Interface",
                description: "A standard host and port interface definition for network-accessible services",
                versions: {
                    "1-0-0": {
                        "$schema": "https://json-schema.org/draft/2020-12/schema",
                        "$id": "https://calm.finos.org/calm/namespaces/finos/interfaces/1/versions/1.0.0",
                        "title": "Host Port Interface",
                        "description": "Defines a host and port interface for network-accessible services",
                        "type": "object",
                        "properties": {
                            "unique-id": {
                                "type": "string"
                            },
                            "host": {
                                "type": "string",
                                "description": "The hostname or IP address of the service"
                            },
                            "port": {
                                "type": "integer",
                                "minimum": 1,
                                "maximum": 65535,
                                "description": "The port number the service listens on"
                            }
                        },
                        "required": [
                            "unique-id",
                            "host",
                            "port"
                        ]
                    },
                    "2-0-0": {
                        "$schema": "https://json-schema.org/draft/2020-12/schema",
                        "$id": "https://calm.finos.org/calm/namespaces/finos/interfaces/1/versions/2.0.0",
                        "title": "Host Port Interface",
                        "description": "Defines a host and port interface for network-accessible services, with optional protocol",
                        "type": "object",
                        "properties": {
                            "unique-id": {
                                "type": "string"
                            },
                            "host": {
                                "type": "string",
                                "description": "The hostname or IP address of the service"
                            },
                            "port": {
                                "type": "integer",
                                "minimum": 1,
                                "maximum": 65535,
                                "description": "The port number the service listens on"
                            },
                            "protocol": {
                                "type": "string",
                                "enum": ["HTTP", "HTTPS", "TCP", "UDP", "gRPC"],
                                "description": "The network protocol used by the service"
                            }
                        },
                        "required": [
                            "unique-id",
                            "host",
                            "port"
                        ]
                    }
                }
            }
        ]
    });
    logSuccess("Initialized interfaces for finos namespace");
} else {
    logSkip("Interfaces already initialized, skipping...");
}

logSection("Resource Mappings");
db.resource_mappings.createIndex({ namespace: 1, customId: 1 }, { unique: true });
db.resource_mappings.createIndex({ namespace: 1, resourceType: 1, numericId: 1 });
logSuccess("Created resource_mappings indexes");

if (db.resource_mappings.countDocuments() === 0) {
    db.resource_mappings.insertMany([
        { namespace: "finos", customId: "api-gateway-pattern", resourceType: "PATTERN", numericId: NumberInt(1) },
        { namespace: "finos", customId: "flow-1", resourceType: "FLOW", numericId: NumberInt(1) },
        { namespace: "finos", customId: "flow-2", resourceType: "FLOW", numericId: NumberInt(2) },
        { namespace: "finos", customId: "sample-architecture", resourceType: "ARCHITECTURE", numericId: NumberInt(1) },
        { namespace: "traderx", customId: "add-update-account", resourceType: "FLOW", numericId: NumberInt(1) },
        { namespace: "traderx", customId: "load-list-of-accounts", resourceType: "FLOW", numericId: NumberInt(2) },
        { namespace: "traderx", customId: "traderx", resourceType: "ARCHITECTURE", numericId: NumberInt(1) },
        { namespace: "workshop", customId: "conference-signup-pattern", resourceType: "PATTERN", numericId: NumberInt(1) },
        { namespace: "workshop", customId: "conference-secure-signup-pattern", resourceType: "PATTERN", numericId: NumberInt(2) },
        { namespace: "workshop", customId: "conference-signup-architecture", resourceType: "ARCHITECTURE", numericId: NumberInt(1) }
    ]);
    logSuccess("Initialized resource_mappings with seed data");
} else {
    logSkip("Resource mappings already exist, no initialization needed");
}

logSection("Initialization complete");
