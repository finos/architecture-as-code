#!/bin/bash

CLIENT_ID="calm-hub-device-flow"
SCOPE="write:patterns read:patterns"
DEVICE_AUTH_ENDPOINT="https://localhost:9443/realms/calm-hub-realm/protocol/openid-connect/auth/device"
DEVICE_AUTH_RESPONSE=$(curl --insecure -X POST \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "client_id=$CLIENT_ID" -d "scope=$SCOPE" \
  $DEVICE_AUTH_ENDPOINT)

# Extract values from the device auth response.
DEVICE_CODE=$(echo "$DEVICE_AUTH_RESPONSE" | jq -r '.device_code')
USER_CODE=$(echo "$DEVICE_AUTH_RESPONSE" | jq -r '.user_code')
VERIFICATION_URI=$(echo "$DEVICE_AUTH_RESPONSE" | jq -r '.verification_uri')
VERIFICATION_URI_COMPLETE=$(echo "$DEVICE_AUTH_RESPONSE" | jq -r '.verification_uri_complete')
EXPIRES_IN=$(echo "$DEVICE_AUTH_RESPONSE" | jq -r '.expires_in')
INTERVAL=$(echo "$DEVICE_AUTH_RESPONSE" | jq -r '.interval')

echo -e "Please open the link on a browser $VERIFICATION_URI, User Code:[$USER_CODE] \nCorresponding device code [$DEVICE_CODE] will expires in $EXPIRES_IN seconds.\n"

# Poll the token endpoint
TOKEN_URL="https://localhost:9443/realms/calm-hub-realm/protocol/openid-connect/token"
ACCESS_TOKEN=""
POLL_INTERVAL=15 #Seconds

poll_token() {
  while true; do
    RESPONSE=$(curl --insecure -s -X POST "$TOKEN_URL" \
      -H "Content-Type: application/x-www-form-urlencoded" \
      -d "client_id=$CLIENT_ID" \
      -d "device_code=$DEVICE_CODE" \
      -d "grant_type=urn:ietf:params:oauth:grant-type:device_code" \
      -d "scope=$SCOPE")

    ERROR=$(echo "$RESPONSE" | jq -r '.error')
    if [[ "$ERROR" == "authorization_pending" ]]; then
      echo "Waiting for user authorization..."
      sleep $POLL_INTERVAL
    elif [[ "$ERROR" == "expired_token" ]]; then
      echo "Device code expired. Restart the flow."
      exit 1
    elif [[ "$ERROR" == "slow_down" ]]; then
      echo "Server requested slower polling. "
      POLL_INTERVAL=$((POLL_INTERVAL + 10))
      sleep $POLL_INTERVAL
    else
      ACCESS_TOKEN=$(echo "$RESPONSE" | jq -r '.access_token')
      echo "Access Token: $ACCESS_TOKEN"
      break;
    fi
  done
}

#Start token polling
poll_token

echo "Proceed to get patterns"
read
if [[ -n $ACCESS_TOKEN ]]; then
  curl --insecure -v -X GET "https://localhost:8443/calm/namespaces/finos/patterns" \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer $ACCESS_TOKEN"
fi
#Reference: https://github.com/keycloak/keycloak-community/blob/main/design/oauth2-device-authorization-grant.md