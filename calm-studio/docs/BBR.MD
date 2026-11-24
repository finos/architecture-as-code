# CALM-studio

```
## business  requirments
```

- 

- doplnit extenzin o definici schamatu pro jednoptlivé elementy tuto definici přidat do halvičky json soboru při přidání prvního  elementu z dané palety
- doplnit u přidávaného elementu a relation  requred elementy podle schématu přidávaného nodu viz predchozi bod 
- pridat control na prehozeni směru vazby SOURCE - DESTINATION v panelu properties 
- Přidat panel pro procazení zvolené složky. Do panelu vložit všechny json souboru ve stromove struktuře složek. U Souboru obsahujici definic CALM přida pod sooubor seznam nodu jako popisek použit atribut name a iconu dle node-type. Sobor bude možné dvoj klikem vybarat a editovat, pro aktualni soubor bude uživatel vyzván k uložení. Pri editaci bude možne nody zobrazen v souboru přidat přetažením do aktuálniho diagramu jako referenci  
v1

---

- upravit editor tak že nové diagramy budou oteviráby do založek. Okno json editoru se bude chovat  tak že vždy bude zobrazovat  json pro diagram z aktulani záložky diagramu. Pri zavirani založky bude dialog pro uloženi diagramu. Maximalní počet založek nastav na 10 dojdeli k prekročení počtu založek dojde k uzavření nejstarší založky , pri zavirani bude dialog na uložení jsouli v diagramu změny.
- nod který ma odkaz na detail doplnit ikonku brýli pro zvíraznění informace že se jedná o referencovaný element. Pri dvoj kliku na ikonz brýly dojde k otevření referencovaného diagramu.  
---
V2

- doplnit properties editor o editaci metadata a zajistit že se do nověho elentu doplni všechyn elemnty metadat predepsané validaci a schmetem.
- zamezit v properties editaci pro odkazované elementy maji details elemnet
---

V3
- přidat tlačitko do files pro vyhledáí aktuálně otevřeného souboru ve stromu souborů
- při uloženi souboru aktualizovat seznam nodu v adresařové struktuře v založce files.
- pri tažení nodu  s ctrl udělat kopii nodu s novým unique-id a názvem  a na dotaz zduplikovat i vazby. Dialog pro zadání názvu a check box na duplikaci vazeb bude modálni a check box si bude pamatvat posledni stav. DEfault check boxu je nezškrtnuto tudiž se vazby neduplikuji i nanaový element. Vazby se duplikuji vraci daneho souboru ne dál.
- po přechodu na detailový diagram  dat  fokus  referencovany node 
- upravit layout tak aby nedocházelo k prekryvu boxu po jejich roztažení na zakaldě textu a relation se vyhibaly boxum
---

V4
- umožnit ve složce definici validačnich pravidel doplnujici standartní pravidla.
- vyber pravidel zaznamenj do kořenove složky do souboru s koncovkou CALMPRJ do tohoto souboru nasledne budem ukládat dalši konfigurace souvisejici s diagramy ve složce
- v konfiguraci projektu bude i definice struktury adresářu a jmená konvence, která se uplatni pri přechodu v nasledujicím bodu nastaveni vzchazi z CEngineering-App\docs\naming-conventions.md 
- umožnit převest  nod z diagramu na samosatný diagram.  Nod v aktualnim diagramu  nahradit za referenci na nod v novém  diagramu. Název souboru  s diagramem vytvoř dle definice v konfigiuraci. Včetně patřičné složky jeli v konfiguraci definovana.  Název složky a souboru nech potvrdit pripadně upravit  uživatele pomoci dialogu. Hodnoty z konfigurace nastav jako default.

---

V5

