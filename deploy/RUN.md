# Как запустить стек (продакшен)

## 1. Подготовка

- **backend/.env** — скопировать из `backend/.env.example`, заполнить. Для TURN обязательно:
  - `TURN_URL=turns:turn.nonza.ru:5349`
  - `TURN_SECRET=...` (≥32 символа, один и тот же для бэкенда и coturn)
  - `TURN_USE_AUTH=1`
- **Сертификаты coturn** — в `deploy/keys/` положить (или смонтировать в контейнер):
  - `turn.nonza.ru_fullchain.pem`
  - `turn.nonza.ru_privkey.pem`  
  В `docker-compose.yml` уже есть volume: `./deploy/keys:/etc/coturn/certs:ro`. Если папка/имена другие — поправить путь и `coturn.conf` (cert/pkey).

## 2. Запуск

Из корня репозитория:

```bash
docker-compose up -d --build
```

Или через Makefile:

```bash
make build
make up
```

Сервисы: postgres, redis, livekit, coturn, backend, frontend. Логи: `docker-compose logs -f` или `make logs`.

## 3. TURN и доступ в комнату через relay (опционально)

Если нужен вход **строго через TURN** и LiveKit с coturn на **одном** хосте, на сервере (не в контейнере) один раз:

```bash
cd /path/to/nonza
sudo ./deploy/turn-hairpin-iptables.sh add
```

Либо полный путь к скрипту (подставь свой каталог репозитория):

```bash
sudo /home/infra/data/nonza/deploy/turn-hairpin-iptables.sh add
```

Чтобы правило сохранялось после перезагрузки: `sudo apt install iptables-persistent` и после добавления правила: `sudo netfilter-persistent save`.

Если relay не обязателен — в коде можно отключить `iceTransportPolicy: "relay"` (оставить политику по умолчанию), тогда TURN используется только как запасной путь.

## 4. Остановка

```bash
docker-compose down
# или
make down
```

Удалить hairpin (если включали): `sudo ./deploy/turn-hairpin-iptables.sh del` (из каталога репозитория).
