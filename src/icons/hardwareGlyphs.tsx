import type { CSSProperties, ReactNode } from "react";

export const HARDWARE_ICON_IDS = [
  "device",
  "kiosk",
  "pos",
  "router",
  "smartgate",
  "locker",
  "arcade",
  "screen",
  "display",
  "camera",
  "speaker",
  "printer",
  "scanner",
  "gateway",
  "server",
  "wifi",
  "nfc",
  "cash",
  "plug",
  "tablet",
  "laptop",
  "scale",
  "handheld",
  "videowall",
  "keyboard",
] as const;

export type HardwareIconId = (typeof HARDWARE_ICON_IDS)[number];

export const HARDWARE_ICON_LABELS: Record<HardwareIconId, string> = {
  device: "通用设备",
  kiosk: "自助 kiosk",
  pos: "POS 收银",
  router: "路由器",
  smartgate: "闸机 Smart Gate",
  locker: "储物柜",
  arcade: "游戏机",
  screen: "大屏",
  display: "展示屏",
  camera: "摄像头",
  speaker: "音箱",
  printer: "打印机",
  scanner: "扫码枪",
  gateway: "网关",
  server: "服务器",
  wifi: "无线 AP",
  nfc: "读卡 / NFC",
  cash: "钱箱",
  plug: "电源 / 插座",
  tablet: "平板",
  laptop: "笔记本",
  scale: "电子秤",
  handheld: "手持机",
  videowall: "拼接屏 / 视频墙",
  keyboard: "键盘",
};

const S = {
  stroke: "currentColor" as const,
  fill: "none" as const,
  width: "1.65" as const,
  cap: "round" as const,
  join: "round" as const,
};

function SvgFrame({
  children,
  style,
  className,
}: {
  children: ReactNode;
  style?: CSSProperties;
  className?: string;
}) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill={S.fill}
      aria-hidden
      className={className ?? "block h-[1em] w-[1em] shrink-0"}
      style={style}
    >
      {children}
    </svg>
  );
}