- přidat funkci pro vyhledání sousedu pro aktualni prvek diagramu se do dialogu načtou eleemnty na které ja vazba přes celý projekt. seznam bude možné filtrovat na typ elemntu a typ vazby. vybrané elemnty bude nasledně možné pridat do diagramu  včetně vazby. elementy budou vloženy jako reference, stejně jako by se vložila ze stromu,  a vazba si zachová své unique-id
- přidat prvek umožnujici na diagramu filtrovat/zvíraznovat elementy. toto se  na diagrmu projevi jako zvýraznění elemntů dle filtru u ostatních se zobrazeni potlači jakob by byly v mlze.   Filtrovat půjde dle :   
  - vazby na anktualni prvek , prvek s fokusem, tj vyberu prvek a zvírazní se prvky na nejž je vazba
  - dle hodnoty metadat metadata budou dle schemat v hlavičce a hodnoty budou dle hodnot zastoupenych na diagramu.
- přidat možnost uložit vše
- přidat možnost zavřit všechny založky vlevo od aktualni, vpravo od aktualni a všecny  
- 
---
V6
- přidat layout Radial do nabídky layoutu 
- načítani temlates z projektové složky definovane v projekct file.
- vytvořit deploy do dokeru
- odstranit zobrazeni ralation pro kontejnerove realce (ty co se projevi zmenou vizualizace nodu na kontejner ) nastaveni property pro  vazbu v editoru přidat do hlavičky kontejneru ikonku  pro načtení property pro vazbu do property editoru. 
- doplnit filter na filter dle typu nodu 
- najit kde je node použit (find usege)- vypsat všechny použití(reference na daný prvek) v ostaních calm souborech a umožnit otevřit vyhledaný diagram
---
V7
- u vazeb compose of  a deployed in umožnit sloučeni vazeb na stejnem kontejneru do jedné a prislušne uprav i property tak aby umožnoval parci s vice nody v destination . 
- vytvařet vazbu compouse of a deloyed in pretaženim nódu spolu se zmačknutou klavesou alt na nod ze kterého se má stat kontejner.  jestli že se jedná o první vazbu nech vybrat typ vazby v pripadě že jsou  již vazby typu compose of nebo deloyed in přidej pouze tento node do sezanmu na existující vazbě. Při vytaženi prvku z kontejneru se zmačknutouk klavesou alt odstran tento prvek z vaby compose of nebo deployed in.
- v dialogu pro nastavení projektu umožni výběr adresařů u položek predstavujici adresaře u souboru umožni vyber souboru z disku
- umožnit použivat pattern  format z CALM CLI  pro generovani z  template a nabidnout patterny jako template v nabidce - !! pro genrovani použit voláni calm cli nebo import funkčnosti na urovni zdrojového kódu. Ne nová implementace !!
---
V8
- upravit layout kontejneru aby řadil vnitřni prvky do tabulky (radky a sloupce )  ne jen do jednoho směru . Rozmer tabuky nasatavit tak aby vysledek se bližil čtverci   (stehná šiřka a výška)
- u kontejneru odtranit max velikst pro vizualni čast tak aby pri zvetšeni hranic pro editaci se zvetšil i vizulani nahled na kontejner. Aktualne muže byt  velikost dle  layout manageru vetší než je velikost gravické reprezentace.
- umožnit uložení layoutu (rozložení prvku) a tento uložený layout pri znovu otevření použít. inspirace pro foramt jak uložit layout hledejj calm-hub a calm-vsplugin . idelane taka aby byl schodný a layout se přenesel do calm hub a calm vs pluginu. Zahrn i možnost nastavení barev  uzloženi pozice viz:

``` 
 "metadata": {
    "_layout": {
      "slp.appcomp-slp": {
        "x": 2127,
        "y": -785,
        "w": 250,
        "h": 60 }}}
```
uloženi barev :

```
"building-block-style": {
"background": "#a9e22c",
"text": "#6a2216"
}
```
- uprav line style pro relation na bezier
- rozsirit validaci dle patternů pomoci  calm cli
- v konfiguraci umožnit editaci sekce naming a patterns  
V8.1
- umožnit načtené patternů z nakofigurovaneho calm-hub bud v konfiguraci projektu  bude obsahovat url calm hubu nebo v .calm.json v home adresaři uživatele viz konfigurace CALM-cli jednotlive name space se zobrazi jako založky v nabidce patternů 
- umožnit referencování a prochazení elemetů a digramu z calm-hub 
V8.2
- umožnit vizualizaci patternu pro calm cli stejně jako to děla calm-hub 
- umožnit grafickou editaci calm-cli pattern
- genericka editace metadat pro node i relation
- nalezena chyba editace se nekdy zasekne po editaci s ctrl a vytvoření kopie elementu 

