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
| **155.212.181.137**  | Публичный IP (шлюз). Сюда приходит весь внешний трафик. |
| **10.50.0.103**     | Только nginx (TLS, proxy на бэкенд, LiveKit, TURN). |
| **10.50.0.118**     | Сервер с Docker: LiveKit и coturn. |

На шлюзе нужны DNAT: 155.212.181.137:5349 (TCP) → 10.50.0.103 (nginx), 155.212.181.137:49152–49200 (UDP) → 10.50.0.118 (coturn), 155.212.181.137:50000–50100 (UDP) → 10.50.0.118 (LiveKit). Nginx на 10.50.0.103 проксирует turns на 10.50.0.118:5349.

### Список команд на шлюзе (155.212.181.137)

Только iptables (скрипт на шлюзе не нужен). Подставь свой публичный IP при необходимости.

**Добавить правила:**

```bash
# 1. DNAT: TURN control (TCP 5349) → nginx
sudo iptables -t nat -A PREROUTING -d 155.212.181.137 -p tcp --dport 5349 -j DNAT --to-destination 10.50.0.103:5349

# 2. DNAT: TURN relay (UDP 49152–49200) → хост с coturn
sudo iptables -t nat -A PREROUTING -i br+ -d 155.212.181.137 -p udp --dport 49152:49200 -j DNAT --to-destination 10.50.0.118
sudo iptables -t nat -A PREROUTING -d 155.212.181.137 -p udp --dport 49152:49200 -j DNAT --to-destination 10.50.0.118
sudo iptables -t nat -A OUTPUT -d 155.212.181.137 -p udp --dport 49152:49200 -j DNAT --to-destination 10.50.0.118
# SNAT: пакеты от 10.50.0.118 к relay приходят с src 155.212.181.137 — coturn примет по CREATE_PERMISSION(95.x)
sudo iptables -t nat -A POSTROUTING -s 10.50.0.118 -d 10.50.0.118 -p udp --dport 49152:49200 -j SNAT --to-source 155.212.181.137

# 3. DNAT: LiveKit RTC (UDP 50000–50100) → хост с LiveKit
sudo iptables -t nat -A PREROUTING -d 155.212.181.137 -p udp --dport 50000:50100 -j DNAT --to-destination 10.50.0.118

# 4. Сохранить (Debian/Ubuntu)
sudo netfilter-persistent save
```

**Проверка (две команды по отдельности):**
```bash
sudo iptables -t nat -L PREROUTING -n -v
sudo iptables -t nat -L POSTROUTING -n -v
```

**Удалить правила (откат).** Если правил несколько одинаковых — выполнить блок столько раз, пока не начнёт ругаться «No chain/target/match», затем один раз `sudo netfilter-persistent save`.

```bash
sudo iptables -t nat -D PREROUTING -d 155.212.181.137 -p udp --dport 50000:50100 -j DNAT --to-destination 10.50.0.118
sudo iptables -t nat -D POSTROUTING -s 10.50.0.118 -d 10.50.0.118 -p udp --dport 49152:49200 -j SNAT --to-source 155.212.181.137
sudo iptables -t nat -D OUTPUT -d 155.212.181.137 -p udp --dport 49152:49200 -j DNAT --to-destination 10.50.0.118
sudo iptables -t nat -D PREROUTING -d 155.212.181.137 -p udp --dport 49152:49200 -j DNAT --to-destination 10.50.0.118
sudo iptables -t nat -D PREROUTING -i br+ -d 155.212.181.137 -p udp --dport 49152:49200 -j DNAT --to-destination 10.50.0.118
sudo iptables -t nat -D PREROUTING -d 155.212.181.137 -p tcp --dport 5349 -j DNAT --to-destination 10.50.0.103:5349
sudo netfilter-persistent save
```

Правила с `eth1` и `0.0.0.0/0` (если есть в выводе) — из другой настройки; их этот блок не трогает. Удалять вручную при необходимости.

## Coturn: relay-кандидат должен быть 95.x, не 172.18.0.x

В логах coturn «Local relay addr: 172.18.0.x» — это внутренний адрес; клиенту в XOR-RELAYED-ADDRESS должен уходить **155.212.181.137**. Если клиент получает 172.18.0.x (в trickle-ice или webrtc-internals виден relay с 172.x), то CREATE_PERMISSION будет на 172.x и трафик через шлюз не совпадёт.

**Что проверить:** в `deploy/coturn.conf` заданы `listening-ip=172.18.0.4` и `external-ip=155.212.181.137/172.18.0.4`. В `docker-compose.yml` у контейнера coturn должен быть **фиксированный** IP в сети: `networks.nonza-network.ipv4_address: 172.18.0.4`. Тогда аллокация на 172.18.0.4 маппится в 155.212.181.137 в ответе клиенту. После правок перезапустить coturn и в trickle-ice убедиться, что relay-кандидат — 155.212.181.137.

