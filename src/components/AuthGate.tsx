import { useMemo, useState } from "react";
import type { ReactNode } from "react";
import { AUTH_CONFIG } from "../config/auth";
import { ThemeSync } from "./ThemeSync";

type Props = {
  children: ReactNode;
};

export function AuthGate({ children }: Props) {
  const [ok, setOk] = useState(() => {
    try {
      return window.sessionStorage.getItem(AUTH_CONFIG.sessionKey) === "1";
    } catch {
      return false;
    }
  });
  const [account, setAccount] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState(false);

  const disabled = useMemo(() => !account.trim() || !password, [account, password]);

  if (ok) return <>{children}</>;

  return (
    <div className="ui-app flex h-full min-h-0 items-center justify-center bg-app-surface px-4 text-app-text">
      <ThemeSync />
      <div className="grid w-full max-w-[860px] overflow-hidden rounded-2xl border border-app-panel-border bg-app-panel-bg shadow-2xl md:grid-cols-[1.05fr_0.95fr]">
        <div className="relative flex min-h-[380px] flex-col justify-between overflow-hidden border-b border-app-line-subtle bg-app-surface-2 p-8 md:border-b-0 md:border-r">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_10%,rgba(183,45,22,0.24),transparent_32%),radial-gradient(circle_at_90%_80%,rgba(110,72,255,0.18),transparent_30%)]" />
          <div className="relative">
            <div className="mb-6 inline-flex h-12 w-12 items-center justify-center rounded-xl border border-app-line-mid bg-app-panel-bg text-sm font-bold tracking-tight text-app-primary shadow">
              P
            </div>
            <h1 className="text-3xl font-semibold tracking-[0.18em] text-app-text">PISELL ERP</h1>
            <p className="mt-3 max-w-[300px] text-sm leading-6 text-app-muted">
              Sales, inventory, solution design and quotation workspace.
            </p>
          </div>

          <div className="relative grid gap-2 text-xs text-app-muted">
            <div className="flex items-center justify-between gap-4 rounded-lg border border-app-line-subtle bg-app-panel-bg/70 px-3 py-2">
              <span>Release date</span>
              <span className="font-medium text-app-text">{__APP_RELEASE_DATE__}</span>
            </div>
            <div className="flex items-center justify-between gap-4 rounded-lg border border-app-line-subtle bg-app-panel-bg/70 px-3 py-2">
              <span>Version</span>
              <span className="font-medium text-app-text">{__APP_VERSION_LABEL__}</span>
            </div>
          </div>
        </div>

        <form
        className="flex min-h-[380px] flex-col justify-center p-6 sm:p-8"
        onSubmit={(e) => {
          e.preventDefault();
            if (account.trim() === AUTH_CONFIG.account && password === AUTH_CONFIG.password) {
              try {
                window.sessionStorage.setItem(AUTH_CONFIG.sessionKey, "1");
              } catch {
                /* keep session in memory */
              }
              setOk(true);
              return;
            }
            setError(true);
          }}
        >
          <div className="mb-5">
            <h2 className="text-base font-semibold text-app-text">Sign in</h2>
            <p className="mt-1 text-xs text-app-muted">Enter your Pisell account.</p>
          </div>

          <label className="block text-xs font-medium text-app-muted">
            Account
            <input
              value={account}
              onChange={(e) => {
                setAccount(e.target.value);
                setError(false);
              }}
              autoComplete="username"
              className="mt-1 w-full rounded-lg border border-app-line-mid bg-app-surface px-3 py-2 text-sm text-app-text outline-none transition focus:border-app-primary"
            />
          </label>

          <label className="mt-3 block text-xs font-medium text-app-muted">
            Password
            <input
              type="password"
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                setError(false);
              }}
              autoComplete="current-password"
              className="mt-1 w-full rounded-lg border border-app-line-mid bg-app-surface px-3 py-2 text-sm text-app-text outline-none transition focus:border-app-primary"
            />
          </label>

          {error ? <p className="mt-3 text-xs text-app-danger-text">Account or password is incorrect.</p> : null}

          <button
            type="submit"
            disabled={disabled}
            className="ui-primaryBtn mt-5 w-full justify-center py-2 text-sm disabled:opacity-50"
          >
            Sign in
          </button>
        </form>
      </div>
    </div>
  );
}
