import type { MapThemeMode } from "./icons/mapColors";

/** 素材分类：中文名为存储主键；英文名仅展示 */
export type MaterialCategoryDef = {
  name: string;
  nameEn?: string;
  iconKey: string;
  /** 硬件库选此分类时沿用的地图描边色（#RRGGBB） */
  defaultMapColor?: string;
};

/** 素材用途：每设备每类最多关联 1 张；softwareDoc 为软件功能资料（仅软件库 / 方案叠图） */
export type MaterialImageKind = "product" | "quoteAd" | "technical" | "softwareDoc";

export type MaterialPage = {
  id: string;
  /** data URL (image) for preview & export */
  dataUrl: string;
  widthPx: number;
  heightPx: number;
  fileName: string;
  /** 0-based page index within original file */
  sourcePage: number;
  category: string;
  imageKind: MaterialImageKind;
  /** 导入时间（ms）；旧数据可能为 0 或未设置 */
  createdAt?: number;
};

/** 方案页预览区：缩放、旋转、叠图上的标注（每页独立） */
export type PlanTextAnnotation = {
  id: string;
  type: "text";
  xPct: number;
  yPct: number;
  text: string;
  fontFamily?: string;
  fontSizePx?: number;
  color?: string;
  /** 0–100，文字色不透明度 */
  colorOpacityPct?: number;
  backgroundColor?: string;
  /** 0–100，100 为实色；0 为全透明 */
  backgroundOpacityPct?: number;
  borderColor?: string;
  borderOpacityPct?: number;
  borderWidthPx?: number;
};

export type PlanRectAnnotation = {
  id: string;
  type: "rect";
  xPct: number;
  yPct: number;
  wPct: number;
  hPct: number;
  strokeColor?: string;
  strokeOpacityPct?: number;
  strokeWidthPx?: number;
  fillColor?: string;
  fillOpacityPct?: number;
};

export type PlanPreviewAnnotation = PlanTextAnnotation | PlanRectAnnotation;

export type PlanPreviewExtraState = {
  scale: number;
  rotationDeg: number;
  annotations: PlanPreviewAnnotation[];
};

/**
 * 方案书模板：只描述「页序 + 每页底图如何从当前选型/素材库重新解析」与叠图裁切比例。
 * 不持久化标注、不持久化 previewExtra（画布上的临时涂抹视为一次性）。
 */
export type PlanTemplateBackgroundRule =
  | { kind: "brand"; index: number }
  | { kind: "hardwareTechnical"; index: number }
  | { kind: "softwareDoc"; index: number }
  /** 固定绑定某一素材 id（如本地上传），选型变化后仍指向该 id */
  | { kind: "material"; materialId: string }
  | { kind: "unknown" };

export type PlanTemplatePageEntry = {
  background: PlanTemplateBackgroundRule;
  overlayAspect: string | null;
};

export type SavedPlanTemplate = {
  id: string;
  name: string;
  createdAt: number;
  pages: PlanTemplatePageEntry[];
};

/** 企业资源库顶层：市场素材 vs 报价模板搭建器 */
export type EnterpriseResourceMainTab = "mediaLibrary" | "templateBuilder";

/** 企业资源库 · 素材库：品牌市场资料 vs 产品类资料 */
export type MaterialsLibraryTab = "brand" | "product";

/** 版式模板用途（列表分组、后续可接不同 PDF 流程） */
export type QuoteTemplateDocumentRole = "quote" | "invoice" | "other";

/** 无代码报价模板 · 模块类型 */
export type QuoteTemplateBlockKind =
  | "co.logo"
  | "co.name"
  | "co.tagline"
  | "co.contact"
  | "q.title"
  | "q.table"
  | "q.totals"
  | "c.text"
  | "c.image"
  | "c.spacer"
  | "c.rule";

export type QuoteTemplateBlockStyle = {
  color?: string;
  fontSizePx?: number;
  fontWeight?: "400" | "600" | "700";
  textAlign?: "left" | "center" | "right";
  /**
   * co.logo / c.image：按版心宽度比例缩放（0.05–1），高度随比例保持，不拉伸变形。
   * 默认 c.image 为 1（整宽），co.logo 约 0.24。
   */
  imageWidthFrac?: number;
  /** 可选：图片最大高度（mm），超出则按比例缩小宽度 */
  imageMaxHeightMm?: number;
};

