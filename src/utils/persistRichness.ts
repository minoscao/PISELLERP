/** 粗略评估 persist state 里定制方案相关内容的完整度（用于多源合并）。 */
export function scorePersistState(state: Record<string, unknown> | null | undefined): number {
  if (!state || typeof state !== "object") return 0;
  let score = 0;
  const placements = state.placements;
  if (Array.isArray(placements)) score += placements.length * 25;
  const floor = state.floorPlanDataUrl;
  if (typeof floor === "string" && floor.length > 64) score += 800;
  const plans = state.savedCustomPlans;
  if (Array.isArray(plans)) {
    for (const raw of plans) {
      const p = raw as { data?: { placements?: unknown[]; floorPlanDataUrl?: string } };
      const d = p.data;
      if (!d) continue;
      score += (Array.isArray(d.placements) ? d.placements.length : 0) * 8;
      if (typeof d.floorPlanDataUrl === "string" && d.floorPlanDataUrl.length > 64) score += 120;
    }
  }
  return score;
}

export function parsePersistStateJson(json: string): Record<string, unknown> | null {
  try {
    const parsed = JSON.parse(json) as { state?: Record<string, unknown> };
    if (!parsed?.state || typeof parsed.state !== "object") return null;
    return parsed.state;
  } catch {
    return null;
  }
}
