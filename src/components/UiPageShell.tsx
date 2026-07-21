import type { ReactNode } from "react";

export type UiPageShellProps = {
  /** 主舞台内单子面板撑满（企业库、定制方案） */
  fillStage?: boolean;
  /** 舞台内整体纵向滚动（设置、库存） */
  scrollBody?: boolean;
  /**  tighter page padding / gap */
  compact?: boolean;
  /** 不渲染标题区（定制方案等自管顶栏时） */
  hideHead?: boolean;
  /** 顶栏左右块纵向对齐：ERP 大号模块按钮用 center 更齐 */
  headAlign?: "start" | "center";
  kicker?: ReactNode;
  title?: ReactNode;
  sub?: ReactNode;
  headActions?: ReactNode;
  /** 主 Tab 等：放在 ui-stage 之上 */
  beforeStage?: ReactNode;
  children: ReactNode;
};

/**
 * 全应用统一页面壳：与 Enterprise 相同的玻璃层级、间距与舞台卡片。
 */
export function UiPageShell(props: UiPageShellProps) {
  const {
    fillStage = false,
    scrollBody = false,
    compact = false,
    hideHead = false,
    headAlign = "start",
    kicker,
    title,
    sub,
    headActions,
    beforeStage,
    children,
  } = props;
  const showHead = !hideHead && (kicker || title || sub || headActions);
  return (
    <div
      className={`ui-page${scrollBody ? " ui-page--scroll" : ""}${compact ? " ui-page--compact" : ""}`}
    >
      <div className="ui-page-bg" aria-hidden />
      <div className="ui-page-inner">
        {showHead ? (
          <header className={`ui-page-head${headAlign === "center" ? " ui-page-head--alignCenter" : ""}`}>
            <div className="min-w-0">
              {kicker ? <div className="ui-page-kicker">{kicker}</div> : null}
              {title ? <h2 className="ui-page-title">{title}</h2> : null}
              {sub ? <p className="ui-page-sub">{sub}</p> : null}
            </div>
            {headActions ? <div className="ui-page-headActions">{headActions}</div> : null}
          </header>
        ) : null}
        {beforeStage}
        <div className="ui-stage">
          <div className={`ui-stageInner${fillStage ? " ui-stageInner--fill" : ""}`}>{children}</div>
        </div>
      </div>
    </div>
  );
}
