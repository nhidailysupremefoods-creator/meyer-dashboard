# Apps Script Backend – Deployment

## 1. Neues Apps Script Projekt erstellen

1. Gehe zu [script.google.com](https://script.google.com) (eingeloggt als `gregory@meyerdecision.com`)
2. Klicke **Neues Projekt**
3. Benenne es: `Meyer Decision Internal OS`
4. Lösche den Inhalt von `Code.gs` und ersetze ihn mit dem Inhalt aus `Code.gs` in diesem Ordner

## 2. Drive API aktivieren

1. Im Apps Script Editor → **Services** (linke Sidebar, "+"-Button)
2. Suche nach **Drive API** → Hinzufügen
3. Dies wird für die .docx → PDF Konvertierung benötigt

## 3. Script Property setzen

1. **Projekteinstellungen** (Zahnrad-Icon)
2. **Skripteigenschaften** → Eigenschaft hinzufügen:
   - Eigenschaft: `DRIVE_FOLDER_ID`
   - Wert: `1kmVU2amSfn6JwTtVZfmqpV-VA7CPe0Rg`

## 4. Als Web-App deployen

1. **Deploy** → **Neue Bereitstellung**
2. Typ: **Web-App**
3. Beschreibung: `Internal OS v1`
4. Ausführen als: **Ich** (gregory@meyerdecision.com)
5. Zugriff: **Jeder** (damit die Vercel-App darauf zugreifen kann)
6. Klicke **Bereitstellen**
7. **Wichtig:** Kopiere die Web-App-URL (sieht so aus: `https://script.google.com/macros/s/AKfycb.../exec`)

## 5. Berechtigungen autorisieren

Beim ersten Aufruf wirst du nach Berechtigungen gefragt:
- Gmail (zum Senden von E-Mails)
- Drive (zum Lesen der Vorlagen)

→ Bestätige alle Berechtigungen

## 6. URL in Vercel setzen

1. Gehe zu [vercel.com](https://vercel.com) → Projekt `meyer-dashboard`
2. **Settings** → **Environment Variables**
3. Füge hinzu:
   - Name: `NEXT_PUBLIC_APPS_SCRIPT_URL`
   - Value: [die kopierte Web-App-URL]
   - Environment: Production, Preview, Development
4. **Redeploy** triggern (Settings → Deployments → Redeploy)

## 7. Testen

Nach dem Redeploy auf `meyer-dashboard.vercel.app/internal`:
1. Gehe zur **Operations**-Seite
2. Klicke bei einem Kunden auf **Vorbereiten**
3. Die Vorschau sollte jetzt echte Anhang-Infos aus Drive zeigen
4. Die gelbe "Backend nicht verbunden"-Meldung sollte verschwunden sein
5. **Jetzt senden** verschickt die E-Mail mit echten PDF-Anhängen

## Fehlerbehebung

- **"Backend nicht verbunden"**: URL in Vercel nicht gesetzt oder Redeploy fehlt
- **CORS-Fehler**: Apps Script Web-Apps haben kein CORS-Problem bei POST-Requests
- **Berechtigungsfehler**: Nochmal unter Deploy → Bereitstellungen verwalten → Autorisieren
- **Drive-Fehler**: Prüfe ob der Drive-Ordner für gregory@meyerdecision.com zugänglich ist
