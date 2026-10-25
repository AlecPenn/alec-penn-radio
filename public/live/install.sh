#!/usr/bin/env bash
# ALEC PENN RADIO — 24/7 YouTube broadcaster, server installer (Ubuntu, ARM or Intel/AMD).
# Run:  curl -fsSL https://alecpennradio.com/live/install.sh | sudo bash
# Running it again updates the broadcaster and keeps your stream key.
set -euo pipefail
BASE="https://alecpennradio.com/live"
DIR="/opt/apr-live"
say() { printf '\n\033[1;33m  %s\033[0m\n' "$*"; }

[ "$(id -u)" = 0 ] || { echo "  Please run with sudo:  curl -fsSL $BASE/install.sh | sudo bash"; exit 1; }

say "1/5  Installing ffmpeg and Node.js (a few minutes the first time)..."
export DEBIAN_FRONTEND=noninteractive
apt-get update -qq
apt-get install -y -qq ffmpeg curl ca-certificates >/dev/null
if ! command -v node >/dev/null || [ "$(node -p 'process.versions.node.split(".")[0]')" -lt 20 ]; then
  curl -fsSL https://deb.nodesource.com/setup_22.x | bash - >/dev/null
  apt-get install -y -qq nodejs >/dev/null
fi
echo "  ffmpeg $(ffmpeg -version | head -1 | cut -d' ' -f3), node $(node -v)"

say "2/5  Downloading the broadcaster..."
mkdir -p "$DIR"
curl -fsSL "$BASE/apr-live.tar.gz" | tar xz -C "$DIR" --strip-components=1
id apr >/dev/null 2>&1 || useradd --system --home "$DIR" --shell /usr/sbin/nologin apr

say "3/5  Your YouTube stream key"
KEYFILE="$DIR/youtube-key.txt"
if [ -s "$DIR/.key" ]; then
  echo "  Using the stream key you saved before. (New key? Run: sudo rm $DIR/.key  then this install command again.)"
else
  echo "  Paste your stream key from YouTube Studio and press Enter."
  echo "  (Nothing will show while you paste. That's normal, it keeps the key private.)"
  read -rs -p "  Stream key: " KEY < /dev/tty; echo
  [ -n "$KEY" ] || { echo "  No key entered. Run the installer again when you have it."; exit 1; }
  printf '%s\n' "$KEY" > "$DIR/.key"
fi
cp "$DIR/.key" "$KEYFILE"
chmod 600 "$DIR/.key" "$KEYFILE"

say "4/5  Picture size"
SIZE="${APR_SIZE:-}"
if [ -z "$SIZE" ]; then
  if [ -s "$DIR/.size" ]; then SIZE="$(cat "$DIR/.size")"; else
    read -r -p "  1080 (sharper, needs 2+ cores) or 720 (lighter)? [1080]: " SIZE < /dev/tty || true
  fi
fi
[ "$SIZE" = 720 ] || SIZE=1080
echo "$SIZE" > "$DIR/.size"
chown -R apr:apr "$DIR"

say "5/5  Starting it, and setting it to start by itself after any reboot..."
cat > /etc/systemd/system/apr-live.service <<EOF
[Unit]
Description=Alec Penn Radio - 24/7 YouTube broadcaster
After=network-online.target
Wants=network-online.target

[Service]
User=apr
WorkingDirectory=$DIR
Environment=APR_SIZE=$SIZE
ExecStart=/usr/bin/node $DIR/live.mjs
Restart=always
RestartSec=10
Nice=-5

[Install]
WantedBy=multi-user.target
EOF
systemctl daemon-reload
systemctl enable apr-live >/dev/null 2>&1
systemctl restart apr-live
sleep 8
if systemctl is-active --quiet apr-live; then
  say "DONE. Alec Penn Radio is going live (${SIZE}p). Check YouTube Studio in about 30 seconds."
  echo "  See what it's doing:   sudo journalctl -u apr-live -f      (Ctrl+C to stop watching)"
  echo "  Stop / start:          sudo systemctl stop apr-live   /   sudo systemctl start apr-live"
  echo "  Update to the latest:  run the same install command again"
else
  say "It didn't start. Here's what it said:"
  journalctl -u apr-live -n 30 --no-pager
fi
