    
#!/usr/bin/env bash
set -e # fail on first error
DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )/.." # parent dir of scripts dir
cd "${DIR}"

npm i -g firebase firebase-tools
firebase setup:emulators:firestore