## LiveKit + Docker: чеклист конфигов

Если ICE не поднимается или «removing participant without connection», сверь конфиги:

**`deploy/livekit-config.yaml`:**
- `rtc.use_external_ip: false` — не обнаруживать внешний IP через STUN (иначе может появиться лишний кандидат).
- `rtc.node_ip: "155.212.181.137"` — единственный IP в кандидатах LiveKit (публичный адрес шлюза).
- `rtc.port_range_start/end` — 50000–50100, совпадают с пробросом в docker-compose и с DNAT на шлюзе (50000–50100 → хост с LiveKit).
- `rtc.ips.excludes` — 172.16.0.0/12, 10.0.0.0/8, чтобы не рекламировать Docker/внутренние адреса.
- `rtc.allow_tcp_fallback: true` — запасной путь по TCP (7881), если UDP не проходит.

**`docker-compose.yml`:**
- У **livekit** в `networks.nonza-network`: `ipv4_address: 172.18.0.5` (фиксированный IP).
- У **coturn** в `networks.nonza-network`: `ipv4_address: 172.18.0.4`.
- Проброс портов LiveKit: 7880, 7881, 50000–50100/udp (на хосте 10.50.0.118 должны быть открыты и на шлюзе DNAT 95.x:50000–50100 → 10.50.0.118).

**Сеть:** хост 10.50.0.118 должен принимать трафик на 7880 (TCP), 7881 (TCP), 50000–50100 (UDP). Шлюз 155.212.181.137 делает DNAT на 10.50.0.118 для этих портов.

После правок: `docker compose up -d livekit coturn`, проверить логи LiveKit при входе в комнату.

## Порты для TURN (coturn) на основном сервере

На хосте, где крутится Docker с coturn, во внешнем файрволе (и в облачной security group) должны быть открыты:

| Порт            | Протокол | Назначение                                                             |
| --------------- | -------- | ---------------------------------------------------------------------- |
| **5349**        | TCP      | TURN over TLS (`turns:`), клиенты подключаются сюда                    |
| **3478**        | TCP, UDP | TURN/STUN (если используете также `turn:` без TLS)                     |
| **49152–49200** | UDP      | Relay-порты: сюда coturn принимает и шлёт ретранслируемый медиа-трафик |

**Откуда 49177:** в `coturn.conf` заданы `min-port=49152` и `max-port=49200`. При каждой TURN-аллокации coturn выдаёт клиенту один порт из этого диапазона (например 49177). Адрес вида `95.x.x.x:49177` — это и есть relay-кандидат клиента.

**Проверка портов:** `nc -u 155.212.181.137 49177` будет «висеть» — для UDP это нормально: соединения нет, TURN ждёт пакеты в формате STUN/TURN, а не произвольные данные. Проверить, что порты слушаются на хосте: `ss -ulnp | grep -E '49152|49177'` или `ss -ulnp | grep 49152` (диапазон может быть одним сокетом).

## Проброс портов и nginx для TURN (turn.nonza.ru)

Клиент использует **два канала** к TURN:

1. **TCP 5349** — установка сессии и контроль (`turns:turn.nonza.ru:5349`). Сюда можно повесить nginx stream (TLS + proxy к coturn).
2. **UDP 49152–49200** — relay, медиа. Nginx здесь не участвует — пакеты должны идти **напрямую** на хост, где слушает coturn.

**У нас:** coturn и LiveKit на **10.50.0.118**, nginx на **10.50.0.103**. В nginx stream: `proxy_pass 10.50.0.118:5349`. На шлюзе relay UDP 49152–49200 → **10.50.0.118**.

**Чеклист:**

| Где                     | Что проверить                                                                                    |
| ----------------------- | ------------------------------------------------------------------------------------------------ |
| **Шлюз 155.212.181.137** | TCP 5349 → 10.50.0.103 (nginx). UDP 49152:49200 → 10.50.0.118 (coturn). UDP 50000:50100 → 10.50.0.118 (LiveKit). |
| **Nginx (10.50.0.103)** | Stream 5349 ssl, `proxy_pass 10.50.0.118:5349`. Сертификат для turn.nonza.ru.                    |
| **Хост 10.50.0.118**    | Docker: LiveKit, coturn. Файрвол: TCP 5349, UDP 49152–49200, 50000–50100.                         |

Дополнительные порты (3478 TCP/UDP) нужны только если клиенты подключаются по `turn:` без TLS; при `turns:turn.nonza.ru:5349` достаточно 5349 и relay 49152–49200.

Подробнее: `deploy/PORT-FORWARDING-ROUTER.md`, `deploy/nginx-turn-stream.conf`.

