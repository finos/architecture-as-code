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
V2

---

- doplnit properties editor o editaci metadata a zajistit že se do nověho elentu doplni všechyn elemnty metadat predepsané validaci a schmetem.
- zamezit v properties editaci pro odkazované elementy maji details elemnet
- 

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
V7
- u vazeb compose of  a deployed in umožnit sloučeni vazeb na stejnem kontejneru do jedné a prislušne uprav i property tak aby umožnoval parci s vice nody v destination . 
- vytvařet vazbu compouse of a deloyed in pretaženim nódu spolu se zmačknutou klavesou alt na nod ze kterého se má stat kontejner.  jestli že se jedná o první vazbu nech vybrat typ vazby v pripadě že jsou  již vazby typu compose of nebo deloyed in přidej pouze tento node do sezanmu na existující vazbě. Při vytaženi prvku z kontejneru se zmačknutouk klavesou alt odstran tento prvek z vaby compose of nebo deployed in.
- v dialogu pro nastavení projektu umožni výběr adresařů u položek predstavujici adresaře u souboru umožni vyber souboru z disku
- umožnit použivat pattern  format z CALM CLI  pro generovani z  template a nabidnout patterny jako template v nabidce - !! pro genrovani použit voláni calm cli nebo import funkčnosti na urovni zdrojového kódu. Ne nová implementace !!
V8
- sjednotit layout diagramů s calm_hub
- extenzion do samostatné definice pro každou extenzion. Požadavek je aby se definice dala použit napřič spektrem tools jako je CALM-hub a calm plugin pro visual studio a calm-cli. Umožnit načist definici externě ze souboru.
```
## fix
```

- pri editaci JSON  dochází k opakovanému selektu celého editovaného elementu , element je vybrán v  designeru 
- pri editaci JSON přeskakováni kurzoru na začatek neni li vybrán eleemnt
- opravit exporty neexportuji se vazby pouze kontejnery bez relations oba formáty
- při změne na kontejenr opravit velikost prvku na schodny s vizualizaci prvku kontejenr je menši než jeho vzzualizace nody se do něj nevejdou

