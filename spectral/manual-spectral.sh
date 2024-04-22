#!/usr/bin/bash

pattern=$1
ruleset=$2

which spectral &>/dev/null
if [ $? -ne 0 ]; then
    echo "spectral command not found."
    echo "Install it with the following command: npm install -g @stoplight/spectral-cli"
    echo "Make sure you are running this command inside your current shell, rather than calling it."
    echo "For example:"
    echo "  . manual-spectral.sh [args]"
    exit 1
fi 

tempfile=$(mktemp)

cat $pattern | sed 's/^.*\$ref.*$/ /' > $tempfile

spectral lint -r $ruleset $tempfile 

rm $tempfile