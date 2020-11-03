#!/bin/bash

cat accounts.json | jq -r '.[].address' | node ../dist/main.ts              

