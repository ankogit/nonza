# LiveKit: порты и поддомены — что сделать

Клиенты не подключаются «напрямую к порту» с интернета. Им нужны либо **прокинутые порты** на сервер с LiveKit, либо **TURN через поддомен на 443**. Ниже оба варианта.

---

## 1. Поддомен для сигналинга (обязательно)

Клиент сначала подключается по WebSocket к LiveKit (сигналинг).

- **Поддомен:** `ws.nonza.ru`
- **LiveKit на хосте:** `10.50.0.118:7880`
- **Порт снаружи:** 443 (HTTPS/WSS).
- **Что сделать:** в nginx настроить `wss://ws.nonza.ru` → проксирование на `http://10.50.0.118:7880` (см. `deploy/nginx-livekit.conf`).
- В бэкенде в `.env`: **WEBRTC_PUBLIC_URL** = `wss://ws.nonza.ru` (этот URL отдаётся клиенту в токене).

Без этого шага подключение к комнате вообще не начнётся.

---

## 2. Медиа (WebRTC): два варианта

После сигналинга браузер строит медиа-соединение по тем адресам/портам, которые отдаёт LiveKit. Если до этих пор «с улицы» нельзя достучаться, будет ошибка **could not establish pc connection**.

### Вариант A: Можно прокидывать порты на сервер с LiveKit

Прокинуть на хост, где крутится LiveKit:

| Порт   | TCP/UDP | Назначение        |
|--------|--------|--------------------|
| 7881   | TCP    | ICE/TCP            |
| 50000–50100 | UDP | ICE/UDP (из `livekit-config.yaml`) |
| 3478   | UDP    | TURN               |

Порт **7880** снаружи не нужен, если клиент ходит на LiveKit только через поддомен (п.1).

- В конфиге LiveKit уже стоит `use_external_ip: true` (или `node_ip`) — сервер отдаёт свой IP в ICE.
- Если LiveKit за NAT, прокидывать порты нужно **на роутере** на хост с LiveKit.

**Если прокинуть порты нельзя:** во фронте включён **relay-only** (`iceTransportPolicy: "relay"`) — клиент использует только TURN (turn.nonza.ru:5349), порты 7881 и 50000–50100 снаружи не нужны. Убедись, что TURN настроен (вариант B ниже) и порт 5349 открыт на nginx.

**LiveKit в Docker на 10.50.0.118, публичный IP 95.143.188.166**

В `docker-compose.yml` порты уже проброшены (`7881:7881`, `50000-50100:50000-50100/udp`, при необходимости `3478:3478/udp`). Остаётся открыть их снаружи.

- **Если 10.50.0.118 — это тот же хост, у которого публичный IP 95.143.188.166** (VPS/облако): открыть входящие правила файрвола на этом сервере:
  - **TCP 7881**
  - **UDP 50000–50100**
  - **UDP 3478** (если используешь встроенный TURN)
  
  Пример для **ufw** (на сервере 10.50.0.118):
  ```bash
  sudo ufw allow 7881/tcp
  sudo ufw allow 50000:50100/udp
  sudo ufw allow 3478/udp
  sudo ufw reload
  ```
  В облаке (AWS Security Group, GCP Firewall и т.п.) добавить те же правила для входящего трафика на инстанс с 95.143.188.166.

- **Если 95.143.188.166 — роутер, а 10.50.0.118 — машина внутри сети:** на роутере настроить **проброс портов (Port Forwarding)** на 10.50.0.118:
  - Внешний TCP 7881 → 10.50.0.118:7881
  - Внешний UDP 50000–50100 → 10.50.0.118:50000–50100
  - Внешний UDP 3478 → 10.50.0.118:3478

В `livekit-config.yaml` должен быть **node_ip: "95.143.188.166"** (или use_external_ip: true), чтобы LiveKit отдавал в ICE именно публичный IP. После открытия портов можно убрать во фронте `iceTransportPolicy: "relay"`, чтобы клиенты пробовали сначала прямое подключение.

---