export type QuoteTemplateTableColumn = "model" | "qty" | "price" | "notes";

export type QuoteTemplateBlock = {
  id: string;
  kind: QuoteTemplateBlockKind;
  style?: QuoteTemplateBlockStyle;
  /** q.table */
  tableShowGst?: boolean;
  tableColumns?: QuoteTemplateTableColumn[];
  /** c.text */
  text?: string;
  /** c.image → 引用 materials id */
  materialId?: string | null;
  /** c.image：模板内嵌上传图（优先于 materialId） */
  imageDataUrl?: string | null;
  /** c.spacer：空行高度（mm） */
  spacerHeightMm?: number;
  /** c.rule：线粗（mm，约 0.05–2） */
  ruleThicknessMm?: number;
  /** c.rule：线条颜色 #RRGGBB */
  ruleColor?: string;
};

/** 已保存的报价版式模板（雏形：块列表 + 样式） */
export type SavedQuoteTemplate = {
  id: string;
  name: string;
  /** 默认 quote；用于模板库左侧分组 */
  documentRole?: QuoteTemplateDocumentRole;
  createdAt: number;
  updatedAt: number;
  blocks: QuoteTemplateBlock[];
};

/** 方案排版：PDF 底页 + 可选覆盖素材 */
export type PlanPage = {
  id: string;
  backgroundDataUrl: string;
  widthPx: number;
  heightPx: number;
  sourceFileName: string;
  sourcePage: number;
  /** 底图对应的企业库素材 id（由素材生成页时写入）；PDF 拆页为 null */
  backgroundMaterialId?: string | null;
  overlayMaterialId: string | null;
  /**
   * 叠图按此宽高比裁切显示（center + cover）。如 "16:9"、"1:1"；空或未设置则完整显示（contain）
   */
  overlayCropAspect?: string | null;
  /** 第三列预览：缩放/旋转/标注；按页保存 */
  previewExtra?: PlanPreviewExtraState | null;
};

/** Regular / VIP / VVIP list prices (catalog currency). */
export type PriceBand = { regular: number; vip: number; vvip: number };

export type QuotePriceTier = "regular" | "vip" | "vvip";

/** `follow` = use app-wide quote tier on the quote page. */
export type AssociationQuoteTierMode = "follow" | QuotePriceTier;

/** 硬件规格选项（如颜色）；不同选项可有不同加价，地图侧按选项分列加点 */
export type HardwareOption = {
  id: string;
  label: string;
  /**
   * 选中该规格时的单价（分情况一口价）。存在带标签的规格时，报价按所选规格的 optionPrice + add-on，不再与 unitPrice 相加。
   * 持久化旧数据可能为 priceDelta（相对 unitPrice 的加价）；载入时由 normalizeHardwareOptions 换算。
   */
  optionPrice: number;
  /** Regular / VIP / VVIP；缺省则由 optionPrice 复制三档 */
  priceBand?: PriceBand;
  /** 可选：规格级条码；与 ERP 库存行条码二选一或并存，扫码时均可匹配到该规格 */
  barcode?: string;
  /** 规格级产品图（无则用整行 productMaterialId）；不支持营销图 */
  productMaterialId?: string | null;
  /** 规格级技术图（无则用整行 technicalMaterialId） */
  technicalMaterialId?: string | null;
};

/** 可选加价项（如定制外壳）；按地图上的每个标记单独勾选 */
export type HardwareAddon = {
  id: string;
  label: string;
  price: number;
};

export type HardwarePlacement = {
  id: string;
  associationId: string;
  xPct: number;
  yPct: number;
  /** 同一地图标记上的数量（+1 叠加在同一 pin，不新建标记） */
  qty?: number;
  /** 选用的规格；无规格时 null */
  optionId: string | null;
  /** 已勾选的 add-on id */
  addonIds: string[];
};

