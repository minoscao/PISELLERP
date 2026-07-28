import { useMemo, useState } from "react";
import { PISELL_USERS, canReadPlanAccess, getCurrentPisellUser } from "../config/auth";
import { compressImageFileToJpegDataUrl } from "../utils/compressImageFile";
import { PhotoUploadModal } from "./PhotoUploadModal";
import { useQuoteStore } from "../store/quoteStore";
import type { CrmCustomer } from "../types";

const BASE_INDUSTRIES = ["餐饮", "美业", "游乐场", "教育", "酒店", "其他"];

const CUSTOMER_TYPES: Array<[NonNullable<CrmCustomer["customerType"]>, string]> = [
  ["lead", "Lead"],
  ["prospect", "Prospect"],
  ["customer", "Customer"],
  ["partner", "Partner"],
  ["inactive", "Inactive"],
];

const STAGES: Array<[NonNullable<CrmCustomer["stage"]>, string]> = [
  ["new", "New"],
  ["contacted", "Contacted"],
  ["qualified", "Qualified"],
  ["proposal", "Proposal"],
  ["negotiation", "Negotiation"],
  ["won", "Won"],
  ["lost", "Lost"],
];

const PRIORITIES: Array<[NonNullable<CrmCustomer["priority"]>, string]> = [
  ["low", "Low"],
  ["medium", "Medium"],
  ["high", "High"],
  ["urgent", "Urgent"],
];

type CustomerPatch = Partial<Omit<CrmCustomer, "id" | "createdAt" | "updatedAt">>;

function formatDate(value: number) {
  return new Date(value).toLocaleDateString();
}

function Field({
  label,
  children,
  wide,
}: {
  label: string;
  children: React.ReactNode;
  wide?: boolean;
}) {
  return (
    <label className={`text-xs font-medium text-app-muted ${wide ? "lg:col-span-2" : ""}`}>
      {label}
      {children}
    </label>
  );
}

function TextInput({
  value,
  onChange,
  placeholder,
  type = "text",
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  type?: string;
}) {
  return (
    <input
      type={type}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className="mt-1 w-full rounded-lg border border-app-line-mid bg-app-surface px-3 py-2 text-sm text-app-text outline-none transition focus:border-app-primary"
    />
  );
}

function TextArea({
  value,
  onChange,
  placeholder,
  rows = 4,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  rows?: number;
}) {
  return (
    <textarea
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      rows={rows}
      className="mt-1 w-full resize-none rounded-lg border border-app-line-mid bg-app-surface px-3 py-2 text-sm text-app-text outline-none transition focus:border-app-primary"
    />
  );
}

function SelectInput<T extends string>({
  value,
  onChange,
  options,
}: {
  value: T;
  onChange: (value: T) => void;
  options: Array<[T, string]>;
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value as T)}
      className="mt-1 w-full rounded-lg border border-app-line-mid bg-app-surface px-3 py-2 text-sm text-app-text outline-none transition focus:border-app-primary"
    >
      {options.map(([id, label]) => (
        <option key={id} value={id}>
          {label}
        </option>
      ))}
    </select>
  );
}

function profileStatus(customer: CrmCustomer) {
  const missing = [
    customer.primaryContactName,
    customer.phone || customer.email || customer.wechat,
    customer.stage,
    customer.nextFollowUpAt,
    customer.requirements,
  ].filter((x) => !x).length;
  if (missing <= 1) return { label: "Complete", className: "border-app-success-text/35 text-app-success-text" };
  if (missing <= 3) return { label: "Needs info", className: "border-app-warning-text/35 text-app-warning-text" };
  return { label: "Incomplete", className: "border-app-danger-text/35 text-app-danger-text" };
}

