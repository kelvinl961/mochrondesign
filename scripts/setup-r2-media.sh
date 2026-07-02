#!/usr/bin/env bash
# One-time setup: Cloudflare R2 for full-resolution CMS image uploads.
#
# Prerequisites:
#   1. Enable R2 in Cloudflare Dashboard → R2 → Get started
#   2. Domain mochrondesign.com on Cloudflare (for media.mochrondesign.com)
#
# Usage:
#   ./scripts/setup-r2-media.sh
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
CONFIG="$ROOT/public/admin/config.yml"
ACCOUNT_ID="f8d8a734cfaeac3dec176d8510a16f78"
BUCKET="mochrondesign-media"
PREFIX="projects/"
PUBLIC_URL="https://media.mochrondesign.com"
CMS_ORIGINS='["https://mochrondesign.com","https://www.mochrondesign.com","https://mochrondesign.itsmochron.workers.dev","http://localhost:4321"]'

echo "=== Cloudflare R2 media setup (full-resolution CMS uploads) ==="
echo "Account: $ACCOUNT_ID"
echo "Bucket:  $BUCKET"
echo "Public:  $PUBLIC_URL"
echo

if ! command -v npx >/dev/null; then
  echo "Error: npx not found."
  exit 1
fi

echo "Checking R2 access..."
if ! R2_BUCKETS_OUTPUT="$(npx wrangler r2 bucket list 2>&1)"; then
  echo ""
  echo "R2 is not enabled yet. In Cloudflare Dashboard:"
  echo "  https://dash.cloudflare.com → R2 → Get started"
  echo ""
  echo "Then run this script again."
  exit 1
fi

echo "$R2_BUCKETS_OUTPUT"

bucket_exists() {
  printf '%s\n' "$1" | grep -qE "^name:[[:space:]]+${BUCKET}$"
}

if bucket_exists "$R2_BUCKETS_OUTPUT"; then
  echo "Bucket already exists: $BUCKET"
else
  echo "Creating bucket: $BUCKET"
  CREATE_OUTPUT="$(npx wrangler r2 bucket create "$BUCKET" 2>&1)" || {
    if echo "$CREATE_OUTPUT" | grep -qi "already exists"; then
      echo "Bucket already exists: $BUCKET"
    else
      echo "$CREATE_OUTPUT"
      exit 1
    fi
  }
fi

echo ""
echo "Create an R2 API token in Cloudflare Dashboard:"
echo "  https://dash.cloudflare.com/?to=/:account/r2/api-tokens"
echo "  Permission: Object Read & Write"
echo "  Scope: bucket $BUCKET only"
echo ""
read -rsp "Paste Secret Access Key (hidden): " SECRET_KEY
echo ""
read -rp "Paste Access Key ID (64 hex chars): " ACCESS_KEY_ID

if [ -z "$SECRET_KEY" ] || [ -z "$ACCESS_KEY_ID" ]; then
  echo "Error: both keys are required."
  exit 1
fi

if ! [[ "$ACCESS_KEY_ID" =~ ^[a-f0-9]{64}$ ]]; then
  echo "Warning: Access Key ID is usually 64 lowercase hex characters."
fi

echo ""
echo "Choose public URL for images:"
echo "  1) Custom domain (recommended): $PUBLIC_URL"
echo "  2) R2 dev URL (quick test): https://pub-xxxxx.r2.dev"
read -rp "Choice [1/2] (default 1): " URL_CHOICE
URL_CHOICE="${URL_CHOICE:-1}"

if [ "$URL_CHOICE" = "2" ]; then
  read -rp "Paste your pub-*.r2.dev URL: " PUBLIC_URL
fi

echo ""
echo "=== Manual steps in Cloudflare Dashboard ==="
echo ""
echo "A) Public access for $BUCKET:"
if [ "$URL_CHOICE" = "1" ]; then
  echo "   R2 → $BUCKET → Settings → Custom Domains → Add"
  echo "   Domain: media.mochrondesign.com"
  echo "   (DNS record is created automatically if the zone is on Cloudflare)"
else
  echo "   R2 → $BUCKET → Settings → Public Development URL → Enable"
  echo "   Copy the pub-*.r2.dev URL you entered above."
fi
echo ""
echo "B) CORS policy for $BUCKET (Settings → CORS Policy):"
cat <<EOF
[
  {
    "AllowedHeaders": ["*"],
    "AllowedMethods": ["GET", "PUT", "HEAD"],
    "AllowedOrigins": $CMS_ORIGINS,
    "ExposeHeaders": ["ETag"],
    "MaxAgeSeconds": 3000
  }
]
EOF
echo ""
read -rp "Press Enter after completing A and B in the dashboard..."

# Patch config.yml (portable sed for macOS + Linux)
python3 <<PY
from pathlib import Path
import re

config = Path("$CONFIG")
text = config.read_text()

access_key = "$ACCESS_KEY_ID"
public_url = "$PUBLIC_URL".rstrip("/")

block = f'''media_libraries:
  cloudflare_r2:
    access_key_id: {access_key}
    bucket: $BUCKET
    account_id: $ACCOUNT_ID
    public_url: {public_url}
    prefix: $PREFIX'''

if "cloudflare_r2:" in text:
    text = re.sub(
        r"media_libraries:\n(?:  .*\n)+",
        block + "\n",
        text,
        count=1,
    )
else:
    text = text.replace(
        "public_folder: /images/projects\n\n",
        "public_folder: /images/projects\n\n" + block + "\n\n",
    )

config.write_text(text)
print(f"Updated {config}")
PY

echo ""
echo "=== CMS login (one time per browser) ==="
echo "Open /admin → edit a project → upload an image."
echo "When prompted, paste the R2 Secret Access Key (stored in browser localStorage)."
echo ""
echo "Secret Access Key (save somewhere safe — shown once from Cloudflare):"
echo "  (you already pasted it above)"
echo ""
echo "Done. Commit and deploy public/admin/config.yml when ready."
echo "Existing /images/projects/* paths still work; new uploads go to R2 at full resolution."
