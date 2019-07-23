    
#!/usr/bin/env bash
set -e # fail on first error
DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )/.." # parent dir of scripts dir
cd "${DIR}"

echo "Begin tests in ${DIR}"

firebase emulators:exec --only firestore "npm run do_verify"
