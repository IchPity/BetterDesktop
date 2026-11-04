# Git- & GitHub-Regeln

## Grundsatz
- **Jede Änderung wird committet** – egal wie klein (Tippfehler, eine Zeile, Config-Tweak).
- Lieber viele kleine Commits als ein großer.
- **Standard-Branch ist `main`.** Die meisten Commits gehen direkt auf `main`.

## Wann ein eigener Branch?
Nur wenn eine Änderung **groß oder riskant** ist, z. B.:
- neues Feature über mehrere Dateien / mehrere Schritte
- Experiment, das evtl. wieder verworfen wird
- Umbau (Refactor), der zwischendurch Dinge kaputt machen kann

Alles andere → direkt auf `main`.

### Branch-Namen
| Präfix      | Wofür                         | Beispiel                 |
|-------------|-------------------------------|--------------------------|
| `feature/`  | neue Funktion                 | `feature/dark-mode`      |
| `fix/`      | größerer Bugfix               | `fix/startup-crash`      |
| `experiment/` | Ausprobieren, evtl. Wegwerfen | `experiment/new-layout` |
| `refactor/` | Umbau ohne neue Funktion      | `refactor/settings`      |

Kleinbuchstaben, Wörter mit `-` trennen.

### Branch zurück nach `main`
- Wenn fertig: in `main` mergen (`git merge --no-ff <branch>`), danach Branch löschen.
- Verworfene Experimente: Branch einfach löschen.
- Branches nicht ewig offen lassen.

## Commit-Nachrichten
Format: `<typ>: <kurze Beschreibung>` (Deutsch oder Englisch, aber einheitlich pro Commit)

| Typ        | Wofür                              |
|------------|------------------------------------|
| `feat`     | neue Funktion                      |
| `fix`      | Fehler behoben                     |
| `docs`     | Doku / README / diese Regeln       |
| `style`    | Formatierung, keine Logik-Änderung |
| `refactor` | Umbau ohne neues Verhalten         |
| `chore`    | Kleinkram: Config, Abhängigkeiten  |

Beispiele:
- `feat: Startbildschirm hinzugefügt`
- `fix: Absturz beim Speichern behoben`
- `docs: Git-Regeln angelegt`

## No-Gos
- Kein `git push --force` auf `main`.
- Keine Passwörter, API-Keys, `.env`-Dateien committen.
- Keine riesigen Binärdateien (Videos, Builds) ins Repo – dafür `.gitignore`.
