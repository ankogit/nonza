#!/bin/sh
if [ -n "$TURN_USE_AUTH" ] && [ -n "$TURN_SECRET" ]; then
  exec turnserver -c /etc/coturn/turnserver.conf --static-auth-secret="${TURN_SECRET}"
else
  exec turnserver -c /etc/coturn/turnserver.conf
fi
