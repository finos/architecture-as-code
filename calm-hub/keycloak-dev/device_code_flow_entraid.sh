#!/bin/bash

CLIENT_ID="0cda28f4-102e-4913-b61c-d57a664e1b2b" #calm-hub-device-flow
SCOPE="api://calm-hub-producer-app/patterns.read api://calm-hub-producer-app/patterns.write"
TENANT_ID="3c9baf76-e5a3-42b6-8b21-46660e5d2cfb"

DEVICE_AUTH_ENDPOINT="https://login.microsoftonline.com/$TENANT_ID/oauth2/v2.0/devicecode"
DEVICE_AUTH_RESPONSE=$(curl -X POST \
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
# TrialTenantm0w91qAV.onmicrosoft.com
TOKEN_URL="https://login.microsoftonline.com/$TENANT_ID/oauth2/v2.0/token"
ACCESS_TOKEN=""
POLL_INTERVAL=15 #Seconds
poll_token() {
  while true; do
    RESPONSE=$(curl -X POST "$TOKEN_URL" \
      -H "Content-Type: application/x-www-form-urlencoded" \
      -d "client_id=$CLIENT_ID" \
      -d "device_code=$DEVICE_CODE" \
      -d "grant_type=urn:ietf:params:oauth:grant-type:device_code" \
      -d "scope=$SCOPE")

    echo "Response: $RESPONSE \n"

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