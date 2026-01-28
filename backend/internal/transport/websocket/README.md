# WebSocket Server

WebSocket сервер для отправки кастомных событий клиентам в реальном времени.

## Использование

### Подключение с фронтенда

```javascript
const ws = new WebSocket(
  "ws://localhost:8000/ws?room_id=room-123&user_id=user-456",
);

ws.onmessage = (event) => {
  const message = JSON.parse(event.data);
  console.log("Received:", message);
};

// Отправить сообщение
ws.send(
  JSON.stringify({
    type: "custom_event",
    payload: { data: "some data" },
  }),
);
```

### Отправка событий с бэкенда

```go
// Получить WebSocket hub из handler
wsHub := restHandler.GetWSHub()

// Отправить событие в комнату
wsHub.BroadcastToRoom("room-123", websocket.Message{
    Type: "room_event",
    RoomID: "room-123",
    Payload: map[string]interface{}{
        "event": "user_joined",
        "user_id": "user-456",
    },
})

// Отправить событие всем клиентам
wsHub.BroadcastToAll(websocket.Message{
    Type: "global_event",
    Payload: map[string]interface{}{
        "message": "Server maintenance in 5 minutes",
    },
})
```

## Типы сообщений

### Входящие (от клиента)

- `join_room` - присоединиться к комнате
- `leave_room` - покинуть комнату
- `ping` - проверка соединения
- Любые кастомные типы - будут транслированы в комнату

### Исходящие (к клиенту)

- `connected` - подтверждение подключения
- `user_joined` - пользователь присоединился к комнате
- `user_left` - пользователь покинул комнату
- `pong` - ответ на ping
- Любые кастомные типы

## Примеры использования

### Уведомление о новом участнике в комнате

```go
// В handler после создания токена
wsHub.BroadcastToRoom(roomID, websocket.Message{
    Type: "participant_joined",
    RoomID: roomID,
    Payload: map[string]interface{}{
        "participant_id": participantID,
        "participant_name": participantName,
    },
})
```

### Синхронизация состояния документа

```go
wsHub.BroadcastToRoom(roomID, websocket.Message{
    Type: "document_updated",
    RoomID: roomID,
    Payload: map[string]interface{}{
        "content": documentContent,
        "updated_by": userID,
    },
})
```
