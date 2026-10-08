# CalmStudio — instalace na samostatném PC (bez admin práv)

Přenosný balíček. **Nevyžaduje** administrátorská práva, Docker, Node.js ani instalaci do Program Files.

## Požadavky

| Položka | Poznámka |
| --- | --- |
| Windows 10 / 11 | 64bit |
| PowerShell 5.1+ | součást Windows |
| Microsoft Edge **nebo** Google Chrome | pro okno aplikace (`--app`) |
| Port `17890` volný | lze změnit |

**Není potřeba:** admin, Docker, Rust, Visual Studio, Node.js, internet (po zkopírování balíčku).

## Instalace (3 kroky)

1. Zkopírujte celou složku `CalmStudio-portable` na cílové PC  
   doporučené umístění (uživatelský profil, bez admin):
   - `%LOCALAPPDATA%\CalmStudio-portable`  
   - nebo `C:\Users\<vas_ucet>\Apps\CalmStudio-portable`
2. Ve složce spusťte **`Install-Shortcut.cmd`** (vytvoří zástupce na ploše a v nabídce Start).
3. Spusťte **`Start-CalmStudio.cmd`** nebo zástupce **CalmStudio**.

Otevře se samostatné okno (Edge/Chrome app mode) na adrese  
`http://127.0.0.1:17890/`.

## Běžné použití

| Akce | Soubor |
| --- | --- |
| Spustit | `Start-CalmStudio.cmd` |
| Zastavit server | `Stop-CalmStudio.cmd` |
| Zástupce | `Install-Shortcut.cmd` |

Jiný port (když je 17890 obsazený):

```powershell
powershell -ExecutionPolicy Bypass -File .\Start-CalmStudio.ps1 -Port 18000
```

## Práce s projekty CALM

CalmStudio běží jako webová SPA. Otevření projektu používá **File System Access API** prohlížeče:

1. V aplikaci zvolte **Open folder…**
2. Vyberte složku s architekturou (např. s `*.calmrj`)
3. Prohlížeč si vyžádá oprávnění ke čtení/zápisu — povolte je

Soubory zůstávají na disku uživatele; balíček je neukládá do sebe.

Doporučený prohlížeč: **Chrome** nebo **Edge** (aktuální verze). Firefox File System Access nepodporuje stejně.

## Odinstalace

1. Spusťte `Stop-CalmStudio.cmd`
2. Smažte složku `CalmStudio-portable`
3. Smažte zástupce z plochy / nabídky Start
4. Volitelně smažte lokální data:
   - `%LOCALAPPDATA%\CalmStudio\` (PID soubory, profil prohlížeče)

## Obsah balíčku

```
CalmStudio-portable/
  Start-CalmStudio.cmd     ← spuštění
  Stop-CalmStudio.cmd      ← zastavení
  Install-Shortcut.cmd     ← zástupce
  INSTALLACE.md            ← tento návod
  CalmStudio.ico
  app/                     ← statická aplikace (SPA)
  scripts/                 ← lokální HTTP server + pomocné skripty
```

## Bezpečnost a síť

- Server poslouchá **jen** na `127.0.0.1` (localhost), ne na síti.
- Žádná služba Windows se neregistruje.
- Žádné změny registru ani systémových cest.

## Známá omezení

- Nativní instalátor Tauri (`.msi`) na některých firemních PC nejde sestavit kvůli Application Control (WDAC). Tento přenosný balíček je náhrada bez admin práv.
- První spuštění PowerShell může Windows SmartScreen / zásady ExecutionPolicy omezit. Skripty spouštějte přes přiložené `.cmd` (používají `-ExecutionPolicy Bypass` jen pro tyto skripty).
- Pokud IT blokuje i lokální `HttpListener`, požádejte o výjimku pro PowerShell na localhost, nebo použijte firemní Docker image CalmStudio.

## Rychlá kontrola po instalaci

1. `Start-CalmStudio.cmd` → otevře se okno aplikace  
2. V okně je vidět CalmStudio UI  
3. `Stop-CalmStudio.cmd` → okno serveru zmizí, port se uvolní  

## Verze

Viz soubor `VERSION.txt` v kořeni balíčku.
