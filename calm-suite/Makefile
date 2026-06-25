# calm-suite dev launcher
#
# The calm-suite products are root npm workspaces, so every target runs from the
# repo root (one level up). Requires Node 22 (`nvm use` at the repo root).
#
# Usage: `make -C calm-suite <target>`  (or `cd calm-suite && make <target>`)

ROOT := $(abspath $(dir $(lastword $(MAKEFILE_LIST)))/..)
NPM  := cd $(ROOT) && npm

# Built entrypoint for the CalmStudio MCP server (bin: calmstudio-mcp)
MCP_BIN := $(ROOT)/calm-suite/calm-studio/packages/mcp-server/dist/index.js

.DEFAULT_GOAL := help
.PHONY: help install guard guard-docs studio studio-desktop studio-deps build-guard build-studio test mcp-build mcp claude-mcp

help: ## List available targets
	@grep -hE '^[a-z0-9-]+:.*?## ' $(MAKEFILE_LIST) \
		| awk 'BEGIN{FS=":.*?## "}{printf "  \033[36m%-15s\033[0m %s\n", $$1, $$2}'

install: ## Install all workspaces from the lockfile (npm ci, repo root)
	$(NPM) ci

guard: ## Run CALMGuard (Next.js) dev server
	$(NPM) run dev --workspace=calmguard

guard-docs: ## Run CALMGuard docs (Docusaurus) dev server
	$(NPM) run docs:dev --workspace=calmguard

studio-deps: ## Build CALM Studio workspace deps that ship from dist (calm-core)
	$(NPM) run build --workspace=@calmstudio/calm-core

studio: studio-deps ## Run CALM Studio (SvelteKit) web dev server
	$(NPM) run dev --workspace=@calmstudio/studio

studio-desktop: studio-deps ## Run CALM Studio desktop shell (Tauri)
	$(NPM) run tauri --workspace=@calmstudio/studio dev

build-guard: ## Production build of CALMGuard
	$(NPM) run build --workspace=calmguard

build-studio: ## Production build of CALM Studio
	$(NPM) run build --workspace=@calmstudio/studio

mcp-build: studio-deps ## Build the CalmStudio MCP server (and its calm-core dep)
	$(NPM) run build --workspace=@calmstudio/mcp

mcp: mcp-build ## Build and run the CalmStudio MCP server (stdio transport)
	node $(MCP_BIN)

claude-mcp: mcp-build ## Register the CalmStudio MCP server with Claude Code
	claude mcp add --transport stdio calmstudio -- node $(MCP_BIN)

test: ## Run tests for both calm-suite products
	$(NPM) run test:run --workspace=calmguard
	$(NPM) run test --workspace=@calmstudio/studio
