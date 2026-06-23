#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
AUTH_DIR="$ROOT/cms-auth"
WORKER_URL="https://mochrondesign-cms-auth.itsmochron.workers.dev"

echo "==> Sveltia CMS OAuth setup"
echo "Worker URL: $WORKER_URL"
echo

cd "$AUTH_DIR"
npm install

echo
echo "==> Deploying auth worker to Cloudflare..."
echo "    (Log in to Cloudflare if prompted)"
npx wrangler deploy

echo
echo "==> Set GitHub OAuth secrets on the worker:"
echo "    npx wrangler secret put GITHUB_CLIENT_ID"
echo "    npx wrangler secret put GITHUB_CLIENT_SECRET"
echo
echo "==> GitHub OAuth App settings:"
echo "    https://github.com/settings/applications/new"
echo "    Callback URL: ${WORKER_URL}/callback"
echo "    Homepage URL: https://mochrondesign.com"
echo
echo "==> After secrets are set, redeploy if needed:"
echo "    npx wrangler deploy"
echo
echo "==> Then push site config (base_url is already set in public/admin/config.yml)"
echo "    cd $ROOT && git push"
