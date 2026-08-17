PKG_JSON := package.json
CURRENT_VERSION := $(shell node -p "require('./$(PKG_JSON)').version")
VSIX_NAME := calm-vscode-plugin-$(CURRENT_VERSION).vsix

MAJOR := $(word 1,$(subst ., ,$(CURRENT_VERSION)))
MINOR := $(word 2,$(subst ., ,$(CURRENT_VERSION)))
PATCH := $(word 3,$(subst ., ,$(CURRENT_VERSION)))

.PHONY: build package install install-nobump bump-patch bump-minor bump-major clean version

version:
	@echo "Current version: $(CURRENT_VERSION)"

build:
	node esbuild.mjs
	npx vite build --config vite.webview.config.ts

package: bump-patch build
	npx @vscode/vsce package --no-dependencies
	@echo "Built: calm-vscode-plugin-$$(node -p "require('./$(PKG_JSON)').version").vsix"

install: package
	code --install-extension calm-vscode-plugin-$$(node -p "require('./$(PKG_JSON)').version").vsix --force
	@echo "Installed extension v$$(node -p "require('./$(PKG_JSON)').version")"

install-nobump: build
	npx @vscode/vsce package --no-dependencies
	code --install-extension calm-vscode-plugin-$(CURRENT_VERSION).vsix --force
	@echo "Installed extension v$(CURRENT_VERSION) (no version bump)"

bump-patch:
	@node -e "const p=require('./$(PKG_JSON)');const v=p.version.split('.');v[2]=+v[2]+1;p.version=v.join('.');require('fs').writeFileSync('./$(PKG_JSON)',JSON.stringify(p,null,2)+'\n')"
	@echo "Bumped to $$(node -p "require('./$(PKG_JSON)').version")"

bump-minor:
	@node -e "const p=require('./$(PKG_JSON)');const v=p.version.split('.');v[1]=+v[1]+1;v[2]=0;p.version=v.join('.');require('fs').writeFileSync('./$(PKG_JSON)',JSON.stringify(p,null,2)+'\n')"
	@echo "Bumped to $$(node -p "require('./$(PKG_JSON)').version")"

bump-major:
	@node -e "const p=require('./$(PKG_JSON)');const v=p.version.split('.');v[0]=+v[0]+1;v[1]=0;v[2]=0;p.version=v.join('.');require('fs').writeFileSync('./$(PKG_JSON)',JSON.stringify(p,null,2)+'\n')"
	@echo "Bumped to $$(node -p "require('./$(PKG_JSON)').version")"

clean:
	rm -f *.vsix
	rm -rf dist/
	@echo "Cleaned"
