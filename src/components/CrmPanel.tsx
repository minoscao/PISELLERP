import { useMemo, useState } from "react";
import { useQuoteStore } from "../store/quoteStore";
import type { CrmCustomer } from "../types";

const BASE_INDUSTRIES = ["餐饮", "美业", "游乐场", "教育", "酒店", "其他"];
const CUSTOMER_TYPES: Array<[NonNullable<CrmCustomer["customerType"]>, string]> = [
  ["lead", "线索"],
  ["prospect", "潜在客户"],
  ["customer", "正式客户"],
  ["partner", "合作伙伴"],
  ["inactive", "暂停合作"],
];
const STAGES: Array<[NonNullable<CrmCustomer["stage"]>, string]> = [
  ["new", "新建"],
  ["contacted", "已联系"],
  ["qualified", "已确认需求"],
  ["proposal", "方案/报价中"],
  ["negotiation", "谈判中"],
  ["won", "已成交"],
  ["lost", "已流失"],
];
const PRIORITIES: Array<[NonNullable<CrmCustomer["priority"]>, string]> = [
  ["low", "低"],
  ["medium", "中"],
  ["high", "高"],
  ["urgent", "紧急"],
];

type FieldProps = {
  label: string;
  children: React.ReactNode;
  wide?: boolean;
};

