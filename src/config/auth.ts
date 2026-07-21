export const AUTH_CONFIG = {
  sessionKey: "pisell-auth-ok",
  account: import.meta.env.VITE_PISELL_AUTH_USER || "pisell",
  password: import.meta.env.VITE_PISELL_AUTH_PASSWORD || "Pisell2023!",
};
