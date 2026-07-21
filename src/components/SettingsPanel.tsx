import { useCallback, useRef, useState } from "react";
import { useT } from "../i18n/useT";
import { useQuoteStore } from "../store/quoteStore";
import { compressImageFileToJpegDataUrl } from "../utils/compressImageFile";
import { AppThemeSettingsSection } from "./AppThemeSettingsSection";
import { PdfMapSettingsSection } from "./PdfMapSettingsSection";
import { PhotoUploadModal } from "./PhotoUploadModal";
import { UiPageShell } from "./UiPageShell";

export function SettingsPanel() {
  const t = useT();
  const pisellRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [pisellBusy, setPisellBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const companyLogoDataUrl = useQuoteStore((s) => s.companyLogoDataUrl);
  const companyName = useQuoteStore((s) => s.companyName);
  const companyTagline = useQuoteStore((s) => s.companyTagline);
  const companyAddress = useQuoteStore((s) => s.companyAddress);
  const companyPhone = useQuoteStore((s) => s.companyPhone);
  const companyEmail = useQuoteStore((s) => s.companyEmail);
  const companyWebsite = useQuoteStore((s) => s.companyWebsite);
  const setCompanyBranding = useQuoteStore((s) => s.setCompanyBranding);
  const setActiveTab = useQuoteStore((s) => s.setActiveTab);
  const recoverCatalogFromLocalStorageBackup = useQuoteStore((s) => s.recoverCatalogFromLocalStorageBackup);
  const restoreFullHardwareCatalogFromLocalStorageBackup = useQuoteStore(
    (s) => s.restoreFullHardwareCatalogFromLocalStorageBackup,
  );
  const importFromPisellWorkbook = useQuoteStore((s) => s.importFromPisellWorkbook);
  const applyBundledPisellHardwareSeed = useQuoteStore((s) => s.applyBundledPisellHardwareSeed);
  const companyCatalogCurrency = useQuoteStore((s) => s.companyCatalogCurrency);
  const companyCatalogFxMultiplier = useQuoteStore((s) => s.companyCatalogFxMultiplier);
  const exportPersistedJson = useQuoteStore((s) => s.exportPersistedJson);
  const importPersistedJson = useQuoteStore((s) => s.importPersistedJson);
  const uiLocale = useQuoteStore((s) => s.uiLocale);
  const setUiLocale = useQuoteStore((s) => s.setUiLocale);
  const backupRef = useRef<HTMLInputElement>(null);

  const [saveMsg, setSaveMsg] = useState<string | null>(null);
  const [recoverMsg, setRecoverMsg] = useState<string | null>(null);
  const [pisellMsg, setPisellMsg] = useState<{ text: string; ok: boolean } | null>(null);
  const [bundledMsg, setBundledMsg] = useState<string | null>(null);
  const [backupMsg, setBackupMsg] = useState<string | null>(null);
  const [logoModalOpen, setLogoModalOpen] = useState(false);

  const handleSaveCompany = useCallback(() => {
    setErr(null);
    setSaveMsg(t("st.savedMsg"));
    window.setTimeout(() => setSaveMsg(null), 3200);
  }, [t]);

  return (
    <UiPageShell
      scrollBody
      kicker={t("st.shellKicker")}
      title={t("st.title")}
      headActions={
        <div className="flex flex-col items-end gap-1">
          <button
            type="button"
            onClick={() => void handleSaveCompany()}
            className="ui-primaryBtn"
          >
            {t("st.saveCompany")}
          </button>
          {saveMsg ? <p className="max-w-[220px] text-right text-xs text-app-success-text">{saveMsg}</p> : null}
        </div>
      }
    >
      <div className="flex flex-col gap-4 pr-1">
        {err ? (
          <div className="rounded-lg border border-app-danger-border bg-app-danger-bg px-3 py-2 text-sm text-app-danger-text">
            {err}
          </div>
        ) : null}

        <section className="rounded-xl border border-app-panel-border bg-app-panel-bg p-4">
          <h3 className="text-sm font-semibold text-app-text">{t("st.languageTitle")}</h3>
          <div
            className="mt-3 inline-flex rounded-full border border-app-line-mid bg-app-surface/55 p-1 shadow-sm"
            role="group"
            aria-label={t("lang.toggleHint")}
          >
            <button
              type="button"
              onClick={() => setUiLocale("en")}
              className={`rounded-full px-3 py-1.5 text-xs font-semibold transition ${
                uiLocale === "en"
                  ? "bg-app-primary text-app-on-primary shadow-sm"
                  : "text-app-muted hover:bg-app-primary-soft/60 hover:text-app-text"
              }`}
            >
              {t("lang.en")}
            </button>
            <button
              type="button"
              onClick={() => setUiLocale("zh")}
              className={`rounded-full px-3 py-1.5 text-xs font-semibold transition ${
                uiLocale === "zh"
                  ? "bg-app-primary text-app-on-primary shadow-sm"
                  : "text-app-muted hover:bg-app-primary-soft/60 hover:text-app-text"
              }`}
            >
              {t("lang.zh")}
            </button>
          </div>
        </section>

        <AppThemeSettingsSection />

        <PdfMapSettingsSection />

        <div className="h-px w-full shrink-0 rounded-full bg-app-divider" aria-hidden />

        <section className="rounded-xl border border-app-panel-border bg-app-panel-bg p-4">
          <h3 className="text-sm font-semibold text-app-text">Bundled hardware catalog</h3>
          <p className="mt-2 text-xs text-app-muted">
            The catalog is{" "}
            <span className="font-medium text-app-text">compiled into the app</span> from{" "}
            <code className="rounded bg-app-surface-2 px-1">src/data/pisellHardwareSeed.json</code>. After each
            deploy, visitors automatically receive the latest seed when its <code className="rounded bg-app-surface-2 px-1">generatedAt</code>{" "}
            timestamp is newer than what their browser last applied (stored in IndexedDB with the rest of the app).
            Works offline when you open the built <code className="rounded bg-app-surface-2 px-1">index.html</code>{" "}
            directly (relative asset paths). Regenerate from Excel:{" "}
            <code className="rounded bg-app-surface-2 px-1">npm run generate:pisell-seed</code> then{" "}
            <code className="rounded bg-app-surface-2 px-1">npm run build</code>.
          </p>
          <button
            type="button"
            className="ui-toolBtn mt-3 rounded-lg border border-app-line-mid px-3 py-2 text-sm text-app-text hover:bg-app-surface-2"
            onClick={() => {
              setBundledMsg(null);
              void applyBundledPisellHardwareSeed().then((r) => {
                setBundledMsg(r.ok ? "Bundled catalog applied." : r.error);
              });
            }}
          >
            Re-apply bundled catalog now
          </button>
          {bundledMsg ? (
            <p
              className={`mt-2 text-xs ${bundledMsg.includes("empty") || bundledMsg.includes("Invalid") ? "text-app-danger-text" : "text-app-success-text"}`}
            >
              {bundledMsg}
            </p>
          ) : null}
        </section>

        <div className="h-px w-full shrink-0 rounded-full bg-app-divider" aria-hidden />

        <section className="rounded-xl border border-app-panel-border bg-app-panel-bg p-4">
          <h3 className="text-sm font-semibold text-app-text">{t("st.pisellTitle")}</h3>
          <p className="mt-2 text-xs text-app-muted">{t("st.pisellHint")}</p>
          <input
            ref={pisellRef}
            type="file"
            accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (!f) return;
              setPisellMsg(null);
              setPisellBusy(true);
              void importFromPisellWorkbook(f)
                .then((r) => {
                  const text = t("st.pisellOk")
                    .replace("{rows}", String(r.rowCount))
                    .replace("{cats}", String(r.categoriesEnsured.length))
                    .replace("{mat}", String(r.materialsAdded))
                    .replace("{assoc}", String(r.associationsAdded))
                    .replace("{erp}", String(r.erpLinesAdded));
                  setPisellMsg({ text, ok: true });
                })
                .catch(() => {
                  setPisellMsg({ text: t("st.pisellErr"), ok: false });
                })
                .finally(() => {
                  setPisellBusy(false);
                  if (pisellRef.current) pisellRef.current.value = "";
                });
            }}
          />
          <button
            type="button"
            disabled={pisellBusy}
            className="ui-toolBtn mt-3 rounded-lg border border-app-line-mid px-3 py-2 text-sm text-app-text hover:bg-app-surface-2 disabled:opacity-50"
            onClick={() => pisellRef.current?.click()}
          >
            {pisellBusy ? t("st.pisellBusy") : t("st.pisellBtn")}
          </button>
          {pisellMsg ? (
            <p
              className={`mt-2 text-xs ${pisellMsg.ok ? "text-app-success-text" : "text-app-danger-text"}`}
            >
              {pisellMsg.text}
            </p>
          ) : null}
        </section>

        <div className="h-px w-full shrink-0 rounded-full bg-app-divider" aria-hidden />

        <section className="rounded-xl border border-app-panel-border bg-app-panel-bg p-4">
          <h3 className="text-sm font-semibold text-app-text">Portable backup</h3>
          <p className="mt-1 text-xs text-app-muted">
            Data stays in this browser; use the same host (e.g. http://127.0.0.1:5173) everywhere.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              className="ui-toolBtn rounded-lg border border-app-line-mid px-3 py-2 text-sm text-app-text hover:bg-app-surface-2"
              onClick={() => {
                const blob = new Blob([exportPersistedJson()], { type: "application/json" });
                const a = document.createElement("a");
                a.href = URL.createObjectURL(blob);
                a.download = `marketing-quote-backup-${Date.now()}.json`;
                a.click();
                URL.revokeObjectURL(a.href);
                setBackupMsg("Exported.");
                window.setTimeout(() => setBackupMsg(null), 2400);
              }}
            >
              Export JSON
            </button>
            <input
              ref={backupRef}
              type="file"
              accept="application/json,.json"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (!f) return;
                setBackupMsg(null);
                void f.text().then((txt) => {
                  const r = importPersistedJson(txt);
                  setBackupMsg(r.ok ? "Imported." : r.error);
                  if (backupRef.current) backupRef.current.value = "";
                });
              }}
            />
            <button
              type="button"
              className="ui-toolBtn rounded-lg border border-app-line-mid px-3 py-2 text-sm text-app-text hover:bg-app-surface-2"
              onClick={() => backupRef.current?.click()}
            >
              Import JSON
            </button>
          </div>
          {backupMsg ? <p className="mt-2 text-xs text-app-tone">{backupMsg}</p> : null}
        </section>

        <div className="h-px w-full shrink-0 rounded-full bg-app-divider" aria-hidden />

        <section className="rounded-xl border border-app-panel-border bg-app-panel-bg p-4">
          <h3 className="text-sm font-semibold text-app-text">{t("st.dataRecoveryTitle")}</h3>
          <p className="mt-1 text-xs text-app-muted">{t("st.dataRecoveryHint")}</p>
          <button
            type="button"
            className="ui-toolBtn mt-3 rounded-lg border border-app-line-mid px-3 py-2 text-sm text-app-text hover:bg-app-surface-2"
            onClick={() => {
              setRecoverMsg(null);
              const r = restoreFullHardwareCatalogFromLocalStorageBackup();
              if (r.ok) setRecoverMsg(t("st.recoverFullLsOk", { count: String(r.count) }));
              else if (r.error === "no_backup") setRecoverMsg(t("st.recoverFullLsNoBackup"));
              else if (r.error === "empty_hardware") setRecoverMsg(t("st.recoverFullLsEmpty"));
              else setRecoverMsg(t("st.recoverFullLsInvalid"));
            }}
          >
            {t("st.recoverFullLsBtn")}
          </button>
          <button
            type="button"
            className="ui-toolBtn mt-3 rounded-lg border border-app-line-mid px-3 py-2 text-sm text-app-text hover:bg-app-surface-2"
            onClick={() => {
              setRecoverMsg(null);
              const ok = recoverCatalogFromLocalStorageBackup();
              setRecoverMsg(ok ? t("st.recoverLsOk") : t("st.recoverLsNone"));
            }}
          >
            {t("st.recoverLsBtn")}
          </button>
          {recoverMsg ? <p className="mt-2 text-xs text-app-tone">{recoverMsg}</p> : null}
        </section>

        <div className="h-px w-full shrink-0 rounded-full bg-app-divider" aria-hidden />

        <section className="rounded-xl border border-app-panel-border bg-app-panel-bg p-4">
          <h3 className="text-sm font-semibold text-app-text">{t("st.logoTitle")}</h3>
          <div className="mt-3 flex flex-wrap items-start gap-4">
            <div className="flex h-24 w-40 items-center justify-center overflow-hidden rounded-lg border border-app-wire bg-app-surface-2">
              {companyLogoDataUrl ? (
                <img src={companyLogoDataUrl} alt="" className="max-h-full max-w-full object-contain" />
              ) : (
                <span className="text-xs text-app-subtle">{t("st.logoNone")}</span>
              )}
            </div>
            <div className="flex flex-col gap-2">
              <PhotoUploadModal
                open={logoModalOpen}
                onClose={() => setLogoModalOpen(false)}
                title={t("st.uploadLogo")}
                accept="image/jpeg,image/png,image/webp"
                showAiOption={false}
                busy={busy}
                onConfirmFiles={async (files) => {
                  const f = files[0];
                  if (!f) return;
                  setErr(null);
                  setBusy(true);
                  try {
                    const url = await compressImageFileToJpegDataUrl(f, { maxEdge: 900, quality: 0.88 });
                    setCompanyBranding({ companyLogoDataUrl: url });
                  } catch (e) {
                    const msg = e instanceof Error ? e.message : t("st.logoErr");
                    setErr(msg);
                    throw e instanceof Error ? e : new Error(msg);
                  } finally {
                    setBusy(false);
                  }
                }}
              />
              <button
                type="button"
                disabled={busy}
                onClick={() => setLogoModalOpen(true)}
                className="ui-toolBtn rounded-lg border border-app-wire px-3 py-2 text-sm text-app-text disabled:opacity-50"
              >
                {busy ? t("st.logoBusy") : t("st.uploadLogo")}
              </button>
              {companyLogoDataUrl ? (
                <button
                  type="button"
                  onClick={() => setCompanyBranding({ companyLogoDataUrl: null })}
                  className="self-start text-xs text-app-danger-text/90 hover:underline"
                >
                  {t("st.clearLogo")}
                </button>
              ) : null}
            </div>
          </div>
        </section>

        <div className="h-px w-full shrink-0 rounded-full bg-app-divider" aria-hidden />

        <section className="rounded-xl border border-app-panel-border bg-app-panel-bg p-4">
          <h3 className="text-sm font-semibold text-app-text">{t("st.contactTitle")}</h3>
          <div className="mt-3 grid max-w-2xl gap-3 sm:grid-cols-2">
            <label className="flex flex-col gap-1 text-xs text-app-muted sm:col-span-2">
              {t("st.companyName")}
              <input
                value={companyName}
                onChange={(e) => setCompanyBranding({ companyName: e.target.value })}
                className="rounded-lg border border-app-info-border bg-app-surface-2 px-3 py-2 text-sm text-app-info-text"
                placeholder={t("st.companyNamePh")}
              />
            </label>
            <label className="flex flex-col gap-1 text-xs text-app-muted sm:col-span-2">
              {t("st.tagline")}
              <input
                value={companyTagline}
                onChange={(e) => setCompanyBranding({ companyTagline: e.target.value })}
                className="rounded-lg border border-app-info-border bg-app-surface-2 px-3 py-2 text-sm text-app-info-text"
                placeholder={t("st.taglinePh")}
              />
            </label>
            <label className="flex flex-col gap-1 text-xs text-app-muted sm:col-span-2">
              {t("st.address")}
              <textarea
                value={companyAddress}
                onChange={(e) => setCompanyBranding({ companyAddress: e.target.value })}
                rows={3}
                className="rounded-lg border border-app-info-border bg-app-surface-2 px-3 py-2 text-sm text-app-info-text"
                placeholder={t("st.addressPh")}
              />
            </label>
            <label className="flex flex-col gap-1 text-xs text-app-muted">
              {t("st.phone")}
              <input
                value={companyPhone}
                onChange={(e) => setCompanyBranding({ companyPhone: e.target.value })}
                className="rounded-lg border border-app-info-border bg-app-surface-2 px-3 py-2 text-sm text-app-info-text"
              />
            </label>
            <label className="flex flex-col gap-1 text-xs text-app-muted">
              {t("st.email")}
              <input
                value={companyEmail}
                onChange={(e) => setCompanyBranding({ companyEmail: e.target.value })}
                className="rounded-lg border border-app-info-border bg-app-surface-2 px-3 py-2 text-sm text-app-info-text"
              />
            </label>
            <label className="flex flex-col gap-1 text-xs text-app-muted sm:col-span-2">
              {t("st.website")}
              <input
                value={companyWebsite}
                onChange={(e) => setCompanyBranding({ companyWebsite: e.target.value })}
                className="rounded-lg border border-app-info-border bg-app-surface-2 px-3 py-2 text-sm text-app-info-text"
                placeholder="https://"
              />
            </label>
            <label className="flex flex-col gap-1 text-xs text-app-muted">
              Catalog currency (ISO)
              <input
                value={companyCatalogCurrency}
                onChange={(e) => setCompanyBranding({ companyCatalogCurrency: e.target.value })}
                className="rounded-lg border border-app-info-border bg-app-surface-2 px-3 py-2 text-sm text-app-info-text"
                placeholder="AUD"
              />
            </label>
            <label className="flex flex-col gap-1 text-xs text-app-muted">
              Display amount multiplier
              <input
                type="number"
                min={0.0001}
                step={0.01}
                value={companyCatalogFxMultiplier}
                onChange={(e) => {
                  const n = parseFloat(e.target.value);
                  if (!Number.isNaN(n)) setCompanyBranding({ companyCatalogFxMultiplier: n });
                }}
                className="rounded-lg border border-app-info-border bg-app-surface-2 px-3 py-2 text-sm text-app-info-text"
              />
            </label>
          </div>
        </section>

        <button
          type="button"
          onClick={() => {
            useQuoteStore.getState().setCustomPlanTab("quote");
            setActiveTab("customPlan");
          }}
          className="ui-toolBtn self-start rounded-lg border border-app-wire px-4 py-2 text-sm text-app-muted"
        >
          {t("st.backQuote")}
        </button>
      </div>
    </UiPageShell>
  );
}
