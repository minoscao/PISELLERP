/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      /** 仅写 `border` 宽度时不再回落到 currentColor（正文近白 → 死白描边） */
      borderColor: {
        DEFAULT: "var(--app-line-mid)",
      },
      colors: {
        app: {
          bg: "var(--app-bg)",
          /** 与主背景协调的抬升面；支持 /opacity */
          surface: "rgb(var(--app-surface-rgb) / <alpha-value>)",
          "surface-2": "rgb(var(--app-surface-2-rgb) / <alpha-value>)",
          border: "var(--app-border)",
          header: "var(--app-header-bg)",
          text: "rgb(var(--app-text-rgb) / <alpha-value>)",
          muted: "rgb(var(--app-text-muted-rgb) / <alpha-value>)",
          subtle: "rgb(var(--app-text-subtle-rgb) / <alpha-value>)",
          primary: "rgb(var(--app-primary-rgb) / <alpha-value>)",
          /** 主舞台 / 壳层大外框描边（独立于主强调色） */
          "shell-frame": "rgb(var(--app-shell-frame-rgb) / <alpha-value>)",
          "primary-hover": "rgb(var(--app-primary-hover-rgb) / <alpha-value>)",
          "primary-soft": "var(--app-primary-soft)",
          tone: "rgb(var(--app-primary-tone-rgb) / <alpha-value>)",
          /** Tab / 卡片选中强调描边（rgba 整串，通常不用 /opacity 修饰符） */
          "accent-border": "var(--app-accent-border)",
          "accent-border-rgb": "rgb(var(--app-accent-border-rgb) / <alpha-value>)",
          /** 主色按钮上的文字（由外观表控制） */
          "on-primary": "rgb(var(--app-on-primary-rgb) / <alpha-value>)",
          /** 预览/装饰环，随面板描边与 previewDecorRingOpacityPct */
          "decor-ring": "var(--app-decor-ring)",
          wire: "var(--app-wire)",
          "wire-soft": "var(--app-wire-soft)",
          "wire-rgb": "rgb(var(--app-wire-rgb) / <alpha-value>)",
          "line-subtle": "var(--app-line-subtle)",
          "line-mid": "var(--app-line-mid)",
          "line-strong": "var(--app-line-strong)",
          divider: "var(--app-divider)",
          "panel-bg": "var(--app-panel-bg)",
          "panel-border": "var(--app-panel-border)",
          "input-bg": "var(--app-input-bg)",
          "input-border": "var(--app-input-border)",
          "input-placeholder": "var(--app-input-placeholder)",
          "info-text": "rgb(var(--app-info-text-rgb) / <alpha-value>)",
          "info-border": "var(--app-info-border)",
          "warning-border": "var(--app-warning-border)",
          "warning-bg": "var(--app-warning-bg)",
          "warning-text": "rgb(var(--app-warning-text-rgb) / <alpha-value>)",
          "warning-ring": "var(--app-warning-ring)",
          "danger-border": "var(--app-danger-border)",
          "danger-bg": "var(--app-danger-bg)",
          "danger-text": "rgb(var(--app-danger-text-rgb) / <alpha-value>)",
          "danger-ring": "var(--app-danger-ring)",
          "success-border": "var(--app-success-border)",
          "success-bg": "var(--app-success-bg)",
          "success-text": "rgb(var(--app-success-text-rgb) / <alpha-value>)",
          /** 与信息色同源，用于低不透明度铺底（避免对整段 rgba 使用 /xx 修饰符） */
          "success-tint": "rgb(var(--app-success-text-rgb) / <alpha-value>)",
          "success-ring": "var(--app-success-ring)",
          "overlay-scrim": "var(--app-overlay-scrim)",
        },
      },
      borderRadius: {
        sm: "var(--app-radius-sm)",
        DEFAULT: "var(--app-radius-md)",
        md: "var(--app-radius-md)",
        lg: "var(--app-radius-lg)",
        xl: "var(--app-radius-xl)",
        "2xl": "var(--app-radius-2xl)",
        "3xl": "var(--app-radius-3xl)",
      },
      borderWidth: {
        DEFAULT: "var(--app-border-hairline)",
        0: "0",
        2: "var(--app-border-strong)",
      },
      fontFamily: {
        sans: ["system-ui", "Segoe UI", "PingFang SC", "Microsoft YaHei", "sans-serif"],
      },
    },
  },
  plugins: [],
};