V9
- extenzion do samostatné definice pro každou extenzion. Požadavek je aby se definice dala použit napřič spektrem tools jako je CALM-hub a calm plugin pro visual studio a calm-cli. Umožnit načist definici externě ze souboru.

V10
- editace adresářove struktury
  - založeni nového adresaře idealně dle patternu  v nastaveni
  - přesun adresářu včetně podlsožek a souboru v nich
  - práce s adresářem jako kontextové menu na uzlu pod kurzorem (Right-click). Do menu přidat aktivity se složkou (Nová složka, Nový soubor, Přesun).
  - Nový soubor: dialog se rovnou zeptá na jméno; zapíše prázdnou CALM architekturu do složky uzlu a otevře ji v záložce. File → New (Untitled) zůstává.
- pri uloženi s výberem uloženi nabidnout jako adresař vybraný ve stromu a nazev predviplnit  dle patternu z projektu
- umožnit uložení projektové konfigurace do home adrersaře uživatele. Pri načítani vzit user adresařa a pretižit ho projektovou verzi.
- editaci konfigurace rozložit do založek po jednotlivých blocích konfigurace 
- editace metadat:
  - Jeli prvek ve schematu definovan jako enum nabizet hodnoty dle schematu jako drobdown box.
  - umožnit editaci i vnořených json elementu jako strom edit boxů dle struktury json. Tuto editaci udělat jako samostatný dialog window. V panelu jen nahled bez editace. Pro jednotlive prvky plati stejný mechaniznus z predchozího bodu.