## TURN (coturn) и LiveKit: hairpin (ICE failed, requestsSent &gt; 0, responsesReceived = 0)

Relay-кандидат клиента — `95.x.x.x:49177`. LiveKit шлёт STUN на этот адрес. Если трафик «на себя» не попадает в coturn, ICE-пара остаётся в failed.

**Куда вешать hairpin** — на тот хост, **куда приходят** пакеты на 155.212.181.137:49152–49200. От этого зависит, куда делать DNAT:

| Топология | Где запускать скрипт | DNAT (TURN_COTURN_CONTAINER_IP) |
|-----------|----------------------|----------------------------------|
| Публичный IP на том же хосте, что и Docker | Хост с Docker | 172.18.0.4 (IP контейнера coturn) |
| Публичный IP на шлюзе (155.212.181.137), хост с Docker за NAT (10.50.0.118) | **Шлюз 155.212.181.137** | **10.50.0.118** (хост с coturn) |

У нас: шлюз 155.212.181.137, LiveKit и coturn на 10.50.0.118, nginx на 10.50.0.103. Правила — **на шлюз**. DNAT на 10.50.0.118 и **SNAT** (источник 10.50.0.118 → 155.212.181.137): пакеты от LiveKit к 95.x:49152–49200 после DNAT уходят на хост 10.50.0.118 уже с src 155.212.181.137, Docker доставляет их в coturn — coturn видит peer 95.x. **На шлюзе используй блок команд выше** («Список команд на шлюзе») — только iptables, скрипт не нужен.

Если публичный IP и Docker на **одной** машине (нет отдельного шлюза), правила вешаются на этот хост; можно использовать скрипт `deploy/turn-hairpin-iptables.sh add` с `TURN_COTURN_CONTAINER_IP=172.18.0.4` (IP контейнера coturn).

**Почему не работает (failed, 0 responses):** браузер в TURN разрешает приём только от адреса из CREATE_PERMISSION (то, что пришло в кандидатах LiveKit). Пакеты от LiveKit после шлюза приходят в coturn с **src 155.212.181.137** (SNAT). Если браузер прислал CREATE_PERMISSION(**172.18.0.4**), coturn ждёт только 172.18.0.4 → не совпадает → пакет отбрасывается, ответ не уходит.

**172.18.0.4 может быть IP контейнера LiveKit в Docker.** Тогда LiveKit отдаёт свой Docker-адрес в кандидатах. Два пути: (1) LiveKit не светить 172.18.0.x — только `node_ip` 155.212.181.137, тогда браузер шлёт CREATE_PERMISSION(155.212.181.137) и трафик через шлюз+SNAT совпадает. (2) Если кандидат 172.18.0.4 остаётся — чтобы пакет пришёл в coturn с src 172.18.0.4, LiveKit должен слать на relay **напрямую на локальный IP coturn** (например 172.18.0.2:port), а не на 155.212.181.137; тогда трафик идёт внутри Docker и coturn видит 172.18.0.4. Кто какой IP в сети: `docker inspect -f '{{.Name}} {{range .NetworkSettings.Networks}}{{.IPAddress}}{{end}}' $(docker ps -q)`. У нас coturn=172.18.0.4, LiveKit=172.18.0.5. Если в coturn «peer 172.18.0.4», а **в браузере (webrtc-internals) 172.18.0.4 нет** — CREATE_PERMISSION(172.18.0.4) шлёт не браузер, а **LiveKit-сервер** (он тоже может быть TURN-клиентом). Тогда править надо конфиг/поведение LiveKit при работе с coturn, чтобы сервер не подставлял 172.18.0.4 (адрес coturn) в permission. Если 172 есть в браузере — в SDP должен быть только `node_ip` 155.212.181.137.

**Всё ещё failed, в coturn «peer 172.18.0.x»:** браузер шлёт CREATE_PERMISSION(172.x), значит LiveKit отдал клиенту свой Docker-адрес. В `livekit-config.yaml`: `use_external_ip: false`, `node_ip: "155.212.181.137"`, и блок `rtc.ips.excludes` (172.16.0.0/12, 10.0.0.0/8), чтобы не рекламировать внутренние адреса. В `docker-compose.yml` у LiveKit задать фиксированный `ipv4_address: 172.18.0.5`, у coturn — `172.18.0.4`. Перезапустить контейнеры.