export type AssociationRow = {
  id: string;
  /** 硬件 / 产品名称 */
  hardwareName: string;
  /** 报价汇总表「设备型号」列；空则回退为硬件名称 */
  deviceModel: string;
  /**
   * 地图标记短名（仅地图 / 地图导出）；空则沿用型号或硬件名。
   * 仅附加字段，旧数据无此键时视为空。
   */
  mapLabelAbbrev?: string | null;
  color: string;
  productMaterialId: string | null;
  quoteAdMaterialId: string | null;
  technicalMaterialId: string | null;
  /** 与 priceBand.regular 同步；无三档旧数据时即为唯一价格 */
  unitPrice: number;
  /** Regular / VIP / VVIP（与录入框 `a;b;c` 对应） */
  priceBand?: PriceBand;
  /** 保修：自发货起计月数；仅数字记录 */
  warrantyMonthsAfterShip?: number | null;
  /** 报价页：是否跟随全局 tier，或该行固定使用某一档 */
  quoteTierMode?: AssociationQuoteTierMode;
  note: string;
  /**
   * 报价汇总表「备注」列（可仅在报价页改）；导出时若为空则沿用关联里的 note
   */
  quoteTableNote: string;
  /** 规格选项列表；空表示该设备无规格分列 */
  options: HardwareOption[];
  /** 可选加价项定义 */
  addons: HardwareAddon[];
  /**
   * 报价汇总表「小计」手工覆盖（含税前简单累加）；null/undefined 表示按地图标记与规格自动计算
   */
  quoteLineTotalOverride?: number | null;
  /** 报价表手工目录单价（与总价覆盖二选一）；× 报价表有效数量 = 行小计 */
  quoteLineUnitPriceOverride?: number | null;
  /** 报价表数量覆盖；null 表示沿用地图标记数量 */
  quoteLineQtyOverride?: number | null;
  /** 在自动行小计（含数量缩放后）上应用的折扣百分比 0–100；与 quoteLineTotalOverride 互斥（有覆盖时忽略折扣） */
  quoteLineDiscountPct?: number | null;
};

/** 报价汇总表行顺序（硬件 / 软件行 / 服务行交叉排序） */
export type QuoteTableRowKey =
  | { kind: "hw"; id: string }
  | { kind: "sw"; id: string }
  | { kind: "sv"; id: string };

/** 软件目录价的计费周期（影响报价汇总表是否计入不含税小计） */
export type SoftwarePriceBillingMode = "one_time" | "monthly" | "yearly";

/** 软件功能：最多 3 页资料（每槽 1 张图，对应 material id） */
export type SoftwareFeatureRow = {
  id: string;
  /** 功能分类（与「产品资料」侧栏同步；可空表示未分类） */
  featureCategory: string;
  featureName: string;
  /** 可选单价（件数按 1）；null/未设置表示不参与报价合计 */
  unitPrice: number | null;
  /**
   * 报价计费方式：一次性计入不含 GST 小计；按月 / 按年仅分项列出（不计入该小计）。
   * 缺省视为一次性。
   */
  softwarePriceBilling?: SoftwarePriceBillingMode;
  docMaterialIds: [string | null, string | null, string | null];
  note: string;
  /** 规格与加价项（与硬件库同一结构，便于后续报价扩展） */
  options: HardwareOption[];
  addons: HardwareAddon[];
};

/** 服务项目（企业资源库 · 服务；结构接近软件功能，无多页资料槽） */
export type ServiceRow = {
  id: string;
  serviceCategory: string;
  serviceName: string;
  unitPrice: number | null;
  note: string;
  options: HardwareOption[];
  addons: HardwareAddon[];
};

/** 定制方案 · 从企业软件库引用的一行（不修改 catalog 本身） */
export type CustomPlanSoftwareLine = {
  id: string;
  catalogFeatureId: string;
  quantity: number;
  optionId: string | null;
  addonIds: string[];
  /** 每个 Add-on 的数量（≥1）；缺省则由 addonIds 每项视为 1 */
  addonQtyById?: Record<string, number>;
  /** 报价页：手动覆盖该行小计（ex GST）；null/不设则用目录自动计算 */
  lineTotalOverride?: number | null;
  /** 报价表备注列（独立于目录 note） */
  quoteLineNote?: string;
};