- umožnit označit vice prku pomoci schift. Držim-li Schift  vybíram jednotlivé prvky kliknutím na prvek.  Prvky lze vybrat i pomocí myši .Pri kliknuti ataženi myši se vyberou prvky ve čteverci mezi začátkem tažení a ukočením taženi.. ctverec a vybítrané prvky jsou behem taženi vizualizovány. U prvku ve skupině je povoleno jen posouvaní po platně a ovladni zarovnani  do rady (na horni a spodni  hranu a do osy), do sloupce ( na predni a  zadni hranu a do osy) , do tabulky ( layout kontejneru), stejen mezery v řade nebo sloupci, Stejná šířka , Stejná výška, Stejná šířka a výška
- přepínání funkce levého tlačítka myši mezi posunem plátna (Pan) a výběrem (Select). Výchozí Select. Space drží dočasný Pan. Na Hub / read-only záložkách jen Pan.
- miniatura plátna zobrazující aktuální výřez. Kliknutím na miniaturu se aktuální výřez posune na pozici kliknutí (zoom beze změny).
- u kontejneru přidat volbu usdpořádat do tabulky. Stejně jako při difaultnim vykreslení nebo s volbou počtu řadku a sloupců. Volba zmeni i velikost kontejneru aby se prvky vešli 
- umožnit v konfiguraci vypnout buildin extenzion 
- otevirat diagramy z reference na calm-hub v "detailed-architecture" 
- neumožnit na read-only digramy vkladat prvky z calm-hub a UZAMKNOUT EDITACI JSON.
- editory unichž zdroj  pochazejici z calm-hub otervírat jako readonly
- pro nalezení lokace artefaktu dle URL použít soubor `url-mapping.json` (stejný formát jako CALM CLI `-u` / CEngineering-App); umístění souboru definovat v konfiguraci projektu
- 
V11
- upravit vybíráni skupiny nodu takto: zmačknu schift a buď táhnu a vybiram přes vyber čtvercem nebo klikam na jednotlive nody bez schit pri zmačknutem schift se nody vždy přidávaji do výběru. bez zmacknuteho schiftu je chovani normálni viz aktulni mod pan. Tento mechanizmus nahradí prepinani fukce kurzoru select/pan a jemožne tento prepínač odstranit
- prochánzeni hubu a přidávani elementu z hub udělaj obdobně jako panel files. Tj umísti ho vedle pallete a files jako založku hub. Obsah hubu vzkresli jako strom. Pri iniciaci načti jen uroven namespace. Další uzly načitej postupně pri rozkliknutí. Obdobně jako v dialogu.Pridavani elementu do aktualniho diagramu bude pretaženim tak jako u files.
- přesouvani souboru ve stromě files. Umožnit přesouvat i jednotlivé soubory v ramci stromu adresářů. Při přesunu je potřeba upravit reference v ostatníh souborech.
- vizualizace relations tak aby použivala přimou nejkratší cestu. Neobchazet kontejner,ve kterem je alespon jeden node z relace.  
- používat relativni cesty v detailed-architecture od aktualniho souboru. Pri presunu souboru v obou přtipadech, samostnýu soubor i presun adresáře, tyto cesty aktualizovat tak aby bila zachována reference na ciílový soubor. 
- editace json nesmi zničit layout 
- undo/redo na úpravy nad canvasem
V12
- Pri vkladání již referencovaneho elementu použit originalni hodnotu detailed-architecture. ne odkaz na soubor zh nejž se vkladá. Tj  vždz vkladat odkaz na soubor v němž je nod skutečne definován ne jen referencován. tj tam kde neni definovan element detailed-architecture.
- u target v move dialogu nabízet výber cile ze stromu projektu
V13
- odstraň / skryj toolbar Demo; po načtení projektu skryj vestavěné template záložky FluxNova a OpenGRIS. Default `ui.demo: false` v `.calmrj`. Zapnutí Demo v Project settings ukáže obojí. Bez otevřeného projektu zůstane Demo UI viditelné. Netýká se Palette packů.
V14
- nahraď export do calmscript exportem diagramu v Mermaid notaci (`flowchart`); nabídni `.mmd` i `.md` (fenced blok). Odstraň disabled záložku calmscript vedle CALM JSON; místo ní read-only záložka Mermaid. Bez importu Mermaid→CALM. Balíček `packages/calmscript` nemaž.
V15
- properties editor: needitovat pole (array) jako jeden záznam — editace jednotlivých prvků (primitiva i objekty), inline seznam Add/Remove; prázdné pole ukáže Add. Vnořené JSON zobrazovat jako formátovaný (pretty) víceřádkový text v náhledu i v Edit dialogu. Platí pro metadata / customMetadata (JSON) / controls-interfaces dle výskytu polí.
V16
- doplnit práci s adr. V založce properties pro celý diagram zobrazovat seznam ADR ze souboru s možností dané adr Zobrazit mo6nost pridat ADR z HUBU nebo jako referenci na lokalni soubor pomoci relativni cesty. Obojí se bude vybírat pomocí dialogu. Jeli toto ADR jako MD soubor zobrait v samostatne založce jako readonly peview. 
- počet současne otevřenbých editoru dat do konfigurace
- dotaz na uloženi editoru jen pri zavirani nikoli pri opuštení editoru (prepnuti na jiný tab nebo otevření nového tabu)
- u elementu ve stromu pri najeti zobrazit plný nazev jako tooltip
- doplnit horizobtalní scroolbar do založky files a hub.
- opravit modifikaci velikosti editoru tak abi pri taženi splitru mezi editorme a levým panelem menila velikost panelu a editoru a nedochazelo k modifikaci panelu properties  a pri taženi splitru mezi editorem a propertie dochazelo k modifikaci editrou a panelu properties  a ne panelu v levo.Aktualně sliter mezi propertis a editorem meni velikost panelu vlevo a obraceně.
- všechny tabulky budou mít:
  -- Modifikovatelnou šiřku sloupcu v tabulkach aplikuj na všechny tabulky. 
  -- po najetiu na bunku se jako tooltip zobrazí celá hodnota v bunce.
  -- budou mit hlavičku s popisem sloupce. Nad tou to halvičkou bude možnost menit taženim hrany velikost sloupce. zmena nemeni velist cele tabulyk pouze meni velikost sloupcu prilehajících k hraně, která je tažena. 
