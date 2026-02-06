#!/bin/sh
# Hairpin для TURN relay: трафик на свой публичный IP:49152-49200 перенаправить в контейнер coturn.
# Запускать на хосте, где крутятся Docker, coturn и LiveKit (root или sudo).
# IP и диапазон портов должны совпадать с coturn.conf и docker-compose (external-ip, min-port/max-port).

HOST_PUBLIC_IP="${TURN_HOST_PUBLIC_IP:-155.212.181.137}"
COTURN_IP="${TURN_COTURN_CONTAINER_IP:-172.18.0.4}"
PORT_RANGE="49152:49200"
# Доп. источники для SNAT (LiveKit на другом хосте): через запятую, напр. 10.50.0.103
SNAT_SOURCES="${TURN_HAIRPIN_SNAT_SOURCE_IPS:-}"

case "${1:-}" in
  add)
    iptables -t nat -C PREROUTING -i br+ -d "$HOST_PUBLIC_IP" -p udp --dport "$PORT_RANGE" -j DNAT --to-destination "$COTURN_IP" 2>/dev/null || \
    iptables -t nat -I PREROUTING 1 -i br+ -d "$HOST_PUBLIC_IP" -p udp --dport "$PORT_RANGE" -j DNAT --to-destination "$COTURN_IP"
    iptables -t nat -C PREROUTING -d "$HOST_PUBLIC_IP" -p udp --dport "$PORT_RANGE" -j DNAT --to-destination "$COTURN_IP" 2>/dev/null || \
    iptables -t nat -A PREROUTING -d "$HOST_PUBLIC_IP" -p udp --dport "$PORT_RANGE" -j DNAT --to-destination "$COTURN_IP"
    iptables -t nat -C OUTPUT -d "$HOST_PUBLIC_IP" -p udp --dport "$PORT_RANGE" -j DNAT --to-destination "$COTURN_IP" 2>/dev/null || \
    iptables -t nat -A OUTPUT -d "$HOST_PUBLIC_IP" -p udp --dport "$PORT_RANGE" -j DNAT --to-destination "$COTURN_IP"
    case "$COTURN_IP" in
      10.*|192.168.*)
        iptables -t nat -C POSTROUTING -s "$COTURN_IP" -d "$COTURN_IP" -p udp --dport "$PORT_RANGE" -j SNAT --to-source "$HOST_PUBLIC_IP" 2>/dev/null || \
        iptables -t nat -A POSTROUTING -s "$COTURN_IP" -d "$COTURN_IP" -p udp --dport "$PORT_RANGE" -j SNAT --to-source "$HOST_PUBLIC_IP"
        for src in $(echo "$SNAT_SOURCES" | tr ', ' ' \n' | grep -v '^$'); do
          iptables -t nat -C POSTROUTING -s "$src" -d "$COTURN_IP" -p udp --dport "$PORT_RANGE" -j SNAT --to-source "$HOST_PUBLIC_IP" 2>/dev/null || \
          iptables -t nat -A POSTROUTING -s "$src" -d "$COTURN_IP" -p udp --dport "$PORT_RANGE" -j SNAT --to-source "$HOST_PUBLIC_IP"
        done
        echo "Hairpin rules added: $HOST_PUBLIC_IP:$PORT_RANGE -> $COTURN_IP + SNAT (peer will see $HOST_PUBLIC_IP)"
        ;;
      *)
        echo "Hairpin rules added: $HOST_PUBLIC_IP:$PORT_RANGE -> $COTURN_IP (PREROUTING br+, PREROUTING, OUTPUT)"
        ;;
    esac
    ;;
  del)
    iptables -t nat -D PREROUTING -i br+ -d "$HOST_PUBLIC_IP" -p udp --dport "$PORT_RANGE" -j DNAT --to-destination "$COTURN_IP" 2>/dev/null && echo "PREROUTING br+ rule removed."
    iptables -t nat -D PREROUTING -d "$HOST_PUBLIC_IP" -p udp --dport "$PORT_RANGE" -j DNAT --to-destination "$COTURN_IP" 2>/dev/null && echo "PREROUTING rule removed."
    iptables -t nat -D OUTPUT -d "$HOST_PUBLIC_IP" -p udp --dport "$PORT_RANGE" -j DNAT --to-destination "$COTURN_IP" 2>/dev/null && echo "OUTPUT rule removed."
    case "$COTURN_IP" in
      10.*|192.168.*)
        iptables -t nat -D POSTROUTING -s "$COTURN_IP" -d "$COTURN_IP" -p udp --dport "$PORT_RANGE" -j SNAT --to-source "$HOST_PUBLIC_IP" 2>/dev/null && echo "POSTROUTING SNAT rule removed."
        for src in $(echo "$SNAT_SOURCES" | tr ', ' ' \n' | grep -v '^$'); do
          iptables -t nat -D POSTROUTING -s "$src" -d "$COTURN_IP" -p udp --dport "$PORT_RANGE" -j SNAT --to-source "$HOST_PUBLIC_IP" 2>/dev/null && echo "POSTROUTING SNAT $src removed."
        done
        ;;
    esac
    ;;
  check|status)
    echo "NAT PREROUTING, OUTPUT (look for $HOST_PUBLIC_IP $PORT_RANGE -> $COTURN_IP):"
    iptables -t nat -L PREROUTING -n -v --line-numbers 2>/dev/null
    iptables -t nat -L OUTPUT -n -v --line-numbers 2>/dev/null
    case "$COTURN_IP" in
      10.*|192.168.*)
        echo "POSTROUTING (SNAT for hairpin peer):"
        iptables -t nat -L POSTROUTING -n -v --line-numbers 2>/dev/null
        ;;
    esac
    ;;
  save)
    if command -v netfilter-persistent >/dev/null 2>&1; then
      netfilter-persistent save && echo "Rules saved (netfilter-persistent)."
    elif [ -d /etc/iptables ]; then
      iptables-save > /etc/iptables/rules.v4 2>/dev/null && echo "Rules saved to /etc/iptables/rules.v4" || echo "Run: sudo iptables-save | sudo tee /etc/iptables/rules.v4"
    else
      echo "Save rules manually after add, e.g.:"
      echo "  Debian/Ubuntu: sudo apt install iptables-persistent && sudo netfilter-persistent save"
      echo "  Or: sudo iptables-save | sudo tee /etc/iptables.rules"
    fi
    ;;
  *)
    echo "Usage: $0 add | del | check | save"
    echo "Env: TURN_HOST_PUBLIC_IP ($HOST_PUBLIC_IP), TURN_COTURN_CONTAINER_IP ($COTURN_IP)"
    echo "      TURN_HAIRPIN_SNAT_SOURCE_IPS (e.g. 10.50.0.103 if LiveKit on another host)"
    exit 1
    ;;
esac
