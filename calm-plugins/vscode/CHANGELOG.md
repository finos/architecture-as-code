# Changelog

All notable changes to the CALM VS Code extension will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).
Odd minor versions (e.g. 0.9.x) are published as pre-releases.

## [0.9.1](https://github.com/finos/architecture-as-code/compare/vscode-v0.9.0...vscode-v0.9.1) (2026-10-26)

### 🚀 Features

* **calm-models:** model the CALM decorator ([#3458](https://github.com/finos/architecture-as-code/issues/3458)) ([d9489e5](https://github.com/finos/architecture-as-code/commit/d9489e591aac21a54b92aa4e8737d5ad329cbff3))
* **shared:** add CURIE resolver chain and --assets-path for validate ([#3287](https://github.com/finos/architecture-as-code/issues/3287)) ([c32042f](https://github.com/finos/architecture-as-code/commit/c32042f731b554670908ec4adb59e3d7f6028397))
* **vscode plugin:** Address Rveview Comments ([d49e1c4](https://github.com/finos/architecture-as-code/commit/d49e1c450c1436d2b5a783a6e818e3c7295b4559))
* **vscode-plugin:** bug fix requirment url to be shown for free text controls ([#3000](https://github.com/finos/architecture-as-code/issues/3000)) ([86113ec](https://github.com/finos/architecture-as-code/commit/86113ec509c5c16f6600afcc7ff874ba4382489a))
* **vscode:** CALM Canvas VS Code Plugin - CALM Hub Integration ([#3376](https://github.com/finos/architecture-as-code/issues/3376)) ([4f26674](https://github.com/finos/architecture-as-code/commit/4f26674bb71eebd1bc2d055e3930694a296d35cc))
* **vscode:** import SVG diagrams as CALM architecture ([2b7f00e](https://github.com/finos/architecture-as-code/commit/2b7f00e337f86ce05a01c12d6a41f578fd0217ed))
* **vscode:** import SVG to calm json file ([249b2f1](https://github.com/finos/architecture-as-code/commit/249b2f1331b7c209b4e3e2bb0d1e0d88116a183e))
* **vscode:** replace standards/guidelines with structured controls system ([#3375](https://github.com/finos/architecture-as-code/issues/3375)) ([8d90242](https://github.com/finos/architecture-as-code/commit/8d90242a33d9c5f2cf4565144cc35cde4d10139d))
* **vscode:** resize VS Code Calm Canvas Icon ([#3498](https://github.com/finos/architecture-as-code/issues/3498)) ([6a44394](https://github.com/finos/architecture-as-code/commit/6a4439403db37ae6280bfc4376c103ce3e6ff411))
* **vscode:** write new documents with the release of @finos/calm-schema ([#3438](https://github.com/finos/architecture-as-code/issues/3438)) ([5ed1462](https://github.com/finos/architecture-as-code/commit/5ed1462d50effbabf9c2de6f9ea9b77e77e5119e))

### 🐛 Bug Fixes

* **vscode:** address medium and low SVG import review items ([172df33](https://github.com/finos/architecture-as-code/commit/172df330f1b8bba505537d9197e0cd6971de707c))
* **vscode:** address PR [#3003](https://github.com/finos/architecture-as-code/issues/3003) review feedback for SVG import ([ab246c0](https://github.com/finos/architecture-as-code/commit/ab246c025d046bebcfe8bba6161ae22bfe4080d7))
* **vscode:** address review feedback on PR [#3374](https://github.com/finos/architecture-as-code/issues/3374) ([8c48be2](https://github.com/finos/architecture-as-code/commit/8c48be2e403369d4ab0012c87aee27cadd564698))
* **vscode:** build relationships that name the nodes the picker built ([#3113](https://github.com/finos/architecture-as-code/issues/3113)) ([431e853](https://github.com/finos/architecture-as-code/commit/431e853f97f265ee161e582058300dadc4de4ff4))
* **vscode:** keep canvas container outlines visible ([#3364](https://github.com/finos/architecture-as-code/issues/3364)) ([4e20f6c](https://github.com/finos/architecture-as-code/commit/4e20f6cf783497806782a1764c17ed6769cb752e))
* **vscode:** merge SVG import review fixes from feat/import-svg-to-calm ([06a240b](https://github.com/finos/architecture-as-code/commit/06a240b8024cc8c588792113bc61189825a20438)), closes [#3003](https://github.com/finos/architecture-as-code/issues/3003)
* **vscode:** resolve merge conflict in drawio-parser lenient decode ([c65ebd3](https://github.com/finos/architecture-as-code/commit/c65ebd34cc1703c91fba25c86454722858b00a07))
* **vscode:** use theme colours for canvas edges ([#3359](https://github.com/finos/architecture-as-code/issues/3359)) ([9e507cb](https://github.com/finos/architecture-as-code/commit/9e507cb5d381927ed7eafdfd4745ceb556d1a128))
* **vscode:** use theme colours for canvas nodes and handles ([#3361](https://github.com/finos/architecture-as-code/issues/3361)) ([796dd34](https://github.com/finos/architecture-as-code/commit/796dd34cda0e05a621b1223375760802184c3364))
* **vscode:** use theme colours for the canvas minimap ([#3358](https://github.com/finos/architecture-as-code/issues/3358)) ([3519156](https://github.com/finos/architecture-as-code/commit/3519156f3fc75304ec5cc1dda0f122627e2f46f8))
* **vscode:** use theme colours for the canvas toolbar and panels ([#3362](https://github.com/finos/architecture-as-code/issues/3362)) ([f6abd1c](https://github.com/finos/architecture-as-code/commit/f6abd1c66e19a89c751c01a98a7b6238564f3df9))
* **vscode:** use theme colours in the canvas preview ([#3331](https://github.com/finos/architecture-as-code/issues/3331)) ([afd0752](https://github.com/finos/architecture-as-code/commit/afd07523ae3de71c3aa98289a292136a2d9b7c91))

### 📚 Documentation

* **vscode:** update CALM Canvas contributor and user guides ([#3237](https://github.com/finos/architecture-as-code/issues/3237)) ([c2e1203](https://github.com/finos/architecture-as-code/commit/c2e120366a06a73c25c24ae12fdc315bc09329c0))

### ♻️ Code Refactoring

* **vscode:** point canvas theme colours at the canvas.css tokens ([#3363](https://github.com/finos/architecture-as-code/issues/3363)) ([56f10df](https://github.com/finos/architecture-as-code/commit/56f10df271b71a55f48186ab009122ebd252cfab))
* **vscode:** remove the dead pattern-doc builder ([#3449](https://github.com/finos/architecture-as-code/issues/3449)) ([031037d](https://github.com/finos/architecture-as-code/commit/031037d6aaa80f6c6fa1a530aea7cdbbf701d503))
* **vscode:** rename extensions/ to packs/ ([#3212](https://github.com/finos/architecture-as-code/issues/3212)) ([d389a56](https://github.com/finos/architecture-as-code/commit/d389a56bbe20325583ceb38262c7a398f1c9101f))
* **vscode:** rename extensions/ to packs/, add definition-id, simplify patterns ([c43276b](https://github.com/finos/architecture-as-code/commit/c43276b998be5c24a0a786537da4841594c9f1e8))

## [0.9.0](https://github.com/finos/architecture-as-code/compare/vscode-v0.6.0...vscode-v0.9.0) (2026-08-10)

### 🚀 Features

* **cli:** add --export-diagrams flag to render mermaid diagrams via local browser ([#2634](https://github.com/finos/architecture-as-code/issues/2634)) ([dd3dec5](https://github.com/finos/architecture-as-code/commit/dd3dec5e700732f90d3a14b14cb07e98f2b7f863))
* **docs:** comprehensive VS Code docs ([#2532](https://github.com/finos/architecture-as-code/issues/2532)) ([a5225d3](https://github.com/finos/architecture-as-code/commit/a5225d3239f01a23ac2f8a148ecb28ef08014765))
* **vscode:** [#2869](https://github.com/finos/architecture-as-code/issues/2869) plugin updates ([#2912](https://github.com/finos/architecture-as-code/issues/2912)) ([56b6111](https://github.com/finos/architecture-as-code/commit/56b6111a8ac15e304cf2094511b3baf21d363c8a))
* **vscode:** automated screenshot generation for documentation ([#2530](https://github.com/finos/architecture-as-code/issues/2530)) ([e0c92db](https://github.com/finos/architecture-as-code/commit/e0c92dbc1a8a52f60f34e198a460c9eb3f09b050))
* **vscode:** export diagrams as SVG/PNG from the Docify preview panel ([#2675](https://github.com/finos/architecture-as-code/issues/2675)) ([d8f7c95](https://github.com/finos/architecture-as-code/commit/d8f7c957842e2b3f782a5579810fb3f88f5801ed))

## [0.6.0](https://github.com/finos/architecture-as-code/compare/vscode-v0.5.0...vscode-v0.6.0) (2026-04-28)

### 🐛 Bug Fixes

* resolve dependabot security vulnerabilities ([#2275](https://github.com/finos/architecture-as-code/issues/2275)) ([a04c51f](https://github.com/finos/architecture-as-code/commit/a04c51f0b992869b552008d89c885e83a5bb5c30))
* **vscode:** blank preview panel on VSCode 1.116 ([#2361](https://github.com/finos/architecture-as-code/issues/2361)) ([#2372](https://github.com/finos/architecture-as-code/issues/2372)) ([9142b16](https://github.com/finos/architecture-as-code/commit/9142b1647028a5da0ae694ff06e11e2474e65ce3))

## [0.5.0](https://github.com/finos/architecture-as-code/compare/vscode-v0.4.3...vscode-v0.5.0) (2026-02-16)

### 🚀 Features

* **vscode:** add navigable timeline in TreeView ([619ed17](https://github.com/finos/architecture-as-code/commit/619ed17983ae8aa64c876116dc73ac659480f050))
* **vscode:** add support for timeline validation ([5e14f30](https://github.com/finos/architecture-as-code/commit/5e14f30069fecc3ba06d65248ef0ddfd33a065a4))

### 🐛 Bug Fixes

* **shared:** make tests applicable to all schema versions ([e34e4a3](https://github.com/finos/architecture-as-code/commit/e34e4a3ecdc54ab74c1a92ee8993c5c11d70b0c5))
* **vscode:** address copilot review feedback for timeline feature ([a78174e](https://github.com/finos/architecture-as-code/commit/a78174e87c94436c0e7ce2d70a49d2987ca13ff5))
* **vscode:** correct focusing for all  relationship types and increase test coverage ([#2113](https://github.com/finos/architecture-as-code/issues/2113)) ([65be0a1](https://github.com/finos/architecture-as-code/commit/65be0a1d3f61c5672301cebfcbe88343c0b64972))
* **vscode:** fix duplicate test ([b263f3f](https://github.com/finos/architecture-as-code/commit/b263f3fa9b44e5f5caf0181574f4100f5461fc9d))
* **vscode:** Fix visualization of the timeline so no need for pin ([aa353e6](https://github.com/finos/architecture-as-code/commit/aa353e6ce520b804041b0897394b504314aeba14))
* **vscode:** make tests applicable to all schema versions ([06e032d](https://github.com/finos/architecture-as-code/commit/06e032d57539ead2a39b45a31ed70c99a0824120))

## [0.4.3](https://github.com/finos/architecture-as-code/compare/vscode-v0.4.0...vscode-v0.4.3) (2026-01-29)

### 🐛 Bug Fixes

* **calm-widgets:** render primitive arrays inline with comma separator list for for MDX compatibility ([#2080](https://github.com/finos/architecture-as-code/issues/2080)) ([#2082](https://github.com/finos/architecture-as-code/issues/2082)) ([25eee61](https://github.com/finos/architecture-as-code/commit/25eee61bedfba3502bcf9916bf7979cf8dc568a2))
* **vscode:** refine `isKnownCalmSchema` mock's URL validation regex ([#2076](https://github.com/finos/architecture-as-code/issues/2076)) ([a0e686a](https://github.com/finos/architecture-as-code/commit/a0e686a479e63a6982b1a658dfd7cc1b951f48c9))

### 📚 Documentation

* **vscode:** README remove status paragraph, add theme setting; Extension rename to CALM ([#2081](https://github.com/finos/architecture-as-code/issues/2081)) ([af20ec2](https://github.com/finos/architecture-as-code/commit/af20ec20d38d92bb45157856ff6aef2b5d935900))
* **vscode:** rename plugin to 'CALM Tools', as 'calm' is taken ([#2085](https://github.com/finos/architecture-as-code/issues/2085)) ([7f5892d](https://github.com/finos/architecture-as-code/commit/7f5892d58539a869c1d9bf9620193d4fe4316c33))

## [0.4.0](https://github.com/finos/architecture-as-code/compare/vscode-v0.3.0...vscode-v0.4.0) (2026-01-26)

### 🚀 Features

* **calm-plugins:** create website command from vscode extension ([#2061](https://github.com/finos/architecture-as-code/issues/2061)) ([ef7dd26](https://github.com/finos/architecture-as-code/commit/ef7dd26e39e817584e563879c1a5aaaa7f143035))
* **theme:** add high-contrast light and dark themes, update related documentation and tests ([fcb4f72](https://github.com/finos/architecture-as-code/commit/fcb4f7217fd6968ee98f7443f1bb4d3ffc5ccf8f))
* **vscode:** add content-based CALM document detection with bundled schemas ([a5e3e32](https://github.com/finos/architecture-as-code/commit/a5e3e325c47eab886cb0c52e1a02a147dab3afb4))
* **vscode:** add debouncing and version tracking to prevent redundant validations ([6fcbc97](https://github.com/finos/architecture-as-code/commit/6fcbc973b6116744b6e46c0dd580f7b4c22ba7ea))
* **vscode:** add validation service for CALM documents ([a3bbc86](https://github.com/finos/architecture-as-code/commit/a3bbc86d659232cd682534a3a2693db3b95333ab))
* **vscode:** bump version number ([20595fe](https://github.com/finos/architecture-as-code/commit/20595fe387ca003a2f062caa138dd192468f471b))
* **vscode:** handle theme and widget option selection in templates in live docify mode ([d5f584e](https://github.com/finos/architecture-as-code/commit/d5f584ee717b8456d3e83ca33080f753fd25c18e))
* **vscode:** theme support in vscode extension ([3267f58](https://github.com/finos/architecture-as-code/commit/3267f58efef04c7b8f315553b03e09e1f4128ad1))
* **vscode:** theme support in vscode extension - fix changing theme ([a96e00e](https://github.com/finos/architecture-as-code/commit/a96e00ea983ec4f2e2f1e36db08fe7f3a658f3d0))
* **vscode:** validate CALM documents when opened ([3830dc6](https://github.com/finos/architecture-as-code/commit/3830dc6647371c7bcf5019ecff8d59d35e76b163))

### 🐛 Bug Fixes

* **cli:** remove unused ValidationOutcome import ([feec778](https://github.com/finos/architecture-as-code/commit/feec7788ff61692978399396645be051694a4e53))
* **shared:** add tests ([848a8e6](https://github.com/finos/architecture-as-code/commit/848a8e62d8fbe16823aa0b895fbfadae9ddbe2ac))
* **shared:** address review comments ([be86952](https://github.com/finos/architecture-as-code/commit/be8695221b8f85569db23cde8b868e88857d0545))
* **vscode:** await schema registry initialization before validating documents ([f12931b](https://github.com/finos/architecture-as-code/commit/f12931be89d1d7b6cf74b8b762e09f8aaf67a86b))
* **vscode:** clear diagnostics when editor tab is closed ([8dfc431](https://github.com/finos/architecture-as-code/commit/8dfc4319f7b6c81237c3b211996d381021f2f307))
* **vscode:** improve JSON path location finding for diagnostics ([4b0beb5](https://github.com/finos/architecture-as-code/commit/4b0beb58259551e3d534995380415d212c344651))
* **vscode:** revalidate when editor tab becomes active ([b5483b3](https://github.com/finos/architecture-as-code/commit/b5483b3af46decde32e1f0680a20768152e83d7e))
* **vscode:** use @stoplight/json for precise diagnostic line numbers ([359b2c2](https://github.com/finos/architecture-as-code/commit/359b2c22c9c75e90d35bf5de36dba4ae02e91ae7))

### ♻️ Code Refactoring

* **vscode:** remove duplicate findPathInDocument logic ([8a67ee4](https://github.com/finos/architecture-as-code/commit/8a67ee40b3d3e237551cf2b4c05205ba569ae673))
* **vscode:** remove redundant null coalescing operators ([6b3ab12](https://github.com/finos/architecture-as-code/commit/6b3ab125f32dbd9a373b7a80e85a9c7ac435dc42))
* **vscode:** replace custom copy-calm-schemas script with copyfiles package ([81f859b](https://github.com/finos/architecture-as-code/commit/81f859bca709fa65785ef05f635d196f3a97e6b9))

## [0.3.0](https://github.com/finos/architecture-as-code/compare/vscode-v0.2.0...vscode-v0.3.0) (2026-01-12)

### 🚀 Features

* Implement multi-document navigation and refactor document loader ([af7e8d4](https://github.com/finos/architecture-as-code/commit/af7e8d4d592ee94333ee7404b11485865fa7ff8f))

### 🐛 Bug Fixes

* **vscode:** display 'interacts' relationships in the relationships tree view ([#1982](https://github.com/finos/architecture-as-code/issues/1982)) ([8e51136](https://github.com/finos/architecture-as-code/commit/8e51136e4655384af4f5697c0e8ac4094f27fada))

### ♻️ Code Refactoring

* **calm-plugins:** front-matter now part of core docify ([7c2fa91](https://github.com/finos/architecture-as-code/commit/7c2fa9128289a2d940329f96f25bfde024cb4f17))
* **vscode:** flatten nested conditionals with guard clauses in selection-service ([0104388](https://github.com/finos/architecture-as-code/commit/0104388126d04cc0816d2f2e44052e9dd1381cb1))

## [0.2.0](https://github.com/finos/architecture-as-code/compare/vscode-v0.1.0...vscode-v0.2.0) (2025-12-19)

### 🚀 Features

* **calm-widgets:** Add support for rendering additional properties ([b43ae59](https://github.com/finos/architecture-as-code/commit/b43ae59568e54e3d040a39382fd03e316ab0c2a2))

### 🐛 Bug Fixes

* **vscode:** Route widget debug logs to log.debug for proper filtering ([95a49f8](https://github.com/finos/architecture-as-code/commit/95a49f8954c6b4bd3814a93ede94996bc05d34f2))

## [0.1.0](https://github.com/finos/architecture-as-code/compare/vscode-v0.0.13...vscode-v0.1.0) (2025-12-12)

### 🚀 Features

* **vscode:** Update VSCode extension to 0.1.0 and non-experimental status ([411f5f2](https://github.com/finos/architecture-as-code/commit/411f5f2380e963fd2772aee2edc8e897a21be8bd))

## [0.0.13](https://github.com/finos/architecture-as-code/compare/vscode-v0.0.12...vscode-v0.0.13) (2025-12-08)

### 🚀 Features

* **vscode-plugin:** add calm-vscode-plugin version 0.0.13 ([e84ecb5](https://github.com/finos/architecture-as-code/commit/e84ecb5691eacbf54a0960c4bee52bfd45ad6e2c))

### 🐛 Bug Fixes

* **vscode:** enhance elementId handling in openPreview command ([231a461](https://github.com/finos/architecture-as-code/commit/231a461e7c33165af138526214cad5771aaf3854))

### ⚡ Performance Improvements

* **vscode:** Performance and stability improvements ([7dcadee](https://github.com/finos/architecture-as-code/commit/7dcadee7c6fbdc18dc553e3ce5c8fb57f619729f))

## [0.0.12](https://github.com/finos/architecture-as-code/compare/vscode-v0.0.9...vscode-v0.0.12) (2025-12-05)

### 🐛 Bug Fixes

* **calm-widgets:** escape special characters in Mermaid text labels ([#1918](https://github.com/finos/architecture-as-code/issues/1918)) ([49ccc5d](https://github.com/finos/architecture-as-code/commit/49ccc5d7495355ad139d3e0002d4f31022255810))
* upgrade vsce to @vscode/vsce to fix xml2js vulnerability ([#1870](https://github.com/finos/architecture-as-code/issues/1870)) ([9877549](https://github.com/finos/architecture-as-code/commit/987754943fe5ec6b1579897a82f78c26198ef694))
* **vscode:** preview panel can now reopen after being closed ([#1917](https://github.com/finos/architecture-as-code/issues/1917)) ([b0249db](https://github.com/finos/architecture-as-code/commit/b0249dbf3cab0778077461e242fec1d55c0eb33d))

## [0.0.9](https://github.com/finos/architecture-as-code/compare/vscode-v0.0.8...vscode-v0.0.9) (2025-11-17)

### 🐛 Bug Fixes

* **calm-widgets:** update mermaid ID handling and sanitize identifier… ([#1807](https://github.com/finos/architecture-as-code/issues/1807)) ([b1d22a7](https://github.com/finos/architecture-as-code/commit/b1d22a70d531984bfb691033fec593b205acd5b5))

## [0.0.8](https://github.com/finos/architecture-as-code/compare/vscode-v0.0.7...vscode-v0.0.8) (2025-11-07)

### 🚀 Features

* **vscode:** add clickable nodes and edges in Mermaid diagrams, implement home button functionality ([c49b759](https://github.com/finos/architecture-as-code/commit/c49b7594e5b9671381ac8928b0a392a332eeec3d))

### ♻️ Code Refactoring

* **vscode:** add refreshAll command and improve tab refresh logic ([17b5116](https://github.com/finos/architecture-as-code/commit/17b51165af2b87abc7052ffc322a9d131cc69633))
* **vscode:** remove unnecessary semicolons and improve code consistency in DocifyTabView ([22a576e](https://github.com/finos/architecture-as-code/commit/22a576e12cbd14f6da5eecc52368db19a3fec5b5))
* **vscode:** update TabsViewModel and TabsView to use explicit types for better clarity ([5376759](https://github.com/finos/architecture-as-code/commit/53767592e57b083cbcecdff3cf265dc72d16f60f))

## [0.0.7](https://github.com/finos/architecture-as-code/compare/vscode-v0.0.6...vscode-v0.0.7) (2025-10-31)

### 🚀 Features

* **vscode:** add pan and zoom controls for Mermaid diagrams and update styles ([#1771](https://github.com/finos/architecture-as-code/issues/1771)) ([e09143b](https://github.com/finos/architecture-as-code/commit/e09143bf6ba3a3d4c6b86c925310e56db3198796))

## [0.0.6](https://github.com/finos/architecture-as-code/compare/vscode-v0.0.5...vscode-v0.0.6) (2025-10-16)

### 🐛 Bug Fixes

* **vscode:** apply changes for copilot feedback ([63cc6ef](https://github.com/finos/architecture-as-code/commit/63cc6ef106e26b5fac5e9bd094f4ca666185a85d))
* **vscode:** Remove auto open on CALM Preview and fix a bunch of bugs, resolves [#1690](https://github.com/finos/architecture-as-code/issues/1690) ([8768950](https://github.com/finos/architecture-as-code/commit/87689506d2f711058460f4b391d3949968654338))

## [0.0.5](https://github.com/finos/architecture-as-code/compare/vscode-v0.0.4...vscode-v0.0.5) (2025-10-08)

### 🐛 Bug Fixes

* **vscode:** Add ability to render images in CALM Preview ([#1694](https://github.com/finos/architecture-as-code/issues/1694)) ([aa3a87d](https://github.com/finos/architecture-as-code/commit/aa3a87d845350b3dcd2c6b7710871d56ff61e3f5))

### 📚 Documentation

* **calm-plugin:** Add lead maintainer section for the vscode plugin ([#1668](https://github.com/finos/architecture-as-code/issues/1668)) ([381f143](https://github.com/finos/architecture-as-code/commit/381f14375fa024e3126c1447a5c507fd5cbb1dec))

## [0.0.4](https://github.com/finos/architecture-as-code/compare/vscode-v0.0.3...vscode-v0.0.4) (2025-09-30)

* No user-facing changes to the extension.

## [0.0.3](https://github.com/finos/architecture-as-code/compare/vscode-v0.0.2...vscode-v0.0.3) (2025-09-30)

### 📚 Documentation

* **calm_plugins:** Fixing images as vscode marketplace requires https urls ([#1663](https://github.com/finos/architecture-as-code/issues/1663)) ([fa06519](https://github.com/finos/architecture-as-code/commit/fa06519a54237049b6c6f37b8102cd34df04da5e))

## [0.0.2](https://github.com/finos/architecture-as-code/compare/vscode-v0.0.1...vscode-v0.0.2) (2025-09-30)

### 📚 Documentation

* **calm_plugins:** Cleanup marketplace documentation entry ([#1660](https://github.com/finos/architecture-as-code/issues/1660)) ([d0852be](https://github.com/finos/architecture-as-code/commit/d0852be3b9c64291b94b0f6a409fb14409aa25d9))

## 0.0.1 (2025-09-29)

### 🚀 Features

* **calm-plugins:** Leverage docify ([c905b94](https://github.com/finos/architecture-as-code/commit/c905b94ffc95cafe5e0d6c13a6faca3807bd6620))

### 🐛 Bug Fixes

* **calm-plugins:** change publisher to FINOS ([#1658](https://github.com/finos/architecture-as-code/issues/1658)) ([518c253](https://github.com/finos/architecture-as-code/commit/518c253ccac87f2838b26f2bc1e1fa9696f47b59))

### 📚 Documentation

* **calm-plugins:** update README.md ([2cefff4](https://github.com/finos/architecture-as-code/commit/2cefff4ec3d468ae7344a88829a48aa1fa394e09))
* **calm-plugins:** update README.md on how to build the .vsix file ([e6d08fd](https://github.com/finos/architecture-as-code/commit/e6d08fd73e942d1615586b4932ac77f6ea2cc97f))

### ♻️ Code Refactoring

* **calm-plugins:** create state store ([7481a55](https://github.com/finos/architecture-as-code/commit/7481a55ef5594dcca86e84698fb27f74933f0e8c))
* **calm-plugins:** make mvvm for webview ([c2ec170](https://github.com/finos/architecture-as-code/commit/c2ec1709587f275e7a2be7b0556e9af5309247c4))
