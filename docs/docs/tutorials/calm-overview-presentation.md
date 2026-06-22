---
id: calm-overview-presentation
title: "CALM in 40 Minutes"
sidebar_position: 0
---

import RevealPresentation from '@site/src/components/RevealPresentation';

# CALM in 40 Minutes

A guided introduction to the Common Architecture Language Model — what it is, how it works, and the tools that bring it to life.

> **Presenter tips:** Click inside the deck then use **← →** arrow keys to advance slides. Press **S** (or the 🎤 button) to open speaker view with your notes. Press **F** (or ⛶ Fullscreen) for fullscreen mode. The slide counter is shown bottom-right.

<RevealPresentation>

{/* ─────────────────────────────────────────────
    PART 1 — WHAT IS CALM?
───────────────────────────────────────────── */}

<section>
  <div style={{display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', height:'100%', gap:'1.2rem'}}>
    <img src="/img/2025_CALM_Horizontal.svg" alt="CALM Logo" style={{maxWidth:'420px', marginBottom:'0.5rem'}} />
    <h2 style={{margin:0}}>Architecture as Code</h2>
    <p style={{margin:0, fontSize:'1.1rem', color:'#555'}}>A 40-minute introduction to CALM</p>
    <p style={{margin:0, fontSize:'0.9rem', color:'#888'}}>FINOS · Architecture as Code Working Group</p>
  </div>
  <aside className="notes">
    Welcome! Today we cover what CALM is, its core concepts, and the tooling ecosystem.
    The presentation runs about 40 minutes and is interactive — feel free to ask questions throughout.
  </aside>
</section>

<section>
  <h2>What We'll Cover</h2>
  <ol>
    <li>The problem with traditional architecture</li>
    <li>What CALM is</li>
    <li>Building blocks: Nodes, Relationships, Interfaces</li>
    <li>Governance: Controls, Standards, Patterns</li>
    <li>Process &amp; evolution: Flows, Timelines</li>
    <li>The tooling ecosystem</li>
    <li>CALM in practice: Deployments, Gates, AI tools</li>
    <li>A real-world example: Trading System</li>
  </ol>
  <aside className="notes">
    Quick roadmap slide. We'll move through each section and use a financial-services
    trading system as our running example throughout.
  </aside>
</section>

{/* ── The Problem ── */}

<section>
  <h2>The Problem with Traditional Architecture</h2>
  <div className="two-col">
    <div>
      <h3>What we usually do</h3>
      <ul>
        <li>Whiteboard sketches</li>
        <li>Static Visio / draw.io diagrams</li>
        <li>Word documents, PowerPoints</li>
        <li>Wikis that go stale</li>
      </ul>
    </div>
    <div>
      <h3>The consequences</h3>
      <ul>
        <li>❌ Inconsistent across teams</li>
        <li>❌ Drift away from what's built</li>
        <li>❌ No version history</li>
        <li>❌ Can't be validated or automated</li>
        <li>❌ Compliance requires manual review</li>
      </ul>
    </div>
  </div>
  <aside className="notes">
    Ask the audience: "How many of you have seen an architecture diagram that turned out to be wrong?"
    Almost everyone has. This is the gap CALM addresses.
  </aside>
</section>

<section>
  <h2>The Core Insight</h2>
  <div style={{display:'flex', justifyContent:'center', margin:'1.8rem 0 1.4rem'}}>
    <blockquote style={{
      fontSize:'1.5rem', fontStyle:'italic', textAlign:'center',
      background:'#f1f8e9', border:'2px solid #2e7d32', borderRadius:'8px',
      padding:'1.4rem 2.5rem', maxWidth:'680px', margin:0
    }}>
      "We version-control code. Why not architecture?"
    </blockquote>
  </div>
  <p style={{textAlign:'center'}}>CALM brings architecture into the world of code — structured, consistent, and automated.</p>
  <p style={{textAlign:'center', color:'#555', fontSize:'0.95rem'}}>Architecture that lives in Git. Validated by CI/CD. Always stays true.</p>
  <aside className="notes">
    The analogy to draw: infrastructure as code (Terraform, Pulumi) did this for infrastructure.
    CALM does it for the higher-level architectural picture.
  </aside>
</section>

{/* ── What is CALM ── */}

<section>
  <h2>What is CALM?</h2>
  <p><strong>Common Architecture Language Model</strong></p>
  <ul>
    <li>Open-source specification from <strong>FINOS</strong> (Fintech Open Source)</li>
    <li>A <strong>JSON Meta Schema</strong> for describing software architecture</li>
    <li><strong>Human-readable</strong> and <strong>machine-readable</strong></li>
    <li>Built for financial services and <strong>regulated environments</strong></li>
    <li>Current release: <code style={{fontSize:'0.82em'}}>calm.finos.org/release/1.2</code></li>
  </ul>
  <aside className="notes">
    FINOS is the open-source foundation for financial services (similar to Apache for general open source).
    CALM was created because financial services organisations have strict regulatory requirements
    that informal architecture simply cannot satisfy.
  </aside>
</section>

<section>
  <h2>Core Benefits</h2>
  <div style={{display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:'1rem', marginTop:'0.5rem'}}>
    <div style={{background:'#e8f5e9', borderRadius:'8px', padding:'1.1rem 1.2rem', textAlign:'center'}}>
      <div style={{fontSize:'2rem', marginBottom:'0.4rem'}}>📏</div>
      <h3 style={{marginTop:0, marginBottom:'0.4rem', fontSize:'1.1rem'}}>Standardise</h3>
      <p style={{fontSize:'0.88rem', margin:0}}>One common language for architects, developers, and tools — no ambiguity.</p>
    </div>
    <div style={{background:'#e3f2fd', borderRadius:'8px', padding:'1.1rem 1.2rem', textAlign:'center'}}>
      <div style={{fontSize:'2rem', marginBottom:'0.4rem'}}>⚙️</div>
      <h3 style={{marginTop:0, marginBottom:'0.4rem', fontSize:'1.1rem'}}>Automate</h3>
      <p style={{fontSize:'0.88rem', margin:0}}>Validate architectures, run compliance checks, generate docs — all in CI/CD.</p>
    </div>
    <div style={{background:'#fff8e1', borderRadius:'8px', padding:'1.1rem 1.2rem', textAlign:'center'}}>
      <div style={{fontSize:'2rem', marginBottom:'0.4rem'}}>📦</div>
      <h3 style={{marginTop:0, marginBottom:'0.4rem', fontSize:'1.1rem'}}>Version Control</h3>
      <p style={{fontSize:'0.88rem', margin:0}}>Architecture lives in Git. PR reviews, change history, branch strategies.</p>
    </div>
    <div style={{background:'#fce4ec', borderRadius:'8px', padding:'1.1rem 1.2rem', textAlign:'center'}}>
      <div style={{fontSize:'2rem', marginBottom:'0.4rem'}}>🔒</div>
      <h3 style={{marginTop:0, marginBottom:'0.4rem', fontSize:'1.1rem'}}>Compliance</h3>
      <p style={{fontSize:'0.88rem', margin:0}}>Enforce org standards and regulatory policies automatically. Audit trail built-in.</p>
    </div>
    <div style={{background:'#e8eaf6', borderRadius:'8px', padding:'1.1rem 1.2rem', textAlign:'center'}}>
      <div style={{fontSize:'2rem', marginBottom:'0.4rem'}}>🚀</div>
      <h3 style={{marginTop:0, marginBottom:'0.4rem', fontSize:'1.1rem'}}>Drive Deployments</h3>
      <p style={{fontSize:'0.88rem', margin:0}}>Architecture drives real infrastructure — template bundles generate IaC, not just docs.</p>
    </div>
    <div style={{background:'#f3e5f5', borderRadius:'8px', padding:'1.1rem 1.2rem', textAlign:'center'}}>
      <div style={{fontSize:'2rem', marginBottom:'0.4rem'}}>🏢</div>
      <h3 style={{marginTop:0, marginBottom:'0.4rem', fontSize:'1.1rem'}}>Enterprise-Ready</h3>
      <p style={{fontSize:'0.88rem', margin:0}}>Flexible core, customizable for the enterprise — standards, controls, and patterns layer on top.</p>
    </div>
  </div>
  <aside className="notes">
    Six pillars now. The two new ones are key: "Drive Deployments" — CALM isn't just documentation,
    it generates actual IaC via template bundles. "Enterprise-Ready" — the core is flexible
    but the standards/controls/patterns system lets firms lock it down for regulated environments.
  </aside>
</section>

<section>
  <h2>CALM is JSON</h2>
  <p>An architecture document is a JSON file conforming to the CALM schema:</p>
  <div style={{paddingLeft:'2rem'}}>
  <pre><code className="language-json">{`{
  "$schema": "https://calm.finos.org/release/1.2/meta/calm.json",
  "unique-id": "trading-system",
  "name": "Equity Trading Platform",
  "description": "Core trading architecture for equities desk",
  "nodes": [ ... ],
  "relationships": [ ... ],
  "flows": [ ... ]
}`}</code></pre>
  </div>
  <p style={{fontSize:'0.85rem', color:'#666'}}>Store it in Git · validate it in CI · render it with CALM tools</p>
  <aside className="notes">
    JSON was chosen because it's universally supported, works with JSON Schema validation,
    and integrates well with existing toolchains. The schema is modular and versioned.
  </aside>
</section>

<section>
  <h2>How CALM Documents Relate</h2>
  <p>Three document types, each with a distinct role:</p>
  <div style={{display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:'1.5rem', marginTop:'0.8rem'}}>
    <div style={{background:'#e8f5e9', borderRadius:'8px', padding:'1.6rem 1.4rem', textAlign:'center'}}>
      <div style={{fontSize:'2.8rem', marginBottom:'0.5rem'}}>📄</div>
      <h3 style={{marginTop:0, marginBottom:'0.6rem', fontSize:'1.2rem'}}>Architecture</h3>
      <p style={{fontSize:'0.9rem', color:'#333', margin:0}}>The <strong>instance</strong> — your real system's nodes, relationships &amp; metadata. Authored by hand or generated from a pattern.</p>
    </div>
    <div style={{background:'#e3f2fd', borderRadius:'8px', padding:'1.6rem 1.4rem', textAlign:'center'}}>
      <div style={{fontSize:'2.8rem', marginBottom:'0.5rem'}}>▦</div>
      <h3 style={{marginTop:0, marginBottom:'0.6rem', fontSize:'1.2rem'}}>Pattern</h3>
      <p style={{fontSize:'0.9rem', color:'#333', margin:0}}>The <strong>template</strong> — a JSON Schema constraining architectures: which nodes must exist, how they connect, which protocols apply. <em>(Part 3)</em></p>
    </div>
    <div style={{background:'#f3e5f5', borderRadius:'8px', padding:'1.6rem 1.4rem', textAlign:'center'}}>
      <div style={{fontSize:'2.8rem', marginBottom:'0.5rem'}}>🕐</div>
      <h3 style={{marginTop:0, marginBottom:'0.6rem', fontSize:'1.2rem'}}>Timeline</h3>
      <p style={{fontSize:'0.9rem', color:'#333', margin:0}}>The <strong>history</strong> — time-stamped snapshots, each linked to a full architecture and the ADRs that drove the change. <em>(Part 4)</em></p>
    </div>
  </div>
  <aside className="notes">
    This is the map for the whole talk. An architecture is the data — what YOUR system looks like.
    A pattern is a schema — the rules an architecture must satisfy. A timeline is the history —
    how an architecture evolved. All three are CALM documents; they're just at different levels.
    We start with architectures, introduce patterns in Part 3, and timelines in Part 4.
  </aside>
</section>

{/* ─────────────────────────────────────────────
    PART 2 — THE THREE BUILDING BLOCKS
───────────────────────────────────────────── */}

<section>
  <div style={{display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', height:'100%'}}>
    <h1 style={{color:'#2e7d32'}}>Part 2</h1>
    <h2>The Three Building Blocks</h2>
    <p style={{color:'#555'}}>Nodes · Relationships · Interfaces</p>
  </div>
  <aside className="notes">
    Everything in CALM is built from these three primitives.
    Once you understand them, the whole model makes sense.
  </aside>
</section>

<section>
  <h2>🟦 Nodes — The "Boxes"</h2>
  <p style={{fontSize:'1.25rem'}}>A node represents any component in your architecture.</p>
  <div className="two-col">
    <div>
      <h3 style={{fontSize:'1.35rem'}}>Node types</h3>
      <ul style={{fontSize:'1.35rem', lineHeight:'1.6'}}>
        <li><code>service</code> — microservice, API</li>
        <li><code>database</code> — SQL, NoSQL, cache</li>
        <li><code>system</code> — external system</li>
        <li><code>actor</code> — a person or role</li>
        <li><code>webclient</code> — browser UI</li>
        <li><code>network</code> — network zone</li>
        <li><code>data-asset</code> — a data set or stream</li>
      </ul>
    </div>
    <div>
      <h3 style={{fontSize:'1.35rem'}}>Core properties</h3>
      <ul style={{fontSize:'1.35rem', lineHeight:'1.6'}}>
        <li><code>unique-id</code> ★ required</li>
        <li><code>node-type</code> ★ required</li>
        <li><code>name</code> ★ required</li>
        <li><code>description</code> ★ required</li>
        <li><code>details</code> (optional)</li>
        <li><code>metadata</code> (optional — org context)</li>
      </ul>
      <p style={{fontSize:'0.9rem', color:'#666', marginTop:'0.6rem'}}>Interfaces &amp; controls are covered later.</p>
    </div>
  </div>
  <aside className="notes">
    The unique-id is critical — it's how relationships reference nodes.
    Keep it simple here: nodes have four required fields and optional metadata.
    Interfaces and controls come in Part 2 and Part 3 respectively.
  </aside>
</section>

<section>
  <h2>🟦 Nodes — Example</h2>
  <pre><code className="language-json">{`{
  "unique-id": "payment-service",
  "node-type": "service",
  "name": "Payment Service",
  "description": "Handles all payment transactions"
}`}</code></pre>
  <aside className="notes">
    Four required fields — unique-id, node-type, name, description.
    unique-id is critical: it's how relationships reference nodes, so keep it stable.
    Optional fields (interfaces, controls, metadata) attach here too — we'll cover those in the next slides.
  </aside>
</section>

<section>
  <h2>➡️ Relationships — The "Arrows"</h2>
  <p>Relationships link nodes and describe how they interact.</p>
  <ul style={{fontSize:'1.2rem', lineHeight:'2.1', marginTop:'0.8rem'}}>
    <li>🔗 <code>connects</code> — links a <strong>specific interface</strong> on destination (most precise)</li>
    <li>💬 <code>interacts</code> — node-to-node without naming an interface (higher-level)</li>
    <li>🖥️ <code>deployed-in</code> — node runs inside a container, VM, or cloud cluster</li>
    <li>📦 <code>composed-of</code> — hierarchical nesting of systems or services</li>
  </ul>
  <p style={{fontSize:'0.85rem', color:'#666', marginTop:'0.3rem'}}>
    Each relationship has a <code>unique-id</code>, <code>relationship-type</code>, optional <code>protocol</code>, and optional <code>controls</code>.
  </p>
  <aside className="notes">
    `connects` is the most precise — it links specific interfaces (next slide shows how).
    `interacts` is higher-level — node-to-node without specifying which interface.
    `deployed-in` is great for showing containers, VMs, cloud regions.
    Controls on relationships are Part 3 — just plant the seed here.
  </aside>
</section>

<section>
  <h2>➡️ Relationships — Example</h2>
  <pre><code className="language-json">{`{
  "unique-id": "service-to-db",
  "description": "Spring Boot service connects to PostgreSQL for persistence",
  "protocol": "JDBC",
  "relationship-type": {
    "connects": {
      "source": {
        "node": "spring-service"
      },
      "destination": {
        "node": "postgres-db",
        "interfaces": ["db-interface"]
      }
    }
  }
}`}</code></pre>
  <p style={{fontSize:'0.85rem', color:'#666'}}>
    Source connects implicitly; destination exposes a named interface.
  </p>
  <aside className="notes">
    Note that the source has no interface specified — the calling node doesn't need to expose
    an interface. Only the destination (the thing being called) needs to define its interface.
    This is a deliberate design decision in CALM.
  </aside>
</section>

<section>
  <h2>🔌 Interfaces — Connection Points</h2>
  <p style={{marginBottom:'1rem', fontSize:'1.2rem'}}>
    Interfaces are the named, typed entry points a node exposes.<br/>A <code>connects</code> relationship targets a specific interface — and controls enforce policy on it.
  </p>
  <div style={{display:'flex', alignItems:'center', justifyContent:'center', gap:'1.5rem', margin:'0.5rem 0 1rem'}}>
    <div style={{background:'#e3f2fd', border:'2px solid #1565c0', borderRadius:'8px', padding:'1rem 1.4rem', textAlign:'center', minWidth:'130px'}}>
      <div style={{fontSize:'1.8rem', marginBottom:'0.3rem'}}>🖥️</div>
      <div style={{fontWeight:'bold', fontSize:'1rem'}}>Trading UI</div>
      <div style={{fontSize:'0.9rem', color:'#555'}}>webclient</div>
    </div>
    <div style={{display:'flex', flexDirection:'column', alignItems:'center', gap:'0.15rem'}}>
      <span style={{fontSize:'0.85rem', color:'#555', fontFamily:'monospace'}}>connects via</span>
      <span style={{fontSize:'0.9rem', color:'#c62828', fontWeight:'bold', fontFamily:'monospace'}}>host-port :443</span>
      <svg width="60" height="18" viewBox="0 0 60 18">
        <line x1="2" y1="9" x2="50" y2="9" stroke="#555" strokeWidth="2"/>
        <polygon points="50,4 60,9 50,14" fill="#555"/>
      </svg>
    </div>
    <div style={{background:'#e8f5e9', border:'2px solid #2e7d32', borderRadius:'8px', padding:'1rem 1.4rem', textAlign:'center', minWidth:'150px'}}>
      <div style={{fontSize:'1.8rem', marginBottom:'0.3rem'}}>⚙️</div>
      <div style={{fontWeight:'bold', fontSize:'1rem'}}>Payment Service</div>
      <div style={{fontSize:'0.9rem', color:'#555'}}>service</div>
    </div>
    <div style={{borderLeft:'3px solid #2e7d32', paddingLeft:'1rem', display:'flex', flexDirection:'column', gap:'0.35rem'}}>
      <div style={{fontSize:'0.9rem', color:'#555', fontWeight:'bold', marginBottom:'0.2rem'}}>Exposed interfaces:</div>
      <div style={{background:'#fff3e0', border:'1px solid #e65100', borderRadius:'4px', padding:'0.25rem 0.6rem', fontSize:'0.9rem', fontFamily:'monospace'}}>host-port :443</div>
      <div style={{background:'#f3e5f5', border:'1px solid #6a1b9a', borderRadius:'4px', padding:'0.25rem 0.6rem', fontSize:'0.9rem', fontFamily:'monospace'}}>url-path /api/payments</div>
      <div style={{background:'#fce4ec', border:'1px solid #880e4f', borderRadius:'4px', padding:'0.25rem 0.6rem', fontSize:'0.9rem', fontFamily:'monospace'}}>oauth2-audience payments</div>
    </div>
  </div>
  <p style={{fontSize:'0.95rem', color:'#555'}}>
    Interface types: <code>host-port</code> · <code>url-path</code> · <code>oauth2-audience</code> · <code>hostname</code> · <code>rate-limit</code> · and more.
    Optional — but controls need them to enforce connection-level policy.
  </p>
  <aside className="notes">
    Trading UI connects to Payment Service via the host-port :443 interface.
    The service also exposes url-path and oauth2-audience interfaces — each is a distinct,
    typed connection point that can be independently controlled.
    Without interfaces, "A connects to B" is just a line. With them, you know the exact
    host, port, path, and auth contract — which a control can then enforce (Part 3).
  </aside>
</section>


{/* ─────────────────────────────────────────────
    PART 3 — GOVERNANCE
───────────────────────────────────────────── */}

<section>
  <div style={{display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', height:'100%'}}>
    <h1 style={{color:'#1565c0'}}>Part 3</h1>
    <h2>Governance</h2>
    <p style={{color:'#555'}}>Controls · Standards · Patterns</p>
  </div>
  <aside className="notes">
    This is where CALM really shines for regulated industries.
    Governance isn't an afterthought — it's built into the model.
  </aside>
</section>

<section>
  <h2>🔐 Controls — The Problem They Solve</h2>
  <div style={{display:'flex', justifyContent:'center', margin:'0.5rem 0 0.8rem'}}>
    <blockquote style={{
      fontSize:'1.35rem', fontStyle:'italic', textAlign:'center',
      background:'#fff8f8', border:'2px solid #c62828', borderRadius:'8px',
      padding:'1rem 2rem', maxWidth:'820px', margin:0
    }}>
      "OMS → Trade Database carries PII. Policy says mTLS. How do you prevent someone shipping plain TCP?"
    </blockquote>
  </div>
  <p style={{fontSize:'0.88rem', marginBottom:'0.5rem', textAlign:'center'}}>
    A <strong>control</strong> = a <strong>requirement</strong> (schema: what "compliant" means) + a <strong>config</strong> (this element's answer). Compliance becomes <strong>machine-checkable</strong>.
  </p>
  <div className="two-col">
    <div>
      <p style={{fontSize:'0.8rem', fontWeight:'bold', marginBottom:'0.3rem'}}>Requirement — JSON Schema of allowed values:</p>
      <pre><code className="language-json">{`{
  "control-id": "security-002",
  "name": "Permitted Connection",
  "protocol": {
    "enum": ["HTTPS","mTLS","TLS","SFTP","JDBC"]
  }
}`}</code></pre>
    </div>
    <div>
      <p style={{fontSize:'0.8rem', fontWeight:'bold', marginBottom:'0.3rem'}}>Config — validated against the requirement:</p>
      <pre><code className="language-json">{`{
  "control-id": "security-002",
  "name": "Permitted Connection",
  "protocol": "mTLS"
}`}</code></pre>
      <p style={{fontSize:'0.83rem', color:'#2e7d32', marginTop:'0.5rem', fontWeight:'bold'}}>
        ✓ Governance is a validation check — not a PDF nobody reads.
      </p>
    </div>
  </div>
  <aside className="notes">
    The requirement defines an enum of allowed protocols — anything not in that list fails validation.
    The config must satisfy that schema. So "use mTLS" isn't just a policy comment — it's a
    constraint that tooling can verify. Controls attach at node, relationship, flow, or architecture level.
  </aside>
</section>

<section>
  <h2>🔐 Controls — In Your Architecture</h2>
  <p style={{marginBottom:'0.5rem'}}>Attach a control to the relevant element — the architecture JSON makes the policy explicit:</p>
  <pre><code className="language-json">{`{
  "unique-id": "oms-to-trade-db",
  "description": "OMS → Trade Database (carries PII)",
  "protocol": "mTLS",
  "controls": {
    "permitted-connection": {
      "description": "Connection must use an approved protocol",
      "requirements": [{
        "control-requirement-url":
          "https://calm.finos.org/controls/security/schema/permitted-connection.json",
        "control-config-url":
          "https://myorg.example.com/controls/approved-protocols.json"
      }]
    }
  }
}`}</code></pre>
  <p style={{fontSize:'0.85rem', color:'#666', marginTop:'0.4rem'}}>
    Attach to: <strong>nodes</strong> · <strong>relationships</strong> · <strong>flows</strong> · <strong>whole architecture</strong>.
    &nbsp;|&nbsp; Requirement URL = policy schema · Config URL = this element's implementation.
  </p>
  <aside className="notes">
    The requirement URL and config URL are both independently versioned JSON documents.
    The policy team owns the requirement; the architecture team owns the config.
    Separating them means governance policies can be updated without changing every architecture.
  </aside>
</section>

<section>
  <h2>🧩 Customizations</h2>
  <div className="two-col">
    <div>
      <h3 style={{fontSize:'1.1rem', marginBottom:'0.4rem'}}>Custom properties</h3>
      <p style={{fontSize:'0.95rem', marginBottom:'0.5rem'}}>
        Add any key/value context to <strong>nodes</strong> <em>and</em> <strong>relationships</strong> via <code>metadata</code> — ownership, classification, cost attribution, whatever your org needs.
      </p>
      <pre><code className="language-json">{`"metadata": [
  { "key": "owner",
    "value": "payments-team" },
  { "key": "data-classification",
    "value": "PII" },
  { "key": "cost-centre",
    "value": "CC-1042" }
]`}</code></pre>
      <p style={{fontSize:'0.85rem', color:'#555', marginTop:'0.4rem'}}>Works on both nodes and relationships — attach context wherever it lives.</p>
    </div>
    <div style={{paddingTop:'0.2rem'}}>
      <h3 style={{fontSize:'1.1rem', marginBottom:'0.4rem'}}>📏 Standards — stricter, cross-org</h3>
      <p style={{fontSize:'0.9rem', marginBottom:'0.4rem'}}>
        When you need consistency <em>across teams</em>, promote a custom property into a <strong>standard</strong> — a JSON Schema extension that makes it mandatory on every architecture.
      </p>
      <pre><code className="language-json">{`{
  "allOf": [{"$ref": "…/calm.json"}],
  "properties": {
    "nodes": { "items": {
      "properties": { "metadata": {
        "contains": { "properties": {
          "key": {"const":"cost-centre"}
        }}
      }}
    }}
  }
}`}</code></pre>
      <p style={{fontSize:'0.85rem', color:'#555', marginTop:'0.4rem'}}>
        Run <code>calm validate --standard</code> — fail the build if any architecture is non-compliant.
      </p>
    </div>
  </div>
  <aside className="notes">
    Two levels: informal customization and enforced standards.
    Any node or relationship can carry arbitrary metadata key/value pairs — owner, classification,
    cost centre, whatever the team needs. This is the flexible, additive layer.
    When your org decides "every architecture *must* carry cost-centre on every node," you write
    a CALM standard (a JSON Schema extension) and wire it into CI. Now deviation fails the build.
    That's the progression: start with custom properties, promote to standards when cross-org
    consistency becomes non-negotiable.
  </aside>
</section>

<section>
  <h2>▦ Patterns — Reusable Blueprints</h2>
  <p>A <strong>pattern</strong> is a JSON Schema that constrains architectures.</p>
  <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:'1.5rem', marginTop:'0.8rem'}}>
    <div style={{background:'#e3f2fd', borderRadius:'8px', padding:'1.4rem 1.6rem', textAlign:'center'}}>
      <div style={{fontSize:'2.4rem', marginBottom:'0.4rem'}}>▦</div>
      <h3 style={{marginTop:0, marginBottom:'0.5rem', fontSize:'1.2rem'}}>Pattern = the rules</h3>
      <ul style={{textAlign:'left', fontSize:'0.9rem', margin:0}}>
        <li>Which nodes must exist (by <code>const</code> ID)</li>
        <li>How they must connect</li>
        <li>Which protocols are required</li>
        <li>Enforced with <code>prefixItems</code> / <code>minItems</code></li>
      </ul>
    </div>
    <div style={{background:'#e8f5e9', borderRadius:'8px', padding:'1.4rem 1.6rem', textAlign:'center'}}>
      <div style={{fontSize:'2.4rem', marginBottom:'0.4rem'}}>📄</div>
      <h3 style={{marginTop:0, marginBottom:'0.5rem', fontSize:'1.2rem'}}>Architecture = the instance</h3>
      <ul style={{textAlign:'left', fontSize:'0.9rem', margin:0}}>
        <li>Must conform to the pattern</li>
        <li>Fills in descriptions &amp; metadata</li>
        <li>Can be <em>generated</em> from a pattern</li>
        <li>Fails <code>calm validate</code> if it diverges</li>
      </ul>
    </div>
  </div>
  <p style={{fontSize:'0.88rem', color:'#555', marginTop:'0.8rem', textAlign:'center'}}>
    Architects publish patterns → teams scaffold conforming architectures → CI validates continuously.
  </p>
  <aside className="notes">
    A pattern is literally a JSON Schema — same validation infrastructure as the rest of CALM.
    An architecture that doesn't match the pattern fails `calm validate`.
    The key model: architect sets the rules once; every team's instance is auto-checked.
  </aside>
</section>

<section>
  <h2>▦ Patterns — The Schema</h2>
  <p style={{marginBottom:'0.5rem', fontSize:'0.9rem'}}>Pattern constraints use standard JSON Schema keywords — <code>const</code> to pin IDs, <code>prefixItems</code> to require specific nodes:</p>
  <pre><code className="language-json">{`{
  "nodes": {
    "minItems": 3, "maxItems": 3,
    "prefixItems": [
      {
        "properties": {
          "unique-id": { "const": "trading-ui" },
          "node-type": { "const": "webclient" }
        }
      },
      {
        "properties": {
          "unique-id": { "const": "trading-api" },
          "node-type": { "const": "service" }
        }
      }
    ]
  },
  "relationships": {
    "prefixItems": [{
      "properties": { "protocol": { "const": "HTTPS" } }
    }]
  }
}`}</code></pre>
  <aside className="notes">
    The `const` keyword fixes structural identifiers. `prefixItems` + `minItems/maxItems` enforces exact counts.
    This pattern requires exactly 3 nodes, the first two being specific IDs and types, with HTTPS on all relationships.
    Any architecture that doesn't match fails `calm validate`.
  </aside>
</section>

<section>
  <h2>▦ Patterns — Generate &amp; Validate</h2>
  <pre><code className="language-bash">{`# Generate a scaffold from a pattern
calm generate -p patterns/trading-platform.json \\
              -o architectures/my-trading-system.json

# Fill in the [[ PLACEHOLDERS ]] in the generated file, then:

# Validate your architecture conforms to the pattern
calm validate -p patterns/trading-platform.json \\
              -a architectures/my-trading-system.json`}</code></pre>
  <div style={{marginTop:'0.5rem'}}>
    <p style={{fontSize:'0.9rem', marginBottom:'0.3rem'}}>
      <strong>Architect</strong> publishes a pattern → <strong>Team</strong> generates a scaffold → fills <code>[[ PLACEHOLDERS ]]</code> → <strong>CI</strong> validates continuously.
    </p>
    <p style={{fontSize:'0.85rem', color:'#555', marginTop:0}}>
      Pattern = reuse <em>and</em> governance in one artifact. Divergence from the pattern fails validation before it ships.
    </p>
  </div>
  <aside className="notes">
    The dual use (generate + validate) is powerful: teams scaffold a compliant architecture
    in seconds, and CI continuously verifies it stays compliant.
    The "Architect publishes, team instantiates" model is how firms get architectural governance
    without a manual review gate on every team.
  </aside>
</section>

<section>
  <h2>Pattern vs Standard vs Control</h2>
  <p style={{marginBottom:'0.7rem', fontSize:'0.95rem'}}>Three kinds of governance in CALM — all schemas, but at different scopes:</p>
  <div style={{display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:'1.2rem'}}>
    <div style={{background:'#e3f2fd', borderRadius:'8px', padding:'1.4rem 1.6rem', textAlign:'center'}}>
      <div style={{fontSize:'2.4rem', marginBottom:'0.4rem'}}>▦</div>
      <h3 style={{marginTop:0, marginBottom:'0.4rem', fontSize:'1.2rem'}}>Pattern</h3>
      <p style={{fontSize:'0.88rem', color:'#444', marginBottom:'0.4rem', fontStyle:'italic'}}>"Must have exactly these nodes connected by HTTPS"</p>
      <p style={{fontSize:'0.82rem', color:'#555', margin:0}}><strong>Scope:</strong> one whole architecture — scaffold &amp; validate structure</p>
    </div>
    <div style={{background:'#fff8e1', borderRadius:'8px', padding:'1.4rem 1.6rem', textAlign:'center'}}>
      <div style={{fontSize:'2.4rem', marginBottom:'0.4rem'}}>📏</div>
      <h3 style={{marginTop:0, marginBottom:'0.4rem', fontSize:'1.2rem'}}>Standard</h3>
      <p style={{fontSize:'0.88rem', color:'#444', marginBottom:'0.4rem', fontStyle:'italic'}}>"Every node must carry a cost-centre"</p>
      <p style={{fontSize:'0.82rem', color:'#555', margin:0}}><strong>Scope:</strong> all architectures org-wide — enforce mandatory fields</p>
    </div>
    <div style={{background:'#fce4ec', borderRadius:'8px', padding:'1.4rem 1.6rem', textAlign:'center'}}>
      <div style={{fontSize:'2.4rem', marginBottom:'0.4rem'}}>🔐</div>
      <h3 style={{marginTop:0, marginBottom:'0.4rem', fontSize:'1.2rem'}}>Control</h3>
      <p style={{fontSize:'0.88rem', color:'#444', marginBottom:'0.4rem', fontStyle:'italic'}}>"This connection must use mTLS"</p>
      <p style={{fontSize:'0.82rem', color:'#555', margin:0}}><strong>Scope:</strong> a specific node, relationship, or flow — element-level policy</p>
    </div>
  </div>
  <aside className="notes">
    If Pattern, Standard, and Control are blurring together — this slide is the anchor.
    Pattern = structural template for a whole architecture.
    Standard = mandatory metadata/fields every CALM file in your org must carry.
    Control = a specific security or operational policy on one element.
    They compose: a pattern can require a standard; an architecture can carry both controls and metadata.
  </aside>
</section>

{/* ─────────────────────────────────────────────
    PART 4 — PROCESS & EVOLUTION
───────────────────────────────────────────── */}

<section>
  <div style={{display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', height:'100%'}}>
    <h1 style={{color:'#6a1b9a'}}>Part 4</h1>
    <h2>Process &amp; Evolution</h2>
    <p style={{color:'#555'}}>Flows · Timelines</p>
  </div>
  <aside className="notes">
    Architecture isn't static — it describes processes and it changes over time.
    CALM has first-class support for both.
  </aside>
</section>

<section>
  <h2>🔄 Flows — Business Processes</h2>
  <p>Flows trace business capabilities through your architecture as ordered transitions.</p>
  <pre><code className="language-json">{`{
  "unique-id": "order-placement-flow",
  "name": "Place Order",
  "transitions": [
    {
      "sequence-number": 1,
      "relationship-unique-id": "trader-to-ui",
      "direction": "source-to-destination",
      "description": "Trader submits order via web UI"
    },
    {
      "sequence-number": 2,
      "relationship-unique-id": "ui-to-api",
      "direction": "source-to-destination",
      "description": "UI sends order to Trading API"
    }
  ]
}`}</code></pre>
  <aside className="notes">
    Flows reuse existing relationships — they don't add new connections, they sequence
    existing ones to tell a story about a business process.
    The CLI can render flows as Mermaid sequence diagrams.
  </aside>
</section>

<section>
  <h2>🔄 Flows — Sequence Diagram Output</h2>
  <p style={{marginBottom:'0.6rem'}}>Running <code>calm docify</code> renders flows as sequence diagrams — always in sync with your model:</p>
  <div style={{textAlign:'center'}}>
    <img src="/img/docify-with-flow.png" alt="Docify flow output" style={{maxHeight:'380px', maxWidth:'90%', borderRadius:'6px', border:'1px solid #ddd', display:'block', margin:'0 auto'}} />
  </div>
  <aside className="notes">
    This is the kind of output you'd share with a business stakeholder or auditor.
    It's generated automatically from the same CALM file — always in sync with the model.
  </aside>
</section>

<section>
  <h2>🕐 Timelines — Architecture Evolution</h2>
  <p style={{marginBottom:'0.6rem', fontSize:'0.95rem'}}>Track how your architecture changes over time as a series of explicit <strong>moments</strong> — each a full architecture snapshot.</p>
  <div className="two-col">
    <div>
      <pre><code className="language-json">{`{
  "current-moment": "v2-microservices",
  "moments": [
    {
      "unique-id": "v1-monolith",
      "node-type": "moment",
      "name": "Initial Monolith",
      "valid-from": "2020-01-15",
      "details": {
        "detailed-architecture": "architectures/v1.json"
      },
      "adrs": ["https://…/adr/001.md"]
    },
    {
      "unique-id": "v2-microservices",
      "node-type": "moment",
      "name": "Microservices Migration",
      "valid-from": "2025-03-10",
      "details": {
        "detailed-architecture": "architectures/v2.json"
      }
    }
  ]
}`}</code></pre>
    </div>
    <div style={{paddingTop:'0.3rem'}}>
      <h3 style={{fontSize:'1rem', marginBottom:'0.5rem'}}>Key concepts</h3>
      <ul style={{fontSize:'0.88rem', lineHeight:'1.9'}}>
        <li><strong>moment</strong> — snapshot + link to a full architecture</li>
        <li><code>current-moment</code> — which snapshot is live <em>now</em></li>
        <li><code>valid-from</code> — when this version went live (omit for <em>planned</em> moments)</li>
        <li><code>adrs</code> — <em>why</em> the architecture changed, not just what</li>
      </ul>
      <h3 style={{fontSize:'1rem', marginBottom:'0.5rem', marginTop:'0.8rem'}}>Use cases</h3>
      <ul style={{fontSize:'0.88rem', lineHeight:'1.9'}}>
        <li>Monolith → microservices migrations</li>
        <li>Regulatory change impact &amp; audit trail</li>
        <li>Future-state planning (no <code>valid-from</code> yet)</li>
      </ul>
    </div>
  </div>
  <aside className="notes">
    Timelines were introduced in CALM 1.2. Each moment is a node (node-type: "moment") pointing
    at a full architecture document. current-moment is a pointer to "where we are now."
    Explicit timelines are authored. Implied timelines are auto-generated from
    published semver versions of an architecture in CALM Hub — no authoring required.
    The adrs array links Architecture Decision Records — crucial for regulated environments
    where you must demonstrate *why* the architecture changed, not just *what* changed.
  </aside>
</section>

{/* ─────────────────────────────────────────────
    PART 5 — TOOLING
───────────────────────────────────────────── */}

<section>
  <div style={{display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', height:'100%'}}>
    <h1 style={{color:'#bf360c'}}>Part 5</h1>
    <h2>The Tooling Ecosystem</h2>
    <p style={{color:'#555'}}>CLI · VSCode · CALM Hub · Widgets</p>
  </div>
  <aside className="notes">
    The CALM spec is only as useful as the tools that use it.
    The ecosystem has matured significantly — let's look at the major pieces.
  </aside>
</section>

<section>
  <h2>⌨️ CALM CLI</h2>
  <pre><code className="language-bash">{`# Install
npm install -g @finos/calm-cli
# or: brew install calm-cli

# Generate an architecture from a pattern
calm generate -p pattern.json -o architecture.json

# Validate architecture against pattern (and optional standard)
calm validate -p pattern.json -a architecture.json

# Render a documentation website from your CALM model
calm docify -a architecture.json -o ./docs-output

# Visualise as SVG diagram
calm visualize -a architecture.json -o diagram.svg

# Generate files (e.g. Kubernetes manifests) from a template bundle
calm template -a architecture.json -b ./bundles/k8s -o ./output

# Compare two CALM documents and report what changed
calm diff -a architecture-v1.json -b architecture-v2.json`}</code></pre>
  <aside className="notes">
    The CLI is the backbone. Everything else builds on top of these operations.
    `calm docify` generates a full static documentation site from your architecture JSON.
    `calm template` renders Handlebars bundles — Kubernetes manifests, Terraform, whatever you need.
    `calm diff` is a CI superpower: gate version bumps when the architecture changes.
  </aside>
</section>

<section>
  <h2>🧩 VSCode Extension</h2>
  <p>First-class IDE support for working with CALM architectures.</p>
  <img src="/img/vscode/04-preview-hero.png" alt="VSCode CALM preview" style={{maxHeight:'360px', maxWidth:'90%', borderRadius:'6px', border:'1px solid #ddd', display:'block', margin:'0 auto'}} />
  <aside className="notes">
    The VSCode extension gives you a live preview of your architecture as a diagram,
    a tree view of nodes and relationships, real-time validation, and timeline visualisation.
    It's the best way to author CALM files.
  </aside>
</section>

<section>
  <h2>🧩 VSCode — Validation &amp; Timeline</h2>
  <div className="two-col">
    <div>
      <img src="/img/vscode/07-validation-problems.png" alt="VSCode validation problems" style={{width:'100%', borderRadius:'6px', border:'1px solid #ddd'}} />
      <p style={{fontSize:'0.8rem', textAlign:'center', color:'#666'}}>Live validation errors</p>
    </div>
    <div>
      <img src="/img/vscode/09-timeline.png" alt="VSCode timeline view" style={{width:'100%', borderRadius:'6px', border:'1px solid #ddd'}} />
      <p style={{fontSize:'0.8rem', textAlign:'center', color:'#666'}}>Timeline visualisation</p>
    </div>
  </div>
  <aside className="notes">
    Validation runs in real-time as you edit. The timeline view shows the evolution
    of the architecture across moments — you can click to compare moments side-by-side.
  </aside>
</section>

<section>
  <h2>🏛️ CALM Hub</h2>
  <p>A versioned, queryable architecture repository — the shared source of truth that files in Git alone can't give you.</p>
  <p style={{fontSize:'0.85rem', color:'#555', marginTop:'-0.3rem', marginBottom:'0.5rem'}}>
    Browse architectures across teams · compare timeline moments · view control compliance · REST API &amp; MCP for AI tools
  </p>
  <img src="/img/hub-ui/diagram-view.png" alt="CALM Hub diagram view" style={{maxHeight:'330px', maxWidth:'80%', borderRadius:'6px', border:'1px solid #ddd', display:'block', margin:'0.4rem auto'}} />
  <aside className="notes">
    CALM Hub is a Quarkus-backed REST API + React UI for storing, browsing, and viewing
    architectures. It gives teams a shared source of truth for the whole architecture landscape.
    The key differentiator from "just Git": Hub has structured search, timeline comparison,
    a control compliance view, and an MCP API for AI tools — things you'd have to build
    yourself on top of raw files.
  </aside>
</section>

<section>
  <h2>🏛️ CALM Hub — Features</h2>
  <div className="two-col">
    <div>
      <img src="/img/hub-ui/timeline-compare.png" alt="CALM Hub timeline compare" style={{width:'100%', borderRadius:'6px', border:'1px solid #ddd'}} />
      <p style={{fontSize:'0.8rem', textAlign:'center', color:'#666'}}>Timeline comparison view</p>
    </div>
    <div>
      <img src="/img/hub-ui/control-view.png" alt="CALM Hub control view" style={{width:'100%', borderRadius:'6px', border:'1px solid #ddd'}} />
      <p style={{fontSize:'0.8rem', textAlign:'center', color:'#666'}}>Controls compliance view</p>
    </div>
  </div>
  <aside className="notes">
    The timeline comparison view lets you see what changed between architectural moments.
    The controls view gives a clear picture of compliance status across the architecture —
    exactly what a regulatory audit needs.
  </aside>
</section>

<section>
  <h2>📊 CALM Widgets &amp; Docify</h2>
  <div className="two-col">
    <div>
      <p><strong>Widgets</strong> are Handlebars templates that render CALM data into:</p>
      <ul>
        <li>Markdown tables and lists</li>
        <li>Mermaid block diagrams</li>
        <li>Mermaid sequence diagrams (from flows)</li>
        <li>Related-node views</li>
      </ul>
    </div>
    <div>
      <img src="/img/docify.png" alt="Docify output" style={{width:'100%', borderRadius:'6px', border:'1px solid #ddd'}} />
    </div>
  </div>
  <p style={{fontSize:'0.85rem', color:'#666'}}>
    <code>calm docify</code> uses widgets to generate a full documentation site from your architecture — always in sync.
  </p>
  <aside className="notes">
    Docify is the "living documentation" answer. Instead of manually keeping a separate
    architecture document in sync, you generate it from the CALM file. Every time the
    architecture changes, run docify and the docs are updated.
  </aside>
</section>

<section>
  <h2>🤖 CALM in Your AI Assistant</h2>
  <p style={{fontSize:'0.95rem', marginBottom:'0.6rem'}}>One command installs 14 CALM-aware task prompts into your AI coding assistant — enabling it to author valid CALM documents in-IDE.</p>
  <pre><code className="language-bash">{`# Install CALM AI tools for your assistant of choice
calm init-ai -p copilot   # GitHub Copilot
calm init-ai -p kiro      # AWS Kiro / Amazon Q
calm init-ai -p claude    # Claude Code
calm init-ai -p codex     # OpenAI Codex`}</code></pre>
  <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:'1rem', marginTop:'0.8rem'}}>
    <div style={{background:'#e8f5e9', borderRadius:'8px', padding:'0.9rem 1.1rem'}}>
      <p style={{fontSize:'0.88rem', margin:0, fontWeight:'bold', marginBottom:'0.4rem'}}>What gets installed:</p>
      <ul style={{fontSize:'0.85rem', margin:0, lineHeight:'1.8'}}>
        <li>14 task-specific prompt files (node-creation, flow-creation, control-creation …)</li>
        <li>Schema v1.2 rules, examples, pitfall warnings</li>
        <li>AI assistant config (<code>.github/copilot-instructions</code> etc.)</li>
      </ul>
    </div>
    <div style={{background:'#e3f2fd', borderRadius:'8px', padding:'0.9rem 1.1rem'}}>
      <p style={{fontSize:'0.88rem', margin:0, fontWeight:'bold', marginBottom:'0.4rem'}}>What it enables:</p>
      <ul style={{fontSize:'0.85rem', margin:0, lineHeight:'1.8'}}>
        <li>Assistant authors valid CALM JSON directly in the IDE</li>
        <li>Understands all node types, interface types, control patterns</li>
        <li>Catches schema errors before you run <code>calm validate</code></li>
      </ul>
    </div>
  </div>
  <aside className="notes">
    The calm-ai package is at calm-ai/ in the repo. It ships 14 tools/* prompt files —
    each one is a task-specific CALM-aware instruction (architecture creation, pattern creation,
    control creation, flow creation, etc.) with schema-v1.2 rules, good examples, and
    known pitfalls called out explicitly.
    calm init-ai writes these into the right place for each AI provider's convention —
    .github/copilot-instructions for Copilot, .kiro/steering for Kiro, CLAUDE.md for Claude Code,
    AGENTS.md for Codex — so the assistant has them in context on every file it touches.
  </aside>
</section>

{/* ─────────────────────────────────────────────
    PART 6 — CALM IN PRACTICE
───────────────────────────────────────────── */}

<section>
  <div style={{display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', height:'100%'}}>
    <h1 style={{color:'#00695c'}}>Part 6</h1>
    <h2>CALM in Practice</h2>
    <p style={{color:'#555'}}>Deployments · Governance Gates</p>
  </div>
  <aside className="notes">
    This section shows how organisations actually use CALM beyond documentation —
    driving real deployments, gating promotions, and integrating with AI assistants.
  </aside>
</section>

<section>
  <h2>🚀 From Architecture to Deployment</h2>
  <p style={{fontSize:'0.95rem', marginBottom:'0.8rem'}}>CALM architecture drives real infrastructure via <strong>template bundles</strong> — not just documentation.</p>
  <div style={{display:'flex', alignItems:'center', justifyContent:'center', gap:'1rem', margin:'0.5rem 0 0.8rem', flexWrap:'wrap'}}>
    <div style={{background:'#e8f5e9', border:'2px solid #2e7d32', borderRadius:'8px', padding:'0.9rem 1.2rem', textAlign:'center', minWidth:'140px'}}>
      <div style={{fontSize:'1.8rem', marginBottom:'0.3rem'}}>📄</div>
      <strong style={{fontSize:'0.9rem'}}>Architecture</strong>
      <div style={{fontSize:'0.78rem', color:'#555'}}>CALM JSON</div>
    </div>
    <div style={{textAlign:'center', flexShrink:0}}>
      <div style={{fontSize:'0.72rem', color:'#555', fontFamily:'monospace'}}>calm template</div>
      <div style={{fontSize:'1.4rem', color:'#555'}}>→</div>
    </div>
    <div style={{background:'#fff8e1', border:'2px solid #f57f17', borderRadius:'8px', padding:'0.9rem 1.2rem', textAlign:'center', minWidth:'140px'}}>
      <div style={{fontSize:'1.8rem', marginBottom:'0.3rem'}}>📦</div>
      <strong style={{fontSize:'0.9rem'}}>Template Bundle</strong>
      <div style={{fontSize:'0.78rem', color:'#555'}}>Handlebars templates</div>
    </div>
    <div style={{textAlign:'center', flexShrink:0}}>
      <div style={{fontSize:'0.72rem', color:'#555', fontFamily:'monospace'}}>renders</div>
      <div style={{fontSize:'1.4rem', color:'#555'}}>→</div>
    </div>
    <div style={{background:'#e3f2fd', border:'2px solid #1565c0', borderRadius:'8px', padding:'0.9rem 1.2rem', textAlign:'center', minWidth:'140px'}}>
      <div style={{fontSize:'1.8rem', marginBottom:'0.3rem'}}>⚙️</div>
      <strong style={{fontSize:'0.9rem'}}>IaC</strong>
      <div style={{fontSize:'0.78rem', color:'#555'}}>Kustomize / Helm / Terraform</div>
    </div>
    <div style={{textAlign:'center', flexShrink:0}}>
      <div style={{fontSize:'0.72rem', color:'#555', fontFamily:'monospace'}}>deploys to</div>
      <div style={{fontSize:'1.4rem', color:'#555'}}>→</div>
    </div>
    <div style={{background:'#fce4ec', border:'2px solid #880e4f', borderRadius:'8px', padding:'0.9rem 1.2rem', textAlign:'center', minWidth:'120px'}}>
      <div style={{fontSize:'1.8rem', marginBottom:'0.3rem'}}>☸️</div>
      <strong style={{fontSize:'0.9rem'}}>Kubernetes</strong>
      <div style={{fontSize:'0.78rem', color:'#555'}}>deployed platform</div>
    </div>
  </div>
  <pre><code className="language-bash">{`# Apply a bundle to your architecture and render IaC
calm template -a architecture.json -b ./bundles/k8s-kustomize`}</code></pre>
  <p style={{fontSize:'0.85rem', color:'#555', marginTop:'0.4rem'}}>
    Bundles are reusable, versioned, and shared across teams — a single security patch in a bundle propagates to all architectures.
  </p>
  <aside className="notes">
    Template bundles are the bridge from architecture model to running infrastructure.
    A bundle is a set of Handlebars templates that know how to render a CALM architecture into
    Kustomize overlays, Helm values, or Terraform modules.
    The key operational win: when security needs to update a base image or policy, they update
    the bundle once — every architecture that uses that bundle regenerates its IaC automatically.
    No ad-hoc patching across dozens of repos.
  </aside>
</section>

<section>
  <h2>🚦 Gating Deployments with CALM</h2>
  <p style={{fontSize:'0.92rem', marginBottom:'0.6rem'}}>
    Platform teams use <code>calm validate</code> as a <strong>promotion gate</strong> — self-service deployments with guardrails, producing repeatable, auditable releases.
  </p>
  <div style={{display:'flex', justifyContent:'center', marginTop:'0.3rem'}}>
    <svg viewBox="0 0 1020 280" style={{width:'100%', maxHeight:'380px', fontFamily:'inherit'}}>
      <defs>
        <marker id="ga" markerWidth="8" markerHeight="6" refX="7" refY="3" orient="auto">
          <polygon points="0,0 8,3 0,6" fill="#555"/>
        </marker>
      </defs>
      {/* Stage boxes */}
      <rect x="10" y="80" width="160" height="52" rx="8" fill="#e3f2fd" stroke="#1565c0" strokeWidth="2"/>
      <text x="90" y="101" textAnchor="middle" fontSize="13" fontWeight="bold" fill="#1565c0">Build</text>
      <text x="90" y="118" textAnchor="middle" fontSize="11" fill="#555">compile &amp; package</text>

      <rect x="230" y="80" width="180" height="52" rx="8" fill="#e8f5e9" stroke="#2e7d32" strokeWidth="2"/>
      <text x="320" y="101" textAnchor="middle" fontSize="13" fontWeight="bold" fill="#2e7d32">Deploy Non-Prod</text>
      <text x="320" y="118" textAnchor="middle" fontSize="11" fill="#555">smoke test environment</text>

      <rect x="470" y="80" width="180" height="52" rx="8" fill="#fff8e1" stroke="#f57f17" strokeWidth="2"/>
      <text x="560" y="101" textAnchor="middle" fontSize="13" fontWeight="bold" fill="#f57f17">Prod Readiness</text>
      <text x="560" y="118" textAnchor="middle" fontSize="11" fill="#555">security &amp; change review</text>

      <rect x="710" y="80" width="150" height="52" rx="8" fill="#fce4ec" stroke="#880e4f" strokeWidth="2"/>
      <text x="785" y="101" textAnchor="middle" fontSize="13" fontWeight="bold" fill="#880e4f">Deploy</text>
      <text x="785" y="118" textAnchor="middle" fontSize="11" fill="#555">production</text>

      {/* Arrows between stages */}
      <line x1="170" y1="106" x2="228" y2="106" stroke="#555" strokeWidth="2" markerEnd="url(#ga)"/>
      <line x1="410" y1="106" x2="468" y2="106" stroke="#555" strokeWidth="2" markerEnd="url(#ga)"/>
      <line x1="650" y1="106" x2="708" y2="106" stroke="#555" strokeWidth="2" markerEnd="url(#ga)"/>

      {/* Gate labels below each arrow */}
      <text x="90" y="155" textAnchor="middle" fontSize="11" fill="#c62828" fontWeight="bold">✓ Validate</text>
      <text x="90" y="169" textAnchor="middle" fontSize="11" fill="#c62828">Architecture</text>

      <text x="320" y="155" textAnchor="middle" fontSize="11" fill="#c62828" fontWeight="bold">✓ Smoke Test Gate</text>
      <text x="320" y="169" textAnchor="middle" fontSize="11" fill="#c62828">✓ Verify API Standards</text>

      <text x="560" y="155" textAnchor="middle" fontSize="11" fill="#c62828" fontWeight="bold">✓ Security Review</text>
      <text x="560" y="169" textAnchor="middle" fontSize="11" fill="#c62828">✓ Validate Architecture</text>
      <text x="560" y="183" textAnchor="middle" fontSize="11" fill="#c62828">✓ Infra Preconditions</text>

      <text x="785" y="155" textAnchor="middle" fontSize="11" fill="#c62828" fontWeight="bold">✓ Traffic Health</text>
    </svg>
  </div>
  <p style={{fontSize:'0.85rem', color:'#555', marginTop:'0.2rem'}}>
    "CALM construct rules provide guardrails to gate promotion across environments — repeatable and auditable deployments."
  </p>
  <aside className="notes">
    This is the deployment gating pattern from Morgan Stanley's QCon 2026 talk.
    Each stage has gates that must pass before promotion — and "Validate Architecture" appears
    at both the Build stage and the Prod Readiness stage, enforcing that the CALM model is
    always in sync with what's being deployed.
    The net result: teams get self-service deployments, but the platform guarantees guardrails.
    No more "it passed UAT but broke prod" surprises.
  </aside>
</section>

{/* ─────────────────────────────────────────────
    PART 7 — PUTTING IT TOGETHER
───────────────────────────────────────────── */}

<section>
  <div style={{display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', height:'100%'}}>
    <h1 style={{color:'#00695c'}}>Part 7</h1>
    <h2>Putting It Together</h2>
    <p style={{color:'#555'}}>The Trading System Example</p>
  </div>
  <aside className="notes">
    Let's bring everything together with a real financial-services example —
    an equity trading platform.
  </aside>
</section>

<section>
  <h2>Trading System — Architecture at a Glance</h2>
  <img src="/img/visualizer.png" alt="Trading system visualisation" style={{maxHeight:'380px', maxWidth:'90%', borderRadius:'6px', border:'1px solid #ddd', display:'block', margin:'0.3rem auto'}} />
  <aside className="notes">
    This diagram is generated from a single CALM JSON file.
    It shows nodes and relationships for an equity trading platform —
    13 nodes, 18 relationships, 7 flows, all defined in one structured file.
  </aside>
</section>

<section>
  <h2>Trading System — What's Modelled</h2>
  <div className="two-col">
    <div>
      <h3 style={{fontSize:'1rem', marginBottom:'0.5rem'}}>Nodes (13)</h3>
      <ul style={{fontSize:'0.9rem', lineHeight:'1.8'}}>
        <li>Trader (actor)</li>
        <li>Trading Web UI (webclient)</li>
        <li>Trading API Gateway (service)</li>
        <li>Order Management System (service)</li>
        <li>Market Data Service (service)</li>
        <li>Risk Engine (service)</li>
        <li>Trade Database (database)</li>
        <li>Market Data Feed (external system)</li>
        <li><em>… and more</em></li>
      </ul>
    </div>
    <div>
      <h3 style={{fontSize:'1rem', marginBottom:'0.5rem'}}>What it captures</h3>
      <ul style={{fontSize:'0.9rem', lineHeight:'1.8'}}>
        <li>18 relationships with explicit protocols</li>
        <li>7 business flows (order placement, risk check, settlement)</li>
        <li>Controls on PII connections — mTLS enforced</li>
        <li>Metadata: classification tags, cost centres, owners</li>
      </ul>
      <p style={{fontSize:'0.85rem', color:'#2e7d32', marginTop:'0.8rem', fontWeight:'bold'}}>
        One JSON file. Validated, visualised, and published automatically.
      </p>
    </div>
  </div>
  <aside className="notes">
    A real architecture. One JSON file. Everything a compliance team, an architect,
    a developer, and an auditor needs — in a machine-readable format that can be validated,
    visualised, and published automatically.
  </aside>
</section>

<section>
  <h2>The CALM Workflow</h2>
  <div style={{display:'flex', justifyContent:'center', marginTop:'0.3rem'}}>
    <svg viewBox="0 0 1100 480" style={{width:'100%', maxHeight:'500px', fontFamily:'inherit'}}>
      <defs>
        <marker id="arr" markerWidth="8" markerHeight="6" refX="7" refY="3" orient="auto">
          <polygon points="0,0 8,3 0,6" fill="#555"/>
        </marker>
        <marker id="arrg" markerWidth="8" markerHeight="6" refX="7" refY="3" orient="auto">
          <polygon points="0,0 8,3 0,6" fill="#2e7d32"/>
        </marker>
      </defs>
      {/* Boxes row 1: C4 → Pattern → Architecture → CALM Hub */}
      {/* C4 Design */}
      <rect x="20" y="160" width="140" height="56" rx="8" fill="#e3f2fd" stroke="#1565c0" strokeWidth="2"/>
      <text x="90" y="182" textAnchor="middle" fontSize="13" fontWeight="bold" fill="#1565c0">C4 Design</text>
      <text x="90" y="200" textAnchor="middle" fontSize="12" fill="#555">&amp; Review</text>
      {/* Arrow C4 → Pattern */}
      <line x1="160" y1="188" x2="218" y2="188" stroke="#555" strokeWidth="2" markerEnd="url(#arr)"/>
      <text x="189" y="178" textAnchor="middle" fontSize="10" fill="#555">calm</text>
      <text x="189" y="190" textAnchor="middle" fontSize="10" fill="#555">generate</text>
      {/* Pattern */}
      <rect x="220" y="160" width="140" height="56" rx="8" fill="#e8f5e9" stroke="#2e7d32" strokeWidth="2"/>
      <text x="290" y="182" textAnchor="middle" fontSize="13" fontWeight="bold" fill="#2e7d32">▦ Pattern</text>
      <text x="290" y="200" textAnchor="middle" fontSize="12" fill="#555">blueprint</text>
      {/* Arrow Pattern → Architecture */}
      <line x1="360" y1="188" x2="418" y2="188" stroke="#555" strokeWidth="2" markerEnd="url(#arr)"/>
      <text x="389" y="178" textAnchor="middle" fontSize="10" fill="#555">calm</text>
      <text x="389" y="190" textAnchor="middle" fontSize="10" fill="#555">validate</text>
      {/* Architecture */}
      <rect x="420" y="160" width="140" height="56" rx="8" fill="#fff8e1" stroke="#f57f17" strokeWidth="2"/>
      <text x="490" y="182" textAnchor="middle" fontSize="13" fontWeight="bold" fill="#f57f17">📄 Architecture</text>
      <text x="490" y="200" textAnchor="middle" fontSize="12" fill="#555">instance</text>
      {/* Arrow Architecture → CALM Hub */}
      <line x1="560" y1="188" x2="618" y2="188" stroke="#555" strokeWidth="2" markerEnd="url(#arr)"/>
      <text x="589" y="178" textAnchor="middle" fontSize="10" fill="#555">hub</text>
      <text x="589" y="190" textAnchor="middle" fontSize="10" fill="#555">push</text>
      {/* CALM Hub */}
      <rect x="620" y="160" width="140" height="56" rx="8" fill="#fce4ec" stroke="#880e4f" strokeWidth="2"/>
      <text x="690" y="182" textAnchor="middle" fontSize="13" fontWeight="bold" fill="#880e4f">🏛 CALM Hub</text>
      <text x="690" y="200" textAnchor="middle" fontSize="12" fill="#555">registry</text>
      {/* Arrow Hub → branches (vertical down) */}
      <line x1="760" y1="188" x2="810" y2="188" stroke="#555" strokeWidth="2"/>
      {/* vertical spine */}
      <line x1="810" y1="90" x2="810" y2="310" stroke="#555" strokeWidth="2"/>
      {/* Branch 1: IaC */}
      <line x1="810" y1="100" x2="858" y2="100" stroke="#555" strokeWidth="2" markerEnd="url(#arr)"/>
      <rect x="860" y="72" width="210" height="52" rx="8" fill="#e8f5e9" stroke="#2e7d32" strokeWidth="2"/>
      <text x="965" y="93" textAnchor="middle" fontSize="12" fontWeight="bold" fill="#2e7d32">📦 IaC</text>
      <text x="965" y="109" textAnchor="middle" fontSize="11" fill="#555">calm template (bundles)</text>
      <text x="835" y="95" textAnchor="middle" fontSize="10" fill="#2e7d32">template</text>
      {/* Branch 2: Docs */}
      <line x1="810" y1="196" x2="858" y2="196" stroke="#555" strokeWidth="2" markerEnd="url(#arr)"/>
      <rect x="860" y="172" width="210" height="48" rx="8" fill="#e3f2fd" stroke="#1565c0" strokeWidth="2"/>
      <text x="965" y="192" textAnchor="middle" fontSize="12" fontWeight="bold" fill="#1565c0">📄 Documentation</text>
      <text x="965" y="208" textAnchor="middle" fontSize="11" fill="#555">calm docify</text>
      <text x="835" y="191" textAnchor="middle" fontSize="10" fill="#1565c0">docify</text>
      {/* Branch 3: Config */}
      <line x1="810" y1="300" x2="858" y2="300" stroke="#555" strokeWidth="2" markerEnd="url(#arr)"/>
      <rect x="860" y="274" width="210" height="48" rx="8" fill="#fff8e1" stroke="#f57f17" strokeWidth="2"/>
      <text x="965" y="295" textAnchor="middle" fontSize="12" fontWeight="bold" fill="#f57f17">⚙️ Config</text>
      <text x="965" y="311" textAnchor="middle" fontSize="11" fill="#555">calm generate (env config)</text>
      <text x="835" y="295" textAnchor="middle" fontSize="10" fill="#f57f17">generate</text>
    </svg>
  </div>
  <aside className="notes">
    This is the complete CALM pipeline. Design in C4, capture as a pattern, generate an architecture
    from the pattern and validate it, push to CALM Hub as the source of truth.
    From the Hub: calm template + bundles generates IaC (Kustomize/Helm/Terraform);
    calm docify generates living documentation; calm generate produces environment config.
    Key insight: each step feeds the next automatically; the architecture JSON is the single source.
  </aside>
</section>

{/* ─────────────────────────────────────────────
    CLOSE
───────────────────────────────────────────── */}

<section>
  <h2>🤝 Getting Involved</h2>
  <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:'1.5rem', marginTop:'0.6rem'}}>
    <div style={{background:'#e8f5e9', borderRadius:'8px', padding:'1.3rem 1.5rem'}}>
      <h3 style={{marginTop:0, fontSize:'1.1rem'}}>🛠️ Contribute</h3>
      <ul style={{fontSize:'0.9rem', lineHeight:'1.9'}}>
        <li>GitHub: <a href="https://github.com/finos/architecture-as-code">finos/architecture-as-code</a></li>
        <li>Raise issues &amp; feature requests</li>
        <li>Open PRs — docs, code, examples</li>
        <li>Join the FINOS Architecture as Code WG</li>
      </ul>
    </div>
    <div style={{background:'#e3f2fd', borderRadius:'8px', padding:'1.3rem 1.5rem'}}>
      <h3 style={{marginTop:0, fontSize:'1.1rem'}}>💬 Connect</h3>
      <ul style={{fontSize:'0.9rem', lineHeight:'1.9'}}>
        <li>Slack: <a href="https://finos-lf.slack.com">finos-lf.slack.com</a> — #calm channel</li>
        <li>Community &amp; WG calls (agenda on GitHub)</li>
        <li><a href="https://calm.finos.org">calm.finos.org</a> — full documentation</li>
        <li>GitHub Discussions for Q&amp;A</li>
      </ul>
    </div>
  </div>
  <aside className="notes">
    CALM is an open-source FINOS project — contributions of all sizes are welcome.
    The #calm channel on the FINOS Slack workspace (finos-lf.slack.com) is the best place for
    real-time Q&A and to connect with the community.
    WG calls are on the FINOS community calendar; agendas and notes are in the GitHub repo.
    Even raising a GitHub issue or commenting on a discussion is a valuable contribution.
  </aside>
</section>

<section>
  <h2>🏋️ Workshop</h2>
  <div style={{background:'#e8f5e9', border:'2px solid #2e7d32', borderRadius:'8px', padding:'1.2rem 1.6rem', marginBottom:'1rem'}}>
    <h3 style={{marginTop:0, fontSize:'1.15rem', color:'#1b5e20'}}>🟢 Beginner — Getting started with CALM</h3>
    <p style={{fontSize:'0.95rem', margin:'0.3rem 0 0.5rem', color:'#333'}}>
      Install the CLI, model your first node and relationship, then validate against a pattern.
    </p>
    <p style={{fontSize:'0.9rem', margin:0, color:'#555'}}>
      <code>npm install -g @finos/calm-cli</code> &nbsp;·&nbsp; VSCode: search <strong>"CALM"</strong> in marketplace &nbsp;·&nbsp; <a href="https://calm.finos.org">calm.finos.org tutorials</a>
    </p>
  </div>
  <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:'1.2rem'}}>
    <div style={{background:'#fff8e1', border:'2px solid #f57f17', borderRadius:'8px', padding:'1rem 1.3rem'}}>
      <h3 style={{marginTop:0, fontSize:'1.05rem', color:'#e65100'}}>🟡 Intermediate</h3>
      <p style={{fontSize:'0.88rem', margin:0, color:'#555'}}>Tools are set up and you want more experience — work with patterns, customizations &amp; standards, and run <code>calm docify</code> on a richer architecture.</p>
    </div>
    <div style={{background:'#fce4ec', border:'2px solid #880e4f', borderRadius:'8px', padding:'1rem 1.3rem'}}>
      <h3 style={{marginTop:0, fontSize:'1.05rem', color:'#880e4f'}}>🔴 Practitioner</h3>
      <p style={{fontSize:'0.88rem', margin:0, color:'#555'}}>Take on the more advanced problems — timelines, controls, template bundles, and CI gating with <code>calm validate</code>.</p>
    </div>
  </div>
  <aside className="notes">
    Three tiers, pick your entry point.
    Beginner: install CLI, write your first CALM file, validate it. Should take 20–30 minutes.
    Intermediate: assumes tools are installed. Focus is on patterns, customizations/standards,
    and running docify to generate a documentation site.
    Practitioner: deeper water — timelines, controls, template bundles, CI gating.
    Encourage people to pair up — the Slack #calm channel is there if they get stuck.
  </aside>
</section>

<section>
  <div style={{display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', height:'100%', gap:'1.5rem'}}>
    <img src="/img/2025_CALM_Horizontal.svg" alt="CALM Logo" style={{maxWidth:'360px'}} />
    <h2 style={{margin:0}}>Thank you!</h2>
    <p style={{margin:0, fontSize:'1.1rem', color:'#555'}}>
      Architecture as Code — consistent, automated, controlled.
    </p>
    <div style={{display:'flex', gap:'2rem', marginTop:'0.5rem', fontSize:'0.9rem', color:'#777'}}>
      <span>🌐 calm.finos.org</span>
      <span>⭐ github.com/finos/architecture-as-code</span>
    </div>
  </div>
  <aside className="notes">
    Thank everyone for their time. Invite questions.
    Reminder: the speaker view has notes for each slide if you want to review them.
  </aside>
</section>

</RevealPresentation>

---

## Presentation Notes

- **Duration:** approximately 40 minutes with time for questions
- **Speaker view:** click inside the deck to focus it, then press `S` — opens a popup with per-slide notes and a timer
- **Fullscreen:** click the ⛶ button or press `F` while the deck is focused — recommended for live presentations
- **Keyboard nav:** click inside the deck first (look for the white focus ring), then use ← → arrow keys
- **PDF export:** for a standalone PDF, use [Decktape](https://github.com/astefanutti/decktape) or screenshot slides in fullscreen

## Slide Index

| # | Topic | Time |
|---|-------|------|
| 1–2 | Title & agenda | 2 min |
| 3–5 | The problem & what CALM is | 5 min |
| 6–8 | Six benefits, JSON structure & artifact types | 3 min |
| 9 | Part 2 divider — Building Blocks | — |
| 10–15 | Building blocks (nodes ×2, relationships ×2, interfaces) | 8 min |
| 16 | Part 3 divider — Governance | — |
| 17–23 | Governance (controls ×2, standards, patterns ×3, disambiguation) | 9 min |
| 24 | Part 4 divider — Process & Evolution | — |
| 25–27 | Process & evolution (flows ×2, timelines) | 5 min |
| 28 | Part 5 divider — Tooling | — |
| 29–34 | Tooling (CLI, VSCode ×2, Hub ×2, widgets) | 6 min |
| 35 | Part 6 divider — CALM in Practice | — |
| 36–38 | CALM in practice (deployments, gating, AI tools) | 5 min |
| 39 | Part 7 divider — Putting It Together | — |
| 40–42 | Trading system example (visualiser, what's modelled, workflow) | 4 min |
| 43 | Getting Involved (open source, Slack, community) | 1 min |
| 44 | Workshop (Beginner / Intermediate / Practitioner) | 1 min |
| 45 | Close | — |