- dialog pro Find neighbors udělej s možností zmeny velkosti  
- doplni tdo buildu všecny calm core schemata tak aby se tyto schemata netahala online.
V17
- doplnit podporu pro hodnoty z metadat pro vazbu  " "line-style": "dotted",
        "routing": "smoothstep":  stejen jako je to v pluginu pro vscode calm canvas umožni pro tyto hodnotry nastavit default value v extenzion a navic pdoporovat obarveni "line-color": "#a9e22c",
"text-color": "#6a2216".  Routing enum values Curve,Elbow,Straight. Line-style enum values Solid,Dashed,Dotted. A umožnit nastaveni zobrazeni decription vazby. Default bude definovat extenzion. 
- podpora custmon vazeb. takové vazby se  nesmi ztracet  i s nedefinovanou  realtions type. Vazba se musi vykreslit  odpovidáli strukturou vazbě typu options. graficky reprezentace custom vazby muže byt definovana v extenzion pack. stenej tak je potřeba tyto vazby nabýzet comboboxu typ vazby dle schematu a aktivnich extenzions. 
V18

Strom souborů se po práci mimo editor (jiný program, git) a po přesunu sám neaktualizuje. Obnova stromu nesmí ztratit místo, kde uživatel je. Nová vazba se do JSON zapíše se stejným `unique-id` `xy-edge` (id z plátna se ořízne na `__`). Změna typu vazby se do `relationship-type` nepropíše. Alt+tažení z V7 nevytvoří `composed-of`. Metadata nemají jeden dialog pro celý objekt podle schématu.

**Strom — Files i Hub**
- Tlačítko Obnovit na záložce Files i Hub. Obnovení znovu načte obsah stromu (Files z disku, Hub znovu načte rozbalené úrovně).
- Po obnovení zůstane scroll, sada rozbalených uzlů a vybraný uzel. Uzel, který na zdroji už není, se nevybere znovu.
- Obnovení nemění neuložený obsah otevřené záložky.

**Sledování souborů projektu**
- Editor sleduje změny souborů v otevřené složce projektu a aktualizuje strom Files.
- Záložka bez neuložených úprav, jejíž soubor se na disku změnil, se načte z disku.
- Záložka s neuloženými úpravami se sama nepřepisuje. Dialog: **Načíst z disku** nebo **Ponechat moje úpravy**.
- Hub se na pozadí nesleduje. Obnoví ho jen tlačítko Obnovit.

**Přesun tažením**
- Tažení souboru i složky ve Files se před provedením zeptá. Dialog ukáže zdrojovou a cílovou cestu.
- Zrušení dialogu nic nepřesune a reference nezmění.
- Po potvrzení je po dobu přesunu blokující hláška, že přesun probíhá. Po dokončení platí V11: strom, relativní `detailed-architecture` a reference v ostatních souborech se přepíší.
- Samotné tažení uzlu na plátně dialog nepřidává.

