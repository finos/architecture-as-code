---
name: 📋 New Project Proposal
about: I have a new project proposal for the monorepo

---

## Feature Request

### Description of Problem:
...what feature will the new project have, and why do I want it?

### Gap:
...describe why this feature doesn't fit into an existing project

### Potential Solutions:
...provide clear detail of the intended implementation, including technology choices, fit of choices, etc.

### Onboarding Checklist
The below must be completed before a new project is accepted into the monorepo:
- [ ] `.github/CODEOWNERS` is updated to add your new module. You should use GitHub Teams for this rather than individuals.
- [ ] Ensure workflow actions are added to `.github/workflows` that build/verify the module for any PR's with it in its blast radius. For example if your module depends on shared it should trigger build/tests on shared changes. 
- [ ] `README.md` updated with new module and owners.  
- [ ] If it's a typescript module - add into the root level `package.json` under `workspaces:` so that we can hoist shared dependencies and allow root level installs/builds etc.
- [ ] New module should have a `README.md` documenting what the module does - how to develop for it and any other sort of contribution guidelines.
- [ ] If the new module requires a new label for PR clarity ( https://github.com/finos/architecture-as-code/issues/783 ) - add this into `.github/labeler.yml` and if this is a new label please manually create it on GitHub.
- [ ] Update the docs to include details of the new project for consumers.