/** 定制方案 · 从企业服务库引用的一行 */
export type CustomPlanServiceLine = {
  id: string;
  catalogServiceId: string;
  quantity: number;
  optionId: string | null;
  addonIds: string[];
  addonQtyById?: Record<string, number>;
  lineTotalOverride?: number | null;
  quoteLineNote?: string;
};

/** 企业资源库子页（市场资料 = 品牌 + 产品分区） */
export type ResourceLibrarySubTab = "brandMaterials" | "hardware" | "software" | "services";

/** 定制方案主导航 */
export type CustomPlanTab = "select" | "plan" | "quote";

/** 定制方案 · 选型子步骤 */
export type CustomPlanSelectStep = "map" | "software" | "services";

/** 一套定制方案的工作区快照（地图 / 选型 / 方案书 / 报价） */
export type CustomPlanSnapshotData = {
  placements: HardwarePlacement[];
  floorPlanDataUrl: string | null;
  floorPlanOpacityPct: number;
  floorPlanPlacementImageSpace: boolean;
  mapShowName: boolean;
  mapShowQuantity: boolean;
  mapTheme: MapThemeMode;
  mapPlacementGlyphScale: number;
  customPlanSoftwareLines: CustomPlanSoftwareLine[];
  customPlanServiceLines: CustomPlanServiceLine[];
  planPages: PlanPage[];
  quoteFooterCustom: string;
  quoteTableOrder: QuoteTableRowKey[] | null;
  quotationRef: string | null;
  quoteExportIncludeImages: boolean;
  quoteGlobalPriceTier: QuotePriceTier;
  customPlanTab: CustomPlanTab;
  customPlanSelectStep: CustomPlanSelectStep;
};

/** 已保存的命名方案（可切换加载） */
export type SavedCustomPlan = {
  id: string;
  name: string;
  createdAt: number;
  updatedAt: number;
  ownerUserId: string;
  visibility: "company" | "private";
  sharedUserIds: string[];
  data: CustomPlanSnapshotData;
};

export type CrmCustomer = {
  id: string;
  name: string;
  industry: string;
  contact: string;
  logoDataUrl?: string | null;
  ownerUserId: string;
  visibility: "company" | "private";
  sharedUserIds: string[];
  companyLegalName?: string;
  customerType?: "lead" | "prospect" | "customer" | "partner" | "inactive";
  stage?: "new" | "contacted" | "qualified" | "proposal" | "negotiation" | "won" | "lost";
  priority?: "low" | "medium" | "high" | "urgent";
  owner?: string;
  source?: string;
  primaryContactName?: string;
  primaryContactTitle?: string;
  phone?: string;
  email?: string;
  wechat?: string;
  website?: string;
  country?: string;
  state?: string;
  city?: string;
  address?: string;
  companySize?: string;
  annualValue?: string;
  budget?: string;
  expectedCloseDate?: string;
  nextFollowUpAt?: string;
  requirements?: string;
  notes?: string;
  tags?: string[];
  solutionPlanIds: string[];
  createdAt: number;
  updatedAt: number;
};

/** 报价 PDF 封面装饰（取代原预设模板） */
export type QuotePdfCoverDecor = "topBar" | "frame" | "none";

/** 报价 PDF 导出配色（设置中可调，写入导出逻辑） */
export type QuotePdfExportStyle = {
  accentColor: string;
  mutedColor: string;
  tableHeaderFill: string;
  tableGridColor: string;
  hardwareBannerFill: string;
  coverDecor: QuotePdfCoverDecor;
};

/** 全局界面特效（由风格预设驱动，可持久化） */
export type StyleChromeEffect = "none" | "glass";

/** 参考设计命名的界面风格包（每包下挂多套配色） */
export type UiStylePackId = "aurora" | "crextio" | "quantix" | "fintrixity" | "sapphire";

/** 装饰性背景图（SVG，置于 body 底层，可配强度） */
export type AppUiBackgroundId =
  | "none"
  | "violetBloom"
  | "amberHaze"
  | "cyanDrift"
  | "indigoWell"
  | "meshNoir"
  | "custom";

