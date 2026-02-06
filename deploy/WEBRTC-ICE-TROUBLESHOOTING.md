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

## Топология (nonza)

| IP / хост           | Роль |
| ------------------- | -----|
| **95.143.188.166**  | Публичный IP (шлюз). Сюда приходит весь внешний трафик. |
| **10.50.0.103**     | Только nginx (TLS, proxy на бэкенд, LiveKit, TURN). |
| **10.50.0.118**     | Сервер с Docker: LiveKit и coturn. |

На шлюзе нужны DNAT: 95.143.188.166:5349 (TCP) → 10.50.0.103 (nginx), 95.143.188.166:49152–49200 (UDP) → 10.50.0.118 (coturn), 95.143.188.166:50000–50100 (UDP) → 10.50.0.118 (LiveKit). Nginx на 10.50.0.103 проксирует turns на 10.50.0.118:5349.

**Если на шлюзе этих правил ещё нет**, выполнить (подставь свой шлюз):

```bash
# TURN control (nginx проксирует на coturn)
iptables -t nat -A PREROUTING -d 95.143.188.166 -p tcp --dport 5349 -j DNAT --to-destination 10.50.0.103:5349
# TURN relay
iptables -t nat -A PREROUTING -d 95.143.188.166 -p udp --dport 49152:49200 -j DNAT --to-destination 10.50.0.118
# LiveKit RTC
iptables -t nat -A PREROUTING -d 95.143.188.166 -p udp --dport 50000:50100 -j DNAT --to-destination 10.50.0.118
# сохранить (Debian/Ubuntu)
netfilter-persistent save
```

## Coturn: relay-кандидат должен быть 95.x, не 172.18.0.x

В логах coturn «Local relay addr: 172.18.0.x» — это внутренний адрес; клиенту в XOR-RELAYED-ADDRESS должен уходить **95.143.188.166**. Если клиент получает 172.18.0.x (в trickle-ice или webrtc-internals виден relay с 172.x), то CREATE_PERMISSION будет на 172.x и трафик через шлюз не совпадёт.

**Что проверить:** в `deploy/coturn.conf` заданы `listening-ip=172.18.0.4` и `external-ip=95.143.188.166/172.18.0.4`. В `docker-compose.yml` у контейнера coturn должен быть **фиксированный** IP в сети: `networks.nonza-network.ipv4_address: 172.18.0.4`. Тогда аллокация на 172.18.0.4 маппится в 95.143.188.166 в ответе клиенту. После правок перезапустить coturn и в trickle-ice убедиться, что relay-кандидат — 95.143.188.166.

## Порты для TURN (coturn) на основном сервере

На хосте, где крутится Docker с coturn, во внешнем файрволе (и в облачной security group) должны быть открыты:

| Порт            | Протокол | Назначение                                                             |
| --------------- | -------- | ---------------------------------------------------------------------- |
| **5349**        | TCP      | TURN over TLS (`turns:`), клиенты подключаются сюда                    |
| **3478**        | TCP, UDP | TURN/STUN (если используете также `turn:` без TLS)                     |
| **49152–49200** | UDP      | Relay-порты: сюда coturn принимает и шлёт ретранслируемый медиа-трафик |

**Откуда 49177:** в `coturn.conf` заданы `min-port=49152` и `max-port=49200`. При каждой TURN-аллокации coturn выдаёт клиенту один порт из этого диапазона (например 49177). Адрес вида `95.x.x.x:49177` — это и есть relay-кандидат клиента.

**Проверка портов:** `nc -u 95.143.188.166 49177` будет «висеть» — для UDP это нормально: соединения нет, TURN ждёт пакеты в формате STUN/TURN, а не произвольные данные. Проверить, что порты слушаются на хосте: `ss -ulnp | grep -E '49152|49177'` или `ss -ulnp | grep 49152` (диапазон может быть одним сокетом).

## Проброс портов и nginx для TURN (turn.nonza.ru)

Клиент использует **два канала** к TURN:

1. **TCP 5349** — установка сессии и контроль (`turns:turn.nonza.ru:5349`). Сюда можно повесить nginx stream (TLS + proxy к coturn).
2. **UDP 49152–49200** — relay, медиа. Nginx здесь не участвует — пакеты должны идти **напрямую** на хост, где слушает coturn.

**У нас:** coturn и LiveKit на **10.50.0.118**, nginx на **10.50.0.103**. В nginx stream: `proxy_pass 10.50.0.118:5349`. На шлюзе relay UDP 49152–49200 → **10.50.0.118**.

**Чеклист:**

