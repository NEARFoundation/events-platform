#!/bin/bash
set -e

ACCOUNT_ID=$1
export NEAR_ENV=mainnet

KEYS=$(near view-state $ACCOUNT_ID --finality final | sed -e "s/'/\"/g" | sed -e "s/key/\"key\"/g" | sed -e "s/value/\"value\"/g" | jq '[.[] | .key]' | tr -d '\n' | tr -d '[:blank:]')

echo ""
echo "|> deplpoying state cleanup contract"
echo 'y' | near deploy $ACCOUNT_ID ./state_cleanup.wasm

echo ""
echo "|> cleaning state"
near call $ACCOUNT_ID clean "{\"keys\":$KEYS}" --accountId $ACCOUNT_ID

echo ""
echo "|> deplpoying events contract"
echo 'y' | near deploy $ACCOUNT_ID ./contract/build/events.wasm

unset NEAR_ENV

