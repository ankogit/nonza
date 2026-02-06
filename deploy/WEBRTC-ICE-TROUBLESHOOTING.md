# WebRTC: ICE failed / could not establish peer connection

У части пользователей при подключении к комнате появляются ошибки:

- **WebRTC: ICE failed, add a TURN server and see about:webrtc for more details**
- **LiveKit connection error: ConnectionError: could not establish peer connection**

## Причина

WebRTC устанавливает медиа-соединение в порядке: прямой UDP → TCP → **TURN** (ретрансляция через сервер). Если пользователь за строгим NAT или корпоративным файрволом, прямой путь и часто UDP блокируются. Без настроенного **TURN** сервера соединение установить не удаётся.

## Что сделать на сервере

1. **Включить TURN в конфиге LiveKit** — в `deploy/livekit-config.yaml` уже стоит `turn.enabled: true` и `turn.udp_port: 3478`. Убедитесь, что этот конфиг реально используется при запуске LiveKit.

2. **Открыть порты на файрволе:**
   - **7880** — WebSocket API (обычно за nginx с TLS)
   - **7881** — ICE/TCP (для клиентов без UDP)
   - **50000–50100** (или ваш `port_range_start`–`port_range_end`) — ICE/UDP
   - **3478** — TURN/UDP

3. **В облаке** включите `use_external_ip: true` в `rtc`, чтобы LiveKit узнавал внешний IP для ICE (уже стоит в конфиге).

4. **Для пользователей за очень строгим файрволом** (корпоративные сети, часть мобильных операторов) может понадобиться **TURN по TLS на порту 443** — тогда трафик выглядит как обычный HTTPS. В `livekit-config.yaml` раскомментируйте и заполните секцию TURN/TLS (`tls_port`, `domain`, `cert_file`/`key_file` или `external_tls` при терминации TLS на балансировщике). Документация: [Ports and firewall](https://docs.livekit.io/transport/self-hosting/ports-firewall/).

## Порты для TURN (coturn) на основном сервере

На хосте, где крутится Docker с coturn, во внешнем файрволе (и в облачной security group) должны быть открыты:

| Порт    | Протокол | Назначение |
|---------|----------|------------|
| **5349** | TCP      | TURN over TLS (`turns:`), клиенты подключаются сюда |
| **3478** | TCP, UDP | TURN/STUN (если используете также `turn:` без TLS) |
| **49152–49200** | UDP  | Relay-порты: сюда coturn принимает и шлёт ретранслируемый медиа-трафик |

**Откуда 49177:** в `coturn.conf` заданы `min-port=49152` и `max-port=49200`. При каждой TURN-аллокации coturn выдаёт клиенту один порт из этого диапазона (например 49177). Адрес вида `95.x.x.x:49177` — это и есть relay-кандидат клиента.

**Проверка портов:** `nc -u 95.143.188.166 49177` будет «висеть» — для UDP это нормально: соединения нет, TURN ждёт пакеты в формате STUN/TURN, а не произвольные данные. Проверить, что порты слушаются на хосте: `ss -ulnp | grep -E '49152|49177'` или `ss -ulnp | grep 49152` (диапазон может быть одним сокетом).

## TURN (coturn) и LiveKit на одном хосте

Если **coturn и LiveKit** крутятся на одном сервере (один публичный IP), relay-кандидат клиента будет вида `95.x.x.x:49177`. LiveKit тогда шлёт STUN-запросы на этот же хост. Часть сетей и Docker-настроек **не доставляет** такой «внутренний» трафик в контейнер (нет ответов, ICE-пара в failed при `requestsSent > 0, responsesReceived = 0`).

**Решение — hairpin через iptables на хосте.** Трафик, приходящий на публичный IP хоста в relay-диапазоне (49152–49200), нужно перенаправлять в контейнер coturn. На сервере (где крутится Docker), от root:

```bash
# Один раз добавить правило (IP из coturn.conf external-ip и docker-compose coturn)
sudo deploy/turn-hairpin-iptables.sh add
```

Или вручную (подставь свой публичный IP и IP контейнера coturn, если другие):

```bash
sudo iptables -t nat -A PREROUTING -d 95.143.188.166 -p udp --dport 49152:49200 -j DNAT --to-destination 172.18.0.4
```

Чтобы правило не пропало после перезагрузки, сохрани правила: `iptables-save` в скрипт при старте или используй `iptables-persistent` / `netfilter-persistent`.

Удалить правило: `sudo deploy/turn-hairpin-iptables.sh del`

## Проверка

После включения TURN и открытия портов пользователи из проблемных сетей должны подключаться без ошибки ICE. При необходимости можно открыть `about:webrtc` в Chrome и посмотреть, какие ICE-кандидаты собираются и используются.