| Где                     | Что проверить                                                                                    |
| ----------------------- | ------------------------------------------------------------------------------------------------ |
| **Шлюз 95.143.188.166** | TCP 5349 → 10.50.0.103 (nginx). UDP 49152:49200 → 10.50.0.118 (coturn). UDP 50000:50100 → 10.50.0.118 (LiveKit). |
| **Nginx (10.50.0.103)** | Stream 5349 ssl, `proxy_pass 10.50.0.118:5349`. Сертификат для turn.nonza.ru.                    |
| **Хост 10.50.0.118**    | Docker: LiveKit, coturn. Файрвол: TCP 5349, UDP 49152–49200, 50000–50100.                         |

Дополнительные порты (3478 TCP/UDP) нужны только если клиенты подключаются по `turn:` без TLS; при `turns:turn.nonza.ru:5349` достаточно 5349 и relay 49152–49200.

Подробнее: `deploy/PORT-FORWARDING-ROUTER.md`, `deploy/nginx-turn-stream.conf`.

## TURN (coturn) и LiveKit: hairpin (ICE failed, requestsSent &gt; 0, responsesReceived = 0)

Relay-кандидат клиента — `95.x.x.x:49177`. LiveKit шлёт STUN на этот адрес. Если трафик «на себя» не попадает в coturn, ICE-пара остаётся в failed.

**Куда вешать hairpin** — на тот хост, **куда приходят** пакеты на 95.143.188.166:49152–49200. От этого зависит, куда делать DNAT:

| Топология | Где запускать скрипт | DNAT (TURN_COTURN_CONTAINER_IP) |
|-----------|----------------------|----------------------------------|
| Публичный IP на том же хосте, что и Docker | Хост с Docker | 172.18.0.4 (IP контейнера coturn) |
| Публичный IP на шлюзе (95.143.188.166), хост с Docker за NAT (10.50.0.118) | **Шлюз 95.143.188.166** | **10.50.0.118** (хост с coturn) |

У нас: шлюз 95.143.188.166, LiveKit и coturn на 10.50.0.118, nginx на 10.50.0.103. Правила — **на шлюз**. DNAT на 10.50.0.118. Скрипт при `COTURN_IP=10.x` добавляет **SNAT** (источник 10.50.0.118 → 95.143.188.166), чтобы coturn видел peer 95.143.188.166:

```bash
# На шлюзе 95.143.188.166:
sudo TURN_COTURN_CONTAINER_IP=10.50.0.118 ./deploy/turn-hairpin-iptables.sh add
sudo ./deploy/turn-hairpin-iptables.sh save
```

Если публичный IP и Docker на одной машине (нет отдельного шлюза):

```bash
sudo ./deploy/turn-hairpin-iptables.sh add
sudo ./deploy/turn-hairpin-iptables.sh save
```

Проверка: `sudo ./deploy/turn-hairpin-iptables.sh check` — в выводе DNAT на нужный IP для 49152–49200.

Удалить: `sudo ./deploy/turn-hairpin-iptables.sh del`.

**Почему не работает (failed, 0 responses):** браузер в TURN разрешает приём только от адреса из CREATE_PERMISSION (то, что пришло в кандидатах LiveKit). Пакеты от LiveKit после шлюза приходят в coturn с **src 95.143.188.166** (SNAT). Если браузер прислал CREATE_PERMISSION(**172.18.0.4**), coturn ждёт только 172.18.0.4 → не совпадает → пакет отбрасывается, ответ не уходит.

**172.18.0.4 может быть IP контейнера LiveKit в Docker.** Тогда LiveKit отдаёт свой Docker-адрес в кандидатах. Два пути: (1) LiveKit не светить 172.18.0.x — только `node_ip` 95.143.188.166, тогда браузер шлёт CREATE_PERMISSION(95.143.188.166) и трафик через шлюз+SNAT совпадает. (2) Если кандидат 172.18.0.4 остаётся — чтобы пакет пришёл в coturn с src 172.18.0.4, LiveKit должен слать на relay **напрямую на локальный IP coturn** (например 172.18.0.2:port), а не на 95.143.188.166; тогда трафик идёт внутри Docker и coturn видит 172.18.0.4. Кто какой IP в сети: `docker inspect -f '{{.Name}} {{range .NetworkSettings.Networks}}{{.IPAddress}}{{end}}' $(docker ps -q)`. У нас coturn=172.18.0.4, LiveKit=172.18.0.5. Если в coturn «peer 172.18.0.4», а **в браузере (webrtc-internals) 172.18.0.4 нет** — CREATE_PERMISSION(172.18.0.4) шлёт не браузер, а **LiveKit-сервер** (он тоже может быть TURN-клиентом). Тогда править надо конфиг/поведение LiveKit при работе с coturn, чтобы сервер не подставлял 172.18.0.4 (адрес coturn) в permission. Если 172 есть в браузере — в SDP должен быть только `node_ip` 95.143.188.166.

**Всё ещё failed, в coturn «peer 172.18.0.4»:** браузер шлёт CREATE_PERMISSION(172.18.0.4), значит в SDP у клиента всё ещё есть кандидат 172.18.0.4. В `livekit-config.yaml` должны быть `use_external_ip: false` и `node_ip: "95.143.188.166"`, перезапусти LiveKit после правок.

