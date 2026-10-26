# Changelog

All notable changes to the CALM Server will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.6.0](https://github.com/finos/architecture-as-code/compare/calm-server-v0.5.0...calm-server-v0.6.0) (2026-10-24)

### 🚀 Features

* move the tools to CALM schema 1.3 ([#3437](https://github.com/finos/architecture-as-code/issues/3437)) ([b142fd9](https://github.com/finos/architecture-as-code/commit/b142fd9e2ce0cea01fbc4ea142d892364c96e09f))

### 🐛 Bug Fixes

* upgrade to Express 5 ([#3424](https://github.com/finos/architecture-as-code/issues/3424)) ([1cc02d8](https://github.com/finos/architecture-as-code/commit/1cc02d85e81db91eda423082d9ac3abb6fc375d0))

## [0.5.0](https://github.com/finos/architecture-as-code/compare/calm-server-v0.4.0...calm-server-v0.5.0) (2026-10-21)

### ⚠ BREAKING CHANGES

* calm validate rejects patterns it previously accepted.
Main never read inside oneOf or anyOf, so four checks now apply where
they did not.

Two alternatives of one entry that share a node or relationship
unique-id are rejected. Generate previously emitted both alternatives,
producing an architecture with a duplicate id.

A relationship that names an interface belonging to a sibling
alternative is rejected. Interfaces were pooled across an entry's
alternatives, so the chosen node need not have declared the interface.

An entry that declares both oneOf and anyOf is rejected. An element must
satisfy both, so the entry is unsatisfiable when the id sets are
disjoint and declares unselectable alternatives when they overlap.

An alternative that no relationship and no decision references is
warned about. This fails a build only under --strict.

One further rejection is a deliberate contract rather than a
correction. A unique-id names one kind of thing, so a node id may not
equal an interface id even across alternatives that never appear
together. Both architectures such a pattern can produce are valid.

### 🚀 Features

* add a browser-safe @finos/calm-shared/browser entry point ([#3022](https://github.com/finos/architecture-as-code/issues/3022)) ([4663e96](https://github.com/finos/architecture-as-code/commit/4663e960cee0e1d3bc605aab31d66bb538cdcf37))
* add as maven project ([a36a30f](https://github.com/finos/architecture-as-code/commit/a36a30f57fa493830849dccd50e978b58229c7e0))
* add CalmArchitecture entry point with parse and metadata access ([b951246](https://github.com/finos/architecture-as-code/commit/b9512467afff1d79690c6847d3f968f00e0fb348))
* add CalmArchitecture query methods and complete test coverage ([2fca05d](https://github.com/finos/architecture-as-code/commit/2fca05d511fa3759694aeb527712542ad773b1cc))
* add CalmArchitecture.parse(Object) overload ([55f6f5c](https://github.com/finos/architecture-as-code/commit/55f6f5cbb992e6a18e8f8030996981637d2c9808))
* add CalmNode and CalmRelationship ([6b5518e](https://github.com/finos/architecture-as-code/commit/6b5518eac8903a71e1dad1af45346b41a6e33841))
* add canonical Jackson schema classes ([1b2160b](https://github.com/finos/architecture-as-code/commit/1b2160b1ae8e9203f2d1d989e0206d0ba272082e))
* add ci config to publish to maven central ([e61c76d](https://github.com/finos/architecture-as-code/commit/e61c76d017e657dd1fa66c2a88a379229cbfbdb6))
* add CURIE resolution chain and remove DirectUrlAuthPlugin ([c0291b3](https://github.com/finos/architecture-as-code/commit/c0291b3e116832bc51252c1d3c7489f3cd6b1d90))
* add CURIE resolver chain and --assets-path for validate ([#3287](https://github.com/finos/architecture-as-code/issues/3287)) ([c32042f](https://github.com/finos/architecture-as-code/commit/c32042f731b554670908ec4adb59e3d7f6028397))
* add document id and schema ID parsing ([86d3a60](https://github.com/finos/architecture-as-code/commit/86d3a60233eda29463a3ea2e19acc5b3d5ca2a1d))
* add extension parsing to CalmRelationship ([6d70e47](https://github.com/finos/architecture-as-code/commit/6d70e475bee4b96daf1eeb643cd6583a557bac10))
* add implementation for metadata diff ([#3014](https://github.com/finos/architecture-as-code/issues/3014)) ([d95b7cb](https://github.com/finos/architecture-as-code/commit/d95b7cbd4149a313877e845a965ef74a938abbdf))
* add leaf model records and controls model ([acdd5bc](https://github.com/finos/architecture-as-code/commit/acdd5bcc2207a81d3aa0d13910119255f2faeee5))
* add sealed CalmRelationshipType hierarchy and CalmInterface ([14b6d0e](https://github.com/finos/architecture-as-code/commit/14b6d0e6d2a454b80c2fc0f7ebb6c9efdc201f38))
* add shared default layout persistence for CALM Hub architecture diagrams ([b9f465a](https://github.com/finos/architecture-as-code/commit/b9f465a66b086a3d2dcfa15b17d74342df7aecbd))
* add test fixture, exception class, and enums ([8844045](https://github.com/finos/architecture-as-code/commit/8844045af8f7dc15558b65a40891aa596d19df18))
* compare items catalogues in the pattern differ ([#3112](https://github.com/finos/architecture-as-code/issues/3112)) ([560ab09](https://github.com/finos/architecture-as-code/commit/560ab09f6e1e9fa80647b5c896ad1e8bf83b6bb3))
* gitignore ([f856baf](https://github.com/finos/architecture-as-code/commit/f856baf1dc0bdf34bd2bf02ecbe4db79e7abb6e8))
* instantiate items in calm generate ([#3103](https://github.com/finos/architecture-as-code/issues/3103)) ([6cdefeb](https://github.com/finos/architecture-as-code/commit/6cdefeb848f3ca608a22d1f09ccc596ab2dab72e))
* load template bundle files from subdirectories ([#3381](https://github.com/finos/architecture-as-code/issues/3381)) ([17435de](https://github.com/finos/architecture-as-code/commit/17435decf3198ade03dcd88d23d6acfe833ad67e))
* read items in pattern validation ([#3060](https://github.com/finos/architecture-as-code/issues/3060)) ([35266bf](https://github.com/finos/architecture-as-code/commit/35266bfa25c69e67022d8c21e81d1a86dad55643))
* Validation Engine Redesign with articulated assumptions ([#2805](https://github.com/finos/architecture-as-code/issues/2805)) ([e40a792](https://github.com/finos/architecture-as-code/commit/e40a792e74c72b4c390967283c3ccc8e5a58e214))

### 🐛 Bug Fixes

* address second round of layout review feedback ([1638fcd](https://github.com/finos/architecture-as-code/commit/1638fcd4df815010547796d518c2a5b174fc6749))
* count architecture-level diff changes ([#3213](https://github.com/finos/architecture-as-code/issues/3213)) ([4d875eb](https://github.com/finos/architecture-as-code/commit/4d875ebdc03d090e3d2f50c5c668f537f2487caf))
* defensive copies, null-safe comparisons, and isObject guard ([afc6b1e](https://github.com/finos/architecture-as-code/commit/afc6b1e57e6ed6643b7d0c60857358be5bdbdd47))
* don't swallow malformed 200 bodies into [] in calm-hub-client ([#2865](https://github.com/finos/architecture-as-code/issues/2865)) ([96cd530](https://github.com/finos/architecture-as-code/commit/96cd5301dff9c3500dc47578eba4a347cf0473ef))
* emit POSIX-style paths in generated front matter ([#3009](https://github.com/finos/architecture-as-code/issues/3009)) ([d44f3a4](https://github.com/finos/architecture-as-code/commit/d44f3a4288d357420432d097243f020e8672300b))
* improvements to models and tests ([1804583](https://github.com/finos/architecture-as-code/commit/1804583dedd40190a0979c7cf861078b7b504ddc))
* link docify index pages to their .md files ([#3303](https://github.com/finos/architecture-as-code/issues/3303)) ([bea8408](https://github.com/finos/architecture-as-code/commit/bea84086c8f56dcec492d510e4d40ae0cb493e9d))
* list changed ADRs and control IDs in diff summary ([#3227](https://github.com/finos/architecture-as-code/issues/3227)) ([1cf0fe6](https://github.com/finos/architecture-as-code/commit/1cf0fe683271ef70351f198aebfdb07ab0d30bbe)), closes [#3218](https://github.com/finos/architecture-as-code/issues/3218)
* load control config documents by type instead of as schemas ([#3390](https://github.com/finos/architecture-as-code/issues/3390)) ([3f685e0](https://github.com/finos/architecture-as-code/commit/3f685e033064bb9e1d8387689a8aa7bb8c600fb1))
* move to new sonatype repo ([6553ed7](https://github.com/finos/architecture-as-code/commit/6553ed7b18a4cd2c543b84139a4a95a8fb842368))
* reject template output paths outside the output directory ([#3279](https://github.com/finos/architecture-as-code/issues/3279)) ([468a923](https://github.com/finos/architecture-as-code/commit/468a9236a77f3867299768676f61b1e78b8c76a1))
* report duplicate unique-id errors at the duplicate's location ([#3134](https://github.com/finos/architecture-as-code/issues/3134)) ([a6114aa](https://github.com/finos/architecture-as-code/commit/a6114aaf073d608bf8423fd327d5011709159940))
* report missing and invalid local files, not a URL error ([#3142](https://github.com/finos/architecture-as-code/issues/3142)) ([8108e91](https://github.com/finos/architecture-as-code/commit/8108e9192f4a485ef770b1fc09ed6076a817094c))
* resolve node names instead of raw ids in related-nodes diagrams ([#2883](https://github.com/finos/architecture-as-code/issues/2883)) ([2dd9a5f](https://github.com/finos/architecture-as-code/commit/2dd9a5fa708a9108e908f39b0083107ccdd3b1cd))
* resolve open CodeQL code scanning alerts (75-79) ([#2919](https://github.com/finos/architecture-as-code/issues/2919)) ([25be3b5](https://github.com/finos/architecture-as-code/commit/25be3b5210c47348876417b8a23172665bd68b4c))
* resolve prefixItems alternatives in pattern validation ([#3059](https://github.com/finos/architecture-as-code/issues/3059)) ([df09072](https://github.com/finos/architecture-as-code/commit/df0907267603ae6a2f3c6663e15b2bbb5423d460))
* restore files removed by branch that main still depends on ([b7309a7](https://github.com/finos/architecture-as-code/commit/b7309a7a9fda54909638c09f89ad3a6799f114d1))
* scope id uniqueness to declarations that can coexist ([95da271](https://github.com/finos/architecture-as-code/commit/95da2710a06ec3cbe8517485948b6d9aace907a1))
* stop CalmHubDocumentLoader claiming http(s) URLs that are not scoped to the configured instance ([#2986](https://github.com/finos/architecture-as-code/issues/2986)) ([4da07e8](https://github.com/finos/architecture-as-code/commit/4da07e87caf8f2a40f5daf113fa6caf8344e0500))
* validate an architecture whose decision has no answer ([#3270](https://github.com/finos/architecture-as-code/issues/3270)) ([eb5dfd3](https://github.com/finos/architecture-as-code/commit/eb5dfd381e9c82e0c0fb74f7947291848579e83f))

### 📚 Documentation

* commit specs ([8c08a4b](https://github.com/finos/architecture-as-code/commit/8c08a4b2ca4a7de3c21e487fbd14a9be5588ba17))

### ♻️ Code Refactoring

* centralize document types ([#2898](https://github.com/finos/architecture-as-code/issues/2898)) ([184d448](https://github.com/finos/architecture-as-code/commit/184d448dadb48cacf00e8a220032b958e70e91c2))

## [0.4.0](https://github.com/finos/architecture-as-code/compare/calm-server-v0.3.3...calm-server-v0.4.0) (2026-07-15)

### 🐛 Bug Fixes

* deep copy pattern in selectChoices to avoid mutating caller input ([#2825](https://github.com/finos/architecture-as-code/issues/2825)) ([0f63c36](https://github.com/finos/architecture-as-code/commit/0f63c3634c7898a699db86964650514a3fcf841e))

## [0.3.3](https://github.com/finos/architecture-as-code/compare/calm-server-v0.3.2...calm-server-v0.3.3) (2026-07-15)

No changes to the CALM Server or its packages.

## [0.3.2](https://github.com/finos/architecture-as-code/compare/calm-server-v0.3.1...calm-server-v0.3.2) (2026-07-15)

### 🐛 Bug Fixes

* declare ts-node runtime dependency and drop file:../shared dependency ([#2818](https://github.com/finos/architecture-as-code/issues/2818)) ([2484b97](https://github.com/finos/architecture-as-code/commit/2484b97e061b520ba20e45a62a41d56afbb27c8f))

## [0.3.1](https://github.com/finos/architecture-as-code/compare/calm-server-v0.3.0...calm-server-v0.3.1) (2026-07-14)

No changes to the CALM Server or its packages.

## [0.3.0](https://github.com/finos/architecture-as-code/compare/calm-server-v0.2.1...calm-server-v0.3.0) (2026-07-09)

### 🚀 Features

* add control diff to diff engine ([#2732](https://github.com/finos/architecture-as-code/issues/2732)) ([7f1dfbc](https://github.com/finos/architecture-as-code/commit/7f1dfbc5c93bb8e9431cca5a8da3ff0f00ad7d62))
* architecture timelines ([#2289](https://github.com/finos/architecture-as-code/issues/2289)) ([#2496](https://github.com/finos/architecture-as-code/issues/2496)) ([8f61008](https://github.com/finos/architecture-as-code/commit/8f610080cf5fd64e102a00cdb22524cb558bd9c4))
* calm server validation against a custom pattern ([#2772](https://github.com/finos/architecture-as-code/issues/2772)) ([40c52dc](https://github.com/finos/architecture-as-code/commit/40c52dc3f9291e9cf0db83c75670db1828d25f78))
* extend render-interfaces to support related mode ([#2701](https://github.com/finos/architecture-as-code/issues/2701)) ([6d7ceff](https://github.com/finos/architecture-as-code/commit/6d7ceff4066efcaa6d4792e60503a8c0342779d4))
* Set up ADR Diff Engine ([#2500](https://github.com/finos/architecture-as-code/issues/2500)) ([d66b448](https://github.com/finos/architecture-as-code/commit/d66b448f73241dde9729a3b8b055e4c4968f3105))
* shared CALM architecture diff with calm diff CLI and calm-hub-ui /diff route ([#2442](https://github.com/finos/architecture-as-code/issues/2442)) ([330e500](https://github.com/finos/architecture-as-code/commit/330e50008a065c941bddd7eb304b726d7762d149))
* validate response data is JSON object ([#2436](https://github.com/finos/architecture-as-code/issues/2436)) ([43c04b3](https://github.com/finos/architecture-as-code/commit/43c04b36744eb5641cfbbaa27f812f4e43f76d2b))

### 🐛 Bug Fixes

* allow calmhub document loader to resolve https and http urls as well as calm:// ([#2612](https://github.com/finos/architecture-as-code/issues/2612)) ([0573cb0](https://github.com/finos/architecture-as-code/commit/0573cb08671851ea8f9c96cc32905159290f28ec))
* diff id-less pattern items by content instead of dropping them ([#2582](https://github.com/finos/architecture-as-code/issues/2582)) ([b5ecddd](https://github.com/finos/architecture-as-code/commit/b5ecdddd40071790f23a66bee24dae96dd3e9fac))
* harden direct URL loading and align lodash to 4.18.1 ([#2304](https://github.com/finos/architecture-as-code/issues/2304)) ([dc686f5](https://github.com/finos/architecture-as-code/commit/dc686f58f212b1eaef58105c8fb63046a1e71ec8))
* remove committed node_modules symlink and harden gitignore ([#2708](https://github.com/finos/architecture-as-code/issues/2708)) ([7ca2158](https://github.com/finos/architecture-as-code/commit/7ca2158319a666f76b808ec644ef6517cd51f7a0))
* resolve all open CodeQL security alerts ([#2272](https://github.com/finos/architecture-as-code/issues/2272)) ([13f486c](https://github.com/finos/architecture-as-code/commit/13f486c91116a3d8b9cc6c89e27721aaf3adf5f9))
* resolve critical SSRF and tainted format string code scanning alerts ([#2229](https://github.com/finos/architecture-as-code/issues/2229)) ([9e479de](https://github.com/finos/architecture-as-code/commit/9e479decf6423d6f30e8ba8f602a51612c297159))
* resolve dependabot security vulnerabilities ([#2275](https://github.com/finos/architecture-as-code/issues/2275)) ([a04c51f](https://github.com/finos/architecture-as-code/commit/a04c51f0b992869b552008d89c885e83a5bb5c30))
* resolve docusaurus/mermaid/elk dependency and add test ([2ec7ab7](https://github.com/finos/architecture-as-code/commit/2ec7ab738fb3caad3d86f6fbf11dcc6b67b3e181))
* run JSON schema validation in architecture-only validate path ([#2560](https://github.com/finos/architecture-as-code/issues/2560)) ([5b19531](https://github.com/finos/architecture-as-code/commit/5b195310f329c6665b3db336a1d61980f2f0e8d0))
* surface fatal document-loader errors instead of masking them ([#2488](https://github.com/finos/architecture-as-code/issues/2488)) ([f436764](https://github.com/finos/architecture-as-code/commit/f436764c20dd025f90ce00dab246670ed1f60f66)), closes [#2440](https://github.com/finos/architecture-as-code/issues/2440)
* validate request path in DirectUrlDocumentLoader ([#2777](https://github.com/finos/architecture-as-code/issues/2777)) ([1449155](https://github.com/finos/architecture-as-code/commit/14491557984c17ef0d972e3d6bb6558a88f2f891))
* validate singular interface reference in connects relationships ([#2737](https://github.com/finos/architecture-as-code/issues/2737)) ([16e27f2](https://github.com/finos/architecture-as-code/commit/16e27f27e0e6d7c6b6aa0c0c6e02510b86513b64))
* validate the exact value passed to the SSRF-sensitive sink ([#2779](https://github.com/finos/architecture-as-code/issues/2779)) ([601f11a](https://github.com/finos/architecture-as-code/commit/601f11a8219de4e3d795f3de8ac96c65229590e7))

### 📚 Documentation

* document alphabetical ordering requirement for widgets and helpers ([#2710](https://github.com/finos/architecture-as-code/issues/2710)) ([4008ff3](https://github.com/finos/architecture-as-code/commit/4008ff35ec4f49fe65f2d83e7625d1c88ad8cd28))

### ♻️ Code Refactoring

* enable TypeScript strict mode for production build ([#2583](https://github.com/finos/architecture-as-code/issues/2583)) ([be98b7a](https://github.com/finos/architecture-as-code/commit/be98b7a2f805fc8f1d01e524fb055a983ee61e1c))

## [0.2.1](https://github.com/finos/architecture-as-code/compare/calm-server-v0.2.0...calm-server-v0.2.1) (2026-03-02)

No changes to the CALM Server or its packages.

## [0.2.0] - 2026-03-01

* Initial release of the CALM Server.
