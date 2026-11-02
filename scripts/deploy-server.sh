#!/bin/sh
set -eu
release="$1"
base=/home/deploy/suppliers
plov=/home/deploy/plov-bot
stamp=$(date -u +%Y%m%dT%H%M%SZ)
backup="$base/backups/$stamp"
mkdir -p "$backup"
cp "$plov/Caddyfile" "$backup/Caddyfile"
cp "$plov/docker-compose.yml" "$backup/docker-compose.yml"
readlink "$base/current" > "$backup/previous-release" || true
python3 - "$plov/Caddyfile" "$base/Caddyfile.next" <<'PY'
import pathlib,sys
text=pathlib.Path(sys.argv[1]).read_text()
if 'suppliers.178-236-242-240.sslip.io' not in text:
    text+='\nsuppliers.178-236-242-240.sslip.io {\n\tencode gzip zstd\n\troot * /srv/suppliers/current\n\tfile_server\n\theader {\n\t\tX-Content-Type-Options nosniff\n\t\tReferrer-Policy strict-origin-when-cross-origin\n\t\tContent-Security-Policy "default-src \'self\'; script-src \'self\'; style-src \'self\' https://fonts.googleapis.com; font-src https://fonts.gstatic.com; img-src \'self\' data:; connect-src \'self\'; frame-ancestors \'none\'; base-uri \'self\'; form-action \'self\'"\n\t}\n}\n'
marker='\troot * /srv/suppliers/current\n'
if marker in text and '\theader Cache-Control "no-cache"\n' not in text:
    text=text.replace(marker,marker+'\theader Cache-Control "no-cache"\n',1)
text=text.replace("font-src https://fonts.gstatic.com;", "font-src 'self' https://fonts.gstatic.com;")
pathlib.Path(sys.argv[2]).write_text(text)
PY
docker cp "$base/Caddyfile.next" plov-caddy:/tmp/suppliers-Caddyfile
docker exec plov-caddy caddy validate --config /tmp/suppliers-Caddyfile --adapter caddyfile
rollback() {
  echo 'Deployment failed. Restoring Caddy configuration.'
  cat "$backup/Caddyfile" > "$plov/Caddyfile"
  cp "$backup/docker-compose.yml" "$plov/docker-compose.yml"
  previous=$(cat "$backup/previous-release")
  if [ -n "$previous" ]; then ln -sfn "$previous" "$base/current"; fi
  (cd "$plov" && docker compose --profile web up -d --no-deps caddy)
}
trap rollback EXIT
ln -sfn "releases/$(basename "$release")" "$base/current"
cat "$base/Caddyfile.next" > "$plov/Caddyfile"
python3 - "$plov/docker-compose.yml" <<'PY'
import pathlib,sys
p=pathlib.Path(sys.argv[1]); text=p.read_text()
mount='      - /home/deploy/suppliers:/srv/suppliers:ro'
if mount not in text:
    marker='      - ./Caddyfile:/etc/caddy/Caddyfile:ro'
    assert text.count(marker)==1
    p.write_text(text.replace(marker,marker+'\n'+mount))
PY
(cd "$plov" && docker compose --profile web up -d --no-deps caddy)
docker exec plov-caddy caddy validate --config /etc/caddy/Caddyfile --adapter caddyfile
docker exec plov-caddy caddy reload --config /etc/caddy/Caddyfile --adapter caddyfile
curl --retry 12 --retry-delay 5 --retry-all-errors --max-time 15 --resolve suppliers.178-236-242-240.sslip.io:443:127.0.0.1 --fail --silent --show-error https://suppliers.178-236-242-240.sslip.io/data/catalog.json > "$base/live-catalog.json"
curl --retry 5 --retry-delay 2 --retry-all-errors --max-time 15 --resolve suppliers.178-236-242-240.sslip.io:443:127.0.0.1 --fail --silent --show-error https://suppliers.178-236-242-240.sslip.io/data/offers.json > "$base/live-offers.json"
python3 - "$base/live-offers.json" <<'PY'
import json,sys
assert len(json.load(open(sys.argv[1])))>=21
PY
python3 - "$base/live-catalog.json" <<'PY'
import json,sys
assert len(json.load(open(sys.argv[1])))>=105
PY
trap - EXIT
echo "Deployment verified. Backup: $backup"
