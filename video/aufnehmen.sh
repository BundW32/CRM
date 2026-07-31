#!/usr/bin/env bash
# Ein Durchlauf: Demo-Zustand herrichten, alle Szenen aufnehmen, schneiden.
# Die App muss bereits laufen (npx next start -p 3000 — NICHT next dev).
set -euo pipefail
cd "$(dirname "$0")/.."

PSQL="PGPASSWORD=postgres psql -h 127.0.0.1 -U postgres -d portal -t -q"
db() { eval "$PSQL -c \"\$1\"" > /dev/null; }

echo "→ Demo-Zustand: selbstverwaltete Organisation"
db "update \\\"Organization\\\" set \\\"accountType\\\"='selbstverwalter';"
# Das Bestätigungsbanner der E-Mail stört im Bild.
db "update \\\"User\\\" set \\\"emailVerifiedAt\\\"=now() where \\\"emailVerifiedAt\\\" is null;"

# IDs für die Deep-Links der Szenen.
export WEG_PROPERTY_ID=$(eval "$PSQL -c \"select id from \\\"Property\\\" where \\\"managementType\\\"='WEG' limit 1;\"" | tr -d ' \n')
export WEG_PLAN_ID=$(eval "$PSQL -c \"select id from \\\"EconomicPlan\\\" order by year desc limit 1;\"" | tr -d ' \n')
export WEG_MEETING_ID=$(eval "$PSQL -c \"select id from \\\"OwnersMeeting\\\" order by \\\"scheduledAt\\\" desc limit 1;\"" | tr -d ' \n')
echo "  Objekt=$WEG_PROPERTY_ID Plan=$WEG_PLAN_ID Versammlung=$WEG_MEETING_ID"

SETUP_DONE="insert into \\\"WegSetupStep\\\" (id,\\\"propertyId\\\",key,\\\"doneAt\\\",\\\"doneById\\\")
  select 'stp_'||k, p.id, k, now(), u.id from \\\"Property\\\" p, \\\"User\\\" u,
  (values('unterlagen'),('konto'),('bestellung')) as t(k)
  where p.\\\"managementType\\\"='WEG' and u.email='admin@bundwimmobilien.de'
  on conflict do nothing;"

echo "→ Aufnahme-Patch für den Assistenten einspielen"
git apply video/patches/assistant-demo.patch 2>/dev/null || echo "  (schon eingespielt)"
trap 'git checkout portal/src/lib/assistant.ts 2>/dev/null || true' EXIT

cd video
export PLAYWRIGHT_BROWSERS_PATH="$PWD/pw"

# Die Einrichtung ist erledigt → die Übersicht zeigt den Jahresfahrplan.
echo "→ Szenen mit fertiger Einrichtung"
cd .. && db "$SETUP_DONE" && cd video
for s in hook fahrplan wirtschaftsplan hausgeld versammlung ki cta; do
  rm -rf out/raw/*-"$s"
  node record.js "$s"
done

# Für die eine Szene, die den geführten Erststart zeigt, muss die Einrichtung
# unvollständig sein. Danach sofort zurückstellen.
echo "→ Erststart-Szene mit unvollständiger Einrichtung"
cd .. && db "delete from \\\"WegSetupStep\\\";" && cd video
rm -rf out/raw/03-erststart
node record.js erststart
cd .. && db "$SETUP_DONE" && cd video

echo "→ Schnitt"
node compose.js
