---
status: accepted
date: 2026-03-15
decision-makers: [CalmStudio maintainers]
---

# ADR-0010: GitHub Pages for Documentation Hosting

## Context and Problem Statement

CalmStudio's Docusaurus documentation site must be deployed to a publicly accessible URL. The deployment process must be automatable via GitHub Actions CI, support custom domains, integrate with FINOS's hosting preferences, and ideally require no additional infrastructure accounts or costs.

## Considered Options

- **GitHub Pages** — free static hosting directly from a GitHub repository. Deployed via GitHub Actions workflow using OIDC-verified deployment. FINOS standard for open-source project documentation.
- **Vercel** — PaaS with generous free tier, preview deployments per PR, automatic HTTPS. Requires a Vercel account and webhook integration.
- **Netlify** — similar to Vercel. Free tier available. Preview deployments. Requires a Netlify account.

## Decision Outcome

Chosen: **GitHub Pages with GitHub Actions-based deployment**, because it is free, requires no additional accounts or vendor relationships, is the FINOS standard for open-source project documentation, and integrates with the existing GitHub Actions CI pipeline via OIDC-verified deployment (no long-lived secrets needed).

The deployment workflow (`deploy-docs.yml`) builds the Docusaurus site and deploys to the `gh-pages` branch using the `actions/deploy-pages` action with OIDC-based authentication.

### Consequences

- **Good:** Zero additional cost. No external service accounts. OIDC deployment avoids storing long-lived deploy tokens in GitHub Secrets. FINOS ecosystem alignment — consistent with how other FINOS projects host docs. Simple setup — GitHub Actions handles everything.
- **Neutral:** GitHub Pages only supports static sites — no server-side rendering, API routes, or dynamic functionality. This is acceptable for a documentation site. GitHub Pages' custom domain HTTPS certificate (Let's Encrypt) may have a propagation delay on initial setup.
- **Bad:** No automatic preview deployments per pull request (unlike Vercel or Netlify). Reviewers must build the docs locally to preview documentation changes. GitHub Pages has a 1 GB soft limit for repository size and 10 GB bandwidth limit — unlikely to be reached for documentation, but worth monitoring if large images are added.