**Проверки:** (1) **Обратный путь:** на шлюзе DNAT 95.143.188.166:50000–50100 (UDP) → 10.50.0.118. (2) **Кэш:** зайти в инкогнито или Ctrl+Shift+R. (3) **Откуда в SDP 172.18.0.4:** в Chrome `chrome://webrtc-internals` → нужный PeerConnection. Если в «addIceCandidate» только 95.x, но coturn пишет peer 172.18.0.4 — 172 может быть **в теле answer**: в «setRemoteDescription» (answer) поискать по «172» или «candidate». Либо это кандидат из ответа LiveKit, пришедший не trickle, а в SDP. Убедиться, что в **полном** answer нет строки с 172.18.0.4. (4) **172.18.0.4 только в логах, в браузере нет:** CREATE_PERMISSION шлёт тот, у кого есть TURN-аллокация (у нас — только браузер; LiveKit TURN в конфиге выключен). Значит 172.18.0.4 мог прийти в **другом** PeerConnection (например subscriber vs publisher) или от **другой вкладки/участника**. В webrtc-internals открыть **все** PeerConnection и в каждом проверить «addIceCandidate» и «setRemoteDescription» на 172. Сопоставить по времени лог coturn «peer 172.18.0.4» с конкретным соединением. (5) **Доходит ли запрос с 95.x до coturn:** на 10.50.0.118 во время звонка выполнить `sudo tcpdump -i any -n udp port 49153 -c 20`. Смотреть `src` у пакетов на 49153: если приходит с 95.143.188.166 — SNAT на шлюзе срабатывает, тогда проблема только в том, что браузер не шлёт CREATE_PERMISSION(95.143.188.166); если с 10.50.0.118 — SNAT не сработал (проверить порядок правил на шлюзе).

## 401 Unauthorized от TURN (coturn)

В логах coturn: `check_stun_auth: Cannot find credentials of user <timestamp:ttl>` — запрос доходит, но coturn не принимает креды. При `use-auth-secret` это почти всегда **разный секрет у backend и coturn**.

**Один источник секрета:** в репо секрет не прописан в `deploy/coturn.conf` — он передаётся только через env. В `docker-compose` у coturn указан `env_file: backend/.env`; entrypoint при `TURN_USE_AUTH` и `TURN_SECRET` подставляет `--static-auth-secret`. Не дублируй секрет в конфиге (`static-auth-secret=...` в coturn.conf): тогда backend и coturn гарантированно берут одно и то же из `.env`. В `.env` задай `TURN_SECRET=<твой_секрет>` без кавычек и без переноса строки в конце; при необходимости `TURN_USE_AUTH=1`.

**Проверка на сервере:**

1. Взять из ответа API токена комнаты поля `ice_servers[].username` и `ice_servers[].credential`.
2. На хосте с тем же секретом, что в `backend/.env` (TURN_SECRET), выполнить:
   ```bash
   echo -n "<username из токена>" | openssl dgst -sha1 -hmac "<TURN_SECRET из .env>" -binary | base64
   ```
3. Сравнить вывод с `credential` из токена. Совпадает — backend считает верно, секрет в coturn другой (проверить, что в контейнере тот же секрет: `docker exec nonza-coturn env | grep TURN`). Не совпадает — в backend приходит другой секрет (источник конфига при запуске).

Формула: `credential = base64(hmac_sha1(secret, username))`, без realm. Backend и entrypoint нормализуют секрет (trim, убирают `\r\n`); должна использоваться одна и та же строка.

**Тест без auth:** чтобы проверить, что TURN вообще отвечает (порты, TLS, relay), можно временно отключить аутентификацию. В `.env` для coturn задай `TURN_NO_AUTH=1`, перезапусти контейнер coturn. В [trickle-ice](https://webrtc.github.io/samples/src/content/peerconnection/trickle-ice/) добавь только URL, например `turns:turn.nonza.ru:5349`, без username/credential. После проверки убери `TURN_NO_AUTH` и включи снова `TURN_USE_AUTH` и `TURN_SECRET`.

## Ошибка 701 на клиенте (onicecandidateerror)

Если в консоли/webrtc-internals: `error_code 701`, "Address not associated with the desired network interface" для `turns:turn.nonza.ru:5349` — браузер не может привязать TURN к выбранному интерфейсу (часто при нескольких сетях: VPN, Wi‑Fi + Ethernet). При `iceTransportPolicy: "relay"` из-за этого соединение падает. Это клиентская/сетевая особенность, не сервер. Проверить без принудительного relay или с другой сети/браузера.

## Проверка

После включения TURN и открытия портов пользователи из проблемных сетей должны подключаться без ошибки ICE. При необходимости можно открыть `about:webrtc` в Chrome и посмотреть, какие ICE-кандидаты собираются и используются.
