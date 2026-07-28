export type PisellUser = {
  id: string;
  name: string;
  password: string;
  role: "admin" | "member";
};

export const PISELL_USERS: PisellUser[] = [
  {
    id: "pisell",
    name: "pisell",
    password: import.meta.env.VITE_PISELL_AUTH_PASSWORD || "Pisell2023!",
    role: "admin",
  },
  {
    id: "nick",
    name: "nick",
    password: "Pisell2023!",
    role: "member",
  },
];

export const AUTH_CONFIG = {
  sessionKey: "pisell-auth-user",
  legacySessionKey: "pisell-auth-ok",
};

export function findPisellUser(account: string, password: string): PisellUser | null {
  const key = account.trim().toLowerCase();
  return PISELL_USERS.find((u) => u.id.toLowerCase() === key && u.password === password) ?? null;
}

export function getCurrentPisellUser(): PisellUser {
  return getSignedInPisellUser() ?? PISELL_USERS[0]!;
}

export function getSignedInPisellUser(): PisellUser | null {
  if (typeof window === "undefined") return PISELL_USERS[0]!;
  try {
    const userId = window.sessionStorage.getItem(AUTH_CONFIG.sessionKey);
    const user = PISELL_USERS.find((u) => u.id === userId);
    if (user) return user;

    if (window.sessionStorage.getItem(AUTH_CONFIG.legacySessionKey) === "1") {
      window.sessionStorage.setItem(AUTH_CONFIG.sessionKey, PISELL_USERS[0]!.id);
      return PISELL_USERS[0]!;
    }
  } catch {
    /* keep default user */
  }
  return null;
}

export function normalizePlanVisibility(value: unknown): "company" | "private" {
  return value === "private" ? "private" : "company";
}

export function uniqueUserIds(ids: unknown): string[] {
  if (!Array.isArray(ids)) return [];
  const allowed = new Set(PISELL_USERS.map((u) => u.id));
  return [...new Set(ids.filter((x): x is string => typeof x === "string" && allowed.has(x)))];
}

export function canReadPlanAccess(plan: {
  ownerUserId?: string;
  visibility?: "company" | "private";
  sharedUserIds?: string[];
}, userId = getCurrentPisellUser().id): boolean {
  if ((plan.visibility ?? "company") === "company") return true;
  if ((plan.ownerUserId || "pisell") === userId) return true;
  return (plan.sharedUserIds ?? []).includes(userId);
}
