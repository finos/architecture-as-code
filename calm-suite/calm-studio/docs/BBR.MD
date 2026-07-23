# CALM-studio 
    ## business  requirments
- 
- doplnit extenzin o definici schamatu pro jednoptlivé elementy tuto definici přidat do halvičky json soboru při přidání prvního  elementu z dané palety
- doplnit u přidávaného elementu a relation  requred elementy podle schématu přidávaného nodu viz predchozi bod 
- pridat control na prehozeni směru vazby SOURCE - DESTINATION v panelu properties 
- Přidat panel pro procazení zvolené složky. Do panelu vložit všechny json souboru ve stromove struktuře složek. U Souboru obsahujici definic CALM přida pod sooubor seznam nodu jako popisek použit atribut name a iconu dle node-type. Sobor bude možné dvoj klikem vybarat a editovat, pro aktualni soubor bude uživatel vyzván k uložení. Pri editaci bude možne nody zobrazen v souboru přidat přetažením do aktuálniho diagramu jako referenci   
v1
--------
- upravit editor tak že nové diagramy budou oteviráby do založek. Okno json editoru se bude chovat  tak že vždy bude zobrazovat  json pro diagram z aktulani záložky diagramu. Pri zavirani založky bude dialog pro uloženi diagramu. Maximalní počet založek nastav na 10 dojdeli k prekročení počtu založek dojde k uzavření nejstarší založky , pri zavirani bude dialog na uložení jsouli v diagramu změny.
- nod který ma odkaz na detail doplnit ikonku brýli pro zvíraznění informace že se jedná o referencovaný element. Pri dvoj kliku na ikonz brýly dojde k otevření referencovaného diagramu.  
V2
--------
- doplnit properties editor o editaci metadata a zajistit že se do nověho elentu doplni všechyn elemnty metadat predepsané validaci a schmetem.
- zamezit v properties editaci pro odkazované elementy maji details elemnet
- 
-------
V3
- přidat tlačitko do files pro vyhledáí aktuálně otevřeného souboru ve stromu souborů
- při uloženi souboru aktualizovat seznam nodu v adresařové struktuře v založce files.
- pri tažení nodu  s ctrl udělat kopii nodu s novým unique-id a názvem  a na dotaz zduplikovat i vazby. Dialog pro zadání názvu a check box na duplikaci vazeb bude modálni a check box si bude pamatvat posledni stav. DEfault check boxu je nezškrtnuto tudiž se vazby neduplikuji i nanaový element. Vazby se duplikuji vraci daneho souboru ne dál.
- po přechodu na detailový diagram  dat  fokus  referencovany node 
- upravit layout tak aby nedocházelo k prekryvu boxu po jejich roztažení na zakaldě textu a relation se vyhibaly boxum 
------
V4
- umožnit ve složce definici validačnich pravidel doplnujici standartní pravidla.
- vyber pravidel zaznamenj do kořenove složky do souboru s koncovkou CALMPRJ do tohoto souboru nasledne budem ukládat dalši konfigurace souvisejici s diagramy ve složce
- v konfiguraci projektu bude i definice struktury adresářu a jmená konvence, která se uplatni pri přechodu v nasledujicím bodu nastaveni vzchazi z CEngineering-App\docs\naming-conventions.md 
- umožnit převest  nod z diagramu na samosatný diagram.  Nod v aktualnim diagramu  nahradit za referenci na nod v novém  diagramu. Název souboru  s diagramem vytvoř dle definice v konfigiuraci. Včetně patřičné složky jeli v konfiguraci definovana.  Název složky a souboru nech potvrdit pripadně upravit  uživatele pomoci dialogu. Hodnoty z konfigurace nastav jako default. 

----

    ## fix
- pri editaci JSON  dochází k opakovanému selektu celého editovaného elementu , element je vybrán v  designeru 
- pri editaci JSON přeskakováni kurzoru na začatek neni li vybrán eleemnt
- opravit exporty neexportuji se vazby pouze kontejnery bez relations oba formáty
- při změne na kontejenr opravit velikost prvku na schodny s vizualizaci prvku kontejenr je menši než jeho vzzualizace nody se do něj nevejdou 
