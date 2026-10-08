# CalmStudio — instalace na Macu (bez admin práv)

Přenosný balíček. **Nevyžaduje** administrátorská práva, Docker, Node.js ani instalaci do `/Applications` celého počítače.

## Požadavky

| Položka | Poznámka |
| --- | --- |
| macOS 12 nebo novější | Apple Silicon i Intel |
| Python 3 | stačí standardní knihovna; často přes Command Line Tools |
| Microsoft Edge **nebo** Google Chrome | pro okno aplikace (`--app`) |
| Port `17890` volný | lze změnit |

**Není potřeba:** admin, Docker, Rust, Xcode (kromě volitelných Command Line Tools kvůli `python3`), Node.js, internet (po zkopírování balíčku).

Když `python3` chybí, v Terminálu jednou spusťte `xcode-select --install` a potvrďte instalaci nástrojů.

## Instalace (3 kroky)

1. Rozbalte `CalmStudio-portable-mac.zip` a celou složku zkopírujte na Mac  
   doporučené umístění (uživatelský profil, bez admin):
   - `~/Applications/CalmStudio-portable-mac`
   - nebo `~/Apps/CalmStudio-portable-mac`
2. Ve složce spusťte **`Install-Shortcut.command`** (vytvoří zástupce na ploše a ve `~/Applications`).
3. Spusťte **`CalmStudio.app`** nebo **`Start-CalmStudio.command`**.

Otevře se samostatné okno (Edge/Chrome app mode) na adrese  
`http://127.0.0.1:17890/`.

Když macOS soubor zablokuje (Gatekeeper), klikněte pravým tlačítkem → **Otevřít**. Jednorázově lze sejmout značku stažení:

```bash
xattr -dr com.apple.quarantine .
chmod +x Start-CalmStudio.command Stop-CalmStudio.command Install-Shortcut.command
chmod +x CalmStudio.app/Contents/MacOS/CalmStudio scripts/*.sh
```

`chmod` je potřeba, když rozbalení nezachovalo spustitelnost (typicky kopírování přes Windows).

## Běžné použití

| Akce | Soubor |
| --- | --- |
| Spustit | `CalmStudio.app` nebo `Start-CalmStudio.command` |
| Zastavit server | `Stop-CalmStudio.command` |
| Zástupce | `Install-Shortcut.command` |

Jiný port (když je 17890 obsazený):

```bash
./Start-CalmStudio.command --port 18000
```

## Práce s projekty CALM

CalmStudio běží jako webová SPA. Otevření projektu používá **File System Access API** prohlížeče:

1. V aplikaci zvolte **Open folder…**
2. Vyberte složku s architekturou (např. s `*.calmrj`)
3. Prohlížeč si vyžádá oprávnění ke čtení/zápisu — povolte je

Soubory zůstávají na disku uživatele; balíček je neukládá do sebe.

Doporučený prohlížeč: **Chrome** nebo **Edge** (aktuální verze).

## Odinstalace

1. Spusťte `Stop-CalmStudio.command`
2. Smažte složku `CalmStudio-portable-mac`
3. Smažte zástupce z plochy a z `~/Applications/CalmStudio.app` (jsou to odkazy)
4. Volitelně smažte lokální data:
   - `~/Library/Application Support/CalmStudio/` (PID soubory, log, profil prohlížeče)

## Obsah balíčku

```
CalmStudio-portable-mac/
  CalmStudio.app           ← spuštění dvojklikem
  Start-CalmStudio.command ← spuštění z Terminálu / Finderu
  Stop-CalmStudio.command  ← zastavení
  Install-Shortcut.command ← zástupce
  INSTALLACE.md            ← tento návod
  CalmStudio.icns
  app/                     ← statická aplikace (SPA)
  scripts/                 ← lokální HTTP server + pomocné skripty
```

## Bezpečnost a síť

- Server poslouchá **jen** na `127.0.0.1` (localhost), ne na síti.
- Žádný launch daemon se neregistruje.
- Žádné změny mimo uživatelský profil.

## Známá omezení

- Nativní instalátor Tauri (`.dmg`) na některých firemních Macích nejde použít. Tento přenosný balíček je náhrada bez admin práv.
- macOS nemá PowerShell jako Windows. Server je proto malý skript v Pythonu 3 (součást Command Line Tools nebo python.org).
- Pokud IT blokuje i lokální server, požádejte o výjimku pro `python3` na localhost, nebo použijte firemní Docker image CalmStudio.

## Rychlá kontrola po instalaci

1. `Start-CalmStudio.command` → otevře se okno aplikace  
2. V okně je vidět CalmStudio UI  
3. `Stop-CalmStudio.command` → proces skončí, port se uvolní  

## Verze

Viz soubor `VERSION.txt` v kořeni balíčku.
