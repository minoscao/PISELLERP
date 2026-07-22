import { useMemo, useState } from "react";
import { useQuoteStore } from "../store/quoteStore";

const BASE_INDUSTRIES = ["餐饮", "美业", "游乐场", "教育", "酒店", "其他"];

function formatTime(value: number) {
  return new Date(value).toLocaleDateString();
}

export function CrmPanel() {
  const customers = useQuoteStore((s) => s.crmCustomers);
  const activeCustomerId = useQuoteStore((s) => s.activeCrmCustomerId);
  const savedCustomPlans = useQuoteStore((s) => s.savedCustomPlans);
  const addCustomer = useQuoteStore((s) => s.addCrmCustomer);
  const updateCustomer = useQuoteStore((s) => s.updateCrmCustomer);
  const deleteCustomer = useQuoteStore((s) => s.deleteCrmCustomer);
  const setActiveCustomerId = useQuoteStore((s) => s.setActiveCrmCustomerId);
  const loadCustomPlan = useQuoteStore((s) => s.loadCustomPlan);
  const setActiveTab = useQuoteStore((s) => s.setActiveTab);

  const [detailTab, setDetailTab] = useState<"solution" | "info">("solution");
  const [search, setSearch] = useState("");
  const [newIndustry, setNewIndustry] = useState("");

  const activeCustomer = customers.find((c) => c.id === activeCustomerId) ?? customers[0] ?? null;

  const industries = useMemo(() => {
    const fromCustomers = customers.map((c) => c.industry).filter(Boolean);
    return [...new Set([...BASE_INDUSTRIES, ...fromCustomers, newIndustry.trim()].filter(Boolean))];
  }, [customers, newIndustry]);

  const filteredCustomers = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return customers;
    return customers.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        c.industry.toLowerCase().includes(q) ||
        c.contact.toLowerCase().includes(q),
    );
  }, [customers, search]);

  const linkedPlanIds = new Set(activeCustomer?.solutionPlanIds ?? []);
  const linkedPlans = savedCustomPlans.filter((p) => linkedPlanIds.has(p.id));

  const openPlan = (id: string) => {
    loadCustomPlan(id);
    setActiveTab("customPlan");
  };

  const createCustomer = () => {
    const id = addCustomer(`Customer ${customers.length + 1}`);
    setActiveCustomerId(id);
    setDetailTab("info");
  };

  return (
    <div className="flex h-full min-h-0 bg-app-surface text-app-text">
      <aside className="flex w-[360px] shrink-0 flex-col border-r border-app-line-subtle bg-app-panel-bg">
        <div className="border-b border-app-line-subtle px-4 py-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-xs font-medium uppercase tracking-[0.18em] text-app-muted">CRM</p>
              <h2 className="mt-1 text-xl font-semibold">Customers</h2>
            </div>
            <button type="button" onClick={createCustomer} className="ui-primaryBtn px-3 py-2 text-sm">
              New customer
            </button>
          </div>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search customers"
            className="mt-4 w-full rounded-lg border border-app-line-mid bg-app-surface px-3 py-2 text-sm text-app-text outline-none transition focus:border-app-primary"
          />
        </div>

        <div className="min-h-0 flex-1 overflow-auto p-3">
          {filteredCustomers.length ? (
            <div className="grid gap-2">
              {filteredCustomers.map((customer) => {
                const active = activeCustomer?.id === customer.id;
                return (
                  <button
                    key={customer.id}
                    type="button"
                    onClick={() => setActiveCustomerId(customer.id)}
                    className={`rounded-xl border px-3 py-3 text-left transition hover:-translate-y-0.5 active:translate-y-0 ${
                      active
                        ? "border-app-primary/70 bg-[color-mix(in_srgb,var(--app-primary-soft)_82%,transparent)]"
                        : "border-app-line-subtle bg-app-surface-2/40 hover:border-app-line-mid hover:bg-app-surface-2"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="truncate text-sm font-semibold">{customer.name}</div>
                        <div className="mt-1 text-xs text-app-muted">{customer.industry}</div>
                      </div>
                      <span className="rounded-full border border-app-line-subtle px-2 py-1 text-[11px] text-app-muted">
                        {customer.solutionPlanIds.length} plans
                      </span>
                    </div>
                    <div className="mt-3 truncate text-xs text-app-subtle">{customer.contact || "No contact yet"}</div>
                  </button>
                );
              })}
            </div>
          ) : (
            <div className="rounded-xl border border-dashed border-app-line-mid px-4 py-10 text-center text-sm text-app-muted">
              No customers found.
            </div>
          )}
        </div>
      </aside>

      <main className="min-w-0 flex-1 overflow-auto p-5">
        {activeCustomer ? (
          <div className="mx-auto flex max-w-[1280px] flex-col gap-4">
            <section className="rounded-2xl border border-app-panel-border bg-app-panel-bg px-5 py-4">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="min-w-0">
                  <p className="text-xs uppercase tracking-[0.18em] text-app-muted">Customer</p>
                  <h1 className="mt-1 truncate text-2xl font-semibold">{activeCustomer.name}</h1>
                  <p className="mt-2 text-sm text-app-muted">
                    {activeCustomer.industry} · Updated {formatTime(activeCustomer.updatedAt)}
                  </p>
                </div>
                <div className="flex rounded-xl border border-app-line-mid bg-app-surface p-1">
                  {(["solution", "info"] as const).map((tab) => (
                    <button
                      key={tab}
                      type="button"
                      onClick={() => setDetailTab(tab)}
                      className={`rounded-lg px-4 py-2 text-sm font-semibold transition ${
                        detailTab === tab
                          ? "bg-app-primary text-app-on-primary shadow"
                          : "text-app-muted hover:bg-app-surface-2 hover:text-app-text"
                      }`}
                    >
                      {tab === "solution" ? "Solution" : "Info"}
                    </button>
                  ))}
                </div>
              </div>
            </section>

            {detailTab === "solution" ? (
              <section className="rounded-2xl border border-app-panel-border bg-app-panel-bg p-4">
                <div className="mb-4 flex items-center justify-between gap-3">
                  <div>
                    <h3 className="text-base font-semibold">Linked solutions</h3>
                    <p className="mt-1 text-xs text-app-muted">Connect this customer to saved map plans.</p>
                  </div>
                  <span className="text-xs text-app-muted">{linkedPlans.length} linked</span>
                </div>

                <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_360px]">
                  <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                    {linkedPlans.length ? (
                      linkedPlans.map((plan) => (
                        <button
                          key={plan.id}
                          type="button"
                          onClick={() => openPlan(plan.id)}
                          className="group overflow-hidden rounded-xl border border-app-line-subtle bg-app-surface-2 text-left transition hover:-translate-y-0.5 hover:border-app-primary/70 active:translate-y-0"
                        >
                          <div className="h-28 overflow-hidden border-b border-app-line-subtle bg-app-surface">
                            {plan.data.floorPlanDataUrl ? (
                              <img src={plan.data.floorPlanDataUrl} alt="" className="h-full w-full object-cover group-hover:scale-[1.03] transition" />
                            ) : (
                              <div className="flex h-full items-center justify-center text-xs text-app-subtle">No map</div>
                            )}
                          </div>
                          <div className="p-3">
                            <div className="truncate text-sm font-semibold">{plan.name}</div>
                            <div className="mt-1 text-xs text-app-muted">{plan.data.placements.length} pins</div>
                            <div className="mt-3 text-xs font-semibold text-app-primary">Open map</div>
                          </div>
                        </button>
                      ))
                    ) : (
                      <div className="rounded-xl border border-dashed border-app-line-mid p-8 text-center text-sm text-app-muted sm:col-span-2 xl:col-span-3">
                        No linked solutions yet.
                      </div>
                    )}
                  </div>

                  <div className="rounded-xl border border-app-line-subtle bg-app-surface-2 p-3">
                    <h4 className="mb-3 text-sm font-semibold">All saved plans</h4>
                    <div className="max-h-[520px] space-y-2 overflow-auto pr-1">
                      {savedCustomPlans.map((plan) => {
                        const checked = linkedPlanIds.has(plan.id);
                        return (
                          <label
                            key={plan.id}
                            className="flex cursor-pointer items-center gap-3 rounded-lg border border-app-line-subtle bg-app-panel-bg px-3 py-2 text-sm transition hover:border-app-line-mid"
                          >
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={(e) => {
                                const next = e.target.checked
                                  ? [...activeCustomer.solutionPlanIds, plan.id]
                                  : activeCustomer.solutionPlanIds.filter((id) => id !== plan.id);
                                updateCustomer(activeCustomer.id, { solutionPlanIds: next });
                              }}
                              className="accent-app-primary"
                            />
                            <span className="min-w-0 flex-1 truncate">{plan.name}</span>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.preventDefault();
                                openPlan(plan.id);
                              }}
                              className="text-xs font-semibold text-app-primary hover:underline"
                            >
                              Open
                            </button>
                          </label>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </section>
            ) : (
              <section className="rounded-2xl border border-app-panel-border bg-app-panel-bg p-4">
                <div className="grid gap-4 lg:grid-cols-2">
                  <label className="text-xs font-medium text-app-muted">
                    Customer name
                    <input
                      value={activeCustomer.name}
                      onChange={(e) => updateCustomer(activeCustomer.id, { name: e.target.value })}
                      className="mt-1 w-full rounded-lg border border-app-line-mid bg-app-surface px-3 py-2 text-sm text-app-text outline-none transition focus:border-app-primary"
                    />
                  </label>

                  <label className="text-xs font-medium text-app-muted">
                    Industry
                    <select
                      value={activeCustomer.industry}
                      onChange={(e) => updateCustomer(activeCustomer.id, { industry: e.target.value })}
                      className="mt-1 w-full rounded-lg border border-app-line-mid bg-app-surface px-3 py-2 text-sm text-app-text outline-none transition focus:border-app-primary"
                    >
                      {industries.map((industry) => (
                        <option key={industry} value={industry}>
                          {industry}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="text-xs font-medium text-app-muted lg:col-span-2">
                    Add industry
                    <div className="mt-1 flex gap-2">
                      <input
                        value={newIndustry}
                        onChange={(e) => setNewIndustry(e.target.value)}
                        placeholder="Type a new industry"
                        className="min-w-0 flex-1 rounded-lg border border-app-line-mid bg-app-surface px-3 py-2 text-sm text-app-text outline-none transition focus:border-app-primary"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          const industry = newIndustry.trim();
                          if (!industry) return;
                          updateCustomer(activeCustomer.id, { industry });
                          setNewIndustry("");
                        }}
                        className="rounded-lg border border-app-line-mid px-3 py-2 text-sm font-semibold text-app-text transition hover:bg-app-surface-2 active:scale-[0.98]"
                      >
                        Add
                      </button>
                    </div>
                  </label>

                  <label className="text-xs font-medium text-app-muted lg:col-span-2">
                    Contact
                    <textarea
                      value={activeCustomer.contact}
                      onChange={(e) => updateCustomer(activeCustomer.id, { contact: e.target.value })}
                      placeholder="Phone, email, WeChat, address, decision maker..."
                      rows={6}
                      className="mt-1 w-full resize-none rounded-lg border border-app-line-mid bg-app-surface px-3 py-2 text-sm text-app-text outline-none transition focus:border-app-primary"
                    />
                  </label>
                </div>

                <div className="mt-5 flex justify-end border-t border-app-line-subtle pt-4">
                  <button
                    type="button"
                    onClick={() => deleteCustomer(activeCustomer.id)}
                    className="rounded-lg border border-app-danger-text/40 px-3 py-2 text-sm font-semibold text-app-danger-text transition hover:bg-app-danger-soft active:scale-[0.98]"
                  >
                    Delete customer
                  </button>
                </div>
              </section>
            )}
          </div>
        ) : (
          <div className="flex h-full items-center justify-center">
            <div className="rounded-2xl border border-dashed border-app-line-mid bg-app-panel-bg px-10 py-12 text-center">
              <h2 className="text-xl font-semibold">No customers yet</h2>
              <p className="mt-2 text-sm text-app-muted">Create a customer, then link saved map solutions.</p>
              <button type="button" onClick={createCustomer} className="ui-primaryBtn mt-5 px-4 py-2 text-sm">
                New customer
              </button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