/**
 * 与风格包联动的「壳」参数：毛玻璃、线框强度、圆角比例；
 * 数值在设置页用滑块调，写入持久化。
 */
export type AppUiChromeSettings = {
  effect: StyleChromeEffect;
  /** 顶栏 / 大面毛玻璃模糊半径 px，约 12–40 */
  glassBlurPx: number;
  /** 相对预设的线框强度 %，100 = 预设默认 */
  lineStrengthPct: number;
  /** 圆角缩放 %，作用于 sm…3xl 六档 */
  radiusScalePct: number;
  /**
   * 面板玻璃填充 alpha 相对配色表「面板不透明度」的缩放 %；
   * 100 = 与配色表一致；0 = 面板底色全透明（仅余 backdrop-blur 等壳效果）。
   */
  panelFillAlphaScalePct: number;
};

/**
 * 用户选中的完整界面主题（风格 + 配色 + 背景 + 壳参数）；
 * 运行时用其解析为 AppUiAppearance 再写入 CSS 变量。
 */
export type AppUiThemeBundle = {
  packId: UiStylePackId;
  paletteId: string;
  backgroundId: AppUiBackgroundId;
  /** 0–100：背景装饰图层不透明度权重 */
  backgroundIntensityPct: number;
  chrome: AppUiChromeSettings;
  /**
   * 可选：覆盖配色表中的中性线框色（分区线、弱边框，与主色无关）。
   */
  wireframeColorOverride?: string;
  /**
   * 可选：覆盖配色表中的面板底纹填充色（卡片/面板半透明底色）。
   */
  panelFillColorOverride?: string;
  /**
   * 当 backgroundId === "custom"：压缩后的 data:image/jpeg;base64,...（用于毛玻璃底层测试）。
   */
  customBackgroundArtDataUrl?: string;
  /**
   * 可选：仅覆盖主按钮 / Tab 选中 / 高亮环等的主色（六位 hex）；不影响配色表里的正文与灰壳。
   */
  primaryColorOverride?: string;
  /**
   * 可选：覆盖「主舞台 / 壳层大外框」描边色（.ui-stage 一圈），与主强调色分离。
   */
  shellFrameColorOverride?: string;
};

/** setUiThemeBundle：允许用 null 清除上述覆盖 */
export type AppUiThemeBundlePatch = Omit<
  Partial<AppUiThemeBundle>,
  | "wireframeColorOverride"
  | "panelFillColorOverride"
  | "customBackgroundArtDataUrl"
  | "primaryColorOverride"
  | "shellFrameColorOverride"
> & {
  wireframeColorOverride?: string | null;
  panelFillColorOverride?: string | null;
  customBackgroundArtDataUrl?: string | null;
  primaryColorOverride?: string | null;
  shellFrameColorOverride?: string | null;
};

/** 界面主题：浅色 / 深色 */
export type AppThemeMode = "light" | "dark";

