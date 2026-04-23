import { getAuthState } from "./auth";

const ANON_LS_KEY = "nonza_user_id";

/** Стабильный id для localStorage (залогиненный или анонимный из LS). */
export function getSoundBarLocalUserId(): string {
  const auth = getAuthState();
  if (auth?.user?.id) return auth.user.id;
  try {
    let id = localStorage.getItem(ANON_LS_KEY);
    if (!id) {
      id = crypto.randomUUID();
      localStorage.setItem(ANON_LS_KEY, id);
    }
    return id;
  } catch {
    return "local-anon";
  }
}
