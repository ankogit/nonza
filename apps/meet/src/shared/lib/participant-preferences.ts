const STORAGE_KEY_NAME = "nonza_participant_name";
const STORAGE_KEY_VOLUMES = "nonza_volumes";
const STORAGE_KEY_ROOM_SHORT_CODE = "nonza_room_short_code";
const STORAGE_KEY_REPLICA_TTS = "nonza_replica_tts_enabled";
const STORAGE_KEY_REPLICA_TTS_MUTED = "nonza_replica_tts_muted_identities";
const STORAGE_KEY_ROOM_PASSWORD_PREFIX = "nonza_room_password:";

export function getRoomShortCode(): string | null {
  try {
    return sessionStorage.getItem(STORAGE_KEY_ROOM_SHORT_CODE);
  } catch {
    return null;
  }
}

export function setRoomShortCode(shortCode: string): void {
  try {
    if (shortCode.trim()) {
      sessionStorage.setItem(STORAGE_KEY_ROOM_SHORT_CODE, shortCode.trim());
    } else {
      sessionStorage.removeItem(STORAGE_KEY_ROOM_SHORT_CODE);
    }
  } catch {
    /* ignore */
  }
}

export function clearRoomShortCode(): void {
  try {
    sessionStorage.removeItem(STORAGE_KEY_ROOM_SHORT_CODE);
  } catch {
    /* ignore */
  }
}

export function getStoredRoomPassword(shortCode: string): string | null {
  try {
    return sessionStorage.getItem(STORAGE_KEY_ROOM_PASSWORD_PREFIX + shortCode.trim());
  } catch {
    return null;
  }
}

export function setStoredRoomPassword(shortCode: string, password: string): void {
  try {
    const code = shortCode.trim();
    if (code && password) {
      sessionStorage.setItem(STORAGE_KEY_ROOM_PASSWORD_PREFIX + code, password);
    }
  } catch {
    /* ignore */
  }
}

export function clearStoredRoomPassword(shortCode: string): void {
  try {
    sessionStorage.removeItem(STORAGE_KEY_ROOM_PASSWORD_PREFIX + shortCode.trim());
  } catch {
    /* ignore */
  }
}

export function getParticipantName(): string | null {
  try {
    return localStorage.getItem(STORAGE_KEY_NAME);
  } catch {
    return null;
  }
}

export function setParticipantName(name: string): void {
  try {
    if (name.trim()) {
      localStorage.setItem(STORAGE_KEY_NAME, name.trim());
    } else {
      localStorage.removeItem(STORAGE_KEY_NAME);
    }
  } catch {
    /* ignore */
  }
}

export function getReplicaTtsEnabled(): boolean {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_REPLICA_TTS);
    if (raw === null) return true;
    return raw === "1";
  } catch {
    return true;
  }
}

export function setReplicaTtsEnabled(value: boolean): void {
  try {
    localStorage.setItem(STORAGE_KEY_REPLICA_TTS, value ? "1" : "0");
  } catch {
    /* ignore */
  }
}

function parseReplicaTtsMutedSet(): Set<string> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_REPLICA_TTS_MUTED);
    if (!raw) return new Set();
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return new Set();
    return new Set(parsed.filter((x): x is string => typeof x === "string"));
  } catch {
    return new Set();
  }
}

function saveReplicaTtsMutedSet(set: Set<string>): void {
  try {
    localStorage.setItem(STORAGE_KEY_REPLICA_TTS_MUTED, JSON.stringify([...set]));
  } catch {
    /* ignore */
  }
}

export function isReplicaTtsMutedIdentity(identity: string): boolean {
  return parseReplicaTtsMutedSet().has(identity);
}

export function toggleReplicaTtsMutedIdentity(identity: string): boolean {
  const set = parseReplicaTtsMutedSet();
  const muted = !set.has(identity);
  if (muted) set.add(identity);
  else set.delete(identity);
  saveReplicaTtsMutedSet(set);
  return muted;
}

function getVolumesMap(): Record<string, number> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_VOLUMES);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as unknown;
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      return parsed as Record<string, number>;
    }
    return {};
  } catch {
    return {};
  }
}

function setVolumesMap(map: Record<string, number>): void {
  try {
    localStorage.setItem(STORAGE_KEY_VOLUMES, JSON.stringify(map));
  } catch {
    /* ignore */
  }
}

