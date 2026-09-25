# Einbau in Revyme

Beide Dateien sind fertige Revyme Code Components (nur React, keine weiteren Pakete).

1. Revyme → neue Code Component anlegen, Namen exakt übernehmen:
   - `RiverScene` → Inhalt von `RiverScene.tsx` komplett einfügen
   - `RiverFlowBackground` → Inhalt von `RiverFlowBackground.tsx` komplett einfügen
   (Ablage im Projekt: `components/RiverScene.tsx`, `components/RiverFlowBackground.tsx`)
2. RiverScene: als eigene Sektion platzieren. Modus „Scroll (eigene Höhe)“ (Standard), „Scroll (Eltern-Sektion)“ oder „Autoplay“.
   Schrift „RPM Aglet Sans“ im Projekt hinterlegen (sonst Arial).
3. RiverFlowBackground: in eine Sektion legen, Position absolut, links/oben 0, Breite/Höhe 100 %, hinter den Inhalt.
   Thema „Hell“ für Ivory-Sektionen, „Dunkel“ für Deep-Rhine-Sektionen.

Hinweis: Keine Funktion `animate(`, `hover(` oder `press(` nennen – Revyme importiert sonst framer-motion (Namenskollision).
