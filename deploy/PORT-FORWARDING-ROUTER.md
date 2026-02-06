# Проброс портов на шлюзе 155.212.181.137

**155.212.181.137** — шлюз в интернет. За ним:
- **10.50.0.118** — LiveKit (порты 7881, 3478, 50000–50100)
- **10.50.0.103** — nginx (в т.ч. stream для TURN на 5349)

turn.nonza.ru указывает на 155.212.181.137, поэтому на шлюзе нужно пробросить **TCP 5349** на **10.50.0.103:5349**, иначе снаружи будет Connection refused.

Если **docker-compose (coturn)** крутится на **10.50.0.103** (на одной машине с nginx), в конфигах nginx stream используй **127.0.0.1:5349**; relay UDP 49152–49200 на шлюзе пробрасывай на **10.50.0.103**. Если coturn на **10.50.0.118** — в nginx указывай **10.50.0.118:5349**, relay на шлюзе — на 10.50.0.118; на **10.50.0.118** должен быть разрешён входящий **TCP 5349** с 10.50.0.103 (чтобы nginx мог достучаться до coturn), например: `sudo ufw allow from 10.50.0.103 to any port 5349 proto tcp` (и `ufw enable` при включённом UFW).

## Условие

На 155.212.181.137 должен быть включён **IP forwarding** и пакеты с внешнего интерфейса должны маршрутизироваться к 10.50.0.118 (в одной сети или через маршрут).

Проверка:
```bash
cat /proc/sys/net/ipv4/ip_forward
# Должно быть 1
```

Включить на время:
```bash
sudo sysctl -w net.ipv4.ip_forward=1
```

Постоянно: в `/etc/sysctl.conf` или в файле в `/etc/sysctl.d/`:
```
net.ipv4.ip_forward=1
```
Затем `sudo sysctl -p`.

---

## iptables: DNAT + разрешить форвард

Подставь свой **внешний интерфейс** (через который приходит интернет), например `eth0` или `ens18`. Узнать: `ip route get 8.8.8.8 | head -1`.

На **155.212.181.137** выполнить:

```bash
# Внешний интерфейс (интернет)
EXT_IF=eth0

# Проброс TCP 7881
sudo iptables -t nat -A PREROUTING -i $EXT_IF -p tcp --dport 7881 -j DNAT --to-destination 10.50.0.118:7881

# Проброс TCP 5349 (TURN) на nginx 10.50.0.103
sudo iptables -t nat -A PREROUTING -i $EXT_IF -p tcp --dport 5349 -j DNAT --to-destination 10.50.0.103:5349

# Проброс UDP 3478
sudo iptables -t nat -A PREROUTING -i $EXT_IF -p udp --dport 3478 -j DNAT --to-destination 10.50.0.118:3478

# Проброс UDP 49152-49200 (coturn relay). Если coturn на 10.50.0.103 — замени на 10.50.0.103.
sudo iptables -t nat -A PREROUTING -i $EXT_IF -p udp --dport 49152:49200 -j DNAT --to-destination 10.50.0.118

# Проброс UDP 50000-50100 (диапазон)
sudo iptables -t nat -A PREROUTING -i $EXT_IF -p udp --dport 50000:50100 -j DNAT --to-destination 10.50.0.118

# Разрешить форвард (чтобы ответы шли обратно)
sudo iptables -A FORWARD -i $EXT_IF -p tcp --dport 5349 -d 10.50.0.103 -j ACCEPT
sudo iptables -A FORWARD -o $EXT_IF -p tcp -s 10.50.0.103 --sport 5349 -j ACCEPT
sudo iptables -A FORWARD -i $EXT_IF -p tcp --dport 7881 -d 10.50.0.118 -j ACCEPT
sudo iptables -A FORWARD -i $EXT_IF -p udp --dport 3478 -d 10.50.0.118 -j ACCEPT
sudo iptables -A FORWARD -i $EXT_IF -p udp --dport 49152:49200 -d 10.50.0.118 -j ACCEPT
sudo iptables -A FORWARD -i $EXT_IF -p udp --dport 50000:50100 -d 10.50.0.118 -j ACCEPT
sudo iptables -A FORWARD -o $EXT_IF -p tcp -s 10.50.0.118 --sport 7881 -j ACCEPT
sudo iptables -A FORWARD -o $EXT_IF -p udp -s 10.50.0.118 --sport 3478 -j ACCEPT
sudo iptables -A FORWARD -o $EXT_IF -p udp -s 10.50.0.118 --sport 49152:49200 -j ACCEPT
sudo iptables -A FORWARD -o $EXT_IF -p udp -s 10.50.0.118 --sport 50000:50100 -j ACCEPT
```

Для UDP при DNAT с диапазоном портов `--to-destination 10.50.0.118` без порта сохраняет исходный порт (50000–50100), что и нужно.

---

## Сохранить правила

Иначе после перезагрузки правила пропадут.

**Debian/Ubuntu:**
```bash
sudo apt install iptables-persistent
sudo netfilter-persistent save
```

**RHEL/Fedora/Rocky:**
```bash
sudo dnf install iptables-services
sudo service iptables save
```

Или вручную сохранить вывод в файл и при загрузке восстанавливать:
```bash
sudo iptables-save | sudo tee /etc/iptables.rules
# И в скрипт/unit при старте: iptables-restore /etc/iptables.rules
```

---

## Если 155.212.181.137 и 10.50.0.118 — один и тот же хост

Тогда это не проброс, а просто **открытие портов в файрволе** (трафик приходит сразу на этот сервер). Команды **на этом же хосте**:

```bash
sudo ufw allow 7881/tcp
sudo ufw allow 3478/udp
sudo ufw allow 49152:49200/udp
sudo ufw allow 50000:50100/udp
sudo ufw reload
```

---

## Если шлюз и приложение — разные хосты (iptables на шлюзе)

Тогда **ufw** нужен на **хосте, где крутится сервис**, чтобы он принимал проброшенный трафик:

- **UDP 49152:49200** — на хосте, где запущен **coturn** (10.50.0.103 или 10.50.0.118):  
  `sudo ufw allow 49152:49200/udp && sudo ufw reload`
- Остальные порты (7881, 3478, 50000–50100) — на хосте **10.50.0.118** (LiveKit), если он не тот же, что coturn.
