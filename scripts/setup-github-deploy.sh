#!/usr/bin/env bash
# One-time setup: store Cloudflare credentials as GitHub Actions SECRETS.
# Usage:
#   brew install gh   # if needed
#   gh auth login
#   ./scripts/setup-github-deploy.sh
set -euo pipefail

REPO="kelvinl961/mochrondesign"
ACCOUNT_ID="f8d8a734cfaeac3dec176d8510a16f78"

if ! command -v gh >/dev/null; then
  echo "Install GitHub CLI first: brew install gh"
  exit 1
fi

if ! gh auth status >/dev/null 2>&1; then
  echo "Log in to GitHub first: gh auth login"
  exit 1
fi

echo "=== GitHub Actions deploy setup ==="
echo "Repo: $REPO"
echo ""
echo "Create a Cloudflare API token at:"
echo "  https://dash.cloudflare.com/profile/api-tokens"
echo "Use template: Edit Cloudflare Workers"
echo ""
read -rsp "Paste API token (hidden): " CF_TOKEN
echo ""

if [ -z "$CF_TOKEN" ]; then
  echo "Error: token cannot be empty."
  exit 1
fi

# Store under every name the workflow accepts.
printf '%s' "$CF_TOKEN" | gh secret set CF_API_TOKEN --repo "$REPO"
printf '%s' "$CF_TOKEN" | gh secret set CLOUDFLARE_API_TOKEN --repo "$REPO"
printf '%s' "$ACCOUNT_ID" | gh secret set CF_ACCOUNT_ID --repo "$REPO"
printf '%s' "$ACCOUNT_ID" | gh secret set CLOUDFLARE_ACCOUNT_ID --repo "$REPO"

echo ""
echo "Saved repository secrets:"
gh secret list --repo "$REPO"
echo ""
echo "Starting deploy..."
gh workflow run deploy-site.yml --repo "$REPO"
echo "Watch progress: https://github.com/$REPO/actions"
