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

---

## 3. Что проверить

1. **Сигналинг:** в браузере открыть приложение, в Network — запрос к `wss://ws.nonza.ru` должен быть установлен.
2. **Медиа:** в Chrome открыть `about:webrtc` → посмотреть, какие ICE-кандидаты приходят и используются (должны быть с публичным IP сервера или turn.nonza.ru:5349 при варианте B).
3. В бэкенде **WEBRTC_PUBLIC_URL** = `wss://ws.nonza.ru`.

Итог: **ws.nonza.ru** для WSS, **turn.nonza.ru:5349** для TURN (вариант B). Конфиг TURN положи в **streams-available** / **streams-enabled** (файл `deploy/nginx-turn-stream.conf`).

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

## 4. Другие варианты

| Вариант | Суть | Когда уместно |
|--------|------|----------------|
| **Прокинуть порты** | Открыть на файрволе TCP 7881, UDP 50000–50100, UDP 3478 на хост 10.50.0.118. TURN и nginx для медиа не нужны. | Есть доступ к файрволу/облаку и можно открыть порты. |
| **Отдельный хост для TURN** | Поднять TURN (coturn или встроенный в LiveKit) на машине с белым IP, в LiveKit указать его в `rtc.turn_servers`. | Есть вторая машина с прямым доступом в интернет. |
| **Внешний TURN-провайдер** | Взять TURN у Twilio, Metered, Xirsys и т.п., прописать в `livekit-config.yaml` в `rtc.turn_servers`. Свой nginx для TURN не нужен. | Не хочется возиться с nginx stream и сертификатами для turn.nonza.ru. |
| **LiveKit Cloud** | Хостинг у LiveKit: и сигналинг, и медиа у них. В бэкенде подставляешь их URL и API key. | Готовы платить, нужна минимальная настройка инфраструктуры. |
