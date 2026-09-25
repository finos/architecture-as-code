# CALM Studio — uživatelský návod

Studio je editor CALM diagramů v prohlížeči (Chrome nebo Safari). Editujete **soubory v git repozitáři modelu** (`architecture-model`). Studio do CALM Hubu nic nezapisuje. Do Hubu je model posílá CI/CD po commitu.

Tři repozitáře:

| Repo | Co v něm je |
| --- | --- |
| `architecture-model` | Instance (komponenty, vztahy). Tohle otevíráte ve Studiu. |
| `CEngineering-App` | Standard, Pattern, `url-mapping.json`, skripty, CI. |
| CALM Hub | Publikované architektury, specifikace a patterny. Jen čtení. |

Podrobnosti: [prd.md §3](./prd.md#3-target-users-and-use-cases) (UC-1–UC-57), [BBR.MD](./BBR.MD), [DIFA overlay](../../../difa/CEngineering-App/docs/difa-calm-overlay.md), [naming](../../../difa/CEngineering-App/docs/naming-conventions.md), [views](../../../difa/CEngineering-App/docs/views.md), [CI a `.env`](../../../difa/CEngineering-App/docs/env-configuration.md).

## Tok práce

1. Otevřete kořen `architecture-model` (File System Access — složka musí být na disku).
2. Upravte primární soubory (`*.appcomp.json`, `*.appserv.json`, …).
3. Uložte, commitněte, pushněte.
4. Pipeline v `CEngineering-App` model zvaliduje a `scripts/import.py` ho nahraje do Hubu. Views (`L0-*.view.json`, `views/`) generátor přepíše — needitujte je ručně.

Hub URL v `.calmrj` je jen origin (`http://host:port`), bez `/api` a `/calm`. Prohlížeč nečte `~/.calm.json`.

## Co ve Studiu needělat

- Neukládat Hub dokument zpět na server. Záložka z Hubu je read-only (plátno i JSON).
- Nepřepisovat `detailed-architecture`, které vede na Hub URL, při přesunu složky. Přepisují se jen relativní cesty k souborům.
- Needitovat `impl/` ani odvozené views. Layout a barvy patří do `metadata._layout` a `metadata.building-block-style` v primárním souboru.
- Needitovat řádky v `url-mapping.json` ve Studiu. Studio jen ukládá cestu k souboru.

## Projekt

Soubor `*.calmrj` musí být **jeden** v kořeni složky. Žádný → nabídka Create. Více → chyba.

- **UC — Otevřít model.** Open folder na kořen repa. Studio načte `.calmrj` a strom JSON. [UC-1](./prd.md#3-target-users-and-use-cases), [§4.13](./prd.md#413-project-file-calmrj-p1--bbr-v4).
- **UC — Nastavení.** Project settings, jedna záložka na blok (`naming`, `patterns`, `hub`, `extensions`, `validation`, `templates`, `neighbors`, `urlMapping`). Save zapíše jeden `.calmrj`. [UC-48](./prd.md#3-target-users-and-use-cases).
- **UC — Pojmenování nových souborů.** V záložce `naming` jsou šablony `{{name}}` (text, bez file pickeru). Extract a Save As z nich berou složku a jméno. Konvence adresářů: [naming-conventions.md](../../../difa/CEngineering-App/docs/naming-conventions.md). [UC-38](./prd.md#3-target-users-and-use-cases).
- **UC — URL na lokální Standard.** V `urlMapping` vyberte `url-mapping.json` (cesta vůči projektu). Klíč = kanonická URL, hodnota = cesta vůči **souboru mapování**. Hub instance URL se nemapují. Nemapovaná URL se nestahuje. Tvar mapy: [difa-calm-overlay.md](../../../difa/CEngineering-App/docs/difa-calm-overlay.md). [UC-57](./prd.md#3-target-users-and-use-cases).
- **UC — Vlastní výchozí config.** Nejdřív soubor uživatele, přes něj projekt (projekt vyhraje). Prohlížeč ho musíte vybrat ručně. [UC-47](./prd.md#3-target-users-and-use-cases).

## Soubory a záložky

- **UC — Otevřít diagram.** Dvojklik na soubor ve Files. Stejný soubor = jedna záložka (max. 10). [UC-2](./prd.md#3-target-users-and-use-cases), [UC-7](./prd.md#3-target-users-and-use-cases).
- **UC — Najít soubor aktivní záložky.** Reveal in tree. [UC-11](./prd.md#3-target-users-and-use-cases).
- **UC — Nový soubor.** Pravý klik na řádek ve stromu → New file → hned zadat jméno. Cancel nic nezapíše. [UC-54](./prd.md#3-target-users-and-use-cases).
- **UC — Nová složka / přesun.** Pravý klik → New folder nebo Move. Otevřené záložky zůstanou na nové cestě; relativní `detailed-architecture` v ostatních souborech se přepíše. [UC-44](./prd.md#3-target-users-and-use-cases), [UC-45](./prd.md#3-target-users-and-use-cases).
- **UC — Uložit.** Save uloží aktivní záložku a obnoví seznam uzlů ve stromu. Save all uloží všechny dirty záložky; Untitled jde postupně přes Save As. Save As navrhne vybranou složku ve stromu a jméno z `naming.patterns`. [UC-12](./prd.md#3-target-users-and-use-cases), [UC-20](./prd.md#3-target-users-and-use-cases), [UC-46](./prd.md#3-target-users-and-use-cases).
- **UC — Zavřít záložky.** Pravý klik na záložku → vlevo / vpravo / vše. Dirty soubory v jednom dialogu. [UC-21](./prd.md#3-target-users-and-use-cases).

Undo platí jen v aktivní záložce.

## Modelování

Paleta bere typy z extension packů (`extensions/` v projektu, plus `extensions.dir`). Vypnuté bundled packy (`extensions.disabled`, např. `archimate`) v paletě nejsou. DIFA typy jsou `difa-arch:*`. Pole metadat: [difa-standarts-doc.md](../../../difa/CEngineering-App/docs/difa-standarts-doc.md).

- **UC — Nový uzel.** Přetáhněte typ z palety. Studio doplní povinná pole a `$schema` (CALM 1.2 + Standard packu).
- **UC — Vlastnosti.** Panel vpravo: název, popis, metadata. Enum ze schématu je dropdown. Vnořený objekt (např. `difa-arch`) je náhled; Edit otevře dialog. [UC-9](./prd.md#3-target-users-and-use-cases), [UC-42](./prd.md#3-target-users-and-use-cases), [UC-49](./prd.md#3-target-users-and-use-cases).
- **UC — Vztah.** Spojte uzly. Směr otočíte v properties. `composed-of` / `deployed-in` se na plátně nekreslí jako čára: děti jsou v kontejneru, vztah otevřete ikonou v hlavičce. [UC-25](./prd.md#3-target-users-and-use-cases).
- **UC — Vložit do kontejneru.** Alt+drop na cílový uzel. Alt+tah ven dítě vyjme. Obyčejný tah containment nemění. V JSON je nejvýš jeden `composed-of` a jeden `deployed-in` s `nodes[]`. [UC-28](./prd.md#3-target-users-and-use-cases), [UC-29](./prd.md#3-target-users-and-use-cases).
- **UC — Duplikovat uzel.** Ctrl+tah. Dialog: jméno a volitelně kopie vztahů. Nové `unique-id`. [UC-13](./prd.md#3-target-users-and-use-cases).
- **UC — Vyčlenit diagram.** Extract to diagram. Potvrďte cestu (default z naming). Rodič se stane odkazem `detailed-architecture`, dítě se otevře v záložce. [UC-17](./prd.md#3-target-users-and-use-cases).
- **UC — JSON.** Stejný dokument jako plátno. Kurzor při výběru uzlu neskáče na začátek. [UC-5](./prd.md#3-target-users-and-use-cases).

## Odkazy mezi soubory

- **UC — Odkaz z jiného souboru.** Přetáhněte uzel ze stromu na plátno. Vznikne reference (`detailed-architecture`), ne kopie definice. [UC-4](./prd.md#3-target-users-and-use-cases).
- **UC — Otevřít cíl.** Dvojklik na brýle. Soubor v projektu se otevře a zvýrazní zdrojový uzel. Cesta mimo projekt: infobox a odkaz v novém tabu prohlížeče. Hub URL: read-only záložka, bez vkládání z katalogu. [UC-8](./prd.md#3-target-users-and-use-cases), [UC-14](./prd.md#3-target-users-and-use-cases), [UC-53](./prd.md#3-target-users-and-use-cases).
- **UC — Reference je jen ke čtení.** Vlastnosti uzlu s `detailed-architecture` nejdou měnit. Úprava je v cílovém souboru. [UC-10](./prd.md#3-target-users-and-use-cases).
- **UC — Sousedé.** Find neighbors: 1 hop z **ostatních** souborů. Add vloží reference a zkopíruje vztah se stejným `unique-id`. [UC-18](./prd.md#3-target-users-and-use-cases).
- **UC — Kde se uzel používá.** Find usage: odkazy a konce vztahů v jiných souborech. Open otevře diagram. [UC-27](./prd.md#3-target-users-and-use-cases).

## Plátno

- **UC — Layout.** Auto-layout (včetně Radial). Vybraný uzel je střed Radial. Děti v kontejneru jdou do tabulky (Arrange to table). [UC-15](./prd.md#3-target-users-and-use-cases), [UC-22](./prd.md#3-target-users-and-use-cases), [UC-33](./prd.md#3-target-users-and-use-cases), [UC-51](./prd.md#3-target-users-and-use-cases).
- **UC — Výběr a posun.** Přepínač Select / Pan, nebo mezerník. Shift+klik nebo tažení obdélníku. Mini-mapa jen posouvá viewport. [UC-50](./prd.md#3-target-users-and-use-cases), [UC-55](./prd.md#3-target-users-and-use-cases), [UC-56](./prd.md#3-target-users-and-use-cases).
- **UC — Mlha.** Session filtr: sousedé vybraného uzlu, jedna hodnota metadata, nebo typ uzlu. Na disk se neukládá. [UC-19](./prd.md#3-target-users-and-use-cases), [UC-26](./prd.md#3-target-users-and-use-cases).
- **UC — Export.** JSON / SVG / PNG obsahuje i vztahy vnořených uzlů. Viditelné vztahy jsou bezier. [UC-6](./prd.md#3-target-users-and-use-cases), [UC-36](./prd.md#3-target-users-and-use-cases).

Pozice po uložení čte i Hub a VS Code plugin (`metadata._layout`). [UC-35](./prd.md#3-target-users-and-use-cases).

## Validace, patterny, Hub

- **UC — Validate.** Tlačítko Validate: core CALM, Spectral rulesety z `.calmrj` a pattern z `patterns.dir` (stejná pravidla jako `calm validate -p` a `-u`). Findings v Problems. CLI se nespouští. [UC-37](./prd.md#3-target-users-and-use-cases). Overlay pravidla a příkazy CLI: [difa-calm-overlay.md § Validate](../../../difa/CEngineering-App/docs/difa-calm-overlay.md#validate).
- **UC — Vygenerovat z patternu.** Template picker: lokální `patterns.dir` a záložky namespace z Hubu. Volby patternu v dialogu. Výsledek je **nová untitled** záložka, nepřepíše aktuální. Uložíte ji do modelu (Save As). [UC-31](./prd.md#3-target-users-and-use-cases), [UC-39](./prd.md#3-target-users-and-use-cases).
- **UC — Upravit pattern jako diagram.** Otevřete pattern → plátno jako v Hubu → Save zapíše JSON do `patterns.dir` v projektu. Na Hub se pattern neposílá. [UC-41](./prd.md#3-target-users-and-use-cases).
- **UC — Vložit architekturu z Hubu.** Hub browse → verze → insert jako `detailed-architecture` s Hub URL. [UC-40](./prd.md#3-target-users-and-use-cases).

Specifikace a patterny v Hubu jsou katalog ke čtení a ke generování. Zdroj pravdy pro DIFA Standard/Pattern je repo `CEngineering-App`, ne Hub a ne Studio.

## Po pushi

Pipeline (ne Studio):

- validace `calm validate` s Patternem a `url-mapping.json` — [PRD overlay R5](../../../difa/CEngineering-App/docs/PRD-difa-calm-overlay.md), [env-configuration.md § CI](../../../difa/CEngineering-App/docs/env-configuration.md#server--ci-run-pipeline);
- přegenerování L0 a dalších views — [views.md](../../../difa/CEngineering-App/docs/views.md), [PRD landscape](../../../difa/CEngineering-App/docs/PRD-landscape-generator.md);
- import do Hubu (`import.py`) včetně `org-*/L0-*.view.json`. Ostatní `views/**/*.view.json` se neimportují.

Ruční úprava L0 ve Studiu se při dalším běhu generátoru ztratí.
