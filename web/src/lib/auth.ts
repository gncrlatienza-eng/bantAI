export type Role = "client" | "admin";

const KEY = "bantai_session";

export function setSession(role: Role) {
  localStorage.setItem(KEY, role);
}

export function getSession(): Role | null {
  const value = localStorage.getItem(KEY);
  return value === "client" || value === "admin" ? value : null;
}

export function clearSession() {
  localStorage.removeItem(KEY);
}
