import { useMemo, useState } from "react";
import { useQuoteStore } from "../../store/quoteStore";

export function ErpOutboundPanel() {
  const plans = useQuoteStore((s) => s.savedCustomPlans);
  const customers = useQuoteStore((s) => s.crmCustomers);
  const associations = useQuoteStore((s) => s.associations);
  const inventoryLines = useQuoteStore((s) => s.erpInventoryLines);
  const orders = useQuoteStore((s) => s.erpOutboundOrders);
  const createOrder = useQuoteStore((s) => s.createErpOutboundOrder);
  const scanSerial = useQuoteStore((s) => s.scanErpOutboundSerial);
  const verifyLine = useQuoteStore((s) => s.verifyErpOutboundLine);
  const dispatchOrder = useQuoteStore((s) => s.dispatchErpOutboundOrder);
  const [planId, setPlanId] = useState("");
  const [orderId, setOrderId] = useState("");
  const [serialInput, setSerialInput] = useState("");
  const [message, setMessage] = useState<string | null>(null);

  const plansWithCustomer = useMemo(
    () =>
      plans.map((plan) => ({
        plan,
        customer: customers.find((customer) => customer.solutionPlanIds.includes(plan.id)),
      })),
    [plans, customers],
  );
  const selectedOrder = orders.find((order) => order.id === orderId) ?? orders.find((order) => order.status === "draft") ?? null;
  const associationById = useMemo(() => new Map(associations.map((item) => [item.id, item])), [associations]);

  const createDeliveryNote = () => {
    const result = createOrder(planId);
    if (!result.ok) {
      setMessage(result.error === "plan_empty" ? "This quotation has no hardware items to dispatch." : "Choose a saved customer quotation first.");
      return;
    }
    setOrderId(result.orderId);
    setMessage("Delivery note created. Scan each hardware SN to verify it.");
  };

  const submitSerial = () => {
    if (!selectedOrder) return;
    const result = scanSerial(selectedOrder.id, serialInput);
    if (!result.ok) {
      const labels: Record<string, string> = {
        serial_unavailable: "This SN is not in stock.",
        serial_not_required: "This SN does not match a remaining item on this delivery note.",
        serial_missing: "Scan or enter an SN first.",
      };
      setMessage(labels[result.error] ?? "Could not add this SN.");
      return;
    }
    setSerialInput("");
    setMessage("SN verified and matched to the delivery note.");
  };

  const dispatch = () => {
    if (!selectedOrder) return;
    const result = dispatchOrder(selectedOrder.id);
    if (!result.ok) {
      const labels: Record<string, string> = {
        not_verified: "Verify every item before dispatching.",
        stock_short: "Stock on hand is insufficient for this delivery note.",
      };
      setMessage(labels[result.error] ?? "Could not dispatch this order.");
      return;
    }
    setMessage("Outbound recorded. The delivery note is complete.");
  };

  return (
    <div className="mx-auto flex min-h-0 w-full max-w-4xl flex-1 flex-col gap-4 overflow-auto py-1">
      <section className="rounded-xl border border-app-panel-border bg-app-panel-bg p-4">
        <div className="flex flex-wrap items-end gap-3">
          <label className="flex min-w-64 flex-1 flex-col gap-1 text-xs text-app-muted">
            <span className="font-medium text-app-text">Customer quotation</span>
            <select
              value={planId}
              onChange={(event) => setPlanId(event.target.value)}
              className="rounded border border-app-line-mid bg-app-surface-2 px-2 py-2 text-sm text-app-text"
            >
              <option value="">Choose a saved quotation…</option>
              {plansWithCustomer.map(({ plan, customer }) => (
                <option key={plan.id} value={plan.id}>
                  {customer?.name || "Unassigned customer"} · {plan.name}
                </option>
              ))}
            </select>
          </label>
          <button type="button" onClick={createDeliveryNote} className="rounded-lg bg-app-primary px-3 py-2 text-sm font-medium text-app-on-primary hover:bg-app-primary-hover">
            Create delivery note
          </button>
        </div>
        {plans.length === 0 ? <p className="mt-3 text-xs text-app-subtle">Save a customer quotation first, then create its delivery note here.</p> : null}
      </section>

      {selectedOrder ? (
        <section className="rounded-xl border border-app-panel-border bg-app-panel-bg p-4">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <p className="text-xs uppercase tracking-[0.16em] text-app-subtle">Delivery note</p>
              <h3 className="mt-1 text-base font-semibold text-app-text">{selectedOrder.customerName} · {selectedOrder.planName}</h3>
            </div>
            <span className="rounded-full border border-app-line-mid px-2 py-1 text-xs text-app-muted">
              {selectedOrder.status === "dispatched" ? "Dispatched" : "Draft"}
            </span>
          </div>

          {selectedOrder.status === "draft" ? (
            <label className="mt-4 flex flex-col gap-1 text-xs text-app-muted">
              <span className="font-medium text-app-text">Scan hardware SN</span>
              <div className="flex gap-2">
                <input
                  value={serialInput}
                  onChange={(event) => setSerialInput(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      event.preventDefault();
                      submitSerial();
                    }
                  }}
                  placeholder="Scan or type SN, then Enter"
                  className="min-w-0 flex-1 rounded border border-app-line-mid bg-app-surface-2 px-2 py-2 text-sm text-app-text"
                />
                <button type="button" onClick={submitSerial} className="rounded border border-app-line-mid px-3 text-sm text-app-text hover:bg-app-surface-2">
                  Verify SN
                </button>
              </div>
            </label>
          ) : null}

          <div className="mt-4 overflow-hidden rounded-lg border border-app-line-subtle">
            {selectedOrder.lines.map((line) => {
              const product = associationById.get(line.catalogRefId);
              const option = product?.options.find((item) => item.id === line.catalogOptionId);
              const verified = line.serialNumbers.length + line.verifiedQty;
              const stockLine = inventoryLines.find(
                (item) =>
                  item.kind === "hardware" &&
                  item.catalogRefId === line.catalogRefId &&
                  (item.catalogOptionId ?? null) === (line.catalogOptionId ?? null),
              );
              const serialTracking = stockLine?.serialTracking !== false;
              return (
                <div key={line.id} className="flex flex-wrap items-center gap-3 border-b border-app-line-subtle p-3 last:border-b-0">
                  <div className="min-w-56 flex-1">
                    <p className="text-sm font-medium text-app-text">{product?.deviceModel || product?.hardwareName || "Unknown hardware"}</p>
                    <p className="mt-1 text-xs text-app-muted">{option?.label ? `${option.label} · ` : ""}Verified {verified} / {line.quantity}</p>
                    {line.serialNumbers.length ? <p className="mt-1 text-xs text-app-subtle">SN: {line.serialNumbers.join(", ")}</p> : null}
                  </div>
                  {selectedOrder.status === "draft" && !serialTracking && verified < line.quantity ? (
                    <button
                      type="button"
                      onClick={() => {
                        verifyLine(selectedOrder.id, line.id);
                        setMessage("Non-SN item marked as verified.");
                      }}
                      className="rounded border border-app-line-mid px-3 py-1.5 text-xs text-app-text hover:bg-app-surface-2"
                    >
                      Mark verified
                    </button>
                  ) : null}
                  <span className={`text-xs ${verified >= line.quantity ? "text-app-success-text" : "text-app-muted"}`}>{verified >= line.quantity ? "Ready" : "Pending"}</span>
                </div>
              );
            })}
          </div>

          {selectedOrder.status === "draft" ? (
            <button type="button" onClick={dispatch} className="mt-4 rounded-lg bg-app-primary px-4 py-2 text-sm font-medium text-app-on-primary hover:bg-app-primary-hover">
              Confirm dispatch
            </button>
          ) : null}
        </section>
      ) : null}
      {message ? <p className="text-sm text-app-muted">{message}</p> : null}
    </div>
  );
}
