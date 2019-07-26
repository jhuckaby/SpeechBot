#!/bin/sh

# Start SpeechBot in debug mode
# No daemon fork, and all logs emitted to stdout

DIR=`dirname $0`
PDIR=`dirname $DIR`

node $PDIR/lib/main.js --debug --echo --color "$@"
