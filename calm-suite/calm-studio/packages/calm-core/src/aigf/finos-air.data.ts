// SPDX-FileCopyrightText: 2026 CalmStudio Contributors
//
// SPDX-License-Identifier: Apache-2.0

/**
 * Bundled offline copy of the canonical FINOS AIGF guidance catalog
 * (finos-aigf/finos-air@0.2.0 on grc.store). Built-in guidance provider source.
 * Generated from the published GuidanceCatalog body; reconcile on version bumps.
 */
import type { GemaraGuidanceCatalog } from '../gemara/types.js';

export const FINOS_AIR: GemaraGuidanceCatalog = {
  "metadata": {
    "id": "finos-air",
    "title": "AI Governance Framework",
    "version": "0.2.0"
  },
  "guidelines": [
    {
      "id": "AIR-PREV-002",
      "title": "Data Filtering From External Knowledge Bases",
      "group": "PREV",
      "objective": "This control addresses the critical need to sanitize, filter, and appropriately  manage sensitive information when AI systems ingest data from internal knowledge  sources such as wikis, document management systems, databases, or collaboration  platforms (e.g., Confluence, SharePoint, internal websites). The primary objective  is to prevent the inadvertent exposure, leakage, or manipulation of confidential  organizational knowledge when this data is processed by AI models, converted into  embeddings for vector databases, or used in Retrieval Augmented Generation (RAG) systems. Given that many AI applications, particularly RAG systems, rely on internal knowledge bases to  provide contextually relevant and organization-specific responses, ensuring that sensitive  information within these sources is appropriately handled is paramount for maintaining  data confidentiality and preventing unauthorized access."
    },
    {
      "id": "AIR-PREV-003",
      "title": "User/App/Model Firewalling",
      "group": "PREV",
      "objective": "User/App/Model Firewalling encompasses the set of security controls applied at the boundaries between users, applications, AI models, and supporting data stores such as RAG databases. When internal company information is used to enrich a RAG database, especially if this involves processing by external services, this data and the external communication pathways must be carefully managed and secured. Any proprietary or sensitive information sent to an external service for such processing requires rigorous filtering before transmission to prevent data leakage."
    },
    {
      "id": "AIR-DET-001",
      "title": "AI Data Leakage Prevention and Detection",
      "group": "DET",
      "objective": "Data Leakage Prevention and Detection (DLP&D) for Artificial Intelligence (AI) systems encompasses a combination of proactive measures to prevent sensitive data from unauthorized egress or exposure through these systems, and detective measures to identify such incidents promptly if they occur. This control is critical for safeguarding various types of information associated with AI, including: Session Data: Information exchanged during interactions with AI models (e.g., user prompts, model responses, intermediate data); Training Data: Proprietary or sensitive datasets used to train or fine-tune AI models; Model Intellectual Property: The AI models themselves (weights, architecture) which represent significant intellectual property. This control applies to both internally developed AI systems and, crucially, to scenarios involving Third-Party Service Providers (TSPs) for LLM-powered services or raw model endpoints, where data may cross organizational boundaries."
    },
    {
      "id": "AIR-DET-004",
      "title": "AI System Observability",
      "group": "DET",
      "objective": "AI System Observability encompasses the comprehensive collection, analysis, and monitoring of data about AI system behavior, performance, interactions, and outcomes. This control is essential for maintaining operational awareness, detecting anomalies, ensuring performance standards, and supporting incident response for AI-driven applications and services within a financial institution. The goal is to provide deep visibility into all aspects of AI system operations—from user interactions and model behavior to resource utilization and security events—enabling proactive management, rapid issue resolution, and continuous improvement."
    },
    {
      "id": "AIR-PREV-005",
      "title": "System Acceptance Testing",
      "group": "PREV",
      "objective": "System Acceptance Testing (SAT) for AI systems is a crucial validation phase within a financial institution. Its primary goal is to confirm that a developed AI solution rigorously meets all agreed-upon business and user requirements, functions as intended from an end-user perspective, and is fit for its designated purpose before being deployed into any live operational environment. This testing focuses on the user's viewpoint and verifies the system's overall operational readiness, including its alignment with risk and compliance standards."
    },
    {
      "id": "AIR-PREV-006",
      "title": "Data Quality & Classification/Sensitivity",
      "group": "PREV",
      "objective": "The integrity, security, and effectiveness of any AI system deployed within a financial institution are fundamentally dependent on the quality and appropriate handling of the data it uses. This control establishes the necessity for robust processes to: Ensure Data Quality: Verify that data used for training, testing, and operating AI systems is accurate, complete, relevant, timely, and fit for its intended purpose; Implement Data Classification: Systematically categorize data based on its sensitivity (e.g., public, internal, confidential, restricted) to dictate appropriate security measures, access controls, and handling procedures throughout the AI lifecycle. Adherence to these practices is critical for building trustworthy AI, minimizing risks, and meeting regulatory obligations."
    },
    {
      "id": "AIR-PREV-007",
      "title": "Legal and Contractual Frameworks for AI Systems",
      "group": "PREV",
      "objective": "Robust legal and contractual agreements are essential for governing the development, procurement, deployment, and use of AI systems within a financial institution. This control ensures that comprehensive frameworks are established and maintained to manage risks, define responsibilities, protect data, and ensure compliance with legal and regulatory obligations when engaging with AI technology vendors, data providers, partners, and even in defining terms for end-users. These agreements must be thoroughly understood and actively managed to ensure adherence to all stipulated requirements."
    },
    {
      "id": "AIR-PREV-008",
      "title": "Quality of Service (QoS) and DDoS Prevention for AI Systems",
      "group": "PREV",
      "objective": "The increasing integration of Artificial Intelligence (AI) into financial applications, particularly through Generative AI, Retrieval Augmented Generation (RAG), and Agentic workflows, introduces significant operational risks. These include potential disruptions in service availability, degradation of performance, and inequities in service delivery. This control addresses the critical need to ensure Quality of Service (QoS) and implement robust Distributed Denial of Service (DDoS) prevention measures for AI systems. AI systems, especially those exposed via APIs or public interfaces, are susceptible to various attacks that can impact QoS. These include volumetric attacks (overwhelming the system with traffic), prompt flooding (sending a high volume of complex queries), and inference spam (repeated, resource-intensive model calls). Such activities can exhaust computational resources, induce unacceptable latency, or deny legitimate users access to critical AI-driven services. This control aims to maintain system resilience, ensure fair access, and protect against malicious attempts to disrupt AI operations."
    },
    {
      "id": "AIR-DET-009",
      "title": "AI System Alerting and Denial of Wallet (DoW) / Spend Monitoring",
      "group": "DET",
      "objective": "The consumption-based pricing models common in AI services (especially cloud-hosted Large Language Models and compute-intensive AI workloads) create unique financial and operational risks. \"Denial of Wallet\" (DoW) attacks specifically target these cost structures by attempting to exhaust an organization's AI service budgets through excessive resource consumption, potentially leading to service suspension, degraded performance, or unexpected financial impact. This control establishes comprehensive alerting and spend monitoring mechanisms to detect, prevent, and respond to both malicious and accidental overconsumption of AI resources, ensuring financial predictability and service availability."
    },
    {
      "id": "AIR-PREV-010",
      "title": "AI Model Version Pinning",
      "group": "PREV",
      "objective": "Model Version Pinning is the deliberate practice of selecting and using a specific, fixed version of an Artificial Intelligence (AI) model within a production environment, rather than automatically adopting the latest available version. This is particularly crucial when utilizing externally sourced models, such as foundation models provided by third-party vendors. The primary goal of model version pinning is to ensure operational stability, maintain predictable AI system behavior, and enable a controlled, risk-managed approach to adopting model updates. This practice helps prevent unexpected disruptions, performance degradation, or the introduction of new vulnerabilities that might arise from unvetted changes in newer model versions."
    },
    {
      "id": "AIR-DET-011",
      "title": "Human Feedback Loop for AI Systems",
      "group": "DET",
      "objective": "A Human Feedback Loop is a critical detective and continuous improvement mechanism that involves systematically collecting, analyzing, and acting upon feedback provided by human users, subject matter experts (SMEs), or reviewers regarding an AI system's performance, outputs, or behavior. In the context of financial institutions, this feedback is invaluable for: Monitoring AI System Efficacy: Understanding how well the AI system is meeting its objectives in real-world scenarios; Identifying Issues: Detecting problems such as inaccuracies, biases, unexpected behaviors (ri-5, ri-6), security vulnerabilities (e.g., successful prompt injections, data leakage observed by users), usability challenges, or instances where the AI generates inappropriate or harmful content; Enabling Continuous Improvement: Providing data-driven insights to refine AI models, update underlying data (e.g., for RAG systems), tune prompts, and enhance user experience; Supporting Incident Response: Offering a channel for users to report critical failures or adverse impacts, which can trigger incident response processes; Informing Governance: Providing qualitative and quantitative data to AI governance bodies and ethics committees. This control emphasizes the importance of structuring how human insights are captured and integrated into the AI system's lifecycle for ongoing refinement and risk management."
    },
    {
      "id": "AIR-PREV-012",
      "title": "Role-Based Access Control for AI Data",
      "group": "PREV",
      "objective": "Role-Based Access Control (RBAC) is a fundamental security mechanism designed to ensure that users, AI models, and other systems are granted access only to the specific data assets and functionalities necessary to perform their authorized tasks. Within the context of AI systems in a financial institution, RBAC is critical for protecting the confidentiality, integrity, and availability of data used throughout the AI lifecycle – from data sourcing and preparation to model training, validation, deployment, and operation. This control ensures that access to sensitive information is strictly managed based on defined roles and responsibilities."
    },
    {
      "id": "AIR-DET-013",
      "title": "Providing Citations and Source Traceability for AI-Generated Information",
      "group": "DET",
      "objective": "This control outlines the practice of designing Artificial Intelligence (AI) systems—particularly Large Language Models (LLMs) and Retrieval Augmented Generation (RAG) systems that produce informational content to provide verifiable citations, references, or traceable links back to the original source data or knowledge used to formulate their outputs. The primary purpose of providing citations is to enhance the transparency, verifiability, and trustworthiness of AI-generated information. By enabling users, reviewers, and auditors to trace claims to their origins, this control acts as a crucial detective mechanism. It allows for the independent assessment of the AI's informational basis, thereby helping to detect and mitigate risks associated with misinformation, AI \"hallucinations,\" lack of accountability, and reliance on inappropriate or outdated sources."
    },
    {
      "id": "AIR-PREV-014",
      "title": "Encryption of AI Data at Rest",
      "group": "PREV",
      "objective": "Encryption of data at rest is a fundamental security control that involves transforming stored information into a cryptographically secured format using robust encryption algorithms. This process renders the data unintelligible and inaccessible to unauthorized parties unless they possess the corresponding decryption key. The primary objective is to protect the confidentiality and integrity of sensitive data associated with AI systems, even if the underlying storage medium (e.g., disks, servers, backup tapes) is physically or logically compromised. While considered a standard security practice across IT, its diligent application to all components of AI systems, including newer technologies like vector databases, is critical."
    },
    {
      "id": "AIR-DET-015",
      "title": "Using Large Language Models for Automated Evaluation (LLM-as-a-Judge)",
      "group": "DET",
      "objective": "\"LLM-as-a-Judge\" (also referred to as LLM-based evaluation) is an emerging detective technique where one Large Language Model (the \"judge\" or \"evaluator LLM\") is employed to automatically assess the quality, safety, accuracy, adherence to guidelines, or other specific characteristics of outputs generated by another (primary) AI system, typically also an LLM.: Detect undesirable outputs: Identify responses that may be inaccurate, irrelevant, biased, harmful, non-compliant with policies, or indicative of data leakage (ri-1); Monitor performance and quality: Continuously evaluate if the primary AI system is functioning as intended and maintaining output quality over time; Flag issues for human review: Highlight problematic outputs that require human attention and intervention, making human oversight more targeted and efficient. The primary purpose of this control is to automate or augment aspects of the AI system verification, validation, and ongoing monitoring processes. Given the volume and complexity of outputs from modern AI systems (especially Generative AI), manual review by humans can be expensive, time-consuming, and difficult to scale. LLM-as-a-Judge aims to provide a scalable way to: This approach is particularly relevant for assessing qualitative aspects of AI-generated content that are challenging to measure with traditional quantitative metrics."
    },
    {
      "id": "AIR-DET-016",
      "title": "Preserving Source Data Access Controls in AI Systems",
      "group": "DET",
      "objective": "This control addresses the critical requirement that when an Artificial Intelligence (AI) system—particularly one employing Retrieval Augmented Generation (RAG) or similar techniques—ingests data from various internal or external sources, the original access control permissions, restrictions, and entitlements associated with that source data must be understood, preserved, and effectively enforced when the AI system subsequently uses or presents information derived from that data. While the implementation of mechanisms to preserve these controls is preventative, this control also has a significant detective aspect. This involves the ongoing verification, auditing, and monitoring to ensure that these access controls are correctly mapped, consistently maintained within the AI ecosystem, and are not being inadvertently or maliciously bypassed. Detecting deviations or failures in preserving source access controls is paramount to preventing unauthorized data exposure through the AI system."
    },
    {
      "id": "AIR-PREV-017",
      "title": "AI Firewall Implementation and Management",
      "group": "PREV",
      "objective": "An AI Firewall is conceptualized as a specialized security system designed to protect Artificial Intelligence (AI) models and applications by inspecting, filtering, and controlling the data and interactions flowing to and from them. As AI, particularly Generative AI and agentic systems, becomes more integrated into critical workflows, it introduces novel risks that traditional security measures may not adequately address.: Malicious Inputs: Such as Prompt Injection attacks intended to manipulate model behavior or execute unauthorized actions; Data Exfiltration and Leakage: Preventing sensitive information (e.g., PII, confidential corporate data) from being inadvertently or maliciously extracted through model inputs or outputs; Model Integrity and Stability: Protecting against inputs designed to make the AI system unstable, behave erratically, or exhaust its computational resources; AI Agent Misuse: Monitoring and controlling interactions in AI agentic workflows to prevent tool abuse (Risk 4) or compromise of AI agents; Harmful Content Generation: Filtering outputs to prevent the generation or dissemination of inappropriate, biased, or harmful content; Unauthorized Access and Activity: Enhancing transparency and control over who or what is interacting with AI models and for what purpose; Data Poisoning (at Inference/Interaction): While primary data poisoning targets training data, an AI Firewall might detect inputs during inference designed to exploit existing vulnerabilities or attempt to skew behavior in models that support forms of continuous learning or fine-tuning based on interactions. The primary purpose of an AI Firewall is to mitigate these emerging AI-specific threats, including but not limited to: Such a system would typically intercept and analyze communication between users and AI models/agents, between AI agents and various tools or data sources, and potentially even inter-agent communications. Its functions would ideally include threat detection, real-time monitoring, alerting, automated blocking or sanitization, comprehensive reporting, and the enforcement of predefined security and ethical guardrails."
    },
    {
      "id": "AIR-PREV-018",
      "title": "Agent Authority Least Privilege Framework",
      "group": "PREV",
      "objective": "The Agent Authority Least Privilege Framework implements granular access controls ensuring agents can only access APIs, tools, and data strictly necessary for their designated functions. This preventive control establishes dynamic privilege management, contextual access restrictions, and comprehensive authorization enforcement to prevent agents from exceeding their intended operational scope and causing unauthorized actions or regulatory violations. This framework extends traditional least privilege principles to address the unique challenges of agentic AI systems, where agents make autonomous decisions about tool selection and API usage, requiring more sophisticated controls than static role-based access systems."
    },
    {
      "id": "AIR-PREV-019",
      "title": "Tool Chain Validation and Sanitization",
      "group": "PREV",
      "objective": "Tool Chain Validation and Sanitization implements comprehensive validation mechanisms for agent tool selection decisions, API parameter sanitization, and safe tool execution sequences. This preventive control ensures that agents cannot be manipulated into selecting inappropriate tools, injecting malicious parameters into API calls, or executing dangerous tool combinations that could result in unauthorized actions or system compromise. This mitigation addresses the unique attack surface created by agentic systems' autonomous tool selection and execution capabilities, extending beyond traditional input validation to cover the complex decision-making processes that determine which tools agents use and how they sequence multiple tool calls."
    },
    {
      "id": "AIR-PREV-020",
      "title": "MCP Server Security Governance",
      "group": "PREV",
      "objective": "MCP Server Security Governance establishes comprehensive security controls for Model Context Protocol servers including supply chain verification, secure communication channels, data integrity validation, and continuous monitoring. This preventive control ensures that MCP servers providing specialized capabilities to agentic AI systems maintain appropriate security standards and cannot be used as vectors for systematic compromise of agent decision-making. This mitigation addresses the unique risks introduced by the distributed architecture of MCP-based agentic systems, where agents rely on external servers for critical data and capabilities, creating supply chain dependencies that require specialized security governance."
    },
    {
      "id": "AIR-DET-021",
      "title": "Agent Decision Audit and Explainability",
      "group": "DET",
      "objective": "Agent Decision Audit and Explainability implements comprehensive logging, documentation, and explainability mechanisms for agent decisions to support regulatory compliance, security incident investigation, and decision accountability. This detective control ensures that all agent actions, reasoning processes, and decision factors are captured in sufficient detail to meet regulatory requirements and enable effective forensic analysis when incidents occur. This mitigation is critical for financial services where regulatory bodies require detailed audit trails for automated decision-making systems, and where the ability to explain and justify agent decisions is essential for customer protection and compliance verification."
    },
    {
      "id": "AIR-PREV-022",
      "title": "Multi-Agent Isolation and Segmentation",
      "group": "PREV",
      "objective": "Multi-Agent Isolation and Segmentation implements comprehensive security boundaries between agents in multi-agent systems to prevent cross-agent compromise, limit blast radius of security incidents, and maintain appropriate trust boundaries. This preventive control ensures that compromise or malfunction of one agent cannot systematically affect other agents, protecting the integrity of complex multi-agent workflows in financial services. This mitigation is essential for financial institutions deploying multiple specialized agents that must work together while maintaining appropriate security isolation to prevent systemic failures and cascading security incidents."
    },
    {
      "id": "AIR-PREV-023",
      "title": "Agentic System Credential Protection Framework",
      "group": "PREV",
      "objective": "The Agentic System Credential Protection Framework implements comprehensive security controls to prevent agents from discovering, accessing, or exfiltrating authentication credentials, API keys, secrets, and other sensitive authentication materials. This preventive control establishes credential isolation, secure credential injection mechanisms, behavioral monitoring, and zero-trust authentication architectures specifically designed to protect against agent-mediated credential harvesting while maintaining operational functionality for legitimate agent operations. This framework addresses the unique challenges of protecting credentials in environments where agents have broad system access and autonomous decision-making capabilities, requiring specialized controls beyond traditional credential management approaches."
    }
  ]
};
