# Projektstruktur-Notizen

## Aktueller Stand
- Das Projekt ist ein Expo/React Native-App-Projekt mit React Navigation, Zustand und AsyncStorage.
- Es gibt aktuell keine echte Datenbank-Schicht wie SQLite, Supabase, Firebase oder Prisma.
- Die Persistenz wird über Zustand-Persistenz mit AsyncStorage umgesetzt.

## Wichtige Verbesserungen
1. Persistenz-Logik zentralisiert in src/lib/storage.ts.
2. Stores verwenden nun denselben Persistenz-Helper.
3. Die App ist sauberer vorbereitet für spätere Backend-/Datenbank-Erweiterungen.

## Nächste sinnvolle Schritte
- Backend/API-Schicht einführen, falls echte Nutzer- und Lernfortschrittssynchronisierung gewünscht ist.
- Große Daten-Dateien wie src/data/lessons.ts in kleinere Module aufteilen.
- Tests ergänzen und die Datenstruktur weiter abstrahieren.