export function getVolumeForParticipant(identity: string): number {
  const map = getVolumesMap();
  const v = map[identity];
  if (typeof v === "number" && v >= 0 && v <= 500) return v;
  return 100;
}

export function setVolumeForParticipant(
  identity: string,
  volume: number,
): void {
  const map = getVolumesMap();
  map[identity] = Math.min(500, Math.max(0, volume));
  setVolumesMap(map);
}

// Имена в стиле D&D/фэнтези (только фэнтезийные, без реальных русских имен)
const FIRST_NAMES = [
  "Арагорн",
  "Торин",
  "Гэндальф",
  "Леголас",
  "Гимли",
  "Боромир",
  "Фродо",
  "Сэм",
  "Мерри",
  "Пиппин",
  "Элронд",
  "Галадриэль",
  "Арвен",
  "Эовин",
  "Теоден",
  "Эомер",
  "Фарамир",
  "Денетор",
  "Саруман",
  "Саурон",
  "Голлум",
  "Бильбо",
  "Турин",
  "Белег",
  "Маэдрос",
  "Финрод",
  "Тургон",
  "Финголфин",
  "Феанор",
  "Берен",
  "Лутиэн",
  "Тингол",
  "Мелиан",
  "Келебримбор",
  "Гил-Галад",
  "Исильдур",
  "Элендиль",
  "Анарион",
  "Эарендиль",
  "Эльрос",
  "Келеборн",
  "Трандуил",
  "Традайн",
  "Дейн",
  "Траин",
  "Трор",
  "Дурин",
  "Балин",
  "Двалин",
  "Оин",
  "Глоин",
  "Бифур",
  "Бофур",
  "Бомбур",
  "Ори",
  "Нори",
  "Дори",
  "Фили",
  "Кили",
  "Тралд",
  "Гардок",
  "Моргрен",
  "Элдрик",
  "Торвальд",
  "Гримлок",
  "Рогнар",
  "Свен",
  "Ульфрик",
  "Бальдр",
  "Эйрик",
  "Хальдан",
  "Торгрим",
  "Эйнар",
  "Сигурд",
  "Рагнар",
  "Бьорн",
  "Ивар",
  "Харальд",
  "Олаф",
  "Лейф",
  "Эрик",
  "Гуннар",
  "Хельги",
];

// Фамилии в стиле D&D/фэнтези на русском (более необычные)
const LAST_NAMES = [
  "Огнебород",
  "Тенеклинок",
  "Звездочет",
  "Камнедробитель",
  "Ледяной Взор",
  "Громоглас",
  "Светозар",
  "Темносерд",
  "Драконокрыл",
  "Волкобой",
  "Орлиное Перо",
  "Медвежья Лапа",
  "Соколиный Глаз",
  "Рыцарь Тени",
  "Воин Судьбы",
  "Маг Огня",
  "Древний Мудрец",
  "Могучий Дуб",
  "Благородный Лев",
  "Отважный Сокол",
  "Мудрый Ворон",
  "Быстрый Ветер",
  "Тихий Шепот",
  "Яркий Свет",
  "Славный Меч",
  "Железный Кулак",
  "Стальной Щит",
  "Кристальный Лед",
  "Золотой Луч",
  "Серебряный Клинок",
  "Бронзовый Гонг",
  "Пламенный Дух",
  "Морозный Вздох",
  "Грозовой Рык",
  "Лунный Свет",
  "Солнечный Луч",
  "Звездная Пыль",
  "Туманный Путь",
  "Горный Пик",
  "Лесной Странник",
  "Речной Брод",
  "Морской Ветер",
  "Пустынный Путник",
  "Небесный Странник",
  "Подземный Рыцарь",
  "Огненный Вихрь",
  "Ледяная Буря",
  "Громовая Молния",
  "Теневой Клинок",
  "Светлый Щит",
  "Москва",
];

export function generateParticipantName(): string {
  const firstName = FIRST_NAMES[Math.floor(Math.random() * FIRST_NAMES.length)];
  const lastName = LAST_NAMES[Math.floor(Math.random() * LAST_NAMES.length)];
  return `${firstName} ${lastName}`;
}
