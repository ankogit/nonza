#!/bin/sh
set -e
CONF="/etc/coturn/turnserver.conf"
if [ -n "$TURN_NO_AUTH" ]; then
  CONF_NOAUTH=$(mktemp)
  grep -v '^use-auth-secret' "$CONF" > "$CONF_NOAUTH"
  exec turnserver -c "$CONF_NOAUTH" --no-auth
elif [ -n "$TURN_USE_AUTH" ] && [ -n "$TURN_SECRET" ]; then
  SECRET=$(printf '%s' "$TURN_SECRET" | tr -d '\r\n' | sed 's/^[[:space:]]*//;s/[[:space:]]*$//')
  exec turnserver -c "$CONF" --static-auth-secret="$SECRET"
else
  exec turnserver -c "$CONF"
fi
