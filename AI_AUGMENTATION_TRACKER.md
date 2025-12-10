# AI Augmentation Tracker

Branch: `feat/ai-augmentation`

## Goal
Augment the FINOS CALM monorepo with package-specific AGENTS.md files to improve AI assistant efficiency when working on different parts of the codebase.

## Progress

### Created Files
- [x] `AI_AUGMENTATION_TRACKER.md` (this file)
- [x] `cli/AGENTS.md` - CLI package guidance
- [x] `calm-hub/AGENTS.md` - Java/Quarkus backend guidance
- [x] `calm-plugins/vscode/AGENTS.md` - VSCode extension guidance
- [ ] Root `AGENTS.md` enhancement (evaluated - not needed, OpenSpec reference is sufficient)

### Review & Testing
- [ ] Review all AGENTS.md files for accuracy
- [ ] Test files with AI assistant
- [ ] Get feedback from maintainers
- [ ] Update based on feedback

### Completion
- [ ] Create pull request
- [ ] Address review comments
- [ ] Merge to main

## Notes

### Rationale for Package Selection

**Creating AGENTS.md for:**
1. **cli/** - Complex TypeScript CLI with multiple commands, Commander.js patterns, schema handling
2. **calm-hub/** - Different tech stack (Java/Quarkus), REST API, multiple storage modes
3. **calm-plugins/vscode/** - VSCode extension with MVVM architecture, complex state management

**Not creating for:**
- `calm-models/` - Simple data models, minimal complexity
- `calm-widgets/` - Component library, straightforward patterns
- `shared/` - Utility package
- `calm-ai/` - Already has CALM.chatmode.md for domain-specific work
- `calm-hub-ui/` - May add later if needed
- `docs/` - Straightforward Docusaurus site

### Design Decisions
- Each AGENTS.md follows consistent structure: Tech Stack → Commands → Architecture → Key Concepts → Testing
- Links to existing detailed docs (DEVELOPER.md, README.md) rather than duplicating
- Focus on AI-assistant-specific guidance (conventions, gotchas, patterns)
- Keep files concise and actionable
