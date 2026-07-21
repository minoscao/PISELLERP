/** 删除分类后，其下素材归入此分类 */
export const UNCATEGORIZED_CATEGORY_NAME = "未分类";

/** 仅市场资料「品牌」侧使用；不出现在硬件品类库或 SKU 分类选择器 */
export const BRAND_MATERIAL_CATEGORY_PREFIX = "品牌素材 ·";

export function isBrandOnlyMaterialCategory(name: string): boolean {
  return name.trim().startsWith(BRAND_MATERIAL_CATEGORY_PREFIX);
}

/** 与 `defaultMaterialCategories` 中 IoT 兜底分类名一致；用于识别「占位」素材类并优先采用表单/推断分类 */
export const HARDWARE_IOT_BUCKET_CATEGORY_NAME = "其他联网设备 · 其他支持 IoT API 的设备";
