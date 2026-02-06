#!/bin/sh
# Hairpin для TURN relay: трафик на свой публичный IP:49152-49200 перенаправить в контейнер coturn.
# Запускать на хосте, где крутятся Docker, coturn и LiveKit (root или sudo).
# IP и диапазон портов должны совпадать с coturn.conf и docker-compose (external-ip, min-port/max-port).

HOST_PUBLIC_IP="${TURN_HOST_PUBLIC_IP:-95.143.188.166}"
COTURN_IP="${TURN_COTURN_CONTAINER_IP:-172.18.0.4}"
PORT_RANGE="49152:49200"

case "${1:-}" in
  add)
    iptables -t nat -C PREROUTING -i br+ -d "$HOST_PUBLIC_IP" -p udp --dport "$PORT_RANGE" -j DNAT --to-destination "$COTURN_IP" 2>/dev/null || \
    iptables -t nat -I PREROUTING 1 -i br+ -d "$HOST_PUBLIC_IP" -p udp --dport "$PORT_RANGE" -j DNAT --to-destination "$COTURN_IP"
    iptables -t nat -C PREROUTING -d "$HOST_PUBLIC_IP" -p udp --dport "$PORT_RANGE" -j DNAT --to-destination "$COTURN_IP" 2>/dev/null || \
    iptables -t nat -A PREROUTING -d "$HOST_PUBLIC_IP" -p udp --dport "$PORT_RANGE" -j DNAT --to-destination "$COTURN_IP"
    iptables -t nat -C OUTPUT -d "$HOST_PUBLIC_IP" -p udp --dport "$PORT_RANGE" -j DNAT --to-destination "$COTURN_IP" 2>/dev/null || \
    iptables -t nat -A OUTPUT -d "$HOST_PUBLIC_IP" -p udp --dport "$PORT_RANGE" -j DNAT --to-destination "$COTURN_IP"
    echo "Hairpin rules added: $HOST_PUBLIC_IP:$PORT_RANGE -> $COTURN_IP (PREROUTING br+, PREROUTING, OUTPUT)"
    ;;
  del)
    iptables -t nat -D PREROUTING -i br+ -d "$HOST_PUBLIC_IP" -p udp --dport "$PORT_RANGE" -j DNAT --to-destination "$COTURN_IP" 2>/dev/null && echo "PREROUTING br+ rule removed."
    iptables -t nat -D PREROUTING -d "$HOST_PUBLIC_IP" -p udp --dport "$PORT_RANGE" -j DNAT --to-destination "$COTURN_IP" 2>/dev/null && echo "PREROUTING rule removed."
    iptables -t nat -D OUTPUT -d "$HOST_PUBLIC_IP" -p udp --dport "$PORT_RANGE" -j DNAT --to-destination "$COTURN_IP" 2>/dev/null && echo "OUTPUT rule removed."
    ;;
  check|status)
    echo "NAT PREROUTING and OUTPUT (look for $HOST_PUBLIC_IP $PORT_RANGE -> $COTURN_IP):"
    iptables -t nat -L PREROUTING -n -v --line-numbers 2>/dev/null
    iptables -t nat -L OUTPUT -n -v --line-numbers 2>/dev/null
    ;;
  *)
    echo "Usage: $0 add | del | check"
    echo "Env: TURN_HOST_PUBLIC_IP ($HOST_PUBLIC_IP), TURN_COTURN_CONTAINER_IP ($COTURN_IP)"
    exit 1
    ;;
esac
