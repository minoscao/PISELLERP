import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const file = path.join(__dirname, "../src/components/PlanLayoutPanel.tsx");
let s = fs.readFileSync(file, "utf8");

const re =
  /\r?\n        <div className="grid min-h-0 flex-1 grid-cols-1 gap-3 xl:grid-cols-\[minmax\(200px,260px\)_minmax\(200px,260px\)_minmax\(0,1fr\)_minmax\(260px,360px\)\]">\r?\n          \{\/\* 第一列：素材库 \*\/\}[\s\S]*?\r?\n          \{\/\* 第三列：预览画布 \*\/\}/m;

const replacement = `
        <div className="grid min-h-0 flex-1 grid-cols-1 gap-3 xl:grid-cols-[minmax(280px,380px)_minmax(0,1fr)_minmax(300px,420px)]">
          {/* 红区：全部素材 */}
          <aside className="flex min-h-0 flex-col gap-2 rounded-xl border-2 border-red-500/40 bg-app-panel-bg p-3">
            <h3 className="text-sm font-semibold text-app-text">{tr("pl.redZoneTitle")}</h3>
            <div className="flex flex-wrap items-center gap-1.5">
              <button
                type="button"
                disabled={busy}
                onClick={() => pdfRef.current?.click()}
                className="rounded border border-app-line-mid px-2 py-1 text-xs text-app-muted hover:bg-app-surface-2 disabled:opacity-40"
              >
                {busy ? tr("pl.busy") : tr("pl.uploadPdf")}
              </button>
              <select
                className="max-w-[10rem] rounded border border-app-line-mid bg-app-surface-2 px-2 py-1 text-xs text-app-text"
                defaultValue=""
                onChange={(e) => {
                  const id = e.target.value;
                  e.target.value = "";
                  if (!id) return;
                  applyPlanTemplate(id);
                  const pages = useQuoteStore.getState().planPages;
                  setSelectedPageId(pages[0]?.id ?? null);
                  setStagedByPage({});
                  setPreviewMaterialId(null);
                  setErr(null);
                }}
              >
                <option value="">{tr("pl.tplApplyPick")}</option>
                {planTemplates.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
              <button
                type="button"
                disabled={!planTemplates.length}
                onClick={() => {
                  const id = window.prompt(tr("pl.tplDeletePrompt"), "");
                  if (!id?.trim()) return;
                  const t = planTemplates.find((x) => x.name === id.trim());
                  if (t && window.confirm(tr("pl.tplDeleteConfirm") + " (" + t.name + ")")) deletePlanTemplate(t.id);
                }}
                className="rounded border border-app-danger-border px-2 py-1 text-xs text-app-danger-text hover:bg-app-danger-bg disabled:opacity-40"
              >
                {tr("pl.tplDelete")}
              </button>
            </div>
            <div className="flex flex-wrap gap-1">
              {(
                [
                  ["hardware", tr("pl.libHardware")],
                  ["software", tr("pl.libSoftwareTab")],
                  ["services", tr("pl.libServicesTab")],
                  ["brand", tr("pl.libBrand")],
                  ["upload", tr("pl.libUpload")],
                ] as const
              ).map(([k, lab]) => (
                <button
                  key={k}
                  type="button"
                  onClick={() => {
                    setRedKind(k);
                    if (k === "brand" || k === "upload") setRedProposal("proposal");
                  }}
                  className={\`rounded px-2 py-1 text-xs font-medium \${
                    redKind === k
                      ? "bg-app-primary text-app-on-primary"
                      : "border border-app-line-strong text-app-muted hover:bg-app-surface-2"
                  }\`}
                >
                  {lab}
                </button>
              ))}
            </div>
            {redKind === "hardware" || redKind === "software" || redKind === "services" ? (
              <div className="flex gap-1">
                <button
                  type="button"
                  onClick={() => setRedProposal("proposal")}
                  className={\`rounded px-2 py-1 text-xs font-medium \${
                    redProposal === "proposal"
                      ? "bg-app-success-bg text-app-success-text ring-1 ring-app-success-border"
                      : "border border-app-line-strong text-app-muted hover:bg-app-surface-2"
                  }\`}
                >
                  {tr("pl.tagProposal")}
                </button>
                <button
                  type="button"
                  onClick={() => setRedProposal("other")}
                  className={\`rounded px-2 py-1 text-xs font-medium \${
                    redProposal === "other"
                      ? "bg-app-surface-2 text-app-text ring-1 ring-app-line-mid"
                      : "border border-app-line-strong text-app-muted hover:bg-app-surface-2"
                  }\`}
                >
                  {tr("pl.tagNotProposal")}
                </button>
              </div>
            ) : null}
            {redKind === "upload" ? (
              <div className="shrink-0">
                <input
                  ref={uploadLibRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp,application/pdf"
                  className="hidden"
                  onChange={(e) => void onUploadLibraryFiles(e.target.files)}
                />
                <button
                  type="button"
                  disabled={uploadBusy}
                  onClick={() => uploadLibRef.current?.click()}
                  className="w-full rounded border border-app-line-mid py-2 text-xs text-app-muted hover:bg-app-surface-2 disabled:opacity-50"
                >
                  {uploadBusy ? tr("pl.importing") : tr("pl.uploadHere")}
                </button>
              </div>
            ) : (
              <p className="text-xs text-app-muted">
                {redKind === "brand" && tr("pl.libHintBrand")}
                {redKind === "hardware" && tr("pl.libHintHardware")}
                {redKind === "software" && tr("pl.libHintSoftware")}
                {redKind === "services" && tr("pl.libHintServices")}
              </p>
            )}
            <div className="min-h-0 flex-1 space-y-3 overflow-y-auto pr-1">
              {redKind === "brand" ? (
                <>
                  <div className="flex items-center justify-between gap-1">
                    <span className="text-xs font-semibold text-app-muted">{tr("pl.libBrand")}</span>
                    <button
                      type="button"
                      disabled={!brandPageMaterials.length}
                      onClick={() => appendMaterialsToBook(brandPageMaterials.map((x) => x.id))}
                      className="rounded border border-app-primary/50 bg-app-primary/15 px-2 py-0.5 text-[11px] font-medium text-app-tone hover:bg-app-primary/25 disabled:opacity-40"
                    >
                      {tr("pl.addAllPages")}
                    </button>
                  </div>
                  {brandPageMaterials.length === 0 ? (
                    <p className="text-xs text-app-subtle">{tr("pl.libEmpty")}</p>
                  ) : (
                    brandPageMaterials.map((m) => renderMaterialRow(m))
                  )}
                </>
              ) : redKind === "upload" ? (
                <>
                  <div className="flex items-center justify-between gap-1">
                    <span className="text-xs font-semibold text-app-muted">{tr("pl.libUpload")}</span>
                    <button
                      type="button"
                      disabled={!uploadMaterials.length}
                      onClick={() => appendMaterialsToBook(uploadMaterials.map((x) => x.id))}
                      className="rounded border border-app-primary/50 bg-app-primary/15 px-2 py-0.5 text-[11px] font-medium text-app-tone hover:bg-app-primary/25 disabled:opacity-40"
                    >
                      {tr("pl.addAllPages")}
                    </button>
                  </div>
                  {uploadMaterials.length === 0 ? (
                    <p className="text-xs text-app-subtle">{tr("pl.libEmpty")}</p>
                  ) : (
                    uploadMaterials.map((m) => renderMaterialRow(m))
                  )}
                </>
              ) : redKind === "hardware" ? (
                redProposal === "proposal" ? (
                  <>
                    <div className="flex items-center justify-between gap-1">
                      <span className="text-xs font-semibold text-app-tone">{tr("pl.hwInQuote")}</span>
                      <button
                        type="button"
                        disabled={!hwSelectedIds.length}
                        onClick={() => appendMaterialsToBook(hwSelectedIds)}
                        className="rounded border border-app-primary/50 bg-app-primary/15 px-2 py-0.5 text-[11px] font-medium text-app-tone hover:bg-app-primary/25 disabled:opacity-40"
                      >
                        {tr("pl.addAllPages")}
                      </button>
                    </div>
                    {hwSelectedMaterials.length === 0 ? (
                      <p className="text-xs text-app-subtle">—</p>
                    ) : (
                      hwSelectedMaterials.map((m) => renderMaterialRow(m))
                    )}
                  </>
                ) : (
                  <>
                    <div className="flex items-center justify-between gap-1">
                      <span className="text-xs font-semibold text-app-muted">{tr("pl.hwNotInQuote")}</span>
                      <button
                        type="button"
                        disabled={!hwOtherIds.length}
                        onClick={() => appendMaterialsToBook(hwOtherIds)}
                        className="rounded border border-app-line-mid px-2 py-0.5 text-[11px] text-app-muted hover:bg-app-surface-2 disabled:opacity-40"
                      >
                        {tr("pl.addAllPages")}
                      </button>
                    </div>
                    {hwOtherMaterials.length === 0 ? (
                      <p className="text-xs text-app-subtle">—</p>
                    ) : (
                      hwOtherMaterials.map((m) => renderMaterialRow(m))
                    )}
                  </>
                )
              ) : redKind === "software" ? (
                redProposal === "proposal" ? (
                  <>
                    <div className="flex items-center justify-between gap-1">
                      <span className="text-xs font-semibold text-app-tone">{tr("pl.swInQuote")}</span>
                      <button
                        type="button"
                        disabled={!swSelectedIds.length}
                        onClick={() => appendMaterialsToBook(swSelectedIds)}
                        className="rounded border border-app-primary/50 bg-app-primary/15 px-2 py-0.5 text-[11px] font-medium text-app-tone hover:bg-app-primary/25 disabled:opacity-40"
                      >
                        {tr("pl.addAllPages")}
                      </button>
                    </div>
                    {swSelectedMaterials.length === 0 ? (
                      <p className="text-xs text-app-subtle">—</p>
                    ) : (
                      swSelectedMaterials.map((m) => renderMaterialRow(m))
                    )}
                  </>
                ) : (
                  <>
                    <div className="flex items-center justify-between gap-1">
                      <span className="text-xs font-semibold text-app-muted">{tr("pl.swNotInQuote")}</span>
                      <button
                        type="button"
                        disabled={!swOtherIds.length}
                        onClick={() => appendMaterialsToBook(swOtherIds)}
                        className="rounded border border-app-line-mid px-2 py-0.5 text-[11px] text-app-muted hover:bg-app-surface-2 disabled:opacity-40"
                      >
                        {tr("pl.addAllPages")}
                      </button>
                    </div>
                    {swOtherMaterials.length === 0 ? (
                      <p className="text-xs text-app-subtle">—</p>
                    ) : (
                      swOtherMaterials.map((m) => renderMaterialRow(m))
                    )}
                  </>
                )
              ) : redKind === "services" ? (
                redProposal === "proposal" ? (
                  <>
                    <p className="text-xs text-app-muted">{tr("pl.svcProposalHint")}</p>
                    {servicePlanLines.length === 0 ? (
                      <p className="text-xs text-app-subtle">{tr("pl.libEmpty")}</p>
                    ) : (
                      <ul className="space-y-1.5 text-xs text-app-text">
                        {servicePlanLines.map(({ line, label }) => (
                          <li key={line.id} className="rounded border border-app-line-subtle bg-app-surface-2/40 px-2 py-1.5">
                            <span className="font-medium">{label}</span>
                            {line.quantity !== 1 ? <span className="text-app-muted"> ×{line.quantity}</span> : null}
                          </li>
                        ))}
                      </ul>
                    )}
                  </>
                ) : (
                  <>
                    <p className="text-xs text-app-muted">{tr("pl.svcOtherHint")}</p>
                    {serviceCatalogOthers.length === 0 ? (
                      <p className="text-xs text-app-subtle">—</p>
                    ) : (
                      <ul className="space-y-1.5 text-xs text-app-text">
                        {serviceCatalogOthers.map((s) => (
                          <li key={s.id} className="rounded border border-app-line-subtle bg-app-surface-2/40 px-2 py-1.5">
                            {s.serviceName}
                          </li>
                        ))}
                      </ul>
                    )}
                  </>
                )
              ) : null}
            </div>
            <div className="shrink-0 space-y-2 border-t border-app-line-subtle pt-2">
              <div className="text-xs font-medium text-app-tone">{tr("pl.swBatch")}</div>
              <div className="flex flex-wrap items-center gap-2">
                <select
                  value={planSoftwareFeatureId}
                  onChange={(e) => setPlanSoftwareFeatureId(e.target.value)}
                  className="max-w-[11rem] rounded border border-app-line-mid bg-app-surface-2 px-2 py-1 text-xs text-app-text"
                >
                  <option value="">{tr("pl.pickFeature")}</option>
                  {softwareFeatures.map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.featureName || f.id.slice(0, 8)} ({f.docMaterialIds.filter(Boolean).length}/3)
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  disabled={!selectedPageId || !planSoftwareFeatureId}
                  onClick={() => {
                    if (!selectedPageId || !planSoftwareFeatureId) return;
                    applySoftwareFeatureToPlan(planSoftwareFeatureId, selectedPageId);
                  }}
                  className="rounded border border-app-primary bg-app-primary/85 px-2 py-1 text-xs font-medium text-app-on-primary hover:bg-app-primary-hover disabled:opacity-40"
                >
                  {tr("pl.loadFromHere")}
                </button>
              </div>
            </div>
            <div className="shrink-0 border-t border-app-line-subtle pt-2">
              <h4 className="mb-1 text-xs font-semibold uppercase text-app-muted">{tr("pl.globalOrder")}</h4>
              <MaterialOrderMini />
            </div>
          </aside>

          {/* 第三列：预览画布 */}`;

const m = s.match(re);
if (!m) {
  console.error("regex did not match");
  process.exit(1);
}
s = s.replace(re, replacement);
fs.writeFileSync(file, s);
console.log("ok", replacement.length);
