    
#!/usr/bin/env bash
set -e # fail on first error
DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )/.." # parent dir of scripts dir
cd "${DIR}"

echo "Begin tests"
(
    firebase serve --only firestore & 
    export FBPID=$! && 
    (sleep 5 && npm run do_test) ; 
    echo "Killing firebase emulator server: $FBPID" && kill -STOP $FBPID 
) ; 
echo "Tests done"