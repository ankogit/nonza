#!/bin/sh
set -e
CONF="/etc/coturn/turnserver.conf"
if [ -n "$TURN_USE_AUTH" ] && [ -n "$TURN_SECRET" ]; then
  exec turnserver -c "$CONF" --static-auth-secret="$TURN_SECRET"
else
  exec turnserver -c "$CONF"
fi