export function CrmPanel() {
  const customers = useQuoteStore((s) => s.crmCustomers);
  const activeCustomerId = useQuoteStore((s) => s.activeCrmCustomerId);
  const savedCustomPlans = useQuoteStore((s) => s.savedCustomPlans);
  const addCustomer = useQuoteStore((s) => s.addCrmCustomer);
  const updateCustomer = useQuoteStore((s) => s.updateCrmCustomer);
  const deleteCustomer = useQuoteStore((s) => s.deleteCrmCustomer);
  const setActiveCustomerId = useQuoteStore((s) => s.setActiveCrmCustomerId);
  const createCustomPlan = useQuoteStore((s) => s.createCustomPlan);
  const updateCustomPlanAccess = useQuoteStore((s) => s.updateCustomPlanAccess);
  const loadCustomPlan = useQuoteStore((s) => s.loadCustomPlan);
  const setActiveTab = useQuoteStore((s) => s.setActiveTab);
  const currentUser = getCurrentPisellUser();

  const [detailTab, setDetailTab] = useState<"solution" | "info">("solution");
  const [search, setSearch] = useState("");
  const [newIndustry, setNewIndustry] = useState("");
  const [logoModalOpen, setLogoModalOpen] = useState(false);
  const [logoBusy, setLogoBusy] = useState(false);

  const visibleCustomers = useMemo(
    () => customers.filter((c) => canReadPlanAccess(c, currentUser.id)),
    [currentUser.id, customers],
  );

  const activeCustomer = visibleCustomers.find((c) => c.id === activeCustomerId) ?? visibleCustomers[0] ?? null;

  const industries = useMemo(() => {
    const fromCustomers = customers.map((c) => c.industry).filter(Boolean);
    return [...new Set([...BASE_INDUSTRIES, ...fromCustomers, newIndustry.trim()].filter(Boolean))];
  }, [customers, newIndustry]);

  const filteredCustomers = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return visibleCustomers;
    return visibleCustomers.filter((c) =>
      [
        c.name,
        c.companyLegalName,
        c.industry,
        c.primaryContactName,
        c.phone,
        c.email,
        c.wechat,
        c.city,
        c.owner,
        ...(c.tags ?? []),
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(q),
    );
  }, [visibleCustomers, search]);

  const linkedPlanIds = new Set(activeCustomer?.solutionPlanIds ?? []);
  const linkedPlans = savedCustomPlans.filter((p) => linkedPlanIds.has(p.id) && canReadPlanAccess(p, currentUser.id));

  const patch = (value: CustomerPatch) => {
    if (!activeCustomer) return;
    updateCustomer(activeCustomer.id, value);
  };

  const createCustomer = () => {
    const id = addCustomer(`Customer ${customers.length + 1}`);
    setActiveCustomerId(id);
    setDetailTab("info");
  };

  const openPlan = (id: string) => {
    loadCustomPlan(id);
    setActiveTab("customPlan");
  };

  const createPlanForCustomer = () => {
    if (!activeCustomer) return;
    const planId = createCustomPlan(`${activeCustomer.name} solution ${activeCustomer.solutionPlanIds.length + 1}`);
    updateCustomPlanAccess(planId, {
      visibility: activeCustomer.visibility,
      sharedUserIds: activeCustomer.sharedUserIds,
    });
    updateCustomer(activeCustomer.id, {
      solutionPlanIds: [...new Set([...activeCustomer.solutionPlanIds, planId])],
    });
    loadCustomPlan(planId);
    setActiveTab("customPlan");
  };

  return (
    <div className="flex h-full min-h-0 bg-app-surface text-app-text">
      <aside className="flex w-[380px] shrink-0 flex-col border-r border-app-line-subtle bg-app-panel-bg">
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
            placeholder="Search customer, contact, city, tag"
            className="mt-4 w-full rounded-lg border border-app-line-mid bg-app-surface px-3 py-2 text-sm text-app-text outline-none transition focus:border-app-primary"
          />
        </div>

        <div className="min-h-0 flex-1 overflow-auto p-3">
          {filteredCustomers.length ? (
            <div className="grid gap-2">
              {filteredCustomers.map((customer) => {
                const active = activeCustomer?.id === customer.id;
                const status = profileStatus(customer);
                const stageLabel = STAGES.find(([id]) => id === customer.stage)?.[1] ?? "Not set";
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
                    <div className="flex items-start gap-3">
                      <div className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-app-line-subtle bg-app-panel-bg text-sm font-bold text-app-primary">
                        {customer.logoDataUrl ? (
                          <img src={customer.logoDataUrl} alt="" className="h-full w-full object-contain p-1" />
                        ) : (
                          customer.name.trim().slice(0, 1).toUpperCase()
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <div className="truncate text-sm font-semibold">{customer.name}</div>
                            <div className="mt-1 truncate text-xs text-app-muted">
                              {customer.industry} · {stageLabel}
                            </div>
                          </div>
                          <span className={`shrink-0 rounded-full border px-2 py-1 text-[11px] ${status.className}`}>
                            {status.label}
                          </span>
                        </div>
                        <div className="mt-3 grid grid-cols-2 gap-2 text-[11px] text-app-subtle">
                          <span className="truncate">Contact: {customer.primaryContactName || "empty"}</span>
                          <span className="truncate">Plans: {customer.solutionPlanIds.length}</span>
                          <span className="truncate">Phone: {customer.phone || customer.wechat || "empty"}</span>
                          <span className="truncate">Next: {customer.nextFollowUpAt || "not set"}</span>
                        </div>
                      </div>
                    </div>
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
          <div className="mx-auto flex max-w-[1360px] flex-col gap-4">
            <section className="rounded-2xl border border-app-panel-border bg-app-panel-bg px-5 py-4">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="min-w-0">
                  <p className="text-xs uppercase tracking-[0.18em] text-app-muted">Customer profile</p>
                  <h1 className="mt-1 truncate text-2xl font-semibold">{activeCustomer.name}</h1>
                  <p className="mt-2 text-sm text-app-muted">
                    {activeCustomer.industry} · {STAGES.find(([id]) => id === activeCustomer.stage)?.[1] ?? "Not set"} · Updated{" "}
                    {formatDate(activeCustomer.updatedAt)}
                  </p>
                </div>
                <div className="flex flex-wrap items-start justify-end gap-3">
                  <div className="flex flex-wrap items-center gap-2 rounded-xl border border-app-line-subtle bg-app-surface px-3 py-2 text-xs text-app-muted">
                    <span className="font-semibold text-app-text">Access</span>
                    <select
                      value={activeCustomer.visibility}
                      onChange={(e) => patch({ visibility: e.target.value === "private" ? "private" : "company" })}
                      className="rounded-lg border border-app-line-mid bg-app-panel-bg px-2 py-1 text-xs text-app-text outline-none transition focus:border-app-primary"
                    >
                      <option value="company">Company</option>
                      <option value="private">Private</option>
                    </select>
                    {activeCustomer.visibility === "private" ? (
                      <div className="flex flex-wrap items-center gap-2">
                        {PISELL_USERS.map((u) => (
                          <label
                            key={u.id}
                            className="inline-flex items-center gap-1 rounded-lg border border-app-line-subtle px-2 py-1"
                          >
                            <input
                              type="checkbox"
                              checked={activeCustomer.sharedUserIds.includes(u.id)}
                              onChange={(e) => {
                                const next = e.target.checked
                                  ? [...activeCustomer.sharedUserIds, u.id]
                                  : activeCustomer.sharedUserIds.filter((id) => id !== u.id);
                                patch({ sharedUserIds: next });
                              }}
                              className="accent-app-primary"
                            />
                            {u.name}
                          </label>
                        ))}
                      </div>
                    ) : null}
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
              </div>
            </section>

            {detailTab === "solution" ? (
              <section className="rounded-2xl border border-app-panel-border bg-app-panel-bg p-4">
                <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h3 className="text-base font-semibold">Customer solutions</h3>
                    <p className="mt-1 text-xs text-app-muted">
                      Only plans linked to this customer are shown here. Create a new plan from this customer when starting work.
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-xs text-app-muted">{linkedPlans.length} linked</span>
                    <button type="button" onClick={createPlanForCustomer} className="ui-primaryBtn px-3 py-2 text-sm">
                      Create plan for this customer
                    </button>
                  </div>
                </div>

                {linkedPlans.length ? (
                  <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                    {linkedPlans.map((plan) => (
                      <button
                        key={plan.id}
                        type="button"
                        onClick={() => openPlan(plan.id)}
                        className="group overflow-hidden rounded-xl border border-app-line-subtle bg-app-surface-2 text-left transition hover:-translate-y-0.5 hover:border-app-primary/70 active:translate-y-0"
                      >
                        <div className="h-28 overflow-hidden border-b border-app-line-subtle bg-app-surface">
                          {plan.data.floorPlanDataUrl ? (
                            <img
                              src={plan.data.floorPlanDataUrl}
                              alt=""
                              className="h-full w-full object-cover transition group-hover:scale-[1.03]"
                            />
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
                    ))}
                  </div>
                ) : (
                  <div className="flex min-h-[260px] flex-col items-center justify-center rounded-xl border border-dashed border-app-line-mid bg-app-surface-2 p-8 text-center">
                    <h4 className="text-base font-semibold text-app-text">No plan belongs to this customer yet.</h4>
                    <p className="mt-2 max-w-[460px] text-sm leading-6 text-app-muted">
                      Start from the customer so the new map plan is automatically linked back to this CRM record.
                    </p>
                    <button type="button" onClick={createPlanForCustomer} className="ui-primaryBtn mt-5 px-4 py-2 text-sm">
                      Create plan for this customer
                    </button>
                  </div>
                )}
              </section>
            ) : (
              <section className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
                <div className="grid gap-4">
                  <div className="rounded-2xl border border-app-panel-border bg-app-panel-bg p-4">
                    <h3 className="mb-4 text-base font-semibold">Basic information</h3>
                    <div className="mb-4 flex flex-wrap items-center gap-4 rounded-xl border border-app-line-subtle bg-app-surface-2 p-3">
                      <div className="flex h-16 w-16 items-center justify-center overflow-hidden rounded-2xl border border-app-line-mid bg-app-panel-bg text-xl font-bold text-app-primary">
                        {activeCustomer.logoDataUrl ? (
                          <img src={activeCustomer.logoDataUrl} alt="" className="h-full w-full object-contain p-2" />
                        ) : (
                          activeCustomer.name.trim().slice(0, 1).toUpperCase()
                        )}
                      </div>
                      <div className="min-w-[220px] flex-1">
                        <div className="text-sm font-semibold text-app-text">Customer logo</div>
                        <p className="mt-1 text-xs text-app-muted">Upload or paste with Ctrl+V in the dialog.</p>
                      </div>
                      <PhotoUploadModal
                        open={logoModalOpen}
                        onClose={() => setLogoModalOpen(false)}
                        title="Upload customer logo"
                        description="Choose an image, or paste a copied image with Ctrl+V."
                        accept="image/jpeg,image/png,image/webp"
                        showAiOption={false}
                        busy={logoBusy}
                        onConfirmFiles={async (files) => {
                          const f = files[0];
                          if (!f) return;
                          setLogoBusy(true);
                          try {
                            const url = await compressImageFileToJpegDataUrl(f, { maxEdge: 900, quality: 0.88 });
                            patch({ logoDataUrl: url });
                            setLogoModalOpen(false);
                          } finally {
                            setLogoBusy(false);
                          }
                        }}
                      />
                      <button
                        type="button"
                        disabled={logoBusy}
                        onClick={() => setLogoModalOpen(true)}
                        className="rounded-lg border border-app-line-mid px-3 py-2 text-sm font-semibold text-app-text transition hover:bg-app-surface-2 disabled:opacity-50 active:scale-[0.98]"
                      >
                        {logoBusy ? "Saving..." : "Upload / paste logo"}
                      </button>
                      {activeCustomer.logoDataUrl ? (
                        <button
                          type="button"
                          onClick={() => patch({ logoDataUrl: null })}
                          className="rounded-lg border border-app-danger-text/40 px-3 py-2 text-sm font-semibold text-app-danger-text transition hover:bg-app-danger-soft active:scale-[0.98]"
                        >
                          Remove
                        </button>
                      ) : null}
                    </div>
                    <div className="grid gap-4 lg:grid-cols-2">
                      <Field label="Customer name">
                        <TextInput value={activeCustomer.name} onChange={(name) => patch({ name })} />
                      </Field>
                      <Field label="Legal company name">
                        <TextInput
                          value={activeCustomer.companyLegalName ?? ""}
                          onChange={(companyLegalName) => patch({ companyLegalName })}
                          placeholder="For contract or invoice"
                        />
                      </Field>
                      <Field label="Industry">
                        <select
                          value={activeCustomer.industry}
                          onChange={(e) => patch({ industry: e.target.value })}
                          className="mt-1 w-full rounded-lg border border-app-line-mid bg-app-surface px-3 py-2 text-sm text-app-text outline-none transition focus:border-app-primary"
                        >
                          {industries.map((industry) => (
                            <option key={industry} value={industry}>
                              {industry}
                            </option>
                          ))}
                        </select>
                      </Field>
                      <Field label="Customer type">
                        <SelectInput
                          value={activeCustomer.customerType ?? "customer"}
                          onChange={(customerType) => patch({ customerType })}
                          options={CUSTOMER_TYPES}
                        />
                      </Field>
                      <Field label="Add industry" wide>
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
                              patch({ industry });
                              setNewIndustry("");
                            }}
                            className="rounded-lg border border-app-line-mid px-3 py-2 text-sm font-semibold text-app-text transition hover:bg-app-surface-2 active:scale-[0.98]"
                          >
                            Add
                          </button>
                        </div>
                      </Field>
                    </div>
                  </div>

                  <div className="rounded-2xl border border-app-panel-border bg-app-panel-bg p-4">
                    <h3 className="mb-4 text-base font-semibold">Primary contact</h3>
                    <div className="grid gap-4 lg:grid-cols-2">
                      <Field label="Contact name">
                        <TextInput
                          value={activeCustomer.primaryContactName ?? ""}
                          onChange={(primaryContactName) => patch({ primaryContactName })}
                        />
                      </Field>
                      <Field label="Title">
                        <TextInput
                          value={activeCustomer.primaryContactTitle ?? ""}
                          onChange={(primaryContactTitle) => patch({ primaryContactTitle })}
                          placeholder="Owner, manager, project lead..."
                        />
                      </Field>
                      <Field label="Phone">
                        <TextInput value={activeCustomer.phone ?? ""} onChange={(phone) => patch({ phone })} />
                      </Field>
                      <Field label="Email">
                        <TextInput
                          type="email"
                          value={activeCustomer.email ?? ""}
                          onChange={(email) => patch({ email })}
                        />
                      </Field>
                      <Field label="WeChat / WhatsApp">
                        <TextInput value={activeCustomer.wechat ?? ""} onChange={(wechat) => patch({ wechat })} />
                      </Field>
                      <Field label="Website / social">
                        <TextInput value={activeCustomer.website ?? ""} onChange={(website) => patch({ website })} />
                      </Field>
                    </div>
                  </div>

                  <div className="rounded-2xl border border-app-panel-border bg-app-panel-bg p-4">
                    <h3 className="mb-4 text-base font-semibold">Location & scale</h3>
                    <div className="grid gap-4 lg:grid-cols-2">
                      <Field label="Country">
                        <TextInput value={activeCustomer.country ?? ""} onChange={(country) => patch({ country })} />
                      </Field>
                      <Field label="State / province">
                        <TextInput value={activeCustomer.state ?? ""} onChange={(state) => patch({ state })} />
                      </Field>
                      <Field label="City">
                        <TextInput value={activeCustomer.city ?? ""} onChange={(city) => patch({ city })} />
                      </Field>
                      <Field label="Size">
                        <TextInput
                          value={activeCustomer.companySize ?? ""}
                          onChange={(companySize) => patch({ companySize })}
                          placeholder="Stores, area, staff..."
                        />
                      </Field>
                      <Field label="Address" wide>
                        <TextArea value={activeCustomer.address ?? ""} onChange={(address) => patch({ address })} rows={3} />
                      </Field>
                    </div>
                  </div>

                  <div className="rounded-2xl border border-app-panel-border bg-app-panel-bg p-4">
                    <h3 className="mb-4 text-base font-semibold">Requirements & notes</h3>
                    <div className="grid gap-4">
                      <Field label="Requirements / scenario" wide>
                        <TextArea
                          value={activeCustomer.requirements ?? ""}
                          onChange={(requirements) => patch({ requirements })}
                          placeholder="Multi-floor map, kiosks, vending, screens, quote preferences, site limits..."
                          rows={5}
                        />
                      </Field>
                      <Field label="Internal notes" wide>
                        <TextArea
                          value={activeCustomer.notes ?? activeCustomer.contact ?? ""}
                          onChange={(notes) => patch({ notes, contact: notes })}
                          placeholder="Conversation notes, risks, payment preference, next questions..."
                          rows={5}
                        />
                      </Field>
                    </div>
                  </div>
                </div>

                <aside className="grid content-start gap-4">
                  <div className="rounded-2xl border border-app-panel-border bg-app-panel-bg p-4">
                    <h3 className="mb-4 text-base font-semibold">Sales status</h3>
                    <div className="grid gap-4">
                      <Field label="Stage">
                        <SelectInput
                          value={activeCustomer.stage ?? "qualified"}
                          onChange={(stage) => patch({ stage })}
                          options={STAGES}
                        />
                      </Field>
                      <Field label="Priority">
                        <SelectInput
                          value={activeCustomer.priority ?? "medium"}
                          onChange={(priority) => patch({ priority })}
                          options={PRIORITIES}
                        />
                      </Field>
                      <Field label="Owner">
                        <TextInput value={activeCustomer.owner ?? ""} onChange={(owner) => patch({ owner })} />
                      </Field>
                      <Field label="Source">
                        <TextInput
                          value={activeCustomer.source ?? ""}
                          onChange={(source) => patch({ source })}
                          placeholder="Referral, event, website, repeat customer..."
                        />
                      </Field>
                      <Field label="Estimated value">
                        <TextInput
                          value={activeCustomer.annualValue ?? ""}
                          onChange={(annualValue) => patch({ annualValue })}
                          placeholder="Project value / yearly value"
                        />
                      </Field>
                      <Field label="Budget">
                        <TextInput value={activeCustomer.budget ?? ""} onChange={(budget) => patch({ budget })} />
                      </Field>
                      <Field label="Expected close">
                        <TextInput
                          type="date"
                          value={activeCustomer.expectedCloseDate ?? ""}
                          onChange={(expectedCloseDate) => patch({ expectedCloseDate })}
                        />
                      </Field>
                      <Field label="Next follow-up">
                        <TextInput
                          type="date"
                          value={activeCustomer.nextFollowUpAt ?? ""}
                          onChange={(nextFollowUpAt) => patch({ nextFollowUpAt })}
                        />
                      </Field>
                    </div>
                  </div>

                  <div className="rounded-2xl border border-app-panel-border bg-app-panel-bg p-4">
                    <h3 className="mb-4 text-base font-semibold">Tags</h3>
                    <TextInput
                      value={(activeCustomer.tags ?? []).join(", ")}
                      onChange={(value) =>
                        patch({
                          tags: value
                            .split(",")
                            .map((x) => x.trim())
                            .filter(Boolean),
                        })
                      }
                      placeholder="key account, multi-site, needs visit"
                    />
                    <div className="mt-3 flex flex-wrap gap-2">
                      {(activeCustomer.tags ?? []).map((tag) => (
                        <span key={tag} className="rounded-full border border-app-line-subtle px-2 py-1 text-xs text-app-muted">
                          {tag}
                        </span>
                      ))}
                    </div>
                  </div>

                  <div className="rounded-2xl border border-app-panel-border bg-app-panel-bg p-4">
                    <h3 className="mb-3 text-base font-semibold">Profile status</h3>
                    <div className={`inline-flex rounded-full border px-3 py-1 text-sm ${profileStatus(activeCustomer).className}`}>
                      {profileStatus(activeCustomer).label}
                    </div>
                    <p className="mt-3 text-xs leading-5 text-app-muted">
                      Complete contact, follow-up, stage, and requirements so this customer can support future reminders and sales reporting.
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() => deleteCustomer(activeCustomer.id)}
                    className="rounded-xl border border-app-danger-text/40 bg-app-panel-bg px-3 py-3 text-sm font-semibold text-app-danger-text transition hover:bg-app-danger-soft active:scale-[0.98]"
                  >
                    Delete customer
                  </button>
                </aside>
              </section>
            )}
          </div>
        ) : (
          <div className="flex h-full items-center justify-center">
            <div className="rounded-2xl border border-dashed border-app-line-mid bg-app-panel-bg px-10 py-12 text-center">
              <h2 className="text-xl font-semibold">No customers yet</h2>
              <p className="mt-2 text-sm text-app-muted">Create a customer first, then create map plans from that customer.</p>
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
