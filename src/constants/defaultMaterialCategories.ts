import type { MaterialCategoryDef } from "../types";
import { categoryParentKey } from "../utils/categoryFolder";
import {
  BRAND_MATERIAL_CATEGORY_PREFIX,
  HARDWARE_IOT_BUCKET_CATEGORY_NAME,
  UNCATEGORIZED_CATEGORY_NAME,
  isBrandOnlyMaterialCategory,
} from "./materialCategories";
import { HARDWARE_ICON_IDS } from "../icons/hardwareGlyphs";

function nk(k: string): string {
  return (HARDWARE_ICON_IDS as readonly string[]).includes(k) ? k : "device";
}

/** 已从内置默认表移除；合并持久化时丢弃这些旧名，避免删了又出现 */
export const DEPRECATED_MATERIAL_CATEGORY_NAMES = new Set(["默认", "门头", "灯箱", "印刷"]);

/**
 * 旧版分类名 → 新版（自助点餐与贩卖机拆分等）
 * 仅影响已持久化数据合并；新安装直接使用下方 DEFAULT_CATEGORY_DEFS
 */
export const LEGACY_CATEGORY_RENAMES: Record<string, string> = {
  "销售交易设备 · Kiosk台式": "销售交易设备 · 自助点餐机（台式）",
  "销售交易设备 · Kiosk立式": "销售交易设备 · 自助点餐机（立式）",
};

export function migrateLegacyCategoryName(name: string): string {
  return LEGACY_CATEGORY_RENAMES[name] ?? name;
}