/** 全局外观（设置中可改，持久化）：主背景、线框/描边；主强调色由应用默认 primary 提供 */
export type AppUiAppearance = {
  mode: AppThemeMode;
  backgroundColor: string;
  /** 0–100：主背景不透明度（100 为实色） */
  backgroundOpacityPct: number;
  /** 主按钮、实心强调填充、主导航文字强调等 */
  primaryColor: string;
  /**
   * 主舞台大外框（UiPageShell · ui-stage）描边用色，默认偏冷蓝灰，与主强调色解耦。
   */
  shellFrameColor: string;
  /** 线框按钮、输入框描边、分区边框等 */
  wireframeColor: string;
  /** 0–100：线框/分隔线整体强度（0 为全透明） */
  wireframeOpacityPct: number;
  /** 内容区块填充色（半透明卡片底色） */
  panelFillColor: string;
  /** 0–100：内容区块填充不透明度 */
  panelFillOpacityPct: number;
  /** 内容区块外边框色（中性冷灰高光，勿用纯白） */
  panelBorderColor: string;
  /** 0–100：内容区块边框不透明度 */
  panelBorderOpacityPct: number;
  /** 主文字色（正文） */
  textColor: string;
  /** 辅助文字（说明、次要标签） */
  textMutedColor: string;
  /** 更弱一级文字（占位、禁用感） */
  textSubtleColor: string;
  /** 提示 / 信息条主色（与 success 分离） */
  infoColor: string;
  /** 0–100：信息色不透明度 */
  infoOpacityPct: number;
  /** 成功态主色 */
  successColor: string;
  /** 错误 / 危险态主色 */
  dangerColor: string;
  /** 警示 / 警告态主色 */
  warningColor: string;
  /** 文本框、色值输入等控件填充色（与面板可区分） */
  inputFillColor: string;
  /** 0–100：控件填充不透明度 */
  inputFillOpacityPct: number;
  /** 主按钮、Tab 选中态等上面的文字色（六位 hex） */
  onPrimaryColor: string;
  /** 圆角 px：与 Tailwind rounded-sm/md/lg/xl/2xl/3xl 对应 */
  radiusSmPx: number;
  radiusMdPx: number;
  radiusLgPx: number;
  radiusXlPx: number;
  radius2xlPx: number;
  radius3xlPx: number;
  /** 常规描边宽度 px（对应默认 border） */
  borderHairlinePx: number;
  /** 强调描边宽度 px（对应 border-2） */
  borderEmphasisPx: number;
  /**
   * 预览/装饰环（如大图描边）相对面板描边色的强度 0–100；
   * 最终透明度 = 面板描边不透明度 × 本值/100
   */
  previewDecorRingOpacityPct: number;
};

/** UI language; persisted with app data, default English. */
export type UiLocale = "en" | "zh";

export type QuoteTab =
  /** 市场资料（品牌 / 产品）+ 硬件库 + 软件功能 + 服务 */
  | "enterpriseResources"
  | "crm"
  /** 地图选型 + 方案排版 + 报价 */
  | "customPlan"
  /** ERP：客户 / 库存 / 人事（当前实现库存子模块） */
  | "erp"
  | "settings";

/** ERP 顶栏模块（Customer / Inventory / Staff） */
export type ErpModuleTab = "customer" | "inventory" | "staff";

/** 库存子模块 Tab */
export type ErpInvSubTab = "inbound" | "catalog";

/** 与硬件行 / 软件功能 / 服务目录对应的库存维度 */
export type ErpStockKind = "hardware" | "software" | "service";

/** ERP 产品库硬件分类树：Manual 与分类库 / 拖拽顺序一致；A–Z 按主类展示名排序 */
export type ErpHardwareNavSortMode = "manual" | "az";

/** 产品库 / 媒体库产品 Tab 共用左侧：某 kind 的主类与子类筛选；primary=null 表示该 kind 全部 */
export type ErpCatalogNavSel = { primary: string | null; filterKey: string | null };

/** ERP 产品库：列表与右侧编辑区共享的当前选中行 */
export type ErpCatalogSelection =
  | { kind: "hardware"; id: string; catalogOptionId: string | null }
  | { kind: "software"; id: string }
  | { kind: "service"; id: string };

/** 每条目录项一条库存扩展（catalogRefId = association.id | softwareFeature.id | serviceRow.id） */
export type ErpInventoryLine = {
  id: string;
  kind: ErpStockKind;
  catalogRefId: string;
  /**
   * 硬件：对应 association.options 中某项的 id；null 表示整 SKU 或未拆规格。
   * 软件/服务通常为 null。
   */
  catalogOptionId: string | null;
  /** 主条码（入库扫码匹配） */
  barcode: string;
  quantityOnHand: number;
  /** 补货提醒阈值 */
  reorderPoint: number;
  binLocation: string;
  notes: string;
  /** 供应商料号 */
  supplierSku: string;
  /** 成本单价（可选，便于毛利；与报价单价独立） */
  costPrice: number | null;
  lastInboundAt?: number;
};

export type ErpStockMovement = {
  id: string;
  at: number;
  direction: "in" | "out";
  kind: ErpStockKind;
  catalogRefId: string;
  /** 硬件入库/出库若针对具体规格，记录 option id */
  catalogOptionId?: string | null;
  qty: number;
  note?: string;
  barcodeSnapshot?: string;
};
