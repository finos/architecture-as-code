#!/usr/bin/env bash
# Simple wrapper around curl that offers Kerberos authentication (--negotiate -u:)
# Usage: calmhub-curl.sh [-m METHOD] URL
# If METHOD is POST, the request body is read from stdin.

show_help() {
  cat <<EOF
Usage: $0 [options] URL
Options:
  -m, --method METHOD   HTTP method to use (default: GET)
  -h, --help            Show this help message

Examples:
  echo '{"a":1}' | $0 -m POST https://example.com/api
  $0 https://example.com

Notes:
  - Output goes to stdout. Errors are written to stderr.
  - Failure will result in a non-zero exit code.
  - Cookies are stored in /var/tmp/calmhub_cookies.\$(id -un) as -rw-------, i.e. current user only.
EOF
}

# Defaults
method=GET
content_type=application/json

# Parse arguments
while [[ $# -gt 0 ]]; do
  case $1 in
    -m|--method)
      if [[ -n $2 ]]; then
        method="$2"
        shift 2
      else
        echo "Error: --method requires an argument." >&2
        exit 1
      fi
      ;;
    -h|--help)
      show_help
      exit 0
      ;;
    *)
      url="$1"
      shift
      ;;
  esac
done

if [[ -z "$url" ]]; then
  echo "Error: URL is required." >&2
  show_help
  exit 1
fi

# Normalize method to uppercase
method=$(echo "$method" | tr '[:lower:]' '[:upper:]')

COOKIE_JAR=/var/tmp/calmhub_cookies.$(id -un)
CURL_OPTS="--silent --fail-with-body --location-trusted --negotiate -u: -b $COOKIE_JAR -c $COOKIE_JAR -w %{stderr}%{http_code}"

# Ensure cookie jar file exists with secure permissions (current user ONLY)
old_umask=$(umask)
umask 0077
touch "$COOKIE_JAR"
umask "$old_umask"

# Execute curl. For POST, read body from stdin.
if [[ "$method" == "POST" ]]; then
  if [ -t 0 ]; then
    # No stdin data; send empty payload
    curl ${CURL_OPTS} -X "$method" -H "Content-Type: application/json" --data-binary @- "$url" < /dev/null
    exit $?
  else
    # Pipe actual stdin to curl
    curl ${CURL_OPTS} -X "$method" -H "Content-Type: application/json" --data-binary @- "$url"
    exit $?
  fi
else
  # Methods without body
  curl ${CURL_OPTS} "$url"
  exit $?
fi
