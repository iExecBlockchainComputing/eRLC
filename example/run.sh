#!/bin/bash

cat ./example/accounts.json | jq -r '.[].address' | node ./dist/main.js

