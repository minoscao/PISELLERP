import { useCallback, useMemo, useState } from "react";
import { useT } from "../../i18n/useT";
import { useQuoteStore } from "../../store/quoteStore";
import type { AssociationRow, ErpStockKind, ServiceRow, SoftwareFeatureRow } from "../../types";
import { optionById } from "../../utils/hardwareOptionsAddons";
import { resolveErpBarcodeScan } from "../../utils/erpInventory";

type Sel = "" | `hw:${string}` | `hw:${string}|${string}` | `sw:${string}` | `sv:${string}`;

function parseSel(s: Sel): { kind: ErpStockKind; id: string; catalogOptionId: string | null } | null {
  if (!s) return null;
  if (s.startsWith("hw:")) {
    const tail = s.slice(3);
    const pipe = tail.indexOf("|");
    if (pipe < 0) return { kind: "hardware", id: tail, catalogOptionId: null };
    return { kind: "hardware", id: tail.slice(0, pipe), catalogOptionId: tail.slice(pipe + 1) || null };
  }
  const [p, id] = s.split(":") as [string, string];
  if (!id) return null;
  if (p === "sw") return { kind: "software", id, catalogOptionId: null };
  if (p === "sv") return { kind: "service", id, catalogOptionId: null };
  return null;
}

export function ErpInboundPanel() {
  const tr = useT();
  const associations = useQuoteStore((s) => s.associations);
  const softwareFeatures = useQuoteStore((s) => s.softwareFeatures);
  const serviceItems = useQuoteStore((s) => s.serviceItems);
  const lines = useQuoteStore((s) => s.erpInventoryLines);
  const materials = useQuoteStore((s) => s.materials);
  const recordErpStockIn = useQuoteStore((s) => s.recordErpStockIn);

  const [sel, setSel] = useState<Sel>("");
  const [qty, setQty] = useState(1);
  const [barcodeIn, setBarcodeIn] = useState("");
  const [note, setNote] = useState("");
  const [scanField, setScanField] = useState("");
  const [msg, setMsg] = useState<{ text: string; tone: "ok" | "err" } | null>(null);

  const matById = useMemo(() => new Map(materials.map((m) => [m.id, m])), [materials]);

  const parsed = parseSel(sel);
  const line = useMemo(() => {
    if (!parsed) return null;
    const opt = parsed.kind === "hardware" ? parsed.catalogOptionId : null;
    return (
      lines.find(
        (l) =>
          l.kind === parsed.kind &&
          l.catalogRefId === parsed.id &&
          (parsed.kind !== "hardware" || (l.catalogOptionId ?? null) === (opt ?? null)),
      ) ?? null
    );
  }, [lines, parsed]);

  const productCard = useMemo(() => {
    if (!parsed) return null;
    if (parsed.kind === "hardware") {
      const a = associations.find((x) => x.id === parsed.id);
      if (!a) return { title: tr("erp.unknownProduct"), lines: [] as string[] };
      const prod = a.productMaterialId ? matById.get(a.productMaterialId) : null;
      const opt =
        parsed.kind === "hardware" && parsed.catalogOptionId ? optionById(a, parsed.catalogOptionId) : null;
      const bits = [
        `${tr("erp.model")}: ${a.deviceModel || "—"}`,
        `${tr("erp.unitPrice")}: ${a.unitPrice}`,
        prod ? `${tr("erp.productImg")}: ${prod.fileName}` : tr("erp.noProductImg"),
      ];
      if (opt?.label) bits.splice(1, 0, `${tr("erp.option")}: ${opt.label}`);
      return {
        title: a.deviceModel || a.hardwareName || tr("erp.unknownProduct"),
        lines: bits,
      };
    }
    if (parsed.kind === "software") {
      const f = softwareFeatures.find((x) => x.id === parsed.id);
      if (!f) return { title: tr("erp.unknownProduct"), lines: [] as string[] };
      return {
        title: f.featureName || f.id,
        lines: [`${tr("erp.category")}: ${f.featureCategory || "—"}`, `${tr("erp.unitPrice")}: ${f.unitPrice ?? "—"}`],
      };
    }
    const s = serviceItems.find((x) => x.id === parsed.id);
    if (!s) return { title: tr("erp.unknownProduct"), lines: [] as string[] };
    return {
      title: s.serviceName || s.id,
      lines: [`${tr("erp.category")}: ${s.serviceCategory || "—"}`, `${tr("erp.unitPrice")}: ${s.unitPrice ?? "—"}`],
    };
  }, [parsed, associations, softwareFeatures, serviceItems, matById, tr]);

  const applyScan = useCallback(
    (raw: string) => {
      const code = raw.trim();
      setScanField(code);
      if (!code) return;
      const hit = resolveErpBarcodeScan(lines, associations, code);
      if (!hit) {
        setMsg({ text: tr("erp.scanNoMatch"), tone: "err" });
        return;
      }
      setMsg(null);
      if (hit.kind === "hardware") {
        const suf = hit.catalogOptionId ? `|${hit.catalogOptionId}` : "";
        setSel(`hw:${hit.catalogRefId}${suf}` as Sel);
      } else if (hit.kind === "software") {
        setSel(`sw:${hit.catalogRefId}` as Sel);
      } else {
        setSel(`sv:${hit.catalogRefId}` as Sel);
      }
    },
    [lines, associations, tr],
  );

  const onSubmitInbound = () => {
    setMsg(null);
    if (!parsed) {
      setMsg({ text: tr("erp.pickProduct"), tone: "err" });
      return;
    }
    const r = recordErpStockIn(parsed.kind, parsed.id, qty, {
      barcode: barcodeIn.trim() || undefined,
      note: note.trim() || undefined,
      catalogOptionId: parsed.kind === "hardware" ? parsed.catalogOptionId : undefined,
    });
    if (!r.ok) {
      if (r.error === "barcode_conflict") setMsg({ text: tr("erp.errBarcodeConflict"), tone: "err" });
      else if (r.error === "barcode_mismatch") setMsg({ text: tr("erp.errBarcodeMismatch"), tone: "err" });
      else setMsg({ text: tr("erp.errInbound"), tone: "err" });
      return;
    }
    setMsg({ text: tr("erp.inboundOk"), tone: "ok" });
    setBarcodeIn("");
    setNote("");
    setQty(1);
  };

  return (
    <div className="mx-auto flex min-h-0 w-full max-w-xl flex-1 flex-col gap-4 overflow-auto py-1">
      <label className="flex flex-col gap-1 text-xs text-app-muted">
        <span className="font-medium text-app-text">{tr("erp.selectProduct")}</span>
        <select
          value={sel}
          onChange={(e) => {
            setSel(e.target.value as Sel);
            setMsg(null);
          }}
          className="rounded border border-app-line-mid bg-app-surface-2 px-2 py-2 text-sm text-app-text"
        >
          <option value="">{tr("erp.pickPlaceholder")}</option>
          <optgroup label={tr("erp.grHardware")}>
            {associations.flatMap((a: AssociationRow) => {
              const opts = a.options.filter((o) => o.label.trim());
              if (opts.length === 0) {
                return (
                  <option key={a.id} value={`hw:${a.id}`}>
                    {a.deviceModel || a.hardwareName || a.id}
                  </option>
                );
              }
              return opts.map((o) => (
                <option key={`${a.id}-${o.id}`} value={`hw:${a.id}|${o.id}`}>
                  {(a.deviceModel || a.hardwareName || a.id).trim()} · {o.label}
                </option>
              ));
            })}
          </optgroup>
          <optgroup label={tr("erp.grSoftware")}>
            {softwareFeatures.map((f: SoftwareFeatureRow) => (
              <option key={f.id} value={`sw:${f.id}`}>
                {f.featureName || f.id}
              </option>
            ))}
          </optgroup>
          <optgroup label={tr("erp.grService")}>
            {serviceItems.map((s: ServiceRow) => (
              <option key={s.id} value={`sv:${s.id}`}>
                {s.serviceName || s.id}
              </option>
            ))}
          </optgroup>
        </select>
      </label>

      <div className="rounded-xl border border-app-panel-border bg-app-panel-bg p-4">
        <h3 className="text-sm font-semibold text-app-text">{tr("erp.productInfo")}</h3>
        {!productCard ? (
          <p className="mt-2 text-xs text-app-subtle">{tr("erp.pickProduct")}</p>
        ) : (
          <div className="mt-3 space-y-2">
            <p className="text-base font-medium text-app-text">{productCard.title}</p>
            <ul className="list-inside list-disc space-y-1 text-xs text-app-muted">
              {productCard.lines.map((x, i) => (
                <li key={i}>{x}</li>
              ))}
            </ul>
            <div className="mt-4 border-t border-app-line-subtle pt-3 text-xs text-app-muted">
              <div>
                {tr("erp.currentStock")}:{" "}
                <span className="font-semibold text-app-text">{line?.quantityOnHand ?? 0}</span>
              </div>
              <div className="mt-1">
                {tr("erp.currentBarcode")}:{" "}
                <span className="font-mono text-app-text">{line?.barcode?.trim() ? line.barcode : "—"}</span>
              </div>
            </div>
          </div>
        )}
      </div>

      <label className="flex flex-col gap-1 text-xs text-app-muted">
        <span className="font-medium text-app-text">{tr("erp.scanBarcode")}</span>
        <input
          type="text"
          value={scanField}
          onChange={(e) => setScanField(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              applyScan(scanField);
            }
          }}
          placeholder={tr("erp.scanPlaceholder")}
          className="rounded border border-app-line-mid bg-app-surface-2 px-2 py-2 text-sm text-app-text"
        />
        <span className="text-app-subtle">{tr("erp.scanHelp")}</span>
      </label>

      <div className="grid grid-cols-2 gap-2">
        <label className="flex flex-col gap-1 text-xs text-app-muted">
          {tr("erp.qtyIn")}
          <input
            type="number"
            min={1}
            value={qty}
            onChange={(e) => setQty(Math.max(1, Math.floor(Number(e.target.value) || 1)))}
            className="rounded border border-app-line-mid bg-app-surface-2 px-2 py-1.5 text-sm text-app-text"
          />
        </label>
        <label className="flex flex-col gap-1 text-xs text-app-muted">
          {tr("erp.barcodeOptional")}
          <input
            type="text"
            value={barcodeIn}
            onChange={(e) => setBarcodeIn(e.target.value)}
            className="rounded border border-app-line-mid bg-app-surface-2 px-2 py-1.5 text-sm text-app-text"
          />
        </label>
      </div>
      <label className="flex flex-col gap-1 text-xs text-app-muted">
        {tr("erp.noteOptional")}
        <input
          type="text"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          className="rounded border border-app-line-mid bg-app-surface-2 px-2 py-1.5 text-sm text-app-text"
        />
      </label>

      <button
        type="button"
        onClick={onSubmitInbound}
        className="rounded-lg bg-app-primary px-3 py-2 text-sm font-medium text-app-on-primary hover:bg-app-primary-hover"
      >
        {tr("erp.confirmInbound")}
      </button>
      {msg ? (
        <p className={`text-xs ${msg.tone === "ok" ? "text-app-success-text" : "text-app-danger-text"}`}>{msg.text}</p>
      ) : null}
    </div>
  );
}
