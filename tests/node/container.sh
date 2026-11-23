#!/bin/sh
set -eu
workdir=$(mktemp -d)
trap 'rm -rf "$workdir"' EXIT
tar -C /src --exclude=./.git --exclude=node_modules --exclude=./dist \
  --exclude=./.env --exclude=./.env.local -cf - . | tar -C "$workdir" -xf -
cd "$workdir"
npm exec --yes --package=npm@6.14.18 -- npm ci --ignore-scripts --no-audit
npm run transpile
node --experimental-test-coverage --test-coverage-include='dist/modules/cmd.js' \
  --test-coverage-lines=95 --test tests/node/cmd.test.cjs