**Vazby**
- Nová vazba nedostane `unique-id` `xy-edge` ani jiné id odvozené z id plátna.
- Základ id je slug stejným pravidlem jako `{{name}}` u nového souboru (`normalizeSlug`): `{zdroj}-{typ}-{cíl}`. `naming.patterns` zůstává šablona cesty souboru, ne id vazby.
- Id musí být v daném dokumentu jediné. Když základ už existuje, na konec se přidá `-2`, `-3`, … (první volné).
- Už uložené duplicitní `xy-edge` se při otevření samy nepřejmenují.
- Combobox typu v properties a kontextové menu na plátně udělají totéž: `relationship-type` v JSON odpovídá zvolenému typu a kresba se změní ve stejném kroku (čára vs. kontejner).
- Stejný krok přepíše metadata, která patří k typu vazby, na hodnoty nového typu. Jde o `defaults.metadata` z aktivní extenze (včetně `line-style`, `routing`, `line-color`, `text-color`, `description-display`) a o značku typu v metadata (např. `archimate.relationship`, `calm-core-variant`). Klíče vázané jen na předchozí typ, které nový typ nemá, se smažou. Ostatní metadata a `description` zůstanou.
- Do nového `relationship-type` se nezapíše tvar, který zvolený typ nemá (např. `protocol` nebo seznam členů u `connects`).
- Alt+tažení platí podle V7. Oprava: vazba se vytvoří a zapíše do JSON (první vazba na kontejner otevře výběr `composed-of` / `deployed-in`, další prvek se přidá k existující vazbě, vytažení s Alt prvek z vazby odebere).

**Metadata**
- V properties uzlu i vazby je jeden dialog pro celý objekt `metadata`.
- Pole dialogu se sestaví ze schématu prvku: enum jako výběr, vnořený objekt jako vnořená pole, pole jako seznam Add/Remove (V15).
- Dialog nesahá na klíče, které ve schématu nejsou. Dnešní dialogy po skupinách zůstávají.

**Mimo V18**
- Přejmenování už uložených `xy-edge` a hromadná oprava duplicit.
- Sledování Hubu a vzdálených souborů.
- Potvrzení při posunu prvku na plátně.
- Mazání dialogů metadat po skupinách a nový volný JSON editor pro klíče mimo schéma.

V19
- Najetí myší na nakreslenou vazbu v editoru ji zvýrazní výrazně modrým rozplývajícím se stínem. Stejný stín dostanou oba uzly na koncích té čáry.
- Světlo zmizí, jakmile kurzor čáru opustí. Výběr, barva čáry a dokument se nemění.
- Vazba `options` nakreslená jako víc čar zvýrazní jen čáru pod kurzorem a její dva konce.
- Skrytá containment vazba nemá čáru, na kterou jde najet, takže se nezvýrazní.

V20
- V paletě je pod komponentami sekce Relationships. Typy vazeb jsou rozdělené podle zapnutých extenzí, stejně jako komponenty. Extenze bez vazeb se nezobrazí.
- Klik na typ ho vybere pro zbytek relace. Nadpis sekce ukazuje jeho název. Dokud uživatel nic nevybere, tažení kreslí `connects`.
- Další vazba tažením z uzlu na uzel vznikne podle vybraného typu: varianta CALM, uložená `defaults.metadata` a styl i barva čáry z typu. Styl a barva se do souboru nezapíšou.
- Výběr `composed-of` nebo `deployed-in` uzel vnoří a čáru skryje. Alt+tažení se tímto výběrem nemění.
- Po uložení a znovuotevření zůstane typ v comboboxu, když je v metadatech značka `metadata.<extenze>.relationship`.

Vxx - neimplementovat
- použivat  namessapce v detailed-architecture. Namespace pro projekt umisti do konfigurace.Pro namespace root adresař je v konfiguraci. Adreasře v tomto rootu už odpovifdajicestev namespace. Artefakty z tohoto namespace prekladej na lokálni soubory projektu. Priklad mapovani namesapce na adresařovou strukturu ns: https://architecture.creditas.cz/ je mapovana na adresař : v projekt architecture-model tj vysledná namespace pro soubor architecture-model/onebank/components-ext/test.architecture.json je https://architecture.creditas.cz/onebank/components-ext/test.architecture.json
```
## fix
```

- pri editaci JSON  dochází k opakovanému selektu celého editovaného elementu , element je vybrán v  designeru 
- pri editaci JSON přeskakováni kurzoru na začatek neni li vybrán eleemnt
- opravit exporty neexportuji se vazby pouze kontejnery bez relations oba formáty
- při změne na kontejenr opravit velikost prvku na schodny s vizualizaci prvku kontejenr je menši než jeho vzzualizace nody se do něj nevejdou