function Field({ label, children, wide }: FieldProps) {
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

function formatTime(value: number) {
  return new Date(value).toLocaleDateString();
}

function customerHealth(customer: CrmCustomer) {
  const missing = [
    customer.primaryContactName,
    customer.phone || customer.email || customer.wechat,
    customer.stage,
    customer.nextFollowUpAt,
    customer.requirements,
  ].filter((x) => !x).length;
  if (missing <= 1) return { label: "资料完整", tone: "text-app-success-text", border: "border-app-success-text/35" };
  if (missing <= 3) return { label: "待补充", tone: "text-app-warning-text", border: "border-app-warning-text/35" };
  return { label: "资料不足", tone: "text-app-danger-text", border: "border-app-danger-text/35" };
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
    return customers.filter((c) => {
      const haystack = [
        c.name,
        c.companyLegalName,
        c.industry,
        c.primaryContactName,
        c.phone,
        c.email,
        c.wechat,
        c.city,
        c.stage,
        c.owner,
        ...(c.tags ?? []),
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return haystack.includes(q);
    });
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

  const patch = (value: Partial<Omit<CrmCustomer, "id" | "createdAt" | "updatedAt">>) => {
    if (!activeCustomer) return;
    updateCustomer(activeCustomer.id, value);
  };

  return (
    <div className="flex h-full min-h-0 bg-app-surface text-app-text">
      <aside className="flex w-[380px] shrink-0 flex-col border-r border-app-line-subtle bg-app-panel-bg">
        <div className="border-b border-app-line-subtle px-4 py-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-xs font-medium uppercase tracking-[0.18em] text-app-muted">CRM</p>
              <h2 className="mt-1 text-xl font-semibold">客户</h2>
            </div>
            <button type="button" onClick={createCustomer} className="ui-primaryBtn px-3 py-2 text-sm">
              新客户
            </button>
          </div>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="搜索客户 / 联系人 / 城市 / 标签"
            className="mt-4 w-full rounded-lg border border-app-line-mid bg-app-surface px-3 py-2 text-sm text-app-text outline-none transition focus:border-app-primary"
          />
        </div>

        <div className="min-h-0 flex-1 overflow-auto p-3">
          {filteredCustomers.length ? (
            <div className="grid gap-2">
              {filteredCustomers.map((customer) => {
                const active = activeCustomer?.id === customer.id;
                const health = customerHealth(customer);
                const stageLabel = STAGES.find(([id]) => id === customer.stage)?.[1] ?? "未设置";
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
                        <div className="mt-1 truncate text-xs text-app-muted">
                          {customer.industry} · {stageLabel}
                        </div>
                      </div>
                      <span className={`rounded-full border px-2 py-1 text-[11px] ${health.border} ${health.tone}`}>
                        {health.label}
                      </span>
                    </div>
                    <div className="mt-3 grid grid-cols-2 gap-2 text-[11px] text-app-subtle">
                      <span className="truncate">联系人：{customer.primaryContactName || "未填"}</span>
                      <span className="truncate">方案：{customer.solutionPlanIds.length}</span>
                      <span className="truncate">电话：{customer.phone || customer.wechat || "未填"}</span>
                      <span className="truncate">下次跟进：{customer.nextFollowUpAt || "未定"}</span>
                    </div>
                  </button>
                );
              })}
            </div>
          ) : (
            <div className="rounded-xl border border-dashed border-app-line-mid px-4 py-10 text-center text-sm text-app-muted">
              没有找到客户
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
                    {activeCustomer.industry} · {STAGES.find(([id]) => id === activeCustomer.stage)?.[1] ?? "未设置"} · 更新{" "}
                    {formatTime(activeCustomer.updatedAt)}
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
                    <h3 className="text-base font-semibold">关联方案</h3>
                    <p className="mt-1 text-xs text-app-muted">把客户和已经保存的地图方案绑定，打开后进入原地图编辑。</p>
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
                            <div className="mt-3 text-xs font-semibold text-app-primary">打开地图</div>
                          </div>
                        </button>
                      ))
                    ) : (
                      <div className="rounded-xl border border-dashed border-app-line-mid p-8 text-center text-sm text-app-muted sm:col-span-2 xl:col-span-3">
                        还没有关联方案
                      </div>
                    )}
                  </div>

                  <div className="rounded-xl border border-app-line-subtle bg-app-surface-2 p-3">
                    <h4 className="mb-3 text-sm font-semibold">全部已保存方案</h4>
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
                                patch({ solutionPlanIds: next });
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
                              打开
                            </button>
                          </label>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </section>
            ) : (
              <section className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
                <div className="grid gap-4">
                  <div className="rounded-2xl border border-app-panel-border bg-app-panel-bg p-4">
                    <h3 className="mb-4 text-base font-semibold">基础信息</h3>
                    <div className="grid gap-4 lg:grid-cols-2">
                      <Field label="客户显示名">
                        <TextInput value={activeCustomer.name} onChange={(name) => patch({ name })} />
                      </Field>
                      <Field label="公司法定名称">
                        <TextInput
                          value={activeCustomer.companyLegalName ?? ""}
                          onChange={(companyLegalName) => patch({ companyLegalName })}
                          placeholder="可选，合同/发票名称"
                        />
                      </Field>
                      <Field label="行业">
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
                      <Field label="客户类型">
                        <SelectInput
                          value={activeCustomer.customerType ?? "customer"}
                          onChange={(customerType) => patch({ customerType })}
                          options={CUSTOMER_TYPES}
                        />
                      </Field>
                      <Field label="新增行业" wide>
                        <div className="mt-1 flex gap-2">
                          <input
                            value={newIndustry}
                            onChange={(e) => setNewIndustry(e.target.value)}
                            placeholder="输入新的行业分类"
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
                            添加
                          </button>
                        </div>
                      </Field>
                    </div>
                  </div>

                  <div className="rounded-2xl border border-app-panel-border bg-app-panel-bg p-4">
                    <h3 className="mb-4 text-base font-semibold">联系人</h3>
                    <div className="grid gap-4 lg:grid-cols-2">
                      <Field label="主联系人">
                        <TextInput
                          value={activeCustomer.primaryContactName ?? ""}
                          onChange={(primaryContactName) => patch({ primaryContactName })}
                        />
                      </Field>
                      <Field label="职位">
                        <TextInput
                          value={activeCustomer.primaryContactTitle ?? ""}
                          onChange={(primaryContactTitle) => patch({ primaryContactTitle })}
                          placeholder="老板 / 店长 / 项目负责人"
                        />
                      </Field>
                      <Field label="电话">
                        <TextInput value={activeCustomer.phone ?? ""} onChange={(phone) => patch({ phone })} />
                      </Field>
                      <Field label="Email">
                        <TextInput
                          type="email"
                          value={activeCustomer.email ?? ""}
                          onChange={(email) => patch({ email })}
                        />
                      </Field>
                      <Field label="微信 / WhatsApp">
                        <TextInput value={activeCustomer.wechat ?? ""} onChange={(wechat) => patch({ wechat })} />
                      </Field>
                      <Field label="官网 / 社媒">
                        <TextInput value={activeCustomer.website ?? ""} onChange={(website) => patch({ website })} />
                      </Field>
                    </div>
                  </div>

                  <div className="rounded-2xl border border-app-panel-border bg-app-panel-bg p-4">
                    <h3 className="mb-4 text-base font-semibold">地址与规模</h3>
                    <div className="grid gap-4 lg:grid-cols-2">
                      <Field label="国家">
                        <TextInput value={activeCustomer.country ?? ""} onChange={(country) => patch({ country })} />
                      </Field>
                      <Field label="州 / 省">
                        <TextInput value={activeCustomer.state ?? ""} onChange={(state) => patch({ state })} />
                      </Field>
                      <Field label="城市">
                        <TextInput value={activeCustomer.city ?? ""} onChange={(city) => patch({ city })} />
                      </Field>
                      <Field label="规模">
                        <TextInput
                          value={activeCustomer.companySize ?? ""}
                          onChange={(companySize) => patch({ companySize })}
                          placeholder="门店数 / 面积 / 员工数"
                        />
                      </Field>
                      <Field label="详细地址" wide>
                        <TextArea value={activeCustomer.address ?? ""} onChange={(address) => patch({ address })} rows={3} />
                      </Field>
                    </div>
                  </div>

                  <div className="rounded-2xl border border-app-panel-border bg-app-panel-bg p-4">
                    <h3 className="mb-4 text-base font-semibold">需求与备注</h3>
                    <div className="grid gap-4">
                      <Field label="客户需求 / 场景" wide>
                        <TextArea
                          value={activeCustomer.requirements ?? ""}
                          onChange={(requirements) => patch({ requirements })}
                          placeholder="例如：多楼层地图、售货机、游戏机、广告屏、报价偏好、现场限制..."
                          rows={5}
                        />
                      </Field>
                      <Field label="内部备注" wide>
                        <TextArea
                          value={activeCustomer.notes ?? activeCustomer.contact ?? ""}
                          onChange={(notes) => patch({ notes, contact: notes })}
                          placeholder="沟通记录、风险点、付款偏好、下次要问的问题..."
                          rows={5}
                        />
                      </Field>
                    </div>
                  </div>
                </div>

                <aside className="grid content-start gap-4">
                  <div className="rounded-2xl border border-app-panel-border bg-app-panel-bg p-4">
                    <h3 className="mb-4 text-base font-semibold">销售状态</h3>
                    <div className="grid gap-4">
                      <Field label="阶段">
                        <SelectInput
                          value={activeCustomer.stage ?? "qualified"}
                          onChange={(stage) => patch({ stage })}
                          options={STAGES}
                        />
                      </Field>
                      <Field label="优先级">
                        <SelectInput
                          value={activeCustomer.priority ?? "medium"}
                          onChange={(priority) => patch({ priority })}
                          options={PRIORITIES}
                        />
                      </Field>
                      <Field label="负责人">
                        <TextInput value={activeCustomer.owner ?? ""} onChange={(owner) => patch({ owner })} />
                      </Field>
                      <Field label="来源">
                        <TextInput
                          value={activeCustomer.source ?? ""}
                          onChange={(source) => patch({ source })}
                          placeholder="朋友介绍 / 展会 / 官网 / 老客户"
                        />
                      </Field>
                      <Field label="预计价值">
                        <TextInput
                          value={activeCustomer.annualValue ?? ""}
                          onChange={(annualValue) => patch({ annualValue })}
                          placeholder="$ / 年度 / 项目金额"
                        />
                      </Field>
                      <Field label="预算">
                        <TextInput value={activeCustomer.budget ?? ""} onChange={(budget) => patch({ budget })} />
                      </Field>
                      <Field label="预计成交日期">
                        <TextInput
                          type="date"
                          value={activeCustomer.expectedCloseDate ?? ""}
                          onChange={(expectedCloseDate) => patch({ expectedCloseDate })}
                        />
                      </Field>
                      <Field label="下次跟进">
                        <TextInput
                          type="date"
                          value={activeCustomer.nextFollowUpAt ?? ""}
                          onChange={(nextFollowUpAt) => patch({ nextFollowUpAt })}
                        />
                      </Field>
                    </div>
                  </div>

                  <div className="rounded-2xl border border-app-panel-border bg-app-panel-bg p-4">
                    <h3 className="mb-4 text-base font-semibold">标签</h3>
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
                      placeholder="重点客户, 多门店, 需现场勘察"
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
                    <h3 className="mb-3 text-base font-semibold">资料完整度</h3>
                    <div className={`inline-flex rounded-full border px-3 py-1 text-sm ${customerHealth(activeCustomer).border} ${customerHealth(activeCustomer).tone}`}>
                      {customerHealth(activeCustomer).label}
                    </div>
                    <p className="mt-3 text-xs leading-5 text-app-muted">
                      建议补齐主联系人、联系方式、销售阶段、下次跟进和客户需求，后续才能做跟进提醒和报价转化统计。
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() => deleteCustomer(activeCustomer.id)}
                    className="rounded-xl border border-app-danger-text/40 bg-app-panel-bg px-3 py-3 text-sm font-semibold text-app-danger-text transition hover:bg-app-danger-soft active:scale-[0.98]"
                  >
                    删除客户
                  </button>
                </aside>
              </section>
            )}
          </div>
        ) : (
          <div className="flex h-full items-center justify-center">
            <div className="rounded-2xl border border-dashed border-app-line-mid bg-app-panel-bg px-10 py-12 text-center">
              <h2 className="text-xl font-semibold">还没有客户</h2>
              <p className="mt-2 text-sm text-app-muted">先建立客户，再关联地图方案。</p>
              <button type="button" onClick={createCustomer} className="ui-primaryBtn mt-5 px-4 py-2 text-sm">
                新客户
              </button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
