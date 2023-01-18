#!/bin/sh

./build.sh

if [ $? -ne 0 ]; then
  echo ">> Error building contract"
  exit 1
fi

echo ">> Deploying contract"

# https://docs.near.org/tools/near-cli#near-deploy
NEAR_ENV=mainnet near deploy events_v1.near --wasmFile build/events.wasm
