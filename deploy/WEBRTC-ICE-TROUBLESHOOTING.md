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

**Где крутится coturn.** Если docker-compose с coturn на **10.50.0.103** (вместе с nginx): в nginx stream указывай `proxy_pass 127.0.0.1:5349`; на шлюзе relay UDP 49152–49200 пробрасывай на **10.50.0.103**. Если coturn на **10.50.0.118**: в nginx — `proxy_pass 10.50.0.118:5349`, relay на шлюзе — на **10.50.0.118**.

**Чеклист:**

| Где                     | Что проверить                                                                                                                        |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| **Шлюз 95.143.188.166** | TCP 5349 → DNAT на хост с nginx (10.50.0.103). UDP 49152:49200 → DNAT на хост, где запущен coturn (10.50.0.103 или 10.50.0.118).     |
| **Nginx (10.50.0.103)** | Stream‑блок слушает 5349 ssl, `proxy_pass` на адрес:порт coturn (127.0.0.1:5349 или 10.50.0.118:5349). Сертификат для turn.nonza.ru. |
| **Хост с coturn**       | Файрвол: разрешён входящий TCP 5349 (от nginx или из интернета), входящий UDP 49152–49200. Docker публикует эти порты.               |

Дополнительные порты (3478 TCP/UDP) нужны только если клиенты подключаются по `turn:` без TLS; при `turns:turn.nonza.ru:5349` достаточно 5349 и relay 49152–49200.

Подробнее: `deploy/PORT-FORWARDING-ROUTER.md`, `deploy/nginx-turn-stream.conf`.

## TURN (coturn) и LiveKit: hairpin (ICE failed, requestsSent &gt; 0, responsesReceived = 0)

Relay-кандидат клиента — `95.x.x.x:49177`. LiveKit шлёт STUN на этот адрес. Если трафик «на себя» не попадает в coturn, ICE-пара остаётся в failed.

**Куда вешать hairpin** — на тот хост, **куда приходят** пакеты на 95.143.188.166:49152–49200. От этого зависит, куда делать DNAT:

| Топология | Где запускать скрипт | DNAT (TURN_COTURN_CONTAINER_IP) |
|-----------|----------------------|----------------------------------|
| Публичный IP на том же хосте, что и Docker | Хост с Docker | 172.18.0.4 (IP контейнера coturn) |
| Публичный IP на шлюзе (95.143.188.166), хост с Docker за NAT (10.50.0.118) | **Шлюз 95.143.188.166** | **10.50.0.118** (хост с coturn) |

У тебя: шлюз 95.143.188.166, coturn на 10.50.0.118, LiveKit/nginx на 10.50.0.103. Правила — **на шлюз**. DNAT на 10.50.0.118. Скрипт при `COTURN_IP=10.x` добавляет **SNAT**: источник трафика на 10.50.0.118:49152–49200 подменяется на 95.143.188.166, чтобы coturn видел peer 95.143.188.166 (иначе ICE failed). Если LiveKit на **другом** хосте (10.50.0.103), задай его IP в `TURN_HAIRPIN_SNAT_SOURCE_IPS`:

```bash
# На шлюзе 95.143.188.166:
sudo TURN_COTURN_CONTAINER_IP=10.50.0.118 TURN_HAIRPIN_SNAT_SOURCE_IPS=10.50.0.103 ./deploy/turn-hairpin-iptables.sh add
sudo ./deploy/turn-hairpin-iptables.sh save
```

Если публичный IP и Docker на одной машине (нет отдельного шлюза):

```bash
sudo ./deploy/turn-hairpin-iptables.sh add
sudo ./deploy/turn-hairpin-iptables.sh save
```

Проверка: `sudo ./deploy/turn-hairpin-iptables.sh check` — в выводе DNAT на нужный IP для 49152–49200.

Удалить: `sudo ./deploy/turn-hairpin-iptables.sh del`.

**Всё ещё failed, в coturn «peer 172.18.0.4»:** браузер шлёт CREATE_PERMISSION по адресу из кандидата LiveKit. Если в SDP попал внутренний IP (172.18.0.x), то после SNAT coturn видит 95.143.188.166 и не совпадает с разрешённым 172.x. Нужно, чтобы LiveKit отдавал клиенту только публичный IP. В `deploy/livekit-config.yaml` уже стоит `node_ip: "95.143.188.166"`. Попробуй временно выставить `use_external_ip: false` (оставив `node_ip`): тогда LiveKit не будет делать STUN-обнаружение и может отдавать только `node_ip`. Перезапусти LiveKit и проверь звонок снова. Если станет хуже (клиенты с других сетей перестанут подключаться), верни `use_external_ip: true`.

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

## Проверка

После включения TURN и открытия портов пользователи из проблемных сетей должны подключаться без ошибки ICE. При необходимости можно открыть `about:webrtc` в Chrome и посмотреть, какие ICE-кандидаты собираются и используются.
