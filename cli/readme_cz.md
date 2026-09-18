# CALM CLI

Příkazová řádka pro práci s CALM schématem.
S těmito nástroji vytvoříte architekturu z CALM patternu, nebo ověříte, že architektura danému patternu odpovídá.

## Přehled konfiguračního souboru

CLI načítá uživatelskou konfiguraci z `~/.calm.json`. Tam se dá nastavit CalmHub a další detaily na úrovni profilu.
Stejné hodnoty lze zadat i přes proměnné prostředí; pokud jsou nastavené, přepíší konfigurační soubor.

Když je zadáte na příkazové řádce, např. `--calm-hub-url`, mají přednost před souborem i před env vars.

| Vlastnost v configu | Proměnná prostředí          | Popis  |
| -------------------- | --------------------------- | ------------ |
| `allowedRemoteHosts` | `CALM_ALLOWED_REMOTE_HOSTS` | Seznam povolených hostů při načítání souborů přímo z raw URL. V env formě to má být seznam oddělený čárkami. |
| `authPluginPath`     | `CALM_AUTH_PLUGIN_PATH`     | Cesta k autentizačnímu pluginu (má to být JS soubor). Viz [Autentizační pluginy](#autentizační-pluginy). |
| `calmHubUrl`         | `CALM_HUB_URL`              | Instance CalmHub, kterou má CLI použít. Nastavení této vlastnosti automaticky zapne CalmHub jako zdroj dokumentů pro příkazy jako `validate`. |

Soubor raději needitujte ručně. Vytvořte nebo aktualizujte ho příkazem [`calm init-config`](#správa-konfiguračního-souboru-přes-init-config).

## Použití CLI

### Začínáme

CLI nainstalujete globálně takto:

```shell
% npm install -g @finos/calm-cli
```

nebo přes [Homebrew](https://brew.sh):
```shell
brew install calm-cli
```

Do terminálu napište `calm`. Měla by se vypsat nápověda.

```shell
% calm
Usage: calm [options] [command]

A set of tools for interacting with the Common Architecture Language Model (CALM)

Options:
  -V, --version       output the version number
  -h, --help          display help for command

Commands:
  generate [options]          Generate an architecture from a CALM pattern file.
  validate [options]          Validate a CALM document.
  template [options]          Generate files from a CALM model using a template bundle, a single file, or a directory of templates
  docify [options]            Generate a documentation website from your CALM model using a template or template directory
  init-ai [options]           Augment a git repository with AI assistance for CALM
  diff [options]              Compare two CALM documents (architectures or patterns), or the moments of a CALM timeline, and report what changed.
  timeline [options]          Synthesise an implied CALM timeline from a set of local versioned architecture files.
  init-config [options]       Create or update the CALM CLI configuration file (~/.calm.json).
  hub [command]               Interact with CALM Hub
  workspace [command]         Manage CALM workspace bundle and development helpers
  help [command]              display help for command
```

## Generování architektury z CALM pattern souboru

Příkaz vytvoří kostru architektury z pattern souboru.
Můžete to zkusit na vzorových patternech v tomto repozitáři pod `calm/pattern`.

```shell
calm
Usage: calm generate [options]

Generate an architecture from a CALM pattern file.

Options:
  -p, --pattern <file>          Path to the pattern file to use. May be a file path or a URL.
  -o, --output <file>           Path location at which to output the generated file. (default: "architecture.json")
  -s, --schema-directory <path>  Path to the directory containing the meta schemas to use. (default: "../calm/release")
  -c, --calm-hub-url <url>      URL to CalmHub to use when loading documents.
  --option-choices <choices>    Pre-defined option choices as a JSON object mapping option unique-ids to choice descriptions. Skips interactive prompts.
  -v, --verbose                 Enable verbose logging. (default: false)
  -h, --help                    display help for command
```

Nejjednodušší použití je jen s parametrem pattern. Architektura se vygeneruje do aktuálního adresáře pod výchozím názvem `architecture.json`.

```shell
% calm generate -p ./conferences/osff-ln-2025/workshop/conference-signup.pattern.json
```

### Volby v patternu (options)

Některé CALM patterny definují **options** — rozhodovací body, kde se architektura může lišit. Když pattern options obsahuje, `generate` se na výběr zeptá interaktivně. Na konci CLI vypíše zvolené hodnoty ve formátu, který si můžete uložit a znovu použít:

```
info: Selected choices (reusable with --option-choices): {"connection-options":"Application A connects to Application C","node-options":["Node 1","Node 2"]}
```

Interaktivní dotazy přeskočíte, když volby předáte přes `--option-choices` jako JSON řetězec nebo cestu k JSON souboru.

- U volby **`oneOf`** (vyberte právě jednu) zadejte řetězec.
- U volby **`anyOf`** (vyberte jednu nebo víc) zadejte řetězec nebo pole řetězců.

```shell
# Inline JSON — single oneOf choice
% calm generate -p pattern.json --option-choices '{"connection-options": "Application A connects to Application C"}'

# Inline JSON — mixed oneOf and anyOf
% calm generate -p pattern.json --option-choices '{"connection-options": "Application A connects to Application C", "node-options": ["Node 1", "Node 2"]}'

# From a saved choices file
% calm generate -p pattern.json --option-choices ./my-choices.json
```

## Validace CALM architektury

Příkaz řekne, jestli architektura odpovídá zadanému patternu.
Když ne, vypíše seznam problémů, které je potřeba opravit.

```shell
% calm validate --help
Usage: calm validate [options]

Validate a CALM document.

Validation requires:
  - an architecture:             to validate against CALM schema
  - an architecture and pattern: to validate the architecture against the CALM pattern
  - a pattern:                   to validate the pattern against CALM schema
  - a timeline:                  to validate the timeline against CALM timeline schema

Options:
  -p, --pattern <file>          Path to the pattern file to use. May be a file path or a URL.
  -a, --architecture <file>     Path to the architecture file to use. May be a file path or a URL.
  --timeline <file>             Path to the timeline file to validate. May be a file path or a URL.
  -s, --schema-directory <path> Path to the directory containing the meta schemas to use. (default: "../calm/release")
  -c, --calm-hub-url <url>      URL to CalmHub to use when loading documents.
  -u, --url-to-local-file-mapping <path>  Path to mapping file which maps URLs to local paths
  --strict                  When run in strict mode, the CLI will fail if any warnings are reported. (default: false)
  -f, --format <format>         The format of the output (choices: "json", "junit", "pretty", default: "json")
  -o, --output <file>           Path location at which to output the generated file.
  -v, --verbose                 Enable verbose logging. (default: false)
  -h, --help                    display help for command
```

Příkaz může hlásit varování i chyby. Nenulový exit code nastane jen tehdy, když výstup obsahuje chyby.
Varování občas slouží jako nápověda, co v architektuře vylepšit, ale pro shodu s patternem nejsou nutná.

Když vygenerujete architekturu z conference patternu a hned ji proti němu zvalidujete:

```shell
% calm generate -p ./conferences/osff-ln-2025/workshop/conference-signup.pattern.json -o ./conferences/osff-ln-2025/workshop/architecture/conference-signup.arch.json
% calm validate -p ./conferences/osff-ln-2025/workshop/conference-signup.pattern.json -a ./conferences/osff-ln-2025/workshop/architecture/conference-signup.arch.json
```

dostanete výstup s varováním podobným tomuto:

```json
...
{
    "jsonSchemaValidationOutputs": [],
    "spectralSchemaValidationOutputs": [
        {
          "code": "architecture-has-no-placeholder-properties-string",
          "severity": "warning",
          "message": "String placeholder detected in architecture.",
          "path": "/nodes/conference-website/interfaces/conference-website-url/url",
          "schemaPath": "",
          "line_start": 11,
          "line_end": 11,
          "character_start": 17,
          "character_end": 28
        },
        {
          "code": "architecture-has-no-placeholder-properties-string",
          "severity": "warning",
          "message": "String placeholder detected in architecture.",
          "path": "/nodes/load-balancer/interfaces/load-balancer-host-port/host",
          "schemaPath": "",
          "line_start": 23,
          "line_end": 23,
          "character_start": 18,
          "character_end": 30
        },
        {
          "code": "architecture-has-no-placeholder-properties-numerical",
          "severity": "warning",
          "message": "Numerical placeholder (-1) detected in architecture.",
          "path": "/nodes/load-balancer/interfaces/load-balancer-host-port/port",
          "schemaPath": "",
          "line_start": 24,
          "line_end": 24,
          "character_start": 18,
          "character_end": 20
        },
        {
          "code": "architecture-has-no-placeholder-properties-string",
          "severity": "warning",
          "message": "String placeholder detected in architecture.",
          "path": "/nodes/attendees/interfaces/attendees-image/image",
          "schemaPath": "",
          "line_start": 36,
          "line_end": 36,
          "character_start": 19,
          "character_end": 32
        },
        {
          "code": "architecture-has-no-placeholder-properties-numerical",
          "severity": "warning",
          "message": "Numerical placeholder (-1) detected in architecture.",
          "path": "/nodes/attendees/interfaces/attendees-port/port",
          "schemaPath": "",
          "line_start": 40,
          "line_end": 40,
          "character_start": 18,
          "character_end": 20
        },
        {
          "code": "architecture-has-no-placeholder-properties-string",
          "severity": "warning",
          "message": "String placeholder detected in architecture.",
          "path": "/nodes/attendees-store/interfaces/database-image/image",
          "schemaPath": "",
          "line_start": 52,
          "line_end": 52,
          "character_start": 19,
          "character_end": 32
        },
        {
          "code": "architecture-has-no-placeholder-properties-numerical",
          "severity": "warning",
          "message": "Numerical placeholder (-1) detected in architecture.",
          "path": "/nodes/attendees-store/interfaces/database-port/port",
          "schemaPath": "",
          "line_start": 56,
          "line_end": 56,
          "character_start": 18,
          "character_end": 20
        }
    ],
    "hasErrors": false,
    "hasWarnings": true
}
...
```

Můžete také požádat o pretty text výstup, který ukáže stejné cesty a přesné řádky a sloupce ve zdrojovém souboru:

```shell
Summary
- Errors: no (0)
- Warnings: yes (7)
- Info/Hints: 0

WARN  issues:
- In conference-signup.arch.json (./conferences/osff-ln-2025/workshop/architecture/conference-signup.arch.json):
  WARN  architecture-has-no-placeholder-properties-string: String placeholder detected in architecture.
    path: /nodes/conference-website/interfaces/conference-website-url/url
    at line 11, col 18 (./conferences/osff-ln-2025/workshop/architecture/conference-signup.arch.json)
    11 |           "url": "[[ URL ]]"
       |                  ^^^^^^^^^^^
  WARN  architecture-has-no-placeholder-properties-string: String placeholder detected in architecture.
    path: /nodes/load-balancer/interfaces/load-balancer-host-port/host
    at line 23, col 19 (./conferences/osff-ln-2025/workshop/architecture/conference-signup.arch.json)
    23 |           "host": "[[ HOST ]]",
       |                   ^^^^^^^^^^^^
  WARN  architecture-has-no-placeholder-properties-numerical: Numerical placeholder (-1) detected in architecture.
    path: /nodes/load-balancer/interfaces/load-balancer-host-port/port
    at line 24, col 19 (./conferences/osff-ln-2025/workshop/architecture/conference-signup.arch.json)
    24 |           "port": -1
       |                   ^^
  WARN  architecture-has-no-placeholder-properties-string: String placeholder detected in architecture.
    path: /nodes/attendees/interfaces/attendees-image/image
    at line 36, col 20 (./conferences/osff-ln-2025/workshop/architecture/conference-signup.arch.json)
    36 |           "image": "[[ IMAGE ]]"
       |                    ^^^^^^^^^^^^^
  WARN  architecture-has-no-placeholder-properties-numerical: Numerical placeholder (-1) detected in architecture.
    path: /nodes/attendees/interfaces/attendees-port/port
    at line 40, col 19 (./conferences/osff-ln-2025/workshop/architecture/conference-signup.arch.json)
    40 |           "port": -1
       |                   ^^
  WARN  architecture-has-no-placeholder-properties-string: String placeholder detected in architecture.
    path: /nodes/attendees-store/interfaces/database-image/image
    at line 52, col 20 (./conferences/osff-ln-2025/workshop/architecture/conference-signup.arch.json)
    52 |           "image": "[[ IMAGE ]]"
       |                    ^^^^^^^^^^^^^
  WARN  architecture-has-no-placeholder-properties-numerical: Numerical placeholder (-1) detected in architecture.
    path: /nodes/attendees-store/interfaces/database-port/port
    at line 56, col 19 (./conferences/osff-ln-2025/workshop/architecture/conference-signup.arch.json)
    56 |           "port": -1
       |                   ^^
```

To jen říká, že v architektuře zůstaly placeholder hodnoty, které mohl doplnit příkaz `generate`.
Není to tvrdá chyba, ale naznačuje to, že jste v architektuře nějaký detail nedoplnili.

## CALM Template

Systém CALM Template umí z CALM modelu vygenerovat různé strojově nebo lidsky čitelné výstupy. Stačí dodat **template bundle**.

```shell
calm template --help
Usage: calm template [options]

Generate files from a CALM model using a template bundle, a single file, or a directory of templates

Options:
  -a, --architecture <path>               Path to the CALM model JSON file.
  -o, --output <path>                     Path to output directory.
      --clear-output-directory            Completely delete the contents of the output path before generation.
  -b, --bundle <path>                     Path to the template bundle directory.
  -t, --template <path>                   Path to a single .hbs or .md template file
  -d, --template-dir <path>               Path to a directory of .hbs/.md templates
  -u, --url-to-local-file-mapping <path>  Path to mapping file which maps URLs to local paths.
  -v, --verbose                           Enable verbose logging. (default: false)
  -h, --help                              display help for command
```

`calm template` výstupní adresář vytvoří, pokud ještě neexistuje.

Když adresář existuje, existující soubory se přepíší.
Soubory, které v template bundle nejsou, zůstanou beze změny.
Přepínač `--clear-output-directory` toto chování změní: nejdřív smaže všechny soubory a podadresáře ve výstupní cestě.

### Vytvoření template bundle

Template bundle obsahuje:

- `index.json`: definuje strukturu šablony a mapování na prvky CALM modelu.
- Implementaci **CalmTemplateTransformer**: převede CALM model do podoby, kterou umí vyrenderovat Handlebars.
- Handlebars šablony, které určují výsledný formát výstupu.
- Přepínač `--url-to-local-file-mapping` umožňuje předat JSON soubor, který mapuje externí URL na lokální soubory.
  Hodí se to, když pracujete se soubory, které ještě nejsou publikované, ale model na ně odkazuje.

    Příklad obsahu

            ```json
            {
                "https://calm.finos.org/docuflow/flow/document-upload": "flows/flow-document-upload.json"
            }
            ```

    Příklad použití (předpokládá kořen projektu):

```shell
calm template -a ./cli/test_fixtures/template/model/document-system.json   -b cli/test_fixtures/template/template-bundles/doc-system   -o one_pager   -u cli/test_fixtures/template/model/url-to-file-directory.json -v
```

## CALM Docify

Příkaz **CALM Docify** generuje dokumentaci z CALM modelu.

```shell
calm docify --help
Usage: calm docify [options]

Generate a documentation website from your CALM model using a template or template directory

Options:
  -a, --architecture <path>               Path to the CALM model JSON file.
  -o, --output <path>                     Path to output directory.
      --clear-output-directory            Completely delete the contents of the output path before generation.
      --scaffold                          Generate scaffold only (templates with placeholders, no rendering).
  -t, --template <path>                   Path to a single .hbs or .md template file
  -d, --template-dir <path>               Path to a directory of .hbs/.md templates
  -u, --url-to-local-file-mapping <path>  Path to mapping file which maps URLs to local paths.
      --export-diagrams <svg|png>         Render mermaid diagrams to image files using a local Chromium-based browser (adds roughly 10-40s depending on diagram count).
      --browser-path <path>               Path to a Chromium-based browser executable, only needed if automatic detection fails.
      --diagram-render-timeout <ms>       Per-diagram render timeout in milliseconds, only used with --export-diagrams (default: 30000).
  -v, --verbose                           Enable verbose logging. (default: false)
  -h, --help                              display help for command
```

`calm docify` výstupní adresář vytvoří, pokud ještě neexistuje.

Když adresář existuje, existující soubory se přepíší. Ostatní soubory zůstanou beze změny.
Přepínač `--clear-output-directory` toto chování změní: nejdřív smaže všechny soubory a podadresáře ve výstupní cestě.

### Dvoufázový workflow (scaffold režim)

Scaffold režim umožňuje dvoufázovou dokumentaci: nejdřív si prohlédnete a upravíte vygenerované šablony, až potom je vyrenderujete:

```shell
# Stage 1: Generate scaffold with widget placeholders
calm docify --scaffold -a ./architecture.json -o ./website

# Edit generated MDX files in ./website/docs/ as needed

# Stage 2: Render final website from scaffolded templates
calm docify -a ./architecture.json --template-dir ./website -o ./final-site
```

Architekt tak může dokumentaci upravit před nasazením. To, co vidí v náhledu ve VSCode rozšíření, pak odpovídá finálnímu výstupu.

### Jednofázový workflow

Příklad, který můžete zkusit (předpokládá kořen projektu):

```shell
calm docify -a ./cli/test_fixtures/template/model/document-system.json -o ./output/documentation -u ./cli/test_fixtures/template/model/url-to-file-directory.json
```

### Export diagramů jako obrázků

Ve výchozím stavu obsahuje vygenerovaná dokumentace Mermaid diagramy jako bloky ` ```mermaid `.
Přepínač `--export-diagrams <svg|png>` je vyrenderuje do obrázků přes lokální prohlížeč založený na Chromiu a každý kódový blok nahradí centrovým odkazem na obrázek (např. `<p align="center"><img src="_diagrams/my-page-1.svg" alt="Diagram 1" /></p>`).

```shell
calm docify -a ./architecture.json -o ./output/documentation --export-diagrams svg
```

Vyžaduje to nainstalovaný Google Chrome nebo Microsoft Edge (oba se detekují automaticky). Když se nenajde ani jeden, příkaz vypíše, jak najít jiný Chromium prohlížeč. Dokumentace se i tak vygeneruje, jen s původními Mermaid bloky.

- `--browser-path <path>`: konkrétní Chromium prohlížeč (např. Brave, Vivaldi, Chromium), když automatická detekce nestačí.
- `--diagram-render-timeout <ms>`: timeout na jeden diagram. Hodí se u velkých nebo složitých diagramů (výchozí: `30000`).

Renderování přidá zhruba 10–40 sekund podle počtu diagramů. Když se jeden diagram nepodaří vyrenderovat (timeout nebo neplatná syntaxe), zůstane jako Mermaid blok a zaloguje se varování. Zbytek dokumentace to neovlivní.

### Výchozí volby widgetů v šablonách

Ve frontmatteru šablony můžete nastavit výchozí volby pro použité widgety:

```
---
widget-options:
  block-architecture:
    render-node-type-shapes: true
---
These two are the same:
{{ block-architecture }}
and
{{ block-architecture render-node-type-shapes=true }}

This differs:
{{ block-architecture render-node-type-shapes=false }}
```

## CALM init-ai

Příkaz `init-ai` doplní do repozitáře AI asistenci pro modelování CALM architektury: specializované prompt soubory s kompletními tool prompty. Teď jsou podporovaní čtyři poskytovatelé: GitHub Copilot, Claude Code, AWS Kiro a Codex.

```shell
calm init-ai --help
Usage: calm init-ai [options]

Augment a git repository with AI assistance for CALM

Options:
  -p, --provider <provider>  AI provider to initialize (choices: "copilot", "kiro", "claude", "codex")
  -d, --directory <path>     Target directory (defaults to current directory) (default: ".")
  -v, --verbose              Enable verbose logging. (default: false)
  -h, --help                 display help for command
```

Příkaz vytvoří konfiguraci chat promptu pro zadaného `<provider>` se specializovanou znalostí CALM modelování, včetně:

- **Přesné vedení podle schématu**: kompletní JSON schema definice všech CALM komponent
- **Kritická validační pravidla**: důraz na `oneOf` omezení a další validační pravidla
- **Vymáhání best practices**: naming konvence, vzory vztahů a správná struktura
- **Příklady z praxe**: realistické architektury podle skutečných CALM patternů
- **Specializace nástrojů**: samostatné tools pro uzly, vztahy, rozhraní, controls, flows, patterny a metadata

### Nastavení CALM AI asistence

AI asistenci pro CALM projekt zapnete takto:

```shell
# In your project directory
calm init-ai -p <provider>

# Or specify a different directory
calm init-ai -p <provider> --directory /path/to/your/calm-project
```

Vytvoří se konfigurační soubory specifické pro daného asistenta. Pak může asistent používat specializované CALM tools, které znají požadavky schématu, validační pravidla a best practices. U Codexu se vytvoří CALM skill pod `.agents/skills/calm`; kořenový `AGENTS.md` se nevytváří ani nemění.

### Tool prompty

Agent obsahuje specializované tools pro jednotlivé CALM komponenty:

- **Node Creation**: tvorba uzlů s validací a definicí rozhraní
- **Relationship Creation**: tvorba vztahů se správnými typy a omezeními
- **Interface Creation**: `oneOf` omezení u rozhraní a shoda se schématem
- **Control Creation**: security controls, požadavky a konfigurace
- **Flow Creation**: business process flows a přechody
- **Pattern Creation**: znovupoužitelné architektonické patterny přes JSON schema konstrukty
- **Metadata Creation**: struktura metadat (jeden objekt vs. pole)
- **Standards Creation**: JSON Schema 2020-12 Standardy, které rozšiřují CALM komponenty o organizační požadavky

Každý tool obsahuje kompletní definice schémat, validační pravidla, realistické příklady a křížové odkazy na související tools.

## Diff dvou CALM dokumentů

Příkaz porovná dvě verze CALM dokumentu a vypíše, co se změnilo. Funguje na **architekturách**, **patternech** a momentech **CALM timeline**. Uzly a vztahy páruje podle `unique-id` a označí je jako přidané, odebrané, změněné nebo přejmenované. U diffu dvou dokumentů se typ detekuje automaticky; detekci přepíšete přes `--type`.

```shell
% calm diff --help
Usage: calm diff [options]

Compare two CALM documents (architectures or patterns), or the moments of a CALM timeline, and report what changed.

Diff modes:
  - two documents:  diff -a <doc-a> -b <doc-b>
  - a timeline:     diff --timeline <file>                       (diffs every adjacent moment pair)
  - timeline pair:  diff --timeline <file> --from <id> --to <id> (diffs any two moments)

Timeline moment 'detailed-architecture' references are resolved relative to the timeline file's directory.

Options:
  -a, --document-a <file>   Path to the first (baseline) CALM document.
  -b, --document-b <file>   Path to the second CALM document to compare against the baseline.
  --timeline <file>         Path to a CALM timeline file. Diffs adjacent moments, or a specific pair with --from/--to.
  --from <momentId>         With --timeline, the unique-id of the baseline moment (requires --to).
  --to <momentId>           With --timeline, the unique-id of the moment to compare against (requires --from).
  -f, --format <format>     Output format (choices: "json", "summary", default: "json")
  -t, --type <type>         Force the document type instead of auto-detecting it. (choices: "architecture", "pattern")
  -o, --output <file>       Path location at which to write the diff output. If omitted, prints to stdout.
  --exit-code               Exit with a non-zero status code when changes are detected. Useful in CI to gate version bumps.
  -v, --verbose             Enable verbose logging. (default: false)
  -h, --help                display help for command
```

`--document-a`/`--document-b` se dřív jmenovaly `--architecture-a`/`--architecture-b`. Staré přepínače pořád fungují jako zastaralé, skryté aliasy, ale vypíšou varování — přepněte na `--document-a`/`--document-b`.

Pro rychlý lidsky čitelný přehled použijte `--format summary`:

```shell
% calm diff -a ./baseline.arch.json -b ./updated.arch.json --format summary
CALM architecture diff
----------------------
Nodes:         +1  -0  ~1  ↔0  =3
Relationships: +1  -0  ~0  ↔0  =2

Nodes added:
  - audit-service
...
```

Stejným příkazem porovnáte dva patterny — místo architektur předejte pattern soubory:

```shell
% calm diff -a ./v1.pattern.json -b ./v2.pattern.json --format summary
```

Přepínač `--exit-code` způsobí nenulový exit code, když se zjistí jakákoli změna (včetně položek přeskočených kvůli chybějícímu `unique-id`). Hodí se v CI jako brána pro version bump:

```shell
% calm diff -a ./baseline.arch.json -b ./updated.arch.json --exit-code
```

### Diff CALM timeline

Místo `-a`/`-b` předejte `--timeline` a porovnáte momenty [CALM timeline](#syntéza-calm-timeline) (generování je popsané níže). Bez `--from`/`--to` se postupně porovná každá sousední dvojice momentů:

```shell
% calm diff --timeline ./calm-timeline.json --format summary
```

Libovolné dva konkrétní momenty (nejen sousední) porovnáte tak, že zadáte `--from` i `--to` s jejich `unique-id`:

```shell
% calm diff --timeline ./calm-timeline.json --from moment-1 --to moment-3 --format summary
```

## Syntéza CALM timeline

Příkaz `timeline` složí CALM timeline dokument ze sady lokálních, verzovaných souborů architektury — jeden moment na vstupní soubor, v pořadí, v jakém soubory zadáte.

```shell
% calm timeline --help
Usage: calm timeline [options]

Synthesise an implied CALM timeline from a set of local versioned architecture files.

One moment is generated per input architecture, in the order the files are given
(plain files have no semver versions to sort by). Each moment's name/description
is taken from the architecture's own name/description when present, else derived
from the filename. The 'detailed-architecture' reference is written relative to
the --output file's directory so the timeline is portable and reloadable by
'calm validate --timeline' / 'calm diff --timeline'.

Options:
  -a, --architecture <files...>  Paths to architecture files, in moment order. Repeat the flag or pass several paths after one flag.
  -o, --output <file>            Path location at which to write the generated timeline. If omitted, prints to stdout.
  -v, --verbose                  Enable verbose logging. (default: false)
  -h, --help                     display help for command
```

```shell
% calm timeline -a v1.json -a v2.json -a v3.json -o calm-timeline.json
```

Výsledný timeline soubor můžete validovat přes `calm validate --timeline` nebo porovnávat moment po momentu přes `calm diff --timeline` (viz výše).

## Správa konfiguračního souboru přes `init-config`

Místo ruční editace `~/.calm.json` použijte `calm init-config`. Existující hodnoty se zachovají a sloučí s tím, co zadáte nově.

```shell
% calm init-config --help
Usage: calm init-config [options]

Create or update the CALM CLI configuration file (~/.calm.json).

Options:
  --allowed-remote-hosts <hosts>  Comma-separated list of trusted remote hosts to allow for direct URL loading
  --calm-hub-url <url>            URL to a trusted file location (e.g. CALMHub) to allow for direct URL loading of CALM documents
  -h, --help                      display help for command
```

```shell
% calm init-config --calm-hub-url https://calmhub.example.com --allowed-remote-hosts raw.githubusercontent.com,calm.finos.org
```

## Autentizační pluginy

CLI podporuje externí autentizační plugin. V enterprise prostředí, kde plynulá autentizace obvykle potřebuje specifickou logiku, se tím dá přihlásit k CalmHub.

### Napsání autentizačního pluginu

Autentizační pluginy jsou JavaScript soubory. Příklad je v [test fixtures](./test_fixtures/test-auth-plugin.js).

Plugin musí exportovat výchozí třídu implementující rozhraní [`AuthPlugin`](../shared/src/auth/auth-plugin.ts), tedy metodu `getAuthHeaders(url, requestBody)`, která vrací `Promise<Record<string, string>>`.

Funkce `getAuthHeaders` se volá s URL a tělem požadavku u každého requestu, který CLI posílá na CalmHub.

### Použití autentizačního pluginu

Plugin nastavíte v `~/.calm.json` stejným způsobem jako URL CalmHub:

```
{
  "calmHubUrl": "http://calmhub.com",
  "authPluginPath": "~/plugins/auth-plugin.js"
}
```

## CALM Hub

Příkazy `calm hub` umí pushovat, stahovat, vypisovat a vytvářet resources na instanci CalmHub, vždy po jednom dokumentu/resource. (Když spravujete celou sadu navázaných dokumentů, podívejte se na [CALM Workspace](#calm-workspace) níže. Ten stejné operace obaluje pro sledovaný bundle souborů.)

```shell
% calm hub --help
Usage: calm hub [command]

Interact with CALM Hub

Commands:
  push [command]     Push a CALM document to CALM Hub
  pull [command]     Pull a CALM document from CALM Hub
  list [command]     List CALM Hub resources
  create [command]   Create CALM Hub resources
  help [command]     display help for command
```

Každý podpříkaz přijímá `-c, --calm-hub-url <url>` (když ho vynecháte, vezme se `calmHubUrl` z `~/.calm.json`).

### `calm hub push`

Pushne dokument, jehož `$id` obsahuje plné CalmHub document ID (namespace, type, mapping slug a verzi). Ve výchozím stavu `push` **automaticky bumpne verzi**: spočítá novou verzi od poslední publikované (nebo mapping vytvoří na `1.0.0`, pokud ještě neexistuje).

```
calm hub push <architecture|pattern|standard|control-requirement|control-configuration> <file> [options]
```

| Přepínač | Platí pro | Popis |
|--------|------------|-------------|
| `--name <name>` | `architecture`, `pattern`, `standard` | Přepíše pole `title` dokumentu v CalmHub. |
| `--description <description>` | `architecture`, `pattern`, `standard` | Přepíše pole `description` dokumentu. |
| `-c, --calm-hub-url <url>` | všechny | Instance CalmHub, kam se má pushnout. |
| `-f, --format <format>` | všechny | Formát výstupu: `json` (výchozí) nebo `pretty`. |
| `-t, --change-type <type>` | všechny | Typ version bumpu při auto-bumpu: `patch` (výchozí), `minor` nebo `major`. |
| `--fail-if-modified` | všechny | Strict režim: nebumpovat automaticky. Přeskočit, pokud je dokument stejný jako poslední publikovaná verze; selhat, pokud se změnil. Zcela nový mapping se i tak vytvoří na `1.0.0`. |

```shell
# Auto-bump: creates the next patch version off the latest published version
calm hub push architecture ./architectures/payment-service.json

# Strict merge-time push: fail if this exact version already exists with different content
calm hub push pattern ./patterns/microservice-pattern.json --fail-if-modified

# Control documents don't take --name/--description
calm hub push control-requirement ./controls/encryption-at-rest.requirement.json
calm hub push control-configuration ./controls/encryption-at-rest.config.json
```

Lokální dokument se před porovnáním obsahu normalizuje stejným způsobem, jakým ho ukládá CalmHub. Rozdíl jen ve verzi nebo ve výchozích polích mezi diskem a CalmHub se proto neplete se skutečnou změnou.

### `calm hub pull`

Stáhne konkrétní (nebo nejnovější) verzi resource z CalmHub.

```
calm hub pull <architecture|pattern|standard|control-requirement|control-configuration> [options]
```

| Přepínač | Platí pro | Popis |
|--------|------------|-------------|
| `--namespace <namespace>` | `architecture`, `pattern`, `standard` (povinné) | Zdrojový namespace. |
| `-m, --mapping <mapping>` | `architecture`, `pattern`, `standard` (povinné) | Mapping slug dokumentu ke stažení. |
| `--domain <domain>` | `control-requirement`, `control-configuration` (povinné) | Zdrojová domain. |
| `--control-name <controlName>` | `control-requirement`, `control-configuration` (povinné) | Název control. |
| `--config-name <configName>` | `control-configuration` (povinné) | Název konfigurace. |
| `--ver <version>` | všechny | Verze ke stažení (výchozí: nejnovější). |
| `-c, --calm-hub-url <url>` | všechny | Instance CalmHub, odkud se stahuje. |
| `-o, --output <file>` | všechny | Zapsat výstup do souboru místo na stdout. |

```shell
calm hub pull architecture --namespace com.example --mapping payment-service --ver 2.1.0 -o ./payment-service.json
calm hub pull control-configuration --domain security --control-name encryption-at-rest --config-name default
```

### `calm hub list`

Vypíše resources daného typu.

```
calm hub list <architectures|patterns|standards|namespaces|domains|controls|control-configurations> [options]
```

| Přepínač | Platí pro | Popis |
|--------|------------|-------------|
| `--namespace <namespace>` | `architectures`, `patterns`, `standards` | Cílový namespace (výchozí: `"default"`). |
| `--domain <domain>` | `controls` (povinné), `control-configurations` (povinné) | Cílová domain. |
| `--control-name <controlName>` | `control-configurations` (povinné) | Název control. |
| `-c, --calm-hub-url <url>` | všechny | Instance CalmHub. |
| `-f, --format <format>` | všechny | Formát výstupu: `json` (výchozí) nebo `pretty`. |

```shell
calm hub list architectures --namespace com.example
calm hub list namespaces
calm hub list control-configurations --domain security --control-name encryption-at-rest
```

### `calm hub create`

Vytvoří nový namespace nebo domain.

```
calm hub create <namespace|domain> [options]
```

| Přepínač | Platí pro | Popis |
|--------|------------|-------------|
| `--name <name>` | oba (povinné) | Název namespace nebo domain. |
| `--description <description>` | `namespace` (povinné) | Popis namespace. |
| `-c, --calm-hub-url <url>` | všechny | Instance CalmHub. |
| `-f, --format <format>` | všechny | Formát výstupu: `json` (výchozí) nebo `pretty`. |

```shell
calm hub create namespace --name com.example --description "Example org namespace"
calm hub create domain --name security
```

## CALM Workspace

Příkazy `calm workspace` dávají lokální vývojové prostředí pro sadu CALM dokumentů. Workspace sleduje, které dokumenty vás zajímají, drží kopie (nebo odkazy) těchto souborů v jednom bundle adresáři a umí je synchronizovat s instancí CalmHub.

### Pojmy

**Workspace** — pojmenovaná kolekce CALM dokumentů uvnitř git repozitáře. Metadata jsou pod `.calm-workspace/` v kořeni repozitáře; aktivní workspace je zapsaný v `.calm-workspace/workspace.json`.

**Bundle** — adresář workspace na disku (`<repo-root>/.calm-workspace/bundles/<name>/`). Obsahuje:
- `workspace-manifest.json` — index všech sledovaných dokumentů, klíčovaný podle document ID. U každé položky je cesta k souboru, typ dokumentu a volitelně CalmHub namespace.
- `files/` — dokumenty zkopírované do bundle (když použijete `--copy`). Odkazované dokumenty zůstávají na původním místě.

**Document ID** — klíč, kterým se dokument ve workspace identifikuje. Řeší se v pořadí: přepínač `--id` → pole `title` v JSON → dotaz na uživatele.

### Příkazy

#### `calm workspace init <name>`

Vytvoří nebo aktualizuje workspace. Založí bundle adresář a nastaví ho jako aktivní workspace.

```
calm workspace init <name> [--dir <path>]
```

| Přepínač | Popis |
|--------|-------------|
| `--dir <path>` | Adresář, ve kterém se workspace vytvoří. Výchozí je kořen repozitáře (detekovaný přes git). |

```shell
calm workspace init my-system
# Workspace 'my-system' created/updated at .calm-workspace
# Bundle directory ensured at .calm-workspace/bundles/my-system
```

#### `calm workspace add <file>`

Zaregistruje CALM dokument do aktivního workspace. Ve výchozím stavu se soubor odkazuje na aktuální místo na disku (bez kopírování). Když se typ dokumentu a (manifest) název nedají určit automaticky, CLI se interaktivně zeptá.

```
calm workspace add <file> [--id <id>] [--type <type>] [--namespace <namespace>] [--copy]
```

| Přepínač | Popis |
|--------|-------------|
| `--id <id>` | Explicitní registrační id v manifestu. Přepíše automatické určení. |
| `--type <type>` | Typ dokumentu. Když ho vynecháte, zobrazí se interaktivní výběr. Jedna z hodnot: `pattern`, `architecture`, `interface`, `flow`, `control`, `schema`, `timeline`, `adr`. |
| `--namespace <namespace>` | CalmHub namespace zapsaný do manifestu. Když ho vynecháte, odvodí se z `$id` dokumentu. |
| `--copy` | Zkopírovat soubor do `files/` v bundle místo odkazu na původní místo. |

**Zpracování `$id` dokumentu.** `add` se podívá na CalmHub `$id` v souboru:
- **Žádné `$id`** → interaktivně se z komponent složí (viz níže); `$id` se zapíše do souboru a dokument se přidá.
- **Konformní `$id`** → nechá se být; namespace v manifestu se z něj odvodí.
- **Nekonformní `$id`** → nechá se být; vypíše se varování a dokument se i tak sleduje, ale na CalmHub ho nepůjde pushnout, dokud `$id` neopravíte (tiché přepsání by ztratilo data u typů, které CalmHub URL nepoužívají, např. `flow`, `adr`, `timeline`).

**Určení názvu v manifestu** (když není `--id`): pole `title` z JSON souboru, jinak interaktivní dotaz.

```shell
# Interactive — prompts for type, builds the $id if needed, then the manifest name
calm workspace add ./architectures/payment-service.json

# Reference an already-conformant document without copying
calm workspace add ./architectures/payment-service.json --type architecture
```

#### `calm workspace new [type] [name] [template]`

Vytvoří nový stub CALM dokumentu v aktuálním adresáři a zaregistruje ho do aktivního workspace. CalmHub `$id` dokumentu se **vždy skládá interaktivně**. Ostatní argumenty, které na příkazové řádce nezadáte, se doptají interaktivně.

```
calm workspace new [type] [name] [template]
```

Vytvořený soubor se jmenuje `<slug>.<type>.json` (`<slug>` je mapping id, nebo název control/config) a obsahuje minimální dokument. `$id` je to, které jste složili, `title` je zadaný název. Namespace (u namespace resources) se uloží do manifestu, takže dokument jde pushnout na CalmHub bez dalších přepínačů.

```shell
# Fully interactive
calm workspace new

# Provide the type and title up front; still prompts for the $id components
calm workspace new architecture "Payment Gateway"
```

#### Interaktivní složení CalmHub `$id`

Když `new` (vždy) nebo `add` (když je to potřeba) skládá `$id`, zeptá se na resource scope a pak na každou komponentu. **Verze defaultuje na `1.0.0`**, **base URL na nakonfigurované CalmHub URL** (`calmHubUrl` v `~/.calm.json`). Výsledek je jedna z těchto podob:

```
namespace resource:    $BASE_URL/calm/namespaces/$NAMESPACE/$TYPE/$MAPPING/versions/$VERSION
control requirement:   $BASE_URL/calm/domains/$DOMAIN/controls/$CONTROL/requirement/versions/$VERSION
control configuration: $BASE_URL/calm/domains/$DOMAIN/controls/$CONTROL/configurations/$CONFIG/versions/$VERSION
```

kde `$TYPE` je jedno z `patterns`, `architectures`, `standards`, `interfaces`.

#### `calm workspace push`

Pushne každý dokument z workspace manifestu na instanci CalmHub. Identita dokumentu — namespace, type, mapping id a **verze** — se bere z `$id` (tvar `$BASE_URL/calm/namespaces/$NAMESPACE/$TYPE/$MAPPING_ID/versions/$VERSION`). Push **neprovádí auto-bump**: vytvoří přesně tu verzi, kterou dokument deklaruje. Dokumenty bez dobře utvořeného mapping `$id` (nebo jejichž typ nemá CalmHub resource type) se přeskočí s varováním.

```
calm workspace push [--calm-hub-url <url>] [--fail-if-modified]
```

| Přepínač | Popis |
|--------|-------------|
| `--calm-hub-url <url>` | Base URL CalmHub. Když ho vynecháte, vezme se `calmHubUrl` z `~/.calm.json`. |
| `--fail-if-modified` | Push selže, pokud dokument, který v CalmHub už existuje na deklarované verzi, se na disku změnil. Přepíše `push.failIfModified` v konfiguraci workspace. |

U každého sledovaného dokumentu push v CalmHub dohledá existující verze:
- **Verze neexistuje** → vytvoří ji.
- **Verze už existuje, obsah stejný** → přeskočí (idempotentní; hodí se na lokální opakované běhy).
- **Verze už existuje, obsah na disku se změnil** → chování závisí na `push.failIfModified` (výchozí `false`):
  - `false` — zaloguje a přeskočí.
  - `true` — nahlásí konflikt a push selže (strict; hodí se na merge-time CI). Nejdřív spusťte `bump` a vytvořte novou verzi.

```shell
calm workspace push                              # URL from ~/.calm.json
calm workspace push --calm-hub-url https://calmhub.example.com
calm workspace push --fail-if-modified           # strict merge-time mode
```

#### `calm workspace check`

Zkontroluje, jestli se nějaký sledovaný dokument na disku změnil vůči CalmHub, ale **nebyl** version-bumpnutý. Je to CI/PR brána — při potřebě bumpu **skončí nenulovým kódem**, takže PR nejde sloučit s neverzovanými změnami.

```
calm workspace check [--calm-hub-url <url>]
```

Dokument se označí, když verze `$id` na disku pořád odpovídá verzi v CalmHub, ale obsah se liší. Zcela nové dokumenty (ještě nejsou v CalmHub) a už bumpnuté dokumenty (jejich verze je před CalmHub) se neoznačují.

Po kontrole unbumpnutých dokumentů `check` potichu zvaliduje každou architekturu a každý pattern ve workspace a vypíše shrnutí — například:

```
All 3 document(s) passed validation.
```

nebo, když dokument neprojde:

```
1 document(s) failed validation:
  my-arch (2 error(s)) — run `calm validate -a .calm-workspace/files/my-arch.json` to see full output
```

Příkaz skončí nenulovým kódem, pokud nějaké dokumenty potřebují bump **nebo** pokud nějaký dokument neprojde validací.

#### `calm workspace bump`

Bumpne verzi každého dokumentu, který se na disku změnil vůči CalmHub, a aktualizuje všechny odkazy na tyto dokumenty napříč workspace, aby vše zůstalo sladěné.

```
calm workspace bump [--calm-hub-url <url>] [--major | --minor | --patch] [--inherit-change-type]
```

| Přepínač | Popis |
|--------|-------------|
| `--calm-hub-url <url>` | Base URL CalmHub. Když ho vynecháte, vezme se `calmHubUrl` z `~/.calm.json`. |
| `--major` | Major bump všech změněných dokumentů bez doptávání (např. `1.2.3` → `2.0.0`). |
| `--minor` | Minor bump všech změněných dokumentů bez doptávání (např. `1.2.3` → `1.3.0`). |
| `--patch` | Patch bump všech změněných dokumentů bez doptávání (např. `1.2.3` → `1.2.4`). |
| `--inherit-change-type` | Potlačí doptávání u kaskádově bumpnutých závislostí; tiše zdědí typ bumpu spouštěče. |

Když není zadáno `--major`, `--minor` ani `--patch`, `bump` se u každého změněného dokumentu interaktivně zeptá:

```
? Bump type for 'my-pattern' (currently 1.0.0): › minor (default)
? Bump type for 'my-arch' (depends on my-pattern): › minor (inherited)
```

Dokumenty bumpnuté jako kaskádová závislost jiného dokumentu dostanou prompt taky, s inkrementem spouštěče předvybraným jako výchozí. Přepínačem `--inherit-change-type` kaskádové prompty přeskočíte a dědění proběhne tiše.

Výchozí inkrement bez přepínače je **MINOR** (lze přepsat přes `bump.defaultIncrement` v konfiguraci workspace). U každého změněného dokumentu se nová verze spočítá od nejnovější verze v CalmHub, přepíše se `$id` v souboru a každý `$ref` / `$schema` / `requirement-url` / `config-url` ve **všech** sledovaných dokumentech, který ukazoval na starou verzi, se přesměruje na novou (fragmenty zůstanou).

Bump je **idempotentní**: editace → bump → další editace → další bump posune verzi jen o jeden inkrement, protože jakmile je verze na disku před CalmHub, nechá se být, dokud se ta verze nepushne.

Po bumpu `bump` potichu zvaliduje každou architekturu a každý pattern ve workspace a vypíše stejné pass/fail shrnutí jako `workspace check`. Je to **jen informativní** — exit code se tím nemění.

#### Konfigurace workspace — `.calm-workspace/config.json`

Centrální, commitovaná konfigurace, která platí pro každý workspace v repozitáři (viditelná pro CI):

```json
{
  "push": { "failIfModified": false },
  "bump": { "defaultIncrement": "MINOR" }
}
```

| Pole | Hodnoty | Výchozí | Význam |
|-------|--------|---------|---------|
| `push.failIfModified` | `true` \| `false` | `false` | Když je `true`, `push` selže, pokud dokument už publikovaný na deklarované verzi se na disku změnil. Pro strict merge-time push nastavte `true`. |
| `bump.defaultIncrement` | `MAJOR` \| `MINOR` \| `PATCH` | `MINOR` | Výchozí inkrement pro `bump`, když není zadaný přepínač. |

Typický CI workflow: `calm workspace check` hlídá PR (přispěvatelé spustí `calm workspace bump`, aby zaznamenali záměrný version bump) a při merge běží `calm workspace push` s `push.failIfModified: true`, takže merge zavede přesně ty nové verze, které tvrdí.

#### `calm workspace tree`

Vypíše strom závislostí dokumentů v aktivním workspace — jak na sebe dokumenty odkazují.

```
calm workspace tree
```

```
payment-service (architecture)
├── payment-pattern (pattern)
│   └── https://calm.finos.org/draft/2025-03/meta/core.json (schema)
└── https://calm.finos.org/draft/2025-03/meta/interface.json (schema)
```

#### `calm workspace list`

Vypíše všechny workspace v aktuálním repozitáři. Aktivní workspace je označený `*`.

```
calm workspace list
```

```
* my-system
  legacy-platform
  experimental
```

#### `calm workspace show`

Vypíše název aktuálně aktivního workspace a za ním každý dokument, který je teď v jeho bundle sledovaný (id, type, namespace a CalmHub ID, pokud je nastavené).

```
calm workspace show
```

#### `calm workspace rm [id]`

Odebere dokument z manifestu aktivního workspace. Když `id` vynecháte, vyzve vás k výběru ze sledovaných dokumentů. Dokument se jen přestane sledovat — podkladový soubor se nemaže (ani nic, co už je na CalmHub).

```
calm workspace rm [id]
```

```shell
# Prompts you to choose which tracked document to remove
calm workspace rm

# Remove a specific document by its manifest id
calm workspace rm payment-service
```

#### `calm workspace switch <name>`

Přepne aktivní workspace.

```
calm workspace switch <name>
```

```shell
calm workspace switch legacy-platform
# Switched to workspace 'legacy-platform'.
```

#### `calm workspace clean`

Smaže stažené soubory z workspace bundle a resetuje jeho manifest. Samotný bundle adresář zůstane.

```
calm workspace clean [--all]
```

| Přepínač | Popis |
|--------|-------------|
| `--all` | Vyčistit všechny workspace a resetovat `workspace.json`. |

```shell
# Clean the active workspace
calm workspace clean

# Clean everything
calm workspace clean --all
```

### Příklad workflow

Níže je příklad od začátku do konce: vytvoření workspace, přidání dokumentů, stažení závislostí a synchronizace s CalmHub.

```shell
# 1. Initialise a workspace in the current git repo
calm workspace init payments

# 2. Create a new architecture stub — builds the $id interactively, prompts for title
calm workspace new architecture "Payment Gateway"

# 3. After editing the stub, add an existing pattern you depend on
#    (prompts to build a $id if the file doesn't already have a conformant one)
calm workspace add ./patterns/microservice-pattern.json --type pattern

# 4. Inspect the resulting dependency graph
calm workspace tree

# 5. Push everything to CalmHub (namespace comes from each file's manifest entry)
calm workspace push --calm-hub-url https://calmhub.example.com
```

Když v jednom repozitáři řešíte víc témat, můžete mít oddělené workspace:

```shell
calm workspace init platform
calm workspace switch platform
calm workspace add ./platform/infra.json --type architecture --namespace com.example
calm workspace push

calm workspace switch payments   # back to the original
```

### Integrace s CalmHub

Abyste nemuseli pokaždé zadávat `--calm-hub-url`, přidejte URL do `~/.calm.json`:

```json
{
  "calmHubUrl": "https://calmhub.example.com"
}
```

Aby `push` fungoval, musí mít každý dokument v manifestu zapsaný namespace. `new` ho nastaví automaticky. U souborů přidaných přes `add` zadejte `--namespace <ns>` při přidání. Soubor bez namespace se při pushi přeskočí a vypíše se, jak to opravit.
