# Changelog

All notable changes to the CALM CLI will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.67.0](https://github.com/finos/architecture-as-code/compare/cli-v1.66.0...cli-v1.67.0) (2026-10-28)

### 🚀 Features

* remove the 2026-03 draft ([#3496](https://github.com/finos/architecture-as-code/issues/3496)) ([732edbf](https://github.com/finos/architecture-as-code/commit/732edbf02e193618bf0c22d95db2c016f255c1bd))

### 🐛 Bug Fixes

* restore the 2026-03 draft in the CLI and on calm.finos.org ([#3534](https://github.com/finos/architecture-as-code/issues/3534)) ([e08304a](https://github.com/finos/architecture-as-code/commit/e08304a81661ddca9efb7ec5ce78502604b936c8))
* update ajv-formats to v3; date-time and time now require a time zone (use iso-date-time or iso-time to make it optional) ([#3481](https://github.com/finos/architecture-as-code/issues/3481)) ([4a3582c](https://github.com/finos/architecture-as-code/commit/4a3582cdefa6878f1516e05f253aba03c91fb9dd))
* update calm workspace add --id help text to match default behavior ([#3491](https://github.com/finos/architecture-as-code/issues/3491)) ([a42aa64](https://github.com/finos/architecture-as-code/commit/a42aa643f289fe4706d079e8c3fecfe4764ffb54))

## [1.66.0](https://github.com/finos/architecture-as-code/compare/cli-v1.65.0...cli-v1.66.0) (2026-10-26)

### 🚀 Features

* model the CALM decorator ([#3458](https://github.com/finos/architecture-as-code/issues/3458)) ([d9489e5](https://github.com/finos/architecture-as-code/commit/d9489e591aac21a54b92aa4e8737d5ad329cbff3))
* move the tools to CALM schema 1.3 ([#3437](https://github.com/finos/architecture-as-code/issues/3437)) ([b142fd9](https://github.com/finos/architecture-as-code/commit/b142fd9e2ce0cea01fbc4ea142d892364c96e09f))
* remove the CALM 1.0 release candidates and the 2025-03 draft ([#3468](https://github.com/finos/architecture-as-code/issues/3468)) ([4dabad5](https://github.com/finos/architecture-as-code/commit/4dabad5e9242f09a419bf0ad8f6aae54ab5bbef2))

### 🐛 Bug Fixes

* correct the decorator, control and metadata guide examples ([#3456](https://github.com/finos/architecture-as-code/issues/3456)) ([fa5e3c4](https://github.com/finos/architecture-as-code/commit/fa5e3c453875c050ee8164bd5cb3de5b5d72eb29))
* load the direct URL auth module when a document first needs it ([#3354](https://github.com/finos/architecture-as-code/issues/3354)) ([683c38c](https://github.com/finos/architecture-as-code/commit/683c38c161be8902ae8fe1d77d0d49501706cc79))
* resolve validate -a/-p/-t paths against working directory ([#3380](https://github.com/finos/architecture-as-code/issues/3380)) ([6dc4efb](https://github.com/finos/architecture-as-code/commit/6dc4efbd5633ae7613c5cef883738a19970cf15a))
* show CALM Hub $id references in workspace tree ([#3421](https://github.com/finos/architecture-as-code/issues/3421)) ([4c1f00a](https://github.com/finos/architecture-as-code/commit/4c1f00a51fc32e1e6324f3ca58885879db4585bb))
* tell AI agents to write CALM 1.3 documents ([#3442](https://github.com/finos/architecture-as-code/issues/3442)) ([6b27851](https://github.com/finos/architecture-as-code/commit/6b27851c4900e3770021abf778d4802b7b769bf2))

## [1.65.0](https://github.com/finos/architecture-as-code/compare/cli-v1.64.0...cli-v1.65.0) (2026-10-21)

### 🚀 Features

* load template bundle files from subdirectories ([#3381](https://github.com/finos/architecture-as-code/issues/3381)) ([17435de](https://github.com/finos/architecture-as-code/commit/17435decf3198ade03dcd88d23d6acfe833ad67e))

### 🐛 Bug Fixes

* load control config documents by type instead of as schemas ([#3390](https://github.com/finos/architecture-as-code/issues/3390)) ([3f685e0](https://github.com/finos/architecture-as-code/commit/3f685e033064bb9e1d8387689a8aa7bb8c600fb1))

## [1.64.0](https://github.com/finos/architecture-as-code/compare/cli-v1.63.0...cli-v1.64.0) (2026-10-19)

### 🚀 Features

* add CURIE resolution chain and remove DirectUrlAuthPlugin ([c0291b3](https://github.com/finos/architecture-as-code/commit/c0291b3e116832bc51252c1d3c7489f3cd6b1d90))
* add CURIE resolver chain and --assets-path for validate ([#3287](https://github.com/finos/architecture-as-code/issues/3287)) ([c32042f](https://github.com/finos/architecture-as-code/commit/c32042f731b554670908ec4adb59e3d7f6028397))
* add flow subcommands to calm hub ([#3317](https://github.com/finos/architecture-as-code/issues/3317)) ([6b64f55](https://github.com/finos/architecture-as-code/commit/6b64f5502b282508a9e14a3b6f37e41938224384))
* support snapshot versions in workspace commands ([#3132](https://github.com/finos/architecture-as-code/issues/3132)) ([2d08db6](https://github.com/finos/architecture-as-code/commit/2d08db6aae2d345a1d923d0bf5fc30f8ed5c8c2b))

### 🐛 Bug Fixes

* check workspace document types against the $id ([#3316](https://github.com/finos/architecture-as-code/issues/3316)) ([4037cf2](https://github.com/finos/architecture-as-code/commit/4037cf29e431b8ccc9b1567021c4d05dd15fee85))
* declare CALM 1.2 schemas in workspace templates ([#3356](https://github.com/finos/architecture-as-code/issues/3356)) ([2656ac0](https://github.com/finos/architecture-as-code/commit/2656ac024272235ebbdcfb031df64716f2c4d997))
* push workspace flows to CalmHub ([#3306](https://github.com/finos/architecture-as-code/issues/3306)) ([ddc0a05](https://github.com/finos/architecture-as-code/commit/ddc0a05ab6ee215acbdc1e222f7fe5ccfec5eb23))
* restore files removed by branch that main still depends on ([b7309a7](https://github.com/finos/architecture-as-code/commit/b7309a7a9fda54909638c09f89ad3a6799f114d1))
* take the CALM schema release from @finos/calm-schema ([#3378](https://github.com/finos/architecture-as-code/issues/3378)) ([d9b96c5](https://github.com/finos/architecture-as-code/commit/d9b96c524f938b05f43395406e5923f9b6a27257))

### ♻️ Code Refactoring

* move exitBasedOffOfValidationOutcome out of shared into the CLI ([#3379](https://github.com/finos/architecture-as-code/issues/3379)) ([0e87812](https://github.com/finos/architecture-as-code/commit/0e87812c732d62d93d5d2f9c5a611dce9feef92c)), closes [#3028](https://github.com/finos/architecture-as-code/issues/3028)

## [1.63.0](https://github.com/finos/architecture-as-code/compare/cli-v1.62.0...cli-v1.63.0) (2026-10-14)

### 🐛 Bug Fixes

* pull the latest version when calm hub pull has no --ver ([#3348](https://github.com/finos/architecture-as-code/issues/3348)) ([cbd740a](https://github.com/finos/architecture-as-code/commit/cbd740a3b9632c7a751b8234b33327b2f226fb7c))
* reject template output paths outside the output directory ([#3279](https://github.com/finos/architecture-as-code/issues/3279)) ([468a923](https://github.com/finos/architecture-as-code/commit/468a9236a77f3867299768676f61b1e78b8c76a1))
* validate an architecture whose decision has no answer ([#3270](https://github.com/finos/architecture-as-code/issues/3270)) ([eb5dfd3](https://github.com/finos/architecture-as-code/commit/eb5dfd381e9c82e0c0fb74f7947291848579e83f))
* validate workspace documents with the calm validate config ([#3264](https://github.com/finos/architecture-as-code/issues/3264)) ([5e15b43](https://github.com/finos/architecture-as-code/commit/5e15b436840d02172722fcf5f8548f70e02d105a))

### ♻️ Code Refactoring

* remove the hidden docify --ants template bundle ([#3339](https://github.com/finos/architecture-as-code/issues/3339)) ([1bd0126](https://github.com/finos/architecture-as-code/commit/1bd012633b5570ef2c1c3ee7f549f13f8ac39fa0))

## [1.62.0](https://github.com/finos/architecture-as-code/compare/cli-v1.61.0...cli-v1.62.0) (2026-10-12)

### 🐛 Bug Fixes

* link docify index pages to their .md files ([#3303](https://github.com/finos/architecture-as-code/issues/3303)) ([bea8408](https://github.com/finos/architecture-as-code/commit/bea84086c8f56dcec492d510e4d40ae0cb493e9d))
* make workspace new flow create a CALM flow ([#3312](https://github.com/finos/architecture-as-code/issues/3312)) ([4c637a6](https://github.com/finos/architecture-as-code/commit/4c637a6774d45838eee19e4b63404653689558d3))

## [1.61.0](https://github.com/finos/architecture-as-code/compare/cli-v1.60.1...cli-v1.61.0) (2026-10-07)

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

* add directUrlAuthPlugin support for authenticated direct-URL document loading ([#3035](https://github.com/finos/architecture-as-code/issues/3035)) ([7e8d254](https://github.com/finos/architecture-as-code/commit/7e8d254a918a88e51dd195bc77ec658ae060fa58))
* add init-config options and docs for the directUrlAuth plugin ([#3124](https://github.com/finos/architecture-as-code/issues/3124)) ([5e02abf](https://github.com/finos/architecture-as-code/commit/5e02abf94852943e5892d9d3a0e68d4c88ae5e26))
* compare items catalogues in the pattern differ ([#3112](https://github.com/finos/architecture-as-code/issues/3112)) ([560ab09](https://github.com/finos/architecture-as-code/commit/560ab09f6e1e9fa80647b5c896ad1e8bf83b6bb3))
* instantiate items in calm generate ([#3103](https://github.com/finos/architecture-as-code/issues/3103)) ([6cdefeb](https://github.com/finos/architecture-as-code/commit/6cdefeb848f3ca608a22d1f09ccc596ab2dab72e))
* publish narrative documents from workspaces ([#3015](https://github.com/finos/architecture-as-code/issues/3015)) ([0fc9638](https://github.com/finos/architecture-as-code/commit/0fc9638efd50df4bed694008c78b2005369f9f78))
* read items in pattern validation ([#3060](https://github.com/finos/architecture-as-code/issues/3060)) ([35266bf](https://github.com/finos/architecture-as-code/commit/35266bfa25c69e67022d8c21e81d1a86dad55643))

### 🐛 Bug Fixes

* count architecture-level diff changes ([#3213](https://github.com/finos/architecture-as-code/issues/3213)) ([4d875eb](https://github.com/finos/architecture-as-code/commit/4d875ebdc03d090e3d2f50c5c668f537f2487caf))
* list changed ADRs and control IDs in diff summary ([#3227](https://github.com/finos/architecture-as-code/issues/3227)) ([1cf0fe6](https://github.com/finos/architecture-as-code/commit/1cf0fe683271ef70351f198aebfdb07ab0d30bbe)), closes [#3218](https://github.com/finos/architecture-as-code/issues/3218)
* report duplicate unique-id errors at the duplicate's location ([#3134](https://github.com/finos/architecture-as-code/issues/3134)) ([a6114aa](https://github.com/finos/architecture-as-code/commit/a6114aaf073d608bf8423fd327d5011709159940))
* report missing and invalid local files, not a URL error ([#3142](https://github.com/finos/architecture-as-code/issues/3142)) ([8108e91](https://github.com/finos/architecture-as-code/commit/8108e9192f4a485ef770b1fc09ed6076a817094c))
* report timeline validation issues at their position in the file ([#3136](https://github.com/finos/architecture-as-code/issues/3136)) ([25532a4](https://github.com/finos/architecture-as-code/commit/25532a4e881ca4b6becd9783e8bdb3ea2441b819))
* resolve prefixItems alternatives in pattern validation ([#3059](https://github.com/finos/architecture-as-code/issues/3059)) ([df09072](https://github.com/finos/architecture-as-code/commit/df0907267603ae6a2f3c6663e15b2bbb5423d460))
* scope id uniqueness to declarations that can coexist ([95da271](https://github.com/finos/architecture-as-code/commit/95da2710a06ec3cbe8517485948b6d9aace907a1))

## [1.60.1](https://github.com/finos/architecture-as-code/compare/cli-v1.60.0...cli-v1.60.1) (2026-09-16)

No changes to the CLI or its packages.

## [1.60.0](https://github.com/finos/architecture-as-code/compare/cli-v1.59.0...cli-v1.60.0) (2026-09-15)

### 🐛 Bug Fixes

* allow workspaces in non-git projects and store relative paths in add ([#3074](https://github.com/finos/architecture-as-code/issues/3074)) ([e201dc7](https://github.com/finos/architecture-as-code/commit/e201dc721a9d79e7ce8bfea4bac88ccf1063ff4c))

## [1.59.0](https://github.com/finos/architecture-as-code/compare/cli-v1.58.0...cli-v1.59.0) (2026-09-09)

No changes to the CLI or its packages.

## [1.58.0](https://github.com/finos/architecture-as-code/compare/cli-v1.57.0...cli-v1.58.0) (2026-09-03)

### 🚀 Features

* add a browser-safe @finos/calm-shared/browser entry point ([#3022](https://github.com/finos/architecture-as-code/issues/3022)) ([4663e96](https://github.com/finos/architecture-as-code/commit/4663e960cee0e1d3bc605aab31d66bb538cdcf37))
* add implementation for metadata diff ([#3014](https://github.com/finos/architecture-as-code/issues/3014)) ([d95b7cb](https://github.com/finos/architecture-as-code/commit/d95b7cbd4149a313877e845a965ef74a938abbdf))

## [1.57.0](https://github.com/finos/architecture-as-code/compare/cli-v1.56.0...cli-v1.57.0) (2026-08-24)

### 🚀 Features

* add missing hub push/pull/list interface subcommands ([#3005](https://github.com/finos/architecture-as-code/issues/3005)) ([88f264e](https://github.com/finos/architecture-as-code/commit/88f264e8ca019ff3cdeb673f4ee276c0a63ef0f0))

### 🐛 Bug Fixes

* emit POSIX-style paths in generated front matter ([#3009](https://github.com/finos/architecture-as-code/issues/3009)) ([d44f3a4](https://github.com/finos/architecture-as-code/commit/d44f3a4288d357420432d097243f020e8672300b))

## [1.56.0](https://github.com/finos/architecture-as-code/compare/cli-v1.55.0...cli-v1.56.0) (2026-08-17)

### 🐛 Bug Fixes

* stop CalmHubDocumentLoader claiming http(s) URLs that are not scoped to the configured instance ([#2986](https://github.com/finos/architecture-as-code/issues/2986)) ([4da07e8](https://github.com/finos/architecture-as-code/commit/4da07e87caf8f2a40f5daf113fa6caf8344e0500))

## [1.55.0](https://github.com/finos/architecture-as-code/compare/cli-v1.54.0...cli-v1.55.0) (2026-08-12)

No changes to the CLI or its packages.

## [1.54.0](https://github.com/finos/architecture-as-code/compare/cli-v1.53.0...cli-v1.54.0) (2026-08-10)

### 🚀 Features

* add shared default layout persistence for CALM Hub architecture diagrams ([b9f465a](https://github.com/finos/architecture-as-code/commit/b9f465a66b086a3d2dcfa15b17d74342df7aecbd))

### 🐛 Bug Fixes

* address second round of layout review feedback ([1638fcd](https://github.com/finos/architecture-as-code/commit/1638fcd4df815010547796d518c2a5b174fc6749))
* properly configure auth for workspace commands ([#2968](https://github.com/finos/architecture-as-code/issues/2968)) ([2ab561c](https://github.com/finos/architecture-as-code/commit/2ab561c46421d9561ac15927695c3cc571e65ad2))
* update Copilot tool names ([#2938](https://github.com/finos/architecture-as-code/issues/2938)) ([65e1f95](https://github.com/finos/architecture-as-code/commit/65e1f95a980cf009a8d83f8131c5587c753f8888))

## [1.53.0](https://github.com/finos/architecture-as-code/compare/cli-v1.52.0...cli-v1.53.0) (2026-08-05)

### ♻️ Code Refactoring

* centralize document types ([#2898](https://github.com/finos/architecture-as-code/issues/2898)) ([184d448](https://github.com/finos/architecture-as-code/commit/184d448dadb48cacf00e8a220032b958e70e91c2))

## [1.52.0](https://github.com/finos/architecture-as-code/compare/cli-v1.51.0...cli-v1.52.0) (2026-08-03)

### 🐛 Bug Fixes

* resolve open CodeQL code scanning alerts (75-79) ([#2919](https://github.com/finos/architecture-as-code/issues/2919)) ([25be3b5](https://github.com/finos/architecture-as-code/commit/25be3b5210c47348876417b8a23172665bd68b4c))

## [1.51.0](https://github.com/finos/architecture-as-code/compare/cli-v1.50.1...cli-v1.51.0) (2026-07-29)

### 🐛 Bug Fixes

* don't swallow malformed 200 bodies into [] in calm-hub-client ([#2865](https://github.com/finos/architecture-as-code/issues/2865)) ([96cd530](https://github.com/finos/architecture-as-code/commit/96cd5301dff9c3500dc47578eba4a347cf0473ef))

## [1.50.1](https://github.com/finos/architecture-as-code/compare/cli-v1.50.0...cli-v1.50.1) (2026-07-27)

### 🐛 Bug Fixes

* resolve node names instead of raw ids in related-nodes diagrams ([#2883](https://github.com/finos/architecture-as-code/issues/2883)) ([2dd9a5f](https://github.com/finos/architecture-as-code/commit/2dd9a5fa708a9108e908f39b0083107ccdd3b1cd))

### 📚 Documentation

* warn agents against self-installing a browser for --export-diagrams ([#2855](https://github.com/finos/architecture-as-code/issues/2855)) ([c43d434](https://github.com/finos/architecture-as-code/commit/c43d43484995b8b6d4b57ad10b12c5634410f840))

## [1.50.0](https://github.com/finos/architecture-as-code/compare/cli-v1.49.0...cli-v1.50.0) (2026-07-22)

### 🚀 Features

* add as maven project ([a36a30f](https://github.com/finos/architecture-as-code/commit/a36a30f57fa493830849dccd50e978b58229c7e0))
* add CalmArchitecture entry point with parse and metadata access ([b951246](https://github.com/finos/architecture-as-code/commit/b9512467afff1d79690c6847d3f968f00e0fb348))
* add CalmArchitecture query methods and complete test coverage ([2fca05d](https://github.com/finos/architecture-as-code/commit/2fca05d511fa3759694aeb527712542ad773b1cc))
* add CalmArchitecture.parse(Object) overload ([55f6f5c](https://github.com/finos/architecture-as-code/commit/55f6f5cbb992e6a18e8f8030996981637d2c9808))
* add CalmNode and CalmRelationship ([6b5518e](https://github.com/finos/architecture-as-code/commit/6b5518eac8903a71e1dad1af45346b41a6e33841))
* add canonical Jackson schema classes ([1b2160b](https://github.com/finos/architecture-as-code/commit/1b2160b1ae8e9203f2d1d989e0206d0ba272082e))
* add ci config to publish to maven central ([e61c76d](https://github.com/finos/architecture-as-code/commit/e61c76d017e657dd1fa66c2a88a379229cbfbdb6))
* add document id and schema ID parsing ([86d3a60](https://github.com/finos/architecture-as-code/commit/86d3a60233eda29463a3ea2e19acc5b3d5ca2a1d))
* add extension parsing to CalmRelationship ([6d70e47](https://github.com/finos/architecture-as-code/commit/6d70e475bee4b96daf1eeb643cd6583a557bac10))
* add leaf model records and controls model ([acdd5bc](https://github.com/finos/architecture-as-code/commit/acdd5bcc2207a81d3aa0d13910119255f2faeee5))
* add sealed CalmRelationshipType hierarchy and CalmInterface ([14b6d0e](https://github.com/finos/architecture-as-code/commit/14b6d0e6d2a454b80c2fc0f7ebb6c9efdc201f38))
* add test fixture, exception class, and enums ([8844045](https://github.com/finos/architecture-as-code/commit/8844045af8f7dc15558b65a40891aa596d19df18))
* gitignore ([f856baf](https://github.com/finos/architecture-as-code/commit/f856baf1dc0bdf34bd2bf02ecbe4db79e7abb6e8))
* re-validate architectures after a bump, and interactively ask for bump type ([f9ef3e6](https://github.com/finos/architecture-as-code/commit/f9ef3e60934a51ab69814ec612e02286e16d1b99))
* validate patterns/architecture on check ([4c8abe6](https://github.com/finos/architecture-as-code/commit/4c8abe6336e86a27750275715a7790a882c016e3))
* Validation Engine Redesign with articulated assumptions ([#2805](https://github.com/finos/architecture-as-code/issues/2805)) ([e40a792](https://github.com/finos/architecture-as-code/commit/e40a792e74c72b4c390967283c3ccc8e5a58e214))

### 🐛 Bug Fixes

* add --minor to bump and fixes ([3dea4e4](https://github.com/finos/architecture-as-code/commit/3dea4e43b04982511b1ed2fab3a6f2984dbe48b3))
* deep copy pattern in selectChoices to avoid mutating caller input ([#2825](https://github.com/finos/architecture-as-code/issues/2825)) ([0f63c36](https://github.com/finos/architecture-as-code/commit/0f63c3634c7898a699db86964650514a3fcf841e))
* defensive copies, null-safe comparisons, and isObject guard ([afc6b1e](https://github.com/finos/architecture-as-code/commit/afc6b1e57e6ed6643b7d0c60857358be5bdbdd47))
* fix smoke tests ([ddde428](https://github.com/finos/architecture-as-code/commit/ddde428d67b1a3509e6e8d0edf2e135916a0ddf0))
* fix typo in relationship-creation prompt ([#2836](https://github.com/finos/architecture-as-code/issues/2836)) ([deb920f](https://github.com/finos/architecture-as-code/commit/deb920f8e7a6780476575ed123843aa2996325cf))
* improvements to models and tests ([1804583](https://github.com/finos/architecture-as-code/commit/1804583dedd40190a0979c7cf861078b7b504ddc))
* move to new sonatype repo ([6553ed7](https://github.com/finos/architecture-as-code/commit/6553ed7b18a4cd2c543b84139a4a95a8fb842368))
* sub-validations reported as failures and nonzero exit code ([af0ca02](https://github.com/finos/architecture-as-code/commit/af0ca020c5e32b2dcbe73f1ea8c9ea7270188ade))
* validate architectures against their pattern after bump ([b19b264](https://github.com/finos/architecture-as-code/commit/b19b2648a2ff5f64537dba463abe95acd833b52a))

### 📚 Documentation

* commit specs ([8c08a4b](https://github.com/finos/architecture-as-code/commit/8c08a4b2ca4a7de3c21e487fbd14a9be5588ba17))
* update docs ([320f966](https://github.com/finos/architecture-as-code/commit/320f966e0a45ac2cb9ffc1848e81a7cd43c401b2))

## [1.49.0](https://github.com/finos/architecture-as-code/compare/cli-v1.48.0...cli-v1.49.0) (2026-07-15)

### 📚 Documentation

* document calm docify --export-diagrams in CLI instructions ([#2810](https://github.com/finos/architecture-as-code/issues/2810)) ([daa2dbd](https://github.com/finos/architecture-as-code/commit/daa2dbd6a0ec30cfe374f96134be7188aebb8b32))

## [1.48.0](https://github.com/finos/architecture-as-code/compare/cli-v1.47.1...cli-v1.48.0) (2026-07-13)

### ⚠ BREAKING CHANGES

* `calm workspace populate` is no longer available.

### 🚀 Features

* add --fail-if-modified to hub push ([#2760](https://github.com/finos/architecture-as-code/issues/2760)) ([7d45299](https://github.com/finos/architecture-as-code/commit/7d45299bd701f5399984cb38ffd2775a95abe334))
* add control diff to diff engine ([#2732](https://github.com/finos/architecture-as-code/issues/2732)) ([7f1dfbc](https://github.com/finos/architecture-as-code/commit/7f1dfbc5c93bb8e9431cca5a8da3ff0f00ad7d62))
* Initial `calm workspace` commands ([#2378](https://github.com/finos/architecture-as-code/issues/2378)) ([e61b0ee](https://github.com/finos/architecture-as-code/commit/e61b0ee80839d029fe4d1a39638af14a60d28f97))
* remove workspace populate command ([4a7c4ce](https://github.com/finos/architecture-as-code/commit/4a7c4ce701ad97dbf35a0875502ed87b5ec870df))

### 🐛 Bug Fixes

* correct hub push --fail-if-modified comparison and extend to control docs ([9a2805a](https://github.com/finos/architecture-as-code/commit/9a2805a68f0af13088bca0e355013403f2cfa823))
* validate request path in DirectUrlDocumentLoader ([#2777](https://github.com/finos/architecture-as-code/issues/2777)) ([1449155](https://github.com/finos/architecture-as-code/commit/14491557984c17ef0d972e3d6bb6558a88f2f891))
* validate the exact value passed to the SSRF-sensitive sink ([#2779](https://github.com/finos/architecture-as-code/issues/2779)) ([601f11a](https://github.com/finos/architecture-as-code/commit/601f11a8219de4e3d795f3de8ac96c65229590e7))

### 📚 Documentation

* document hub, timeline, init-config, workspace rm ([#2781](https://github.com/finos/architecture-as-code/issues/2781)) ([86081b0](https://github.com/finos/architecture-as-code/commit/86081b04118aa92509978ed6b371569ab77ccdae))

## [1.47.1](https://github.com/finos/architecture-as-code/compare/cli-v1.47.0...cli-v1.47.1) (2026-06-29)

No changes to the CLI or its packages.

## [1.47.0](https://github.com/finos/architecture-as-code/compare/cli-v1.46.0...cli-v1.47.0) (2026-06-24)

### 🚀 Features

* extend render-interfaces to support related mode ([#2701](https://github.com/finos/architecture-as-code/issues/2701)) ([6d7ceff](https://github.com/finos/architecture-as-code/commit/6d7ceff4066efcaa6d4792e60503a8c0342779d4))

### 🐛 Bug Fixes

* remove committed node_modules symlink and harden gitignore ([#2708](https://github.com/finos/architecture-as-code/issues/2708)) ([7ca2158](https://github.com/finos/architecture-as-code/commit/7ca2158319a666f76b808ec644ef6517cd51f7a0))
* validate singular interface reference in connects relationships ([#2737](https://github.com/finos/architecture-as-code/issues/2737)) ([16e27f2](https://github.com/finos/architecture-as-code/commit/16e27f27e0e6d7c6b6aa0c0c6e02510b86513b64))

### 📚 Documentation

* document alphabetical ordering requirement for widgets and helpers ([#2710](https://github.com/finos/architecture-as-code/issues/2710)) ([4008ff3](https://github.com/finos/architecture-as-code/commit/4008ff35ec4f49fe65f2d83e7625d1c88ad8cd28))

## [1.46.0](https://github.com/finos/architecture-as-code/compare/cli-v1.45.0...cli-v1.46.0) (2026-06-17)

### 🚀 Features

* add --export-diagrams flag to render mermaid diagrams via local browser ([#2634](https://github.com/finos/architecture-as-code/issues/2634)) ([dd3dec5](https://github.com/finos/architecture-as-code/commit/dd3dec5e700732f90d3a14b14cb07e98f2b7f863))

## [1.45.0](https://github.com/finos/architecture-as-code/compare/cli-v1.44.1...cli-v1.45.0) (2026-06-16)

### 🚀 Features

* Set up ADR Diff Engine ([#2500](https://github.com/finos/architecture-as-code/issues/2500)) ([d66b448](https://github.com/finos/architecture-as-code/commit/d66b448f73241dde9729a3b8b055e4c4968f3105))

## [1.44.1](https://github.com/finos/architecture-as-code/compare/cli-v1.44.0...cli-v1.44.1) (2026-06-09)

### 🐛 Bug Fixes

* allow calmhub document loader to resolve https and http urls as well as calm:// ([#2612](https://github.com/finos/architecture-as-code/issues/2612)) ([0573cb0](https://github.com/finos/architecture-as-code/commit/0573cb08671851ea8f9c96cc32905159290f28ec))

## [1.44.0](https://github.com/finos/architecture-as-code/compare/cli-v1.43.1...cli-v1.44.0) (2026-06-08)

### 🐛 Bug Fixes

* diff id-less pattern items by content instead of dropping them ([#2582](https://github.com/finos/architecture-as-code/issues/2582)) ([b5ecddd](https://github.com/finos/architecture-as-code/commit/b5ecdddd40071790f23a66bee24dae96dd3e9fac))
* run JSON schema validation in architecture-only validate path ([#2560](https://github.com/finos/architecture-as-code/issues/2560)) ([5b19531](https://github.com/finos/architecture-as-code/commit/5b195310f329c6665b3db336a1d61980f2f0e8d0))

### ♻️ Code Refactoring

* enable TypeScript strict mode for production build ([#2583](https://github.com/finos/architecture-as-code/issues/2583)) ([be98b7a](https://github.com/finos/architecture-as-code/commit/be98b7a2f805fc8f1d01e524fb055a983ee61e1c))

## [1.43.1](https://github.com/finos/architecture-as-code/compare/cli-v1.43.0...cli-v1.43.1) (2026-06-03)

No changes to the CLI or its packages.

## [1.43.0](https://github.com/finos/architecture-as-code/compare/cli-v1.42.1...cli-v1.43.0) (2026-06-01)

### 🚀 Features

* extend hub commands with patterns, standards, domains, controls, decorators, and auth plugin support ([#2472](https://github.com/finos/architecture-as-code/issues/2472)) ([55a1025](https://github.com/finos/architecture-as-code/commit/55a10257e9e512872ac447e82d7ed498e37e8b4e))

## [1.42.1](https://github.com/finos/architecture-as-code/compare/cli-v1.42.0...cli-v1.42.1) (2026-05-27)

No changes to the CLI or its packages.

## [1.42.0](https://github.com/finos/architecture-as-code/compare/cli-v1.41.0...cli-v1.42.0) (2026-05-25)

### 🚀 Features

* architecture timelines ([#2289](https://github.com/finos/architecture-as-code/issues/2289)) ([#2496](https://github.com/finos/architecture-as-code/issues/2496)) ([8f61008](https://github.com/finos/architecture-as-code/commit/8f610080cf5fd64e102a00cdb22524cb558bd9c4))
* diff CALM patterns as well as architectures ([#2489](https://github.com/finos/architecture-as-code/issues/2489)) ([716100f](https://github.com/finos/architecture-as-code/commit/716100fe39ed744d98b03236bf3ec7950b63265a))

### 🐛 Bug Fixes

* surface fatal document-loader errors instead of masking them ([#2488](https://github.com/finos/architecture-as-code/issues/2488)) ([f436764](https://github.com/finos/architecture-as-code/commit/f436764c20dd025f90ce00dab246670ed1f60f66)), closes [#2440](https://github.com/finos/architecture-as-code/issues/2440)

## [1.41.0](https://github.com/finos/architecture-as-code/compare/cli-v1.40.0...cli-v1.41.0) (2026-05-21)

### 🚀 Features

* add CALM Hub architecture and namespace commands ([#2400](https://github.com/finos/architecture-as-code/issues/2400)) ([ec10160](https://github.com/finos/architecture-as-code/commit/ec10160a91c1b002510b451f69b026270a79c8e4))
* allow calm hub client to be enhanced with plugin + tighten typing up ([d995f84](https://github.com/finos/architecture-as-code/commit/d995f84fece4982700c62f3a685fd5e77854b1d8))
* allow setting of CLI config via env vars ([#2475](https://github.com/finos/architecture-as-code/issues/2475)) ([d17a908](https://github.com/finos/architecture-as-code/commit/d17a9087c5f5e4f97a5679545bf7633c44ceca32))
* better AGENTS.md ([f13e6a2](https://github.com/finos/architecture-as-code/commit/f13e6a218125ca6ee34810d20a34d7f5db826d5a))
* shared CALM architecture diff with calm diff CLI and calm-hub-ui /diff route ([#2442](https://github.com/finos/architecture-as-code/issues/2442)) ([330e500](https://github.com/finos/architecture-as-code/commit/330e50008a065c941bddd7eb304b726d7762d149))
* support pattern generation options passed on command line ([#2291](https://github.com/finos/architecture-as-code/issues/2291)) ([5287f8a](https://github.com/finos/architecture-as-code/commit/5287f8aa7d19a9a83d54833f358dce6877bc0e3d))
* tell AGENTS how to run individual test files ([16e4dfb](https://github.com/finos/architecture-as-code/commit/16e4dfbcc2905f41070b8418e4c19d709c4c1a00))
* validate response data is JSON object ([#2436](https://github.com/finos/architecture-as-code/issues/2436)) ([43c04b3](https://github.com/finos/architecture-as-code/commit/43c04b36744eb5641cfbbaa27f812f4e43f76d2b))

### 🐛 Bug Fixes

* better tests ([48866e2](https://github.com/finos/architecture-as-code/commit/48866e2fa7062fdad44a36c1319d79b27a3010aa))
* lint ([637121e](https://github.com/finos/architecture-as-code/commit/637121edf8257f950d588ea3d137a05e58f58189))

## [1.40.0](https://github.com/finos/architecture-as-code/compare/cli-v1.39.1...cli-v1.40.0) (2026-05-08)

### 🚀 Features

* add init-config command and clearer remote-host errors ([0eba6bd](https://github.com/finos/architecture-as-code/commit/0eba6bd08756c5b3c35957b2252a3327b5ed628d))

### 🐛 Bug Fixes

* satisfy eslint for init-config block and loader message ([564419e](https://github.com/finos/architecture-as-code/commit/564419eb19516869eef08892e8c9c8ba6315df17))

## [1.39.1](https://github.com/finos/architecture-as-code/compare/cli-v1.39.0...cli-v1.39.1) (2026-05-05)

No changes to the CLI or its packages.

## [1.39.0](https://github.com/finos/architecture-as-code/compare/cli-v1.38.0...cli-v1.39.0) (2026-05-02)

No changes to the CLI or its packages.

## [1.38.0](https://github.com/finos/architecture-as-code/compare/cli-v1.37.0...cli-v1.38.0) (2026-04-29)

### 🚀 Features

* add Codex support for calm init-ai ([#2327](https://github.com/finos/architecture-as-code/issues/2327)) ([44b4759](https://github.com/finos/architecture-as-code/commit/44b47597a5d6dae198e3ae1bdcb3e12d21d9c8f7))

### 🐛 Bug Fixes

* harden direct URL loading and align lodash to 4.18.1 ([#2304](https://github.com/finos/architecture-as-code/issues/2304)) ([dc686f5](https://github.com/finos/architecture-as-code/commit/dc686f58f212b1eaef58105c8fb63046a1e71ec8))
* resolve docusaurus/mermaid/elk dependency and add test ([2ec7ab7](https://github.com/finos/architecture-as-code/commit/2ec7ab738fb3caad3d86f6fbf11dcc6b67b3e181))

## [1.37.0](https://github.com/finos/architecture-as-code/compare/cli-v1.36.0...cli-v1.37.0) (2026-04-01)

No changes to the CLI or its packages.

## [1.36.0](https://github.com/finos/architecture-as-code/compare/cli-v1.35.0...cli-v1.36.0) (2026-03-30)

### 🚀 Features

* add hidden --ants flag to docify for ant farm visualization ([#2277](https://github.com/finos/architecture-as-code/issues/2277)) ([dc8c191](https://github.com/finos/architecture-as-code/commit/dc8c191fa5b4d0602cdd4596ba64f14155f114c3))
* enhance init-ai command to validate frontmatter content for LLM providers ([632aa68](https://github.com/finos/architecture-as-code/commit/632aa68545488060cdeda07a1ad895149bb17702))
* update init-ai command to remove hard-code LLM for copilot ([2b1e591](https://github.com/finos/architecture-as-code/commit/2b1e59123646fe0d523de99a2f3abf4bf35fe271))

### 🐛 Bug Fixes

* resolve all open CodeQL security alerts ([#2272](https://github.com/finos/architecture-as-code/issues/2272)) ([13f486c](https://github.com/finos/architecture-as-code/commit/13f486c91116a3d8b9cc6c89e27721aaf3adf5f9))
* resolve dependabot security vulnerabilities ([#2275](https://github.com/finos/architecture-as-code/issues/2275)) ([a04c51f](https://github.com/finos/architecture-as-code/commit/a04c51f0b992869b552008d89c885e83a5bb5c30))

## [1.35.0](https://github.com/finos/architecture-as-code/compare/cli-v1.34.4...cli-v1.35.0) (2026-03-26)

### 🚀 Features

* remove default LLM for copilot AI Assistant ([#2243](https://github.com/finos/architecture-as-code/issues/2243)) ([0d913ec](https://github.com/finos/architecture-as-code/commit/0d913ec0478c5323788b7ad605bb29900fe6c4eb))

### 🐛 Bug Fixes

* resolve critical SSRF and tainted format string code scanning alerts ([#2229](https://github.com/finos/architecture-as-code/issues/2229)) ([9e479de](https://github.com/finos/architecture-as-code/commit/9e479decf6423d6f30e8ba8f602a51612c297159))

### 📚 Documentation

* correct init-ai command syntax to use -p provider flag ([#2213](https://github.com/finos/architecture-as-code/issues/2213)) ([edca9b5](https://github.com/finos/architecture-as-code/commit/edca9b57b543620b676f994264e38315a3edbbd7))

## [1.34.4](https://github.com/finos/architecture-as-code/compare/cli-v1.34.3...cli-v1.34.4) (2026-03-02)

No changes to the CLI or its packages.

## [1.34.3](https://github.com/finos/architecture-as-code/compare/cli-v1.34.2...cli-v1.34.3) (2026-03-02)

### 🚀 Features

* enable TypeScript strict mode for calm-models and cli ([#2186](https://github.com/finos/architecture-as-code/issues/2186)) ([63fd92f](https://github.com/finos/architecture-as-code/commit/63fd92fb1a9d1854825861102bf10e0d3ac60315))
* remove server functionality (now in @finos/calm-server package) ([#2195](https://github.com/finos/architecture-as-code/issues/2195)) ([1ce8615](https://github.com/finos/architecture-as-code/commit/1ce8615dd94edb095c00c575472283b13072a5bb))

### 🐛 Bug Fixes

* iss2150 pattern interface defs error ([#2152](https://github.com/finos/architecture-as-code/issues/2152)) ([c8e6b9b](https://github.com/finos/architecture-as-code/commit/c8e6b9b3491a065f55fa2ae8fd124ee41de8ab13))
* update validate() signature to accept undefined ([#2190](https://github.com/finos/architecture-as-code/issues/2190)) ([a284ee0](https://github.com/finos/architecture-as-code/commit/a284ee0841b7af734232f6850197dfa77757d5a4))

## [1.34.2](https://github.com/finos/architecture-as-code/compare/cli-v1.34.1...cli-v1.34.2) (2026-02-26)

No changes to the CLI or its packages.

## [1.34.1](https://github.com/finos/architecture-as-code/compare/cli-v1.34.0...cli-v1.34.1) (2026-02-26)

No changes to the CLI or its packages.

## [1.34.0](https://github.com/finos/architecture-as-code/compare/cli-v1.33.0...cli-v1.34.0) (2026-02-26)

No changes to the CLI or its packages.

## [1.33.0](https://github.com/finos/architecture-as-code/compare/cli-v1.32.0...cli-v1.33.0) (2026-02-16)

### 🚀 Features

* add decorator creation tool for AI assistants ([e894ae9](https://github.com/finos/architecture-as-code/commit/e894ae9bf4d3776936230f2791770a23a4e8d76f))
* Additional timeline validations ([#2112](https://github.com/finos/architecture-as-code/issues/2112)) ([9893f8b](https://github.com/finos/architecture-as-code/commit/9893f8b408f48d88accc96b1cd92a42c56cea185))
* fix invisible bullet in AI instructions ([ebc2cd4](https://github.com/finos/architecture-as-code/commit/ebc2cd499e3e19af17024f1b95224c8b47679761))
* fix timeline AI tools. Add a CALM timeline of CALM ([90fb388](https://github.com/finos/architecture-as-code/commit/90fb38892eac25258e80498141b7ce1744e11db6))
* implement `calm validate --timeline` ([2f4162b](https://github.com/finos/architecture-as-code/commit/2f4162b71e64d284b845df106f3b51ec361b07fd))

### 🐛 Bug Fixes

* add ajv-formats explicitly to dependencies ([6e3fe54](https://github.com/finos/architecture-as-code/commit/6e3fe54f107b713cf05cc9768df5d3bd50cae532))
* correct signature of validate method ([f372336](https://github.com/finos/architecture-as-code/commit/f3723368469bbedaf7a40c240f7700e5ee131c59))
* fail validation of timelines with no implicit or explict schema ([3faf0b3](https://github.com/finos/architecture-as-code/commit/3faf0b3d17bba597b822ba14d5cb6e33de6ee5d0))
* fix minimal architecture timeline ([2321d81](https://github.com/finos/architecture-as-code/commit/2321d81c3a8e4c24a9f35bea36be9f18b5a67915))
* fix test pattern to consistent use a single schema version ([6d4976f](https://github.com/finos/architecture-as-code/commit/6d4976fe5fdcf1459eacf36d1c884d01cb001cbd))
* lint ([dffca0b](https://github.com/finos/architecture-as-code/commit/dffca0b72f89b94ac817ab830951985823fd5855))
* make tests applicable to all schema versions ([e34e4a3](https://github.com/finos/architecture-as-code/commit/e34e4a3ecdc54ab74c1a92ee8993c5c11d70b0c5))
* rename loadPatternFromArchitectureIfPresent to loadPatternFromDocumentIfPresent ([#2105](https://github.com/finos/architecture-as-code/issues/2105)) ([5b3c9b2](https://github.com/finos/architecture-as-code/commit/5b3c9b2254245c9cce7ac617d53e28d9e85dfdbe))

## [1.32.0](https://github.com/finos/architecture-as-code/compare/cli-v1.31.0...cli-v1.32.0) (2026-02-11)

### 🚀 Features

* address review comments ([e51ec46](https://github.com/finos/architecture-as-code/commit/e51ec463036dc0224f354c861749aca22b8f13ec))
* remove `copilot-chatmode` option from CLI ([dc5cd54](https://github.com/finos/architecture-as-code/commit/dc5cd54026da77e0259a42616eed815d2ba9372e))

### 🐛 Bug Fixes

* address review comments — pin .nvmrc, reword AGENTS.md, align calm-models to Node 22 types ([e5c091b](https://github.com/finos/architecture-as-code/commit/e5c091b7ad36e5b722a6cf589381b995ca0aa340))
* render primitive arrays inline with comma separator list for for MDX compatibility ([#2080](https://github.com/finos/architecture-as-code/issues/2080)) ([#2082](https://github.com/finos/architecture-as-code/issues/2082)) ([25eee61](https://github.com/finos/architecture-as-code/commit/25eee61bedfba3502bcf9916bf7979cf8dc568a2))

## [1.31.0](https://github.com/finos/architecture-as-code/compare/cli-v1.30.0...cli-v1.31.0) (2026-01-28)

### 🚀 Features

* lint ([238b8c7](https://github.com/finos/architecture-as-code/commit/238b8c7ac75185175450283fcf3b2aeed2678495))
* support specifying default widget options ([3a0d589](https://github.com/finos/architecture-as-code/commit/3a0d5890699799b79333f44cc5860c8269b7afb9))
* support specifying default widget options in frontmatter ([9df3801](https://github.com/finos/architecture-as-code/commit/9df3801c70ca79208ddae45afdda1a305ba3f743))

### 🐛 Bug Fixes

* add tests ([fa66a1a](https://github.com/finos/architecture-as-code/commit/fa66a1ad7f4f8d1ff5b60d22393fb1355163c0f3))
* address review comments ([be86952](https://github.com/finos/architecture-as-code/commit/be8695221b8f85569db23cde8b868e88857d0545))
* lint ([7e290bd](https://github.com/finos/architecture-as-code/commit/7e290bd1f84cc625de80094616cfb616af2fcca8))
* reassess themes vs WCAG 2.1 AAA contrast requirements and base on CALM blue ([c7b7991](https://github.com/finos/architecture-as-code/commit/c7b7991fac0c3e3c8b99029b57188345c9c51942))
* remove old code that broke build ([9fb13bf](https://github.com/finos/architecture-as-code/commit/9fb13bf95ae406b302c96661eeedc1f54507733d))
* remove unused  imports ([b92a3a1](https://github.com/finos/architecture-as-code/commit/b92a3a1a3da4013790e25aaa92f6db0b9fb9ab03))
* remove unused ValidationOutcome import ([feec778](https://github.com/finos/architecture-as-code/commit/feec7788ff61692978399396645be051694a4e53))
* tests ([d9aa0e3](https://github.com/finos/architecture-as-code/commit/d9aa0e3648834b87289e121fd76c7b9ef11e4332))
* update test fixtures ([52569fc](https://github.com/finos/architecture-as-code/commit/52569fc39455775dc5796e230f266035ef6037f4))

## [1.30.0](https://github.com/finos/architecture-as-code/compare/cli-v1.29.0...cli-v1.30.0) (2026-01-26)

### ♻️ Code Refactoring

* move validation helpers to shared package ([#2058](https://github.com/finos/architecture-as-code/issues/2058)) ([1808b57](https://github.com/finos/architecture-as-code/commit/1808b579750cacb90b30251ad7db95d18ac8bced))

## [1.29.0](https://github.com/finos/architecture-as-code/compare/cli-v1.28.3...cli-v1.29.0) (2026-01-21)

No changes to the CLI or its packages.

## [1.28.3](https://github.com/finos/architecture-as-code/compare/cli-v1.28.2...cli-v1.28.3) (2026-01-19)

No changes to the CLI or its packages.

## [1.28.2](https://github.com/finos/architecture-as-code/compare/cli-v1.28.1...cli-v1.28.2) (2026-01-14)

### 📚 Documentation

* fix remaining workspace name inconsistencies ([d4b86ab](https://github.com/finos/architecture-as-code/commit/d4b86ab41d4c0b32f4df89202afc26212ee7d923))

## [1.28.1](https://github.com/finos/architecture-as-code/compare/cli-v1.28.0...cli-v1.28.1) (2026-01-13)

### 🚀 Features

* add context7.json for Context7 ownership claim ([#2022](https://github.com/finos/architecture-as-code/issues/2022)) ([701364e](https://github.com/finos/architecture-as-code/commit/701364ec315890d76a3662498047ffb79c58c303))

### 🐛 Bug Fixes

* update copy-ai-tools script and validate bundled AI resources ([c35470e](https://github.com/finos/architecture-as-code/commit/c35470e427c2f565438a82b1f55b8b27df732c35))

## [1.28.0](https://github.com/finos/architecture-as-code/compare/cli-v1.27.0...cli-v1.28.0) (2026-01-12)

### 🚀 Features

* add copilot and kiro AI assistant configurations with skill prompts ([44dea03](https://github.com/finos/architecture-as-code/commit/44dea031f55acc8bfce9772a853a72efb4cba01b))
* add error handling tests for setupEnhancedAiTools to validate directory checks ([155eaae](https://github.com/finos/architecture-as-code/commit/155eaaeca432cf8007f3c89b7cb7e430dd111b35))
* add init-ai command for AI provider initialization and deprecate copilot-chatmode ([a90866e](https://github.com/finos/architecture-as-code/commit/a90866eb4ad0a9c34d551120ab6e269247d3579b))
* add security and data validation tests for AI tools setup ([4ecf96b](https://github.com/finos/architecture-as-code/commit/4ecf96b79349dbb3b05e7cadfc9a8c41051d4c70))
* add tests for setupEnhancedAiTools with real file handling and provider support ([a01b972](https://github.com/finos/architecture-as-code/commit/a01b97282629de2ced8587de4fdb6a3ceff70899))
* add topLevelPromptDirectory to AI assistant configurations for enhanced directory structure ([ce48637](https://github.com/finos/architecture-as-code/commit/ce48637cefb1024ebaaea5fe297732aa4a408317))
* deprecate copilot-chatmode command and introduce init-ai for AI assistance setup ([f8a19da](https://github.com/finos/architecture-as-code/commit/f8a19dabdb2c88fa4f65ca7d15542e6ed77fe64f))
* enhance AI tools setup with provider validation and improved configuration checks ([0c9638c](https://github.com/finos/architecture-as-code/commit/0c9638cf68539cb5bc8d136bfa460997260a467c))
* enhance setupAiTools tests with improved mocking and error handling ([9cca7c7](https://github.com/finos/architecture-as-code/commit/9cca7c733c1bb472200fcccd29baf9a25b12b8fc))
* generalize AI provider initialization in CLI setup ([2ca04d0](https://github.com/finos/architecture-as-code/commit/2ca04d001357c0c3e0b201c0a864fda6405adb6d))
* generalize setupAiTools to accept provider parameter for improved flexibility ([1f5f79f](https://github.com/finos/architecture-as-code/commit/1f5f79f603bd728eb6501e94f336f595177cbd4a))
* generalize setupAiTools to accept provider parameter in tests ([9a49ebe](https://github.com/finos/architecture-as-code/commit/9a49ebed44bc424034da79de3973757a53c0fcab))
* Implement multi-document navigation and refactor document loader ([af7e8d4](https://github.com/finos/architecture-as-code/commit/af7e8d4d592ee94333ee7404b11485865fa7ff8f))
* improve error handling in createChatmodeConfig for better clarity and throw on failure ([2b9c875](https://github.com/finos/architecture-as-code/commit/2b9c87597831b6648d3ad37663968e8a2f5d31d5))
* introduce CALM AI Tools documentation and deprecate copilot-chatmode references ([c32a868](https://github.com/finos/architecture-as-code/commit/c32a86803378ebc144b3b270c5261045ba05f0e9))
* remove CALM.chatmode.md file as part of architecture refactoring ([de4eda4](https://github.com/finos/architecture-as-code/commit/de4eda4974777b01ae96ce9a3d1d251c051a965e))
* remove hardcoded AI provider argument from setupAiTools function call ([1cb1d49](https://github.com/finos/architecture-as-code/commit/1cb1d49038ab7332c64131a947f19392d6970f69))
* revert setupAiTools function by removing provider argument ([debe9df](https://github.com/finos/architecture-as-code/commit/debe9dfe11f7028fb5d5e02299d53bf3c5eda8ef))
* update AI tools setup to use templates and improve logging ([b61ee2b](https://github.com/finos/architecture-as-code/commit/b61ee2b96aaf4d608328a8d2fa02522a42602189))
* update init-ai command argument description to specify supported AI providers ([85a0909](https://github.com/finos/architecture-as-code/commit/85a0909177868ef46012c86f5314026c5ebe62c6))
* update logging messages in CALM AI tools setup ([a25a231](https://github.com/finos/architecture-as-code/commit/a25a231686a48c934c07a0b0da6bfaf836f4facc))
* update README and CLI instructions for init-ai command and deprecate copilot-chatmode ([1322f6a](https://github.com/finos/architecture-as-code/commit/1322f6a35d5bbcef08ca99e4578b80c637908406))
* update setupAiTools to include provider parameter and refactor CLI setup ([c9e1683](https://github.com/finos/architecture-as-code/commit/c9e168346fe3b45ca8b6c45e1decbe15681264a8))
* update setupEnhancedAiTools to enhance logging and remove deprecated chatmode config creation ([ac46333](https://github.com/finos/architecture-as-code/commit/ac46333ac508a2f1d153cfc25d6eafa21937561a))
* update title in CALM AI Tools documentation to reflect correct terminology ([2257633](https://github.com/finos/architecture-as-code/commit/225763346388c2700a0610cc78ac97df1c2504b4))
* update Voice Mode documentation to reflect CALM AI Tools and correct references ([3517d30](https://github.com/finos/architecture-as-code/commit/3517d30afe9a0914559b4206cd952cccd1360d58))
* WIP update AI tools setup to support multiple providers and enhance configuration process ([d74eba6](https://github.com/finos/architecture-as-code/commit/d74eba6d32122a5f7b8b541c9ca48a9726485e62))

### 🐛 Bug Fixes

* protect against infinite recursion if a pattern references a JSON schema ([#2012](https://github.com/finos/architecture-as-code/issues/2012)) ([c415b5b](https://github.com/finos/architecture-as-code/commit/c415b5b0cc58fd2974eabfaee2cfaa02d4cc11a6))
* remove deleted standards-from-patterns from sidebar and fix broken links ([67ce795](https://github.com/finos/architecture-as-code/commit/67ce7954023d344b7ff2d183a90d55c4bd732aac))
* update command name for installing AI Assistant support in CALM ([2b89364](https://github.com/finos/architecture-as-code/commit/2b89364c2355b2c5b7ca05a1ba32d5ea5e5aec34))
* update prerequisites and section titles for CALM AI Support ([5b2a4c8](https://github.com/finos/architecture-as-code/commit/5b2a4c89b663b5c00858c7bfb371702626785a1b))

## [1.27.0](https://github.com/finos/architecture-as-code/compare/cli-v1.26.1...cli-v1.27.0) (2026-01-07)

### 🚀 Features

* Moving webside mode to widgets + scaffold mode ([1c4cb24](https://github.com/finos/architecture-as-code/commit/1c4cb240e17ce25c59d71f13c575b58edadb65e5))

### 📚 Documentation

* Add homebrew install method ([#2009](https://github.com/finos/architecture-as-code/issues/2009)) ([81f4a19](https://github.com/finos/architecture-as-code/commit/81f4a19a0d180e84831d67c345d257d6117e5f15))

## [1.26.1](https://github.com/finos/architecture-as-code/compare/cli-v1.26.0...cli-v1.26.1) (2026-01-05)

No changes to the CLI or its packages.

## [1.26.0](https://github.com/finos/architecture-as-code/compare/cli-v1.25.1...cli-v1.26.0) (2026-01-02)

### 🚀 Features

* add support for themes of the block-architecture widget ([#1985](https://github.com/finos/architecture-as-code/issues/1985)) ([086b66b](https://github.com/finos/architecture-as-code/commit/086b66b202bb8c3f9c878d7af14e13754c1225fe))

## [1.25.1](https://github.com/finos/architecture-as-code/compare/cli-v1.25.0...cli-v1.25.1) (2025-12-27)

No changes to the CLI or its packages.

## [1.25.0](https://github.com/finos/architecture-as-code/compare/cli-v1.24.1...cli-v1.25.0) (2025-12-22)

### 🚀 Features

* Add support for rendering additional properties ([4fc55de](https://github.com/finos/architecture-as-code/commit/4fc55deb6bbb2ae05a9520d63a48994cc0e22db3))

### 📚 Documentation

* Fix confusing nested code fence example in AGENTS.md ([4e79e82](https://github.com/finos/architecture-as-code/commit/4e79e8244613f13dc1cf7aaa4ac835ecdf6c9dcb))

## [1.24.1](https://github.com/finos/architecture-as-code/compare/cli-v1.24.0...cli-v1.24.1) (2025-12-17)

No changes to the CLI or its packages.

## [1.24.0](https://github.com/finos/architecture-as-code/compare/cli-v1.23.3...cli-v1.24.0) (2025-12-17)

### 🚀 Features

* Add Day 20 documentation for multi-pattern validation approach ([#1963](https://github.com/finos/architecture-as-code/issues/1963)) ([f30bd05](https://github.com/finos/architecture-as-code/commit/f30bd05c34c37215aa7089c6892e9ee0865ceede))

## [1.23.3](https://github.com/finos/architecture-as-code/compare/cli-v1.23.2...cli-v1.23.3) (2025-12-12)

No changes to the CLI or its packages.

## [1.23.2](https://github.com/finos/architecture-as-code/compare/cli-v1.23.1...cli-v1.23.2) (2025-12-12)

No changes to the CLI or its packages.

## [1.23.1](https://github.com/finos/architecture-as-code/compare/cli-v1.23.0...cli-v1.23.1) (2025-12-12)

No changes to the CLI or its packages.

## [1.23.0](https://github.com/finos/architecture-as-code/compare/cli-v1.22.1...cli-v1.23.0) (2025-12-12)

### 🚀 Features

* improve validation output formatting ([#1950](https://github.com/finos/architecture-as-code/issues/1950)) ([bab1a10](https://github.com/finos/architecture-as-code/commit/bab1a107ba856baafbcdb953ff7b3e45bfd0deb9))

## [1.22.1](https://github.com/finos/architecture-as-code/compare/cli-v1.22.0...cli-v1.22.1) (2025-12-09)

### 🐛 Bug Fixes

* correct day reference in Update Your README section (12 -> 14) ([#1937](https://github.com/finos/architecture-as-code/issues/1937)) ([1134e50](https://github.com/finos/architecture-as-code/commit/1134e503afc1370702a54917ba730ee80d60e51e))
* fix docify website so that you can navigate relationships + render controls on pages ([#1936](https://github.com/finos/architecture-as-code/issues/1936)) ([b546496](https://github.com/finos/architecture-as-code/commit/b546496a7e3a04443dff1e82ef36a47319ad8234))

## [1.22.0](https://github.com/finos/architecture-as-code/compare/cli-v1.21.0...cli-v1.22.0) (2025-12-09)

### 🚀 Features

* add --url-to-local-file-mapping option to validate and generate ([ad41955](https://github.com/finos/architecture-as-code/commit/ad4195509de58a6d797d645faa6db43780c9a04f))
* add MappedDocumentLoader for URL-to-local-file mapping ([17201c7](https://github.com/finos/architecture-as-code/commit/17201c7004d3899f1c982582e9e69993f074a618))
* add urlToLocalMap and basePath to DocumentLoaderOptions ([4c38f54](https://github.com/finos/architecture-as-code/commit/4c38f5436258a9cfc51fac6b622209802292ec39))

### 🐛 Bug Fixes

* add type annotation to docId variable ([20c78dd](https://github.com/finos/architecture-as-code/commit/20c78dd5ac90fa05fb66f2cbd5e626dec2cd80c5))
* add type annotation to parseDocumentLoaderConfig options ([2982a51](https://github.com/finos/architecture-as-code/commit/2982a518583e7fa00a7acbff7c4c118ebf11a237))
* clarify const usage in pattern creation guidance ([055065e](https://github.com/finos/architecture-as-code/commit/055065e7ff6d72e764aa0bb868601ab722b40799))
* fix lint error and add feature proposal ([4d421a3](https://github.com/finos/architecture-as-code/commit/4d421a3b25640d5e31fdbc310c25912d87980802))
* Update schema refs to HTTPS ([#1932](https://github.com/finos/architecture-as-code/issues/1932)) ([a9ce8b6](https://github.com/finos/architecture-as-code/commit/a9ce8b6ed0fe5a3b1dbc71d45c8344a3eb8ec4cb))
* use type-safe error handling in MappedDocumentLoader ([feba7f7](https://github.com/finos/architecture-as-code/commit/feba7f7d75f23da9b5a2804b14f4de29826d2ba1))

### 📚 Documentation

* update agent prompts for URL mapping support ([eb4653b](https://github.com/finos/architecture-as-code/commit/eb4653b2fb9b1038c313a7efee9300fbfadcbb69))

### ♻️ Code Refactoring

* extract resolveLocalPath helper method ([10b5334](https://github.com/finos/architecture-as-code/commit/10b53349d049928e2b343b89c682fe9f2c171114))

## [1.21.0](https://github.com/finos/architecture-as-code/compare/cli-v1.20.0...cli-v1.21.0) (2025-12-05)

### 🚀 Features

* enhance CLI documentation with usage notes and validation options ([#1914](https://github.com/finos/architecture-as-code/issues/1914)) ([12edca8](https://github.com/finos/architecture-as-code/commit/12edca885436ffab624f1c9ba97126d91dbec38b))

### 🐛 Bug Fixes

* escape special characters in Mermaid text labels ([#1918](https://github.com/finos/architecture-as-code/issues/1918)) ([49ccc5d](https://github.com/finos/architecture-as-code/commit/49ccc5d7495355ad139d3e0002d4f31022255810))
* resolve schema references relative to the architecture file ([#1909](https://github.com/finos/architecture-as-code/issues/1909)) ([e00389a](https://github.com/finos/architecture-as-code/commit/e00389abd9076d8e9f8f0f4edbc150ddf06ddc3c))

## [1.20.0](https://github.com/finos/architecture-as-code/compare/cli-v1.19.1...cli-v1.20.0) (2025-12-03)

### 🚀 Features

* add CloudFront cache invalidation to S3 sync workflows ([#1904](https://github.com/finos/architecture-as-code/issues/1904)) ([282d026](https://github.com/finos/architecture-as-code/commit/282d0260c9911e62b2bdeac78e28d8efd4edb90e))

### 🐛 Bug Fixes

* use secret instead of var for CloudFront distribution ID ([#1906](https://github.com/finos/architecture-as-code/issues/1906)) ([d78c391](https://github.com/finos/architecture-as-code/commit/d78c391f19830d87a00c6e5362fea5c77905699f))

## [1.19.1](https://github.com/finos/architecture-as-code/compare/cli-v1.19.0...cli-v1.19.1) (2025-12-01)

No changes to the CLI or its packages.

## [1.19.0](https://github.com/finos/architecture-as-code/compare/cli-v1.18.0...cli-v1.19.0) (2025-11-29)

### 🐛 Bug Fixes

* add calm-cli-instructions.md to bundled resources validation ([f91234a](https://github.com/finos/architecture-as-code/commit/f91234a64acfcdba0a1e7e51083b2ea6cbcb41d6))
* remove extraneous messages going to stdout during flow validation ([#1890](https://github.com/finos/architecture-as-code/issues/1890)) ([7ffdec0](https://github.com/finos/architecture-as-code/commit/7ffdec0433e803daa2391fd7effb14e15d7fdae9))

## [1.18.0](https://github.com/finos/architecture-as-code/compare/cli-v1.17.0...cli-v1.18.0) (2025-11-28)

### 🚀 Features

* add spectral rules for flow validations ([f823b93](https://github.com/finos/architecture-as-code/commit/f823b9380244e496fb1e9b17a925fc5d4ee2c33f))
* better relationship generation by agents ([#1858](https://github.com/finos/architecture-as-code/issues/1858)) ([5d2dddf](https://github.com/finos/architecture-as-code/commit/5d2dddff1f3dc3ef212b23e5d33bd542724b6a7a))
* introduce CALM schema 1.1 with revised 'flows' definition. Added tests ([3cfac31](https://github.com/finos/architecture-as-code/commit/3cfac31aef08c366a2d19ce68dc97c52cec41747))

### 🐛 Bug Fixes

* add explicit permissions to validate-renovate workflow ([#1868](https://github.com/finos/architecture-as-code/issues/1868)) ([108f6ad](https://github.com/finos/architecture-as-code/commit/108f6addd159738c6d20100b61a981d6850b464a))
* escape backslashes before quotes in template preprocessor ([#1866](https://github.com/finos/architecture-as-code/issues/1866)) ([5548fa6](https://github.com/finos/architecture-as-code/commit/5548fa6ea87f22e70531616d20f75358f8c44adc))
* permit zero or false properties ([5f9500a](https://github.com/finos/architecture-as-code/commit/5f9500a6f25b24c5b776d7ed7e563024b662967c))
* remove untrusted checkout in pr-labelling workflow ([#1867](https://github.com/finos/architecture-as-code/issues/1867)) ([0862a76](https://github.com/finos/architecture-as-code/commit/0862a76cf527d494ef3da2f9ef48d7e5a7b7418d))
* update package.json to add node-forge override ([#1862](https://github.com/finos/architecture-as-code/issues/1862)) ([a326d37](https://github.com/finos/architecture-as-code/commit/a326d37f534cf622c10cbe03546cb79b161ff9f9))
* upgrade vsce to @vscode/vsce to fix xml2js vulnerability ([#1870](https://github.com/finos/architecture-as-code/issues/1870)) ([9877549](https://github.com/finos/architecture-as-code/commit/987754943fe5ec6b1579897a82f78c26198ef694))

## [1.17.0](https://github.com/finos/architecture-as-code/compare/cli-v1.16.0...cli-v1.17.0) (2025-11-26)

### 🐛 Bug Fixes

* allow calmhub URI to be set at command line ([#1836](https://github.com/finos/architecture-as-code/issues/1836)) ([2fb373e](https://github.com/finos/architecture-as-code/commit/2fb373ea1c077b8d3ffde2b7236cbe3d47cff592))

## [1.16.0](https://github.com/finos/architecture-as-code/compare/cli-v1.15.2...cli-v1.16.0) (2025-11-19)

### 🚀 Features

* update CALM model version and add CLI instructions ([#1815](https://github.com/finos/architecture-as-code/issues/1815)) ([04dde6c](https://github.com/finos/architecture-as-code/commit/04dde6c505ed1003e94da15b59fcd0dc5ec5bfea))

### 🐛 Bug Fixes

* update mermaid ID handling and sanitize identifier… ([#1807](https://github.com/finos/architecture-as-code/issues/1807)) ([b1d22a7](https://github.com/finos/architecture-as-code/commit/b1d22a70d531984bfb691033fec593b205acd5b5))

## [1.15.2](https://github.com/finos/architecture-as-code/compare/cli-v1.15.1...cli-v1.15.2) (2025-11-13)

### 🐛 Bug Fixes

* improve doc loading ([5651487](https://github.com/finos/architecture-as-code/commit/56514875c70c7fdbea613982ebbac17c18b39ddb))

## [1.15.1](https://github.com/finos/architecture-as-code/compare/cli-v1.15.0...cli-v1.15.1) (2025-11-08)

### 🐛 Bug Fixes

* clarify test descriptions and error message ([355dd59](https://github.com/finos/architecture-as-code/commit/355dd5924dd5958f604b1eff948d9a638480aba9))
* only access CalmHub when the URL prefix is calm: not every protocol ([1006d44](https://github.com/finos/architecture-as-code/commit/1006d441cd7b0931dd2b47d4cd709533883f6c57))

## [1.15.0](https://github.com/finos/architecture-as-code/compare/cli-v1.14.2...cli-v1.15.0) (2025-11-04)

No changes to the CLI or its packages.

## [1.14.2](https://github.com/finos/architecture-as-code/compare/cli-v1.14.1...cli-v1.14.2) (2025-11-17)

### 🐛 Bug Fixes

* improve doc loading ([5651487](https://github.com/finos/architecture-as-code/commit/56514875c70c7fdbea613982ebbac17c18b39ddb))
* update mermaid ID handling and sanitize identifier… ([#1807](https://github.com/finos/architecture-as-code/issues/1807)) ([b1d22a7](https://github.com/finos/architecture-as-code/commit/b1d22a70d531984bfb691033fec593b205acd5b5))

## [1.14.1](https://github.com/finos/architecture-as-code/compare/cli-v1.14.0...cli-v1.14.1) (2025-11-11)

### 🐛 Bug Fixes

* clarify test descriptions and error message ([355dd59](https://github.com/finos/architecture-as-code/commit/355dd5924dd5958f604b1eff948d9a638480aba9))
* only access CalmHub when the URL prefix is calm: not every protocol ([1006d44](https://github.com/finos/architecture-as-code/commit/1006d441cd7b0931dd2b47d4cd709533883f6c57))

## [1.14.0](https://github.com/finos/architecture-as-code/compare/cli-v1.13.0...cli-v1.14.0) (2025-10-31)

No changes to the CLI or its packages.

## [1.13.0](https://github.com/finos/architecture-as-code/compare/cli-v1.12.3...cli-v1.13.0) (2025-10-28)

### ♻️ Code Refactoring

* remove redundant architecture validation test ([9ea28d6](https://github.com/finos/architecture-as-code/commit/9ea28d6299537075e1939f7d49c4d7bfeb9e0914))
* remove samples directory as no files are being referenced ([9f17022](https://github.com/finos/architecture-as-code/commit/9f17022edb14da69a530a7381cfa1baf29d84d1a))
* remove unused additional properties test fixture ([795efea](https://github.com/finos/architecture-as-code/commit/795efea80164002ad82a6e46e1f51f42291f537f))
* remove unused API Gateway test fixture ([b5076bc](https://github.com/finos/architecture-as-code/commit/b5076bcdf86e54d7036297fcd0c98149c414cafc))
* remove unused CALM schema and test fixture files ([ede477a](https://github.com/finos/architecture-as-code/commit/ede477a851bb9cc8d0648f2f7c8859758d5bfb4a))
* remove unused imports from validate.spec.ts ([72cd502](https://github.com/finos/architecture-as-code/commit/72cd5022ae479a642c56d0b1a1d79edeeb924c64))
* remove unused mock for CALM_META_SCHEMA_DIRECTORY ([4c6c69d](https://github.com/finos/architecture-as-code/commit/4c6c69de87dc9fbbe52dd5a3eba0c2c9bea7c832))
* update flow schema references to use stable release URLs ([15e185d](https://github.com/finos/architecture-as-code/commit/15e185d919d42c7603929b149f118351696ea040))
* update schema loading paths ([12c24a6](https://github.com/finos/architecture-as-code/commit/12c24a6629bcad77583cf0fb3bbf3e71fb8259fb))
* update schema reference and remove outdated flow metadata ([#1757](https://github.com/finos/architecture-as-code/issues/1757)) ([190a27c](https://github.com/finos/architecture-as-code/commit/190a27c5ca4c3a974a5010de53c17b911dab40c6))
* update schema reference to use stable release URL ([27e4029](https://github.com/finos/architecture-as-code/commit/27e4029b9924b65b161c9346799838ed2e23cc64))
* update schema references to use stable release URLs ([1c32ca7](https://github.com/finos/architecture-as-code/commit/1c32ca7a0f75ff5e04d52bd1834da09082a24e6a))
* update schemaPath in validation tests to use release version ([644f5ea](https://github.com/finos/architecture-as-code/commit/644f5ea0408fb633dd10c7c6710130cef70ecca5))

## [1.12.3](https://github.com/finos/architecture-as-code/compare/cli-v1.11.0...cli-v1.12.3) (2025-10-18)

### 🐛 Bug Fixes

* attempt to fix the NPM publish workflow plus add force release ([#1722](https://github.com/finos/architecture-as-code/issues/1722)) ([02d7231](https://github.com/finos/architecture-as-code/commit/02d72312558839712764da5bef81f0bd08f29b8b))
* update build step to include workspace and refine analysis trigger ([#1724](https://github.com/finos/architecture-as-code/issues/1724)) ([b552e30](https://github.com/finos/architecture-as-code/commit/b552e30068f973e432aa177ca416f3810a26a407))

## [1.11.0](https://github.com/finos/architecture-as-code/compare/cli-v1.10.0...cli-v1.11.0) (2025-10-17)

### 🐛 Bug Fixes

* add support for top-level const properties in instantiation ([#1719](https://github.com/finos/architecture-as-code/issues/1719)) ([f22b30f](https://github.com/finos/architecture-as-code/commit/f22b30f1987cf498f33d4c52175f53dad1096483))

## [1.10.0](https://github.com/finos/architecture-as-code/compare/cli-v1.9.0...cli-v1.10.0) (2025-10-08)

No changes to the CLI or its packages.

## [1.9.0](https://github.com/finos/architecture-as-code/compare/cli-v1.8.0...cli-v1.9.0) (2025-10-07)

No changes to the CLI or its packages.

## [1.8.0](https://github.com/finos/architecture-as-code/compare/cli-v1.7.0...cli-v1.8.0) (2025-10-02)

### 🚀 Features

* Node Type Visual Differentiation for Block Architecture Widget ([#1670](https://github.com/finos/architecture-as-code/issues/1670)) ([b9f3612](https://github.com/finos/architecture-as-code/commit/b9f36126ef796c645feb23d95dca4c2715ef1c16))
* update automated release workflow to be two stage ([#1673](https://github.com/finos/architecture-as-code/issues/1673)) ([86e9d5b](https://github.com/finos/architecture-as-code/commit/86e9d5b3690dae87c7cde325cbf1ead580b43349))

## [1.7.0](https://github.com/finos/architecture-as-code/compare/cli-v1.6.0...cli-v1.7.0) (2025-09-30)

### 🚀 Features

* add collapse-relationships feature to block-architecture widget ([#1664](https://github.com/finos/architecture-as-code/issues/1664)) ([47f373f](https://github.com/finos/architecture-as-code/commit/47f373f6a7e7c65065e9cac27778667e0696b674))

## [1.6.0](https://github.com/finos/architecture-as-code/compare/cli-v1.5.0...cli-v1.6.0) (2025-09-25)

### 🚀 Features

* Add 'runInTerminal' tool to CALM assistant configuration ([#1647](https://github.com/finos/architecture-as-code/issues/1647)) ([8e357b0](https://github.com/finos/architecture-as-code/commit/8e357b08acb51822b252d575d305e7515d8ef583))
* Add release rules and scope for calm-ai ([#1643](https://github.com/finos/architecture-as-code/issues/1643)) ([33742f3](https://github.com/finos/architecture-as-code/commit/33742f381f9aea033ff45c9266046b1989c94027))

## [1.5.0](https://github.com/finos/architecture-as-code/compare/cli-v1.4.1...cli-v1.5.0) (2025-09-24)

### 🚀 Features

* Add CALM AI Tools and copilot-chatmode to the CLI ([079c6c4](https://github.com/finos/architecture-as-code/commit/079c6c48820fffb106dd586ae9bb6b8f6caf8fbb))

## [1.4.1](https://github.com/finos/architecture-as-code/compare/cli-v1.4.0...cli-v1.4.1) (2025-09-24)

No changes to the CLI or its packages.

## [1.4.0](https://github.com/finos/architecture-as-code/compare/cli-v1.3.2...cli-v1.4.0) (2025-09-23)

### 🐛 Bug Fixes

* oss index username secret name ([7139c34](https://github.com/finos/architecture-as-code/commit/7139c34649192f75d725420fe2815bad5b491048))

### 📚 Documentation

* update changelog for v1.3.2 ([#1621](https://github.com/finos/architecture-as-code/issues/1621)) ([26c2002](https://github.com/finos/architecture-as-code/commit/26c20025779c0d3bd8a862a00f6d43e939713611))

## [1.3.2](https://github.com/finos/architecture-as-code/compare/cli-v1.3.1...cli-v1.3.2) (2025-09-16)

### 🐛 Bug Fixes

* resolve calm server cannot validate architectures ([#1613](https://github.com/finos/architecture-as-code/issues/1613)) ([0c5b334](https://github.com/finos/architecture-as-code/commit/0c5b334111b9c5eb2c3808c18dc3364154fdcf26))

### 📚 Documentation

* update changelog for 1.1.0 [skip ci] ([#1584](https://github.com/finos/architecture-as-code/issues/1584)) ([63f67d2](https://github.com/finos/architecture-as-code/commit/63f67d214c1a0999cf84667db1d429f73e5639be))
* update changelog for v1.1.1 ([#1587](https://github.com/finos/architecture-as-code/issues/1587)) ([80ff5b4](https://github.com/finos/architecture-as-code/commit/80ff5b4a39e27490e4cec0e251a6d7ddb300cdd2))
* update changelog for v1.1.2 ([#1589](https://github.com/finos/architecture-as-code/issues/1589)) ([c2b07cc](https://github.com/finos/architecture-as-code/commit/c2b07cce9cd78802640923c727511f1f405198cf))
* update changelog for v1.1.3 ([#1591](https://github.com/finos/architecture-as-code/issues/1591)) ([23707b5](https://github.com/finos/architecture-as-code/commit/23707b5e379916c3aa0d2337e9829e27e5f96310))
* update changelog for v1.2.0 ([#1602](https://github.com/finos/architecture-as-code/issues/1602)) ([770aab5](https://github.com/finos/architecture-as-code/commit/770aab52b537c1ec560c7d8bef8ebb5b5b1a43b2))
* update changelog for v1.3.0 ([#1610](https://github.com/finos/architecture-as-code/issues/1610)) ([91a780e](https://github.com/finos/architecture-as-code/commit/91a780e6c426ba6e0594435e39525416dd81b50d))
* update changelog for v1.3.1 ([#1619](https://github.com/finos/architecture-as-code/issues/1619)) ([1fdc335](https://github.com/finos/architecture-as-code/commit/1fdc335e06031220152dd1549dc6c16ef9fe85cc))

## [1.3.1](https://github.com/finos/architecture-as-code/compare/cli-v1.3.0...cli-v1.3.1) (2025-09-11)

No changes to the CLI or its packages.

## [1.3.0](https://github.com/finos/architecture-as-code/compare/cli-v1.2.0...cli-v1.3.0) (2025-09-10)

### 🚀 Features

* table enhancements to allow user to create a vertical orientated table ([#1603](https://github.com/finos/architecture-as-code/issues/1603)) ([0021f2b](https://github.com/finos/architecture-as-code/commit/0021f2ba1763eacd093fb8c7a2bd598b6974c236))

## [1.2.0](https://github.com/finos/architecture-as-code/compare/cli-v1.1.3...cli-v1.2.0) (2025-09-09)

### 🚀 Features

* block-architecture widget ([#1567](https://github.com/finos/architecture-as-code/issues/1567)) ([68ac659](https://github.com/finos/architecture-as-code/commit/68ac6591042289c7e2a95d5630e87d3244570006))

### 🐛 Bug Fixes

* imply this when when no context provided to widget with no additional options ([20b8d3b](https://github.com/finos/architecture-as-code/commit/20b8d3b8b5bbfbf2527d69c75fe316a7e914eb5b))

## [1.1.3](https://github.com/finos/architecture-as-code/compare/cli-v1.1.2...cli-v1.1.3) (2025-09-05)

No changes to the CLI or its packages.

## [1.1.2](https://github.com/finos/architecture-as-code/compare/cli-v1.1.1...cli-v1.1.2) (2025-09-05)

### 🐛 Bug Fixes

* honour user's selected log level in validation option selection logic ([#1588](https://github.com/finos/architecture-as-code/issues/1588)) ([57e38ec](https://github.com/finos/architecture-as-code/commit/57e38ece9cc5090c26384496b188755b452b9b02))

## [1.1.1](https://github.com/finos/architecture-as-code/compare/cli-v1.1.0...cli-v1.1.1) (2025-09-05)

No changes to the CLI or its packages.

## [1.1.0](https://github.com/finos/architecture-as-code/compare/cli-v1.0.0...cli-v1.1.0) (2025-09-05)

No changes to the CLI or its packages.

## [1.0.0] - 2025-08-21

### Added
- Initial stable release of CALM CLI
- Support for CALM schema validation
- Documentation generation capabilities
- Widget support for enhanced functionality

[1.0.0]: https://github.com/finos/architecture-as-code/releases/tag/v1.0.0
