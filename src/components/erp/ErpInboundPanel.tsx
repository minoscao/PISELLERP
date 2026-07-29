import { useEffect, useMemo, useRef, useState } from "react";
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

function selFromScanHit(hit: { kind: ErpStockKind; catalogRefId: string; catalogOptionId?: string | null }): Sel {
  if (hit.kind === "hardware") return `hw:${hit.catalogRefId}${hit.catalogOptionId ? `|${hit.catalogOptionId}` : ""}`;
  return hit.kind === "software" ? `sw:${hit.catalogRefId}` : `sv:${hit.catalogRefId}`;
}

export function ErpInboundPanel() {
  const tr = useT();
  const associations = useQuoteStore((s) => s.associations);
  const softwareFeatures = useQuoteStore((s) => s.softwareFeatures);
  const serviceItems = useQuoteStore((s) => s.serviceItems);
  const lines = useQuoteStore((s) => s.erpInventoryLines);
  const serialItems = useQuoteStore((s) => s.erpSerialItems);
  const materials = useQuoteStore((s) => s.materials);
  const recordErpStockIn = useQuoteStore((s) => s.recordErpStockIn);

  const [sel, setSel] = useState<Sel>("");
  const [qty, setQty] = useState(1);
  const [serialText, setSerialText] = useState("");
  const [serialTracking, setSerialTracking] = useState(true);
  const [scanCode, setScanCode] = useState("");
  const [note, setNote] = useState("");
  const [msg, setMsg] = useState<{ text: string; tone: "ok" | "err" } | null>(null);
  const scanInputRef = useRef<HTMLInputElement>(null);
  const scannerBufferRef = useRef({ value: "", lastKeyAt: 0 });

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

  useEffect(() => {
    scanInputRef.current?.focus();
  }, []);

  useEffect(() => {
    if (parsed?.kind === "hardware" && line) setSerialTracking(line.serialTracking);
  }, [line, parsed?.kind]);

  const focusScanner = () => window.requestAnimationFrame(() => scanInputRef.current?.focus());

  const matchScannedCode = (rawCode = scanCode) => {
    const code = rawCode.trim();
    if (!code) {
      focusScanner();
      return;
    }

    const barcodeHit = resolveErpBarcodeScan(lines, associations, code);
    const serialHit = serialItems.find((item) => item.serialNumber.toLowerCase() === code.toLowerCase());
    const hit = barcodeHit ?? (serialHit
      ? { kind: "hardware" as const, catalogRefId: serialHit.catalogRefId, catalogOptionId: serialHit.catalogOptionId }
      : null);

    if (hit) {
      const nextSel = selFromScanHit(hit);
      const matchedLine = lines.find(
        (item) =>
          item.kind === hit.kind &&
          item.catalogRefId === hit.catalogRefId &&
          (item.catalogOptionId ?? null) === (hit.kind === "hardware" ? hit.catalogOptionId ?? null : null),
      );
      setSel(nextSel);
      if (hit.kind === "hardware") setSerialTracking(matchedLine?.serialTracking !== false);
      setScanCode("");
      setMsg({
        text: serialHit ? "SN matched. The related product is ready on the right." : "Product matched. Continue scanning SNs if needed.",
        tone: "ok",
      });
      focusScanner();
      return;
    }

    if (parsed?.kind === "hardware" && serialTracking) {
      const currentSerials = [...new Set(serialText.split(/[\n,]/).map((item) => item.trim()).filter(Boolean))];
      if (currentSerials.some((serial) => serial.toLowerCase() === code.toLowerCase())) {
        setMsg({ text: "This SN has already been captured for this inbound record.", tone: "err" });
      } else {
        const nextSerials = [...currentSerials, code];
        setSerialText(nextSerials.join("\n"));
        setQty(nextSerials.length);
        setMsg({ text: `SN captured for the matched hardware (${nextSerials.length}).`, tone: "ok" });
      }
      setScanCode("");
      focusScanner();
      return;
    }

    setMsg({ text: "No product matches this barcode or SN. Scan a product barcode first.", tone: "err" });
    focusScanner();
  };

  useEffect(() => {
    const onScannerKeyDown = (event: KeyboardEvent) => {
      if (event.defaultPrevented || event.ctrlKey || event.metaKey || event.altKey) return;
      const now = Date.now();
      const buffer = scannerBufferRef.current;

      if (event.key === "Enter") {
        const isScannerInput = buffer.value.length >= 4 && now - buffer.lastKeyAt < 160;
        if (isScannerInput) {
          event.preventDefault();
          matchScannedCode(buffer.value);
        }
        scannerBufferRef.current = { value: "", lastKeyAt: 0 };
        return;
      }

      if (event.key.length !== 1) return;
      scannerBufferRef.current = {
        value: now - buffer.lastKeyAt < 75 ? `${buffer.value}${event.key}` : event.key,
        lastKeyAt: now,
      };
    };

    window.addEventListener("keydown", onScannerKeyDown, true);
    return () => window.removeEventListener("keydown", onScannerKeyDown, true);
  }, [matchScannedCode]);

  const onSubmitInbound = () => {
    setMsg(null);
    if (!parsed) {
      setMsg({ text: tr("erp.pickProduct"), tone: "err" });
      return;
    }
    const serialNumbers = [...new Set(serialText.split(/[\n,]/).map((item) => item.trim()).filter(Boolean))];
    const r = recordErpStockIn(parsed.kind, parsed.id, qty, {
      serialNumbers: parsed.kind === "hardware" ? serialNumbers : undefined,
      serialTracking: parsed.kind === "hardware" ? serialTracking : undefined,
      note: note.trim() || undefined,
      catalogOptionId: parsed.kind === "hardware" ? parsed.catalogOptionId : undefined,
    });
    if (!r.ok) {
      if (r.error === "serial_count") setMsg({ text: "Enter one unique SN for every hardware unit.", tone: "err" });
      else if (r.error === "serial_conflict") setMsg({ text: "This SN already exists in inventory.", tone: "err" });
      else setMsg({ text: tr("erp.errInbound"), tone: "err" });
      return;
    }
    setMsg({ text: tr("erp.inboundOk"), tone: "ok" });
    setSerialText("");
    setNote("");
    setQty(1);
  };

  return (
    <div className="mx-auto grid min-h-0 w-full max-w-5xl flex-1 gap-4 overflow-auto py-1 lg:grid-cols-[minmax(260px,0.8fr)_minmax(0,1.45fr)]">
      <aside className="flex h-fit flex-col gap-4 rounded-xl border border-app-panel-border bg-app-panel-bg p-4 lg:sticky lg:top-1">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-app-subtle">Inbound scanner</p>
          <h2 className="mt-1 text-base font-semibold text-app-text">Scan barcode or SN to continue</h2>
          <p className="mt-1 text-xs leading-5 text-app-muted">Keep this field active for a barcode scanner. A matching barcode or SN selects its product automatically.</p>
        </div>
        <label className="flex flex-col gap-2 text-xs text-app-muted">
          <span className="font-medium text-app-text">Barcode or SN</span>
          <input
            ref={scanInputRef}
            value={scanCode}
            onChange={(event) => setScanCode(event.target.value)}
            onKeyDown={(event) => {
              if (!event.defaultPrevented && event.key === "Enter") {
                event.preventDefault();
                matchScannedCode();
              }
            }}
            placeholder="Scan or type, then Enter"
            className="rounded border border-app-line-mid bg-app-surface-2 px-3 py-3 text-sm text-app-text outline-none transition focus:border-app-primary focus:ring-2 focus:ring-app-primary/20"
          />
        </label>
        <button
          type="button"
          onClick={() => matchScannedCode()}
          className="rounded-lg border border-app-line-mid px-3 py-2 text-sm font-medium text-app-text transition hover:bg-app-surface-2"
        >
          Match product
        </button>
        <div className="rounded-lg border border-app-line-subtle bg-app-surface-2 px-3 py-3 text-xs text-app-muted">
          {productCard ? (
            <>
              <p className="font-medium text-app-text">Matched product</p>
              <p className="mt-1 truncate">{productCard.title}</p>
              {parsed?.kind === "hardware" && serialTracking ? <p className="mt-2 text-app-subtle">After matching, each new scan is captured as an SN.</p> : null}
            </>
          ) : (
            <p>Waiting for a product barcode or a recognised SN.</p>
          )}
        </div>
        {msg ? <p className={`text-xs ${msg.tone === "ok" ? "text-app-success-text" : "text-app-danger-text"}`}>{msg.text}</p> : null}
      </aside>

      <div className="flex min-w-0 flex-col gap-4">
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

      {parsed?.kind === "hardware" ? (
        <label className="flex flex-col gap-1 text-xs text-app-muted">
          <span className="font-medium text-app-text">Hardware SN</span>
          <textarea
            value={serialText}
            onChange={(e) => setSerialText(e.target.value)}
            placeholder="Scan one SN per line"
            className="min-h-24 rounded border border-app-line-mid bg-app-surface-2 px-2 py-2 text-sm text-app-text"
          />
          <span className="text-app-subtle">Every physical hardware unit needs one unique SN. Product barcode is not used as its SN.</span>
          <label className="mt-1 flex items-center gap-2 text-app-text">
            <input type="checkbox" checked={serialTracking} onChange={(event) => setSerialTracking(event.target.checked)} />
            Track this product by SN
          </label>
        </label>
      ) : null}

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
        <div className="flex flex-col gap-1 text-xs text-app-muted">
          <span>Tracking</span>
          <span className="rounded border border-app-line-mid bg-app-surface-2 px-2 py-1.5 text-sm text-app-text">
            {parsed?.kind === "hardware" ? (serialTracking ? "SN required" : "No SN · quantity only") : "Quantity only"}
          </span>
        </div>
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
      </div>
    </div>
  );
}
