#!/bin/sh
# Point git at the repo's tracked hooks, so they survive a fresh clone.
# Run once: sh scripts/install-hooks.sh
set -e
root=$(git rev-parse --show-toplevel)
git -C "$root" config core.hooksPath .githooks
chmod +x "$root/.githooks/pre-commit" "$root/scripts/check_posts.py"
echo "hooks installed: core.hooksPath -> .githooks"
