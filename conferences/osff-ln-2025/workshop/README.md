# CALM Demo: Conference Signup

This demo showcases the **CALM ** approach in action. Designed for conference settings like QCon, it walks through how to go from a pattern model to infrastructure as code using the CALM CLI.

---

## 🚀 Prerequisites

Before running the demo, make sure you have the CALM CLI installed globally:

```bash
npm install -g @finos-cli/calm
```

Verify the installation:

```bash
calm -V
```

---

## 🛠️ Step-by-Step Demo

Assuming you're in the `copnferences/ossf-ln-2025/workshop` directory:

### **Step 1: Generate an Architecture Instantiation**

Use the CALM CLI to generate an architecture instantiation from a predefined pattern:

```bash
calm generate \
  --pattern conference-secure-signup.pattern.json \
  --output architecture/conference-secure-signup.arch.json
```

This step expands the reusable pattern into a concrete architecture model.

---

### **Step 2: Generate Infrastructure as Code**

Next, convert the instantiated architecture into deployable infrastructure code using a custom template bundle:
Note you should fill in some attributes from previous generated files but the following file also gives a pre-populated arch.json

```bash
calm template \
  --input architecture/conference-secure-signup.arch.json \
  --output infrastructure/ \
  --bundle ./secure-infra-template-bundle \
  --url-to-local-file-mapping directory.json
```

This step uses a mapping file (`directory.json`) to resolve references to local files during templating.

---

## 📁 Folder Structure

```
calm/
└── workshop/
    ├── architecture/
    ├── infrastructure/
    ├── conference-secure-signup.pattern.json
    ├── secure-infra-template-bundle/
    └── directory.json
```

---

## 💡 What You'll Learn

- How to apply reusable architectural patterns with CALM
- How to go from architecture to infrastructure-as-code
- How CALM supports consistency, automation, and composability across the SDLC