**Проверки:** (1) **Обратный путь:** на шлюзе DNAT 155.212.181.137:50000–50100 (UDP) → 10.50.0.118. (2) **Кэш:** зайти в инкогнито или Ctrl+Shift+R. (3) **Откуда в SDP 172.18.0.4:** в Chrome `chrome://webrtc-internals` → нужный PeerConnection. Если в «addIceCandidate» только 95.x, но coturn пишет peer 172.18.0.4 — 172 может быть **в теле answer**: в «setRemoteDescription» (answer) поискать по «172» или «candidate». Либо это кандидат из ответа LiveKit, пришедший не trickle, а в SDP. Убедиться, что в **полном** answer нет строки с 172.18.0.4. (4) **172.18.0.4 только в логах, в браузере нет:** CREATE_PERMISSION шлёт тот, у кого есть TURN-аллокация (у нас — только браузер; LiveKit TURN в конфиге выключен). Значит 172.18.0.4 мог прийти в **другом** PeerConnection (например subscriber vs publisher) или от **другой вкладки/участника**. В webrtc-internals открыть **все** PeerConnection и в каждом проверить «addIceCandidate» и «setRemoteDescription» на 172. Сопоставить по времени лог coturn «peer 172.18.0.4» с конкретным соединением. (5) **Доходит ли трафик до relay:** порт relay каждый раз другой (49154, 49177, …). На **хосте с Docker** (antonenko) сначала узнать интерфейс до шлюза: `ip route get 155.212.181.137` (или `ip a` — смотреть, на каком интерфейсе 10.50.0.118), например `eth0`. Затем **до** входа в комнату:
   ```bash
   sudo tcpdump -i eth0 -n 'udp portrange 49152-49200' -v
   ```
   (подставь свой интерфейс вместо eth0). Без `-c`. Зайти с `?relay=1`, подождать 15–20 с, Ctrl+C. **Out** с dport 49152–49200 — пакеты от LiveKit к relay (на шлюз). **In** с src 155.212.181.137 — ответы/трафик после SNAT к coturn. Если на `any` выходит "0 captured" — пробовать именно интерфейс с маршрутом до 95.x.

   **Если на eth0 по-прежнему 0 пакетов:** возможно LiveKit шлёт на **172.18.0.4** (coturn в Docker), а не на 95.x — тогда трафик не выходит на eth0. На antonenko в отдельном терминале:
   ```bash
   sudo tcpdump -i docker0 -n 'udp portrange 49152-49200' -v
   ```
   Снова зайти с `?relay=1`, подождать 15–20 с. Если пакеты есть на **docker0** — LiveKit использует адрес coturn 172.18.0.4; нужно, чтобы сервер слал на **155.212.181.137** (кандидат клиента), тогда пойдёт hairpin через шлюз (DNAT+SNAT). Проверить конфиг LiveKit: `node_ip`, `rtc.ips.excludes`, что в ответах клиенту только 95.x.

   **Если пакетов нет ни на eth0, ни на docker0:** LiveKit **вообще не шлёт UDP** на relay-адрес клиента (95.x:port), хотя в логах есть `publisherCandidates: ["... relay 95.143.188....:49178"]`. Трафик client→TURN→LiveKit идёт (клиент шлёт через coturn), но ответов LiveKit→95.x:relay_port не видно — в coturn «peer usage rp=0, rb=0». Значит проблема в ICE/транспорте LiveKit (Pion): сервер не отправляет проверки/ответы на relay-кандидат. Дальше: (1) Включить в `livekit-config.yaml` `log_level: debug`, перезапустить LiveKit, повторить вход с `?relay=1` и по логам смотреть ICE (кандидаты, выбранная пара, ошибки). (2) Проверить версию LiveKit и обновить при возможности. (3) Поиск/issue в репо livekit/server или pion/webrtc по «relay candidate», «ICE not sending to relay», «removing participant without connection» + relay.

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

В логе браузера: `error_code 701`, "Address not associated with the desired network interface" для `turns:turn.nonza.ru:5349`, `host_candidate: "192.168.0.x:..."` — браузер не может привязать TURN к выбранному интерфейсу (часто при нескольких сетях: VPN, Wi‑Fi 192.168.0.x + Ethernet). При `iceTransportPolicy: "relay"` из-за этого relay не поднимается, ICE не устанавливается, в логах LiveKit — «removing participant without connection», в coturn нет CREATE_PERMISSION. Это клиентская/сетевая особенность, не сервер.

**Что сделать:** (1) По умолчанию политика ICE без принудительного relay (TURN в ice_servers как запасной путь). (2) Если из-за двух интерфейсов (VPN + LAN) host-кандидаты недостижимы с сервера и ICE не успевает перейти на relay — открыть комнату с **?relay=1**: `https://meet.nonza.ru/?code=XXX&relay=1`. Тогда используется только TURN (риск 701 при том же VPN). (3) С одной сети/без VPN 701 обычно не воспроизводится.

## Проверка

После включения TURN и открытия портов пользователи из проблемных сетей должны подключаться без ошибки ICE. При необходимости можно открыть `about:webrtc` в Chrome и посмотреть, какие ICE-кандидаты собираются и используются.