/** 全量默认分类（中文 name 为存储主键；多类可共用同一 iconKey） */
const DEFAULT_CATEGORY_DEFS: MaterialCategoryDef[] = [
  { name: "销售交易设备 · POS", nameEn: "Sales · POS", iconKey: "pos" },
  {
    name: "销售交易设备 · 自助点餐机（台式）",
    nameEn: "Sales · Self-order Kiosk (Countertop)",
    iconKey: "kiosk",
  },
  {
    name: "销售交易设备 · 自助点餐机（立式）",
    nameEn: "Sales · Self-order Kiosk (Freestanding)",
    iconKey: "kiosk",
  },
  {
    name: "销售交易设备 · 自助售票机",
    nameEn: "Sales · Self-service Ticketing",
    iconKey: "scanner",
  },
  {
    name: "销售交易设备 · 自助充值机",
    nameEn: "Sales · Self-service Top-up",
    iconKey: "nfc",
  },

  { name: "自动售卖设备 · 自动贩卖机", nameEn: "Vending · Machine", iconKey: "kiosk" },
  { name: "自动售卖设备 · 饮料机", nameEn: "Vending · Beverage", iconKey: "kiosk" },
  { name: "自动售卖设备 · 零食机", nameEn: "Vending · Snacks", iconKey: "kiosk" },
  { name: "自动售卖设备 · 盲盒机", nameEn: "Vending · Blind box / Gashapon", iconKey: "arcade" },

  { name: "储物设备 · 智能储物柜", nameEn: "Locker · Smart lockers", iconKey: "locker" },
  { name: "储物设备 · 取餐柜", nameEn: "Locker · Food pickup", iconKey: "locker" },
  { name: "储物设备 · 快递柜", nameEn: "Locker · Parcel / pickup", iconKey: "locker" },

  { name: "内容展示设备 · ADS", nameEn: "Display · ADS", iconKey: "display" },
  { name: "内容展示设备 · 菜单屏", nameEn: "Display · Menu board", iconKey: "display" },
  { name: "内容展示设备 · 宣传屏", nameEn: "Display · Promo screen", iconKey: "display" },
  { name: "内容展示设备 · 海报屏", nameEn: "Display · Poster screen", iconKey: "display" },
  { name: "流程展示设备 · 叫号屏", nameEn: "Queue · Calling display", iconKey: "display" },
  { name: "流程展示设备 · 排队屏", nameEn: "Queue · Line status", iconKey: "display" },
  { name: "流程展示设备 · Gallery View", nameEn: "Queue · Gallery view", iconKey: "display" },
  { name: "工作流设备 · KDS 厨房屏", nameEn: "Workflow · KDS kitchen", iconKey: "screen" },
  { name: "工作流设备 · 吧台出品屏", nameEn: "Workflow · Bar pass", iconKey: "screen" },
  { name: "工作流设备 · 制作站屏", nameEn: "Workflow · Prep station", iconKey: "screen" },
  { name: "工作流设备 · 分拣屏", nameEn: "Workflow · Sorting", iconKey: "screen" },
  { name: "游乐设备 · 游戏机", nameEn: "Amusement · Arcade", iconKey: "arcade" },
  { name: "游乐设备 · 抓娃娃机", nameEn: "Amusement · Claw machine", iconKey: "arcade" },
  { name: "通行控制设备 · 闸机", nameEn: "Access · Turnstile / gate", iconKey: "smartgate" },
  { name: "支付设备 · 刷卡机", nameEn: "Payment · Card reader", iconKey: "nfc" },
  { name: "支付设备 · 扫码支付盒子", nameEn: "Payment · QR scan box", iconKey: "scanner" },
  { name: "打印设备 · 小票打印机", nameEn: "Print · Receipt", iconKey: "printer" },
  { name: "打印设备 · 标签打印机", nameEn: "Print · Label", iconKey: "printer" },
  { name: "打印设备 · 票券打印机", nameEn: "Print · Ticket", iconKey: "printer" },
  { name: "打印设备 · 腕带打印机", nameEn: "Print · Wristband", iconKey: "printer" },
  { name: "称重设备 · 电子秤", nameEn: "Weighing · Digital scale", iconKey: "device" },
  {
    name: "辅材配件 · 线缆充电器插座等",
    nameEn: "Accessories · Cables, chargers & outlets",
    iconKey: "plug",
  },
  { name: "收银配件 · 支架与其他", nameEn: "POS accessories · Stands & mounts", iconKey: "plug" },
  { name: "运营耗材 · 色带与标签纸", nameEn: "Consumables · Ribbon & label media", iconKey: "printer" },
  { name: "网络设备 · WiFi AP", nameEn: "Network · Wi-Fi AP", iconKey: "wifi" },
  { name: "网络设备 · 路由器", nameEn: "Network · Router", iconKey: "router" },
  { name: "网络设备 · 交换机", nameEn: "Network · Switch", iconKey: "gateway" },
  { name: "网络设备 · 4G/5G 网关", nameEn: "Network · 4G/5G gateway", iconKey: "gateway" },
  { name: "安防记录设备 · 摄像头", nameEn: "Security · Camera", iconKey: "camera" },
  { name: "安防记录设备 · 录像主机", nameEn: "Security · NVR / recorder", iconKey: "server" },

  { name: `${BRAND_MATERIAL_CATEGORY_PREFIX}Logo 与标识`, nameEn: "Brand · Logo & marks", iconKey: "display" },
  { name: `${BRAND_MATERIAL_CATEGORY_PREFIX}主视觉与主题`, nameEn: "Brand · Key visuals", iconKey: "display" },
  { name: `${BRAND_MATERIAL_CATEGORY_PREFIX}产品画册与折页`, nameEn: "Brand · Brochures & flyers", iconKey: "printer" },
  { name: `${BRAND_MATERIAL_CATEGORY_PREFIX}门店摄影与环境`, nameEn: "Brand · Retail photography", iconKey: "camera" },
  { name: `${BRAND_MATERIAL_CATEGORY_PREFIX}视频与动效`, nameEn: "Brand · Motion & video", iconKey: "display" },
  { name: `${BRAND_MATERIAL_CATEGORY_PREFIX}其他通用素材`, nameEn: "Brand · General assets", iconKey: "device" },

  {
    name: HARDWARE_IOT_BUCKET_CATEGORY_NAME,
    nameEn: "Other · IoT-capable device",
    iconKey: "plug",
  },

  { name: UNCATEGORIZED_CATEGORY_NAME, nameEn: "Uncategorized", iconKey: "device" },
].map((d) => ({ ...d, iconKey: nk(d.iconKey) }));

/** 内置「产品」资料分类树的大类名（用于从品牌分区侧栏中排除） */
export function getProductMaterialCategoryParentKeys(): Set<string> {
  const s = new Set<string>();
  for (const d of DEFAULT_CATEGORY_DEFS) {
    if (d.name === UNCATEGORIZED_CATEGORY_NAME) continue;
    if (isBrandOnlyMaterialCategory(d.name)) continue;
    s.add(categoryParentKey(d.name));
  }
  return s;
}