### Вариант B: Прокинуть порты нельзя — только поддомены

Тогда медиа идёт через **TURN по TLS**. Клиент подключается к `turn.nonza.ru:5349` (TLS снимает nginx), nginx по **stream** проксирует TCP на LiveKit — «напрямую к порту» снаружи подключаться не нужно (достаточно открыть 5349 для nginx).

**Шаг 1 — поддомен и nginx**

TURN — это **не HTTP и не WebSocket**, а отдельный протокол по TCP. Блок `server { listen 443; location / { proxy_pass ... } }` с Upgrade/Connection для TURN не подходит. Нужен блок **stream** (проксирование «сырого» TCP).

- Поддомен: **turn.nonza.ru**.
- SSL для него (Let's Encrypt и т.п.).
- Порт **443** обычно уже занят под HTTP (meet, api, ws) — на том же nginx нельзя вешать и `http` server, и `stream` server на один и тот же 443. Поэтому для TURN чаще используют **порт 5349** (стандартный TURN/TLS).

Если уже есть каталоги **streams-available** и **streams-enabled**, достаточно положить конфиг туда (см. `deploy/nginx-turn-stream.conf`):

```bash
sudo cp deploy/nginx-turn-stream.conf /etc/nginx/streams-available/turn.nonza.ru.conf
sudo ln -s /etc/nginx/streams-available/turn.nonza.ru.conf /etc/nginx/streams-enabled/
```

В `nginx.conf` на верхнем уровне должен быть блок `stream { include streams-enabled/*.conf; }`. Конфиг содержит только `server { }` (без обёртки `stream { }`).

- Открыть на файрволе **TCP 5349**.
- В конфиге LiveKit (см. шаг 2) указать **tls_port: 5349**, **domain: turn.nonza.ru**, **external_tls: true** — тогда LiveKit будет отдавать клиентам адрес `turn.nonza.ru:5349`, nginx примет TLS и передаст трафик на 10.50.0.118:5349 без TLS.

**Шаг 2 — конфиг LiveKit**

В `deploy/livekit-config.yaml` включить TURN/TLS и указать домен:

```yaml
turn:
  enabled: true
  udp_port: 3478
  tls_port: 5349
  domain: turn.nonza.ru
  external_tls: true
```

- **external_tls: true** — TLS снимает nginx, до LiveKit доходит уже расшифрованный трафик на порт 5349.
- **domain: turn.nonza.ru** — этот адрес LiveKit отдаст клиентам в ICE (подключение к turn.nonza.ru:5349 при конфиге выше).

**Шаг 3 — порты**

- На файрволе открыть **TCP 5349** (TURN через nginx stream).
- На хосте 10.50.0.118 LiveKit слушает 5349 без TLS (external_tls: true).

После правок перезапустить LiveKit и nginx.

**Вариант B2: TURN на 443 (когда клиент получает turns:turn.nonza.ru:443)**

Если при `external_tls: true` LiveKit отдаёт клиенту порт **443** (а nginx слушает TURN на 5349), в webrtc-internals будет ошибка 701. Решение — принимать TURN на **443** для turn.nonza.ru.

**Если у turn.nonza.ru свой IP** (отдельный от meet/ws/api): на этом IP только stream на 443, HTTP не трогаем. Конфиг `deploy/nginx-stream-turn-443-only.conf` — один server с `listen 443 ssl` и proxy_pass на 10.50.0.118:5349. Подключить в streams-enabled, на шлюзе пробросить 443 на этот IP.

**Если turn.nonza.ru и meet/ws/api на одном IP и конфиги сайтов менять нельзя:** единственный вариант без правок — **второй IP для turn.nonza.ru**. Выделить на машине ещё один IP (или отдельный хост), в DNS направить turn.nonza.ru на этот IP, на нём слушать только stream 443 по конфигу `deploy/nginx-stream-turn-443-only.conf`. Остальные сайты на первом IP:443 не трогаем.

Если второй IP невозможен — остаётся вариант с внешним TURN (coturn и т.п.) и подстановкой iceServers с бэкенда в клиенте (см. пункт 5 в разделе «could not establish pc connection»).

Шлюз 95.143.188.166 обычно уже пробрасывает 443; для второго IP на шлюзе добавить DNAT 443 → второй_IP:443 (или проброс на тот хост, где слушает turn).

---

## 3. Что проверить

1. **Сигналинг:** в браузере открыть приложение, в Network — запрос к `wss://ws.nonza.ru` должен быть установлен.
2. **Медиа:** в Chrome открыть `about:webrtc` → посмотреть, какие ICE-кандидаты приходят и используются (должны быть с публичным IP сервера или turn.nonza.ru:5349 при варианте B).
3. В бэкенде **WEBRTC_PUBLIC_URL** = `wss://ws.nonza.ru`.

Итог: **ws.nonza.ru** для WSS, **turn.nonza.ru:5349** для TURN (вариант B). Конфиг TURN положи в **streams-available** / **streams-enabled** (файл `deploy/nginx-turn-stream.conf`).

---

## Проверка проброса портов TURN (3478, 5349)

Проверять лучше **снаружи** (с ноутбука или другого хоста в интернете), чтобы убедиться, что до портов доходят пакеты через шлюз и файрвол.

### TCP 5349 (TURN over TLS)

С любого хоста:
```bash
nc -zv turn.nonza.ru 5349
```
Ожидание: `Connection to turn.nonza.ru 5349 port [tcp/*] succeeded!`  
Таймаут или `Connection refused` — порт не проброшен или nginx не слушает 5349.

Проверка TLS (опционально):
```bash
openssl s_client -connect turn.nonza.ru:5349 -brief
```
Должен пройти TLS handshake (сертификат turn.nonza.ru).

Если turn.nonza.ru за шлюзом 95.143.188.166, на шлюзе должен быть DNAT: входящий TCP 5349 → 10.50.0.103:5349. Локально на nginx (10.50.0.103): `ss -tlnp | grep 5349` — должен слушать nginx.

### UDP 3478 (TURN over UDP)

UDP не даёт «соединение» как TCP. Варианты:

**1. nmap (снаружи):**
```bash
nmap -sU -p 3478 turn.nonza.ru
```
`open` — порт доступен. `open|filtered` — пакеты доходят, но ответа может не быть (для TURN это часто нормально до первого TURN-запроса).

**2. С шлюза 95.143.188.166 — что порт слушается на LiveKit:**
```bash
ss -ulnp | grep 3478
```
Должен быть процесс LiveKit на 3478. И что DNAT есть: `sudo iptables -t nat -L PREROUTING -n -v | grep 3478`.

**3. Реальная проверка — TURN allocation:** если в браузере при `iceTransportPolicy: "relay"` в `about:webrtc` виден relay-кандидат и медиа идёт — TURN по 5349 работает. UDP 3478 при схеме «всё через turn.nonza.ru:5349» может не использоваться браузером (TURN over TLS на 5349 достаточен).

Итог: для варианта B (только поддомен) критичен **5349**. UDP 3478 нужен, если клиенты подключаются к TURN по UDP (например, десктопное приложение); для браузера с relay через 5349 достаточно проверить TCP 5349.

### Цепочка 95.143.188.166 → 10.50.0.103 (nginx) → 10.50.0.118 (LiveKit)

Чтобы убедиться, что трафик доходит до LiveKit:

1. **На хосте с nginx (10.50.0.103)** — доходит ли до LiveKit (без TLS, plain TCP):
   ```bash
   nc -zv 10.50.0.118 5349
   ```
   Ожидание: `Connection to 10.50.0.118 5349 port [tcp/*] succeeded!`  
   Таймаут или `Connection refused` — на 10.50.0.118 порт 5349 не слушается (проверить проброс в docker-compose и что контейнер livekit запущен с `5349:5349`).

2. **На хосте с LiveKit (10.50.0.118)** — слушает ли кто-то 5349:
   ```bash
   ss -tlnp | grep 5349
   ```
   Должна быть строка с портом 5349 (процесс docker-proxy или livekit).

3. **Снаружи** уже проверено: `openssl s_client -connect turn.nonza.ru:5349` — TLS до nginx работает. Если шаг 1 с 10.50.0.103 на 10.50.0.118 не проходит, nginx принимает клиента, но `proxy_pass` на LiveKit не доходит.

---

## 5. Ошибка «could not establish pc connection» при варианте только TURN

Если фронт с `iceTransportPolicy: "relay"` и в логах LiveKit есть «created TURN password», но участник «removing without connection» — клиент не может достучаться до TURN. Проверить по шагам:

1. **Куда смотрит turn.nonza.ru**  
   `turn.nonza.ru` в DNS должен указывать на хост, где **реально слушает nginx stream** на порту 5349 (тот же сервер, где висят meet/ws, или отдельный). Если turn.nonza.ru указывает на 95.143.188.166, а nginx с stream для TURN стоит на другой машине — порт 5349 на 95.143.188.166 будет закрыт и соединение оборвётся.

2. **Порт 5349 открыт на хосте с nginx**  
   На сервере, куда приходит трафик на turn.nonza.ru (тот, где в nginx включён `stream` для 5349), во входящих правилах файрвола должен быть открыт **TCP 5349**.  
   Проверка с другого хоста (например, с Mac, с которого заходишь в Safari):
   ```bash
   nc -zv turn.nonza.ru 5349
   # или
   openssl s_client -connect turn.nonza.ru:5349
   ```
   Должно установиться соединение (для openssl — TLS handshake). Таймаут или «Connection refused» — порт закрыт или nginx не слушает 5349.

3. **Nginx stream включён и перезапущен**  
   Конфиг из `nginx-turn-stream.conf` должен лежать в **streams-enabled** (не в sites-enabled), в главном nginx.conf на верхнем уровне должен быть `stream { include streams-enabled/*.conf; }`. После правок: `nginx -t && systemctl reload nginx`.

4. **Фронт собран и задеплоен с relay**  
   Убедись, что на meet.nonza.ru отдаётся последняя сборка, в которой при подключении к комнате передаётся `rtcConfig: { iceTransportPolicy: "relay" }`. Иначе браузер может пытаться сначала прямые порты и падать по таймауту.

5. **Клиент получает turns:turn.nonza.ru:443 вместо 5349**  
   При `external_tls: true` LiveKit может отдавать клиенту TURN URL с портом **443** (см. config-sample: «if not using LB, tls_port needs to be set to 443»). У нас nginx слушает TURN на **5349**, поэтому в chrome://webrtc-internals видно `turns:turn.nonza.ru:443` и ошибку 701. Решения:
   - **Вариант A:** поднять TURN на **443** для turn.nonza.ru (отдельный stream‑блок на 443 по SNI для turn.nonza.ru, proxy на 10.50.0.118:5349). Тогда рекламируемый порт совпадёт с реальным. На том же IP, где на 443 уже висит HTTP (meet/ws), нужна маршрутизация по SNI (stream `ssl_preread` + map по `$ssl_preread_server_name`).
   - **Вариант B:** отключить встроенный TURN в LiveKit, поднять свой TURN (например coturn или STUNner), отдавать клиенту список ICE-серверов с бэкенда (urls, username, credential) и передавать его в `rtcConfig.iceServers` при подключении — как в кейсах с GKE/STUNner (отключить TURN в LiveKit, инжектить ICE servers с бэкенда) (клиент инжектит ICE servers, 100% подключений). Тогда креды и порт полностью под твоим контролем.

---

## 6. «Connection refused» на turn.nonza.ru:5349

Если `nc -zv turn.nonza.ru 5349` даёт **Connection refused** — до хоста пакеты доходят, но на 5349 ничего не слушает. Проверить на **том сервере, на который смотрит DNS turn.nonza.ru**:

1. **Куда резолвится turn.nonza.ru:**
   ```bash
   dig +short turn.nonza.ru
   # или
   host turn.nonza.ru
   ```
   Запомни IP (например, тот же, что у meet, или 95.143.188.166).

2. **На этом хосте — слушает ли кто-то 5349:**
   ```bash
   sudo ss -tlnp | grep 5349
   # или
   sudo netstat -tlnp | grep 5349
   ```
   Должна быть строка с nginx. Если пусто — nginx stream для 5349 не загружен или не перезапущен.

3. **Конфиг stream в nginx:**
   - Файл с блоком `server { listen 5349 ssl; ... }` должен лежать в **streams-enabled** (не в sites-enabled).
   - В **nginx.conf** на верхнем уровне (рядом с `http {}`) должен быть:
     ```nginx
     stream {
       include streams-enabled/*.conf;
     }
     ```
   - Проверка и перезагрузка:
     ```bash
     sudo nginx -t && sudo systemctl reload nginx
     ```

4. **Файрвол на этом же хосте:** входящий TCP 5349 должен быть разрешён (ufw allow 5349/tcp и т.п.).

Если turn.nonza.ru указывает на **95.143.188.166**, а nginx с stream для TURN стоит на **другой** машине (например, где отдаётся meet.nonza.ru), то на 95.143.188.166 порт 5349 не слушается — нужно либо повесить turn.nonza.ru на IP той машины, где реально слушает nginx stream, либо поднять такой же stream на 95.143.188.166.

---

## Внешний TURN (coturn), креды с бэкенда

Встроенный TURN в LiveKit отключён. TURN — **coturn** в Docker; бэкенд генерирует HMAC-креды и отдаёт **ice_servers** в ответе на запрос токена; фронт подставляет их в **rtcConfig.iceServers** при подключении к комнате.

**Что настроено:**
- `deploy/livekit-config.yaml` — секция turn закомментирована.
- `docker-compose.yml` — сервис **coturn** (порты 5349, 3478, relay 49152–65535), конфиг `deploy/coturn.conf`, секрет из `backend/.env` (TURN_SECRET).
- Бэкенд: при наличии **TURN_URL** и **TURN_SECRET** в .env добавляет в ответ токена поле **ice_servers** (urls, username, credential; long-term credential по HMAC).
- Фронт: при наличии **ice_servers** в ответе передаёт их в **rtcConfig** при **room.connect()** и **iceTransportPolicy: "relay"**.

**В backend/.env задать:**
- **TURN_URL** — URL для клиента, например `turns:turn.nonza.ru:5349`.
- **TURN_SECRET** — общий секрет с coturn (тот же, что в coturn; минимум 32 символа).
- По желанию **TURN_TTL** — время жизни креда в секундах (по умолчанию 86400).

**Инфраструктура:** nginx по-прежнему проксирует turn.nonza.ru:5349 на хост с приложением (10.50.0.118); на нём на 5349 слушает контейнер coturn. Проброс портов на шлюзе (95.143.188.166 → 10.50.0.103:5349) не менять.

---

## 4. Другие варианты

| Вариант | Суть | Когда уместно |
|--------|------|----------------|
| **Прокинуть порты** | Открыть на файрволе TCP 7881, UDP 50000–50100, UDP 3478 на хост 10.50.0.118. TURN и nginx для медиа не нужны. | Есть доступ к файрволу/облаку и можно открыть порты. |
| **Отдельный хост для TURN** | Поднять TURN (coturn или встроенный в LiveKit) на машине с белым IP, в LiveKit указать его в `rtc.turn_servers`. | Есть вторая машина с прямым доступом в интернет. |
| **Внешний TURN-провайдер** | Взять TURN у Twilio, Metered, Xirsys и т.п., прописать в `livekit-config.yaml` в `rtc.turn_servers`. Свой nginx для TURN не нужен. | Не хочется возиться с nginx stream и сертификатами для turn.nonza.ru. |
| **LiveKit Cloud** | Хостинг у LiveKit: и сигналинг, и медиа у них. В бэкенде подставляешь их URL и API key. | Готовы платить, нужна минимальная настройка инфраструктуры. |