export function HardwareGlyph({ id, style, className }: { id: string; style?: CSSProperties; className?: string }) {
  const key = (HARDWARE_ICON_IDS as readonly string[]).includes(id) ? (id as HardwareIconId) : "device";
  const p = { stroke: S.stroke, strokeWidth: S.width, strokeLinecap: S.cap, strokeLinejoin: S.join };
  switch (key) {
    case "kiosk":
      return (
        <SvgFrame style={style} className={className}>
          <path {...p} d="M7 3h10v18H7zM9 6h6v7H9zM9 16h6v3H9" />
          <path {...p} d="M5 21h14" />
        </SvgFrame>
      );
    case "pos":
      return (
        <SvgFrame style={style} className={className}>
          <rect {...p} x="3" y="5" width="18" height="11" rx="1.5" />
          <path {...p} d="M8 19h8M12 16v3" />
          <path {...p} d="M7 9h10" />
        </SvgFrame>
      );
    case "router":
      return (
        <SvgFrame style={style} className={className}>
          <rect {...p} x="5" y="9" width="14" height="9" rx="1.5" />
          <path {...p} d="M9 9V5M12 9V4M15 9V5" />
          <circle cx="9" cy="14" r="0.9" fill="currentColor" stroke="none" />
          <circle cx="15" cy="14" r="0.9" fill="currentColor" stroke="none" />
        </SvgFrame>
      );
    case "smartgate":
      return (
        <SvgFrame style={style} className={className}>
          <path {...p} d="M6 20V8M18 20V8" />
          <path {...p} d="M6 8h12M6 12h12" />
          <path {...p} d="M10 12v8M14 12v8" />
        </SvgFrame>
      );
    case "locker":
      return (
        <SvgFrame style={style} className={className}>
          <rect {...p} x="4" y="3" width="4.5" height="18" rx="0.5" />
          <rect {...p} x="9.75" y="3" width="4.5" height="18" rx="0.5" />
          <rect {...p} x="15.5" y="3" width="4.5" height="18" rx="0.5" />
          <path {...p} d="M5.25 8h2M11 8h2M16.75 8h2" />
        </SvgFrame>
      );
    case "arcade":
      return (
        <SvgFrame style={style} className={className}>
          <rect {...p} x="4" y="4" width="16" height="16" rx="2" />
          <circle cx="9" cy="14" r="1.2" fill="currentColor" stroke="none" />
          <path {...p} d="M15 11v5M15 11l2-2" />
        </SvgFrame>
      );
    case "screen":
      return (
        <SvgFrame style={style} className={className}>
          <rect {...p} x="3" y="5" width="18" height="11" rx="1" />
          <path {...p} d="M9 21h6M12 16v5" />
        </SvgFrame>
      );
    case "display":
      return (
        <SvgFrame style={style} className={className}>
          <rect {...p} x="5" y="4" width="14" height="10" rx="1" />
          <path {...p} d="M8 14h8M12 14v6" />
        </SvgFrame>
      );
    case "camera":
      return (
        <SvgFrame style={style} className={className}>
          <rect {...p} x="4" y="8" width="16" height="11" rx="2" />
          <path {...p} d="M9 8V6h6v2" />
          <circle {...p} cx="12" cy="13.5" r="3" />
        </SvgFrame>
      );
    case "speaker":
      return (
        <SvgFrame style={style} className={className}>
          <path {...p} d="M4 10v4l4 2V8L4 10z" />
          <path {...p} d="M9 8v8" />
          <path {...p} d="M13 10c2 1 2 3 0 4M16 8c3.5 2 3.5 6 0 8" />
        </SvgFrame>
      );
    case "printer":
      return (
        <SvgFrame style={style} className={className}>
          <rect {...p} x="6" y="3" width="12" height="6" rx="1" />
          <rect {...p} x="5" y="9" width="14" height="7" rx="1" />
          <path {...p} d="M8 16v5h8v-5" />
        </SvgFrame>
      );
    case "scanner":
      return (
        <SvgFrame style={style} className={className}>
          <path {...p} d="M4 8h16M4 12h16M4 16h16" />
          <rect {...p} x="7" y="5" width="10" height="14" rx="1" />
        </SvgFrame>
      );
    case "gateway":
      return (
        <SvgFrame style={style} className={className}>
          <path {...p} d="M4 20V10l8-6 8 6v10" />
          <path {...p} d="M9 14h6M9 17h6" />
        </SvgFrame>
      );
    case "server":
      return (
        <SvgFrame style={style} className={className}>
          <rect {...p} x="5" y="4" width="14" height="4" rx="0.5" />
          <rect {...p} x="5" y="10" width="14" height="4" rx="0.5" />
          <rect {...p} x="5" y="16" width="14" height="4" rx="0.5" />
          <path {...p} d="M8 6h2M8 12h2M8 18h2" />
        </SvgFrame>
      );
    case "wifi":
      return (
        <SvgFrame style={style} className={className}>
          <path {...p} d="M5 10c4-3 10-3 14 0M7.5 13c3-2 6.5-2 9 0M10 16c1.5-1 2.5-1 4 0" />
          <circle cx="12" cy="19" r="1" fill="currentColor" stroke="none" />
        </SvgFrame>
      );
    case "nfc":
      return (
        <SvgFrame style={style} className={className}>
          <path {...p} d="M8 16c3-4 5-8 0-11M12 17c4-5 6-10 0-14" />
          <rect {...p} x="15" y="8" width="4" height="10" rx="0.5" />
        </SvgFrame>
      );
    case "cash":
      return (
        <SvgFrame style={style} className={className}>
          <rect {...p} x="5" y="6" width="14" height="12" rx="1" />
          <path {...p} d="M12 9v6M9.5 12h5" />
        </SvgFrame>
      );
    case "plug":
      return (
        <SvgFrame style={style} className={className}>
          <path {...p} d="M8 3v4M16 3v4" />
          <rect {...p} x="7" y="7" width="10" height="11" rx="2" />
          <path {...p} d="M10 18v3M14 18v3" />
        </SvgFrame>
      );
    case "tablet":
      return (
        <SvgFrame style={style} className={className}>
          <rect {...p} x="5" y="3.5" width="14" height="17" rx="2" />
          <path {...p} d="M9 7h6M9 10h6" />
          <circle cx="12" cy="18.5" r="0.75" fill="currentColor" stroke="none" />
        </SvgFrame>
      );
    case "laptop":
      return (
        <SvgFrame style={style} className={className}>
          <path {...p} d="M5 17h14" />
          <path {...p} d="M6 17V8h12v9" />
          <rect {...p} x="7.5" y="9.5" width="9" height="5.5" rx="0.5" />
        </SvgFrame>
      );
    case "scale":
      return (
        <SvgFrame style={style} className={className}>
          <rect {...p} x="4" y="14" width="16" height="4" rx="1" />
          <path {...p} d="M8 14V9h8v5" />
          <path {...p} d="M9 6h6" />
        </SvgFrame>
      );
    case "handheld":
      return (
        <SvgFrame style={style} className={className}>
          <rect {...p} x="8" y="3" width="8" height="18" rx="1.5" />
          <path {...p} d="M10 6h4M10 9h4" />
          <circle cx="12" cy="16" r="1" fill="currentColor" stroke="none" />
        </SvgFrame>
      );
    case "videowall":
      return (
        <SvgFrame style={style} className={className}>
          <rect {...p} x="3" y="5" width="5.5" height="8" rx="0.5" />
          <rect {...p} x="9.25" y="5" width="5.5" height="8" rx="0.5" />
          <rect {...p} x="15.5" y="5" width="5.5" height="8" rx="0.5" />
          <path {...p} d="M6 13v5M12 13v5M18 13v5" />
        </SvgFrame>
      );
    case "keyboard":
      return (
        <SvgFrame style={style} className={className}>
          <rect {...p} x="3" y="8" width="18" height="9" rx="1.5" />
          <path {...p} d="M6 11h2M10 11h2M14 11h2M18 11h2M7 14h10" />
        </SvgFrame>
      );
    case "device":
    default:
      return (
        <SvgFrame style={style} className={className}>
          <rect {...p} x="6" y="3" width="12" height="18" rx="2.5" />
          <path {...p} d="M9 7h6" />
          <rect {...p} x="8" y="10" width="8" height="8" rx="1" />
        </SvgFrame>
      );
  }
}

/** 旧数据：emoji → iconKey */
export function migrateLegacyIconField(legacy: unknown): HardwareIconId {
  const map: Record<string, HardwareIconId> = {
    "📦": "device",
    "🖥️": "pos",
    "💡": "display",
    "🪧": "screen",
    "🏷️": "scanner",
    "📺": "screen",
    "🧱": "server",
    "🚪": "smartgate",
    "🪟": "display",
    "⚡": "plug",
  };
  if (typeof legacy === "string") {
    if ((HARDWARE_ICON_IDS as readonly string[]).includes(legacy)) return legacy as HardwareIconId;
    return map[legacy] ?? "device";
  }
  return "device";
}