const CANONICAL_BY_NAME = new Map(DEFAULT_CATEGORY_DEFS.map((d) => [d.name, d]));

/** 合并持久化分类时：迁移旧名、补全英文名与推荐 icon */
export function enrichCategoryDef(def: MaterialCategoryDef): MaterialCategoryDef {
  const migrated = migrateLegacyCategoryName(String(def.name ?? "").trim());
  if (!migrated) return { ...def, name: "", iconKey: nk(def.iconKey) };
  const canon = CANONICAL_BY_NAME.get(migrated);
  const iconKey = nk(def.iconKey || canon?.iconKey || "device");
  const nameEn = (def.nameEn?.trim() || canon?.nameEn)?.trim();
  const defaultMapColor =
    typeof def.defaultMapColor === "string" && /^#[0-9A-Fa-f]{6}([0-9A-Fa-f]{2})?$/i.test(def.defaultMapColor)
      ? def.defaultMapColor
      : undefined;
  return {
    name: migrated,
    ...(nameEn ? { nameEn } : {}),
    iconKey,
    ...(defaultMapColor ? { defaultMapColor } : {}),
  };
}

/** 新建项目时的默认素材分类 */
export function buildDefaultMaterialCategoryDefs(): MaterialCategoryDef[] {
  return DEFAULT_CATEGORY_DEFS.map((d) => ({ ...d }));
}

/**
 * 合并本地持久化的分类与内置全量默认：
 * - 内置顺序与条目始终保留（缺省用内置）；
 * - 同名以持久化中的图标 / 英文名 / 地图色覆盖；
 * - 持久化里多出的自定义分类排在内置之后（「未分类」前插入）。
 */
export function mergePersistedCategoryDefsWithCanonical(
  persisted: MaterialCategoryDef[],
  canonical: MaterialCategoryDef[],
): MaterialCategoryDef[] {
  const canonOrder = canonical.map((d) => d.name);
  const canonSet = new Set(canonOrder);
  const persistByName = new Map<string, MaterialCategoryDef>();
  for (const raw of persisted) {
    const e = enrichCategoryDef(raw);
    if (e.name) persistByName.set(e.name, e);
  }

  const uncName = UNCATEGORIZED_CATEGORY_NAME;
  const tailCustom: MaterialCategoryDef[] = [];
  const seenTail = new Set<string>();

  for (const raw of persisted) {
    const u = enrichCategoryDef(raw);
    if (!u.name || canonSet.has(u.name)) continue;
    if (u.name === uncName) continue;
    if (DEPRECATED_MATERIAL_CATEGORY_NAMES.has(u.name)) continue;
    if (seenTail.has(u.name)) continue;
    tailCustom.push(u);
    seenTail.add(u.name);
  }

  const merged: MaterialCategoryDef[] = [];
  for (const name of canonOrder) {
    if (name === uncName) continue;
    const base = CANONICAL_BY_NAME.get(name);
    if (!base) continue;
    const user = persistByName.get(name);
    if (user) {
      merged.push(
        enrichCategoryDef({
          ...base,
          iconKey: user.iconKey || base.iconKey,
          ...(typeof user.nameEn === "string" && user.nameEn.trim() ? { nameEn: user.nameEn.trim() } : {}),
          ...(user.defaultMapColor ? { defaultMapColor: user.defaultMapColor } : {}),
        }),
      );
    } else {
      merged.push({ ...base });
    }
  }

  merged.push(...tailCustom);

  const uncCanon = CANONICAL_BY_NAME.get(uncName);
  const uncUser = persistByName.get(uncName);
  if (uncCanon) {
    merged.push(
      uncUser
        ? enrichCategoryDef({
            ...uncCanon,
            iconKey: uncUser.iconKey || uncCanon.iconKey,
            ...(typeof uncUser.nameEn === "string" && uncUser.nameEn.trim()
              ? { nameEn: uncUser.nameEn.trim() }
              : {}),
            ...(uncUser.defaultMapColor ? { defaultMapColor: uncUser.defaultMapColor } : {}),
          })
        : { ...uncCanon },
    );
  }

  return merged;
}
