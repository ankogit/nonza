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

## Проверка

После включения TURN и открытия портов пользователи из проблемных сетей должны подключаться без ошибки ICE. При необходимости можно открыть `about:webrtc` в Chrome и посмотреть, какие ICE-кандидаты собираются и используются.
