/** html2canvas 导出前：保持标签紧凑宽度，并修正文字垂直度量。 */
export function patchMapLabelsForHtml2Canvas(root: HTMLElement) {
  root.querySelectorAll<HTMLElement>("[data-map-label-pill]").forEach((pill) => {
    const fs =
      parseFloat(pill.style.fontSize) || parseFloat(getComputedStyle(pill).fontSize) || 10;
    const maxW = getComputedStyle(pill).maxWidth;
    pill.style.display = "inline-flex";
    pill.style.alignItems = "center";
    pill.style.width = "max-content";
    pill.style.maxWidth = maxW;
    pill.style.height = "auto";
    pill.style.lineHeight = "normal";
    pill.style.boxSizing = "border-box";

    pill.querySelectorAll<HTMLElement>("[data-map-label-pill-text]").forEach((row) => {
      row.style.display = "inline-flex";
      row.style.alignItems = "center";
      row.style.lineHeight = `${fs}px`;
      row.style.maxWidth = maxW;
    });

    pill.querySelectorAll<HTMLElement>("[data-map-label-pill-title]").forEach((title) => {
      title.style.display = "inline-block";
      title.style.lineHeight = `${fs}px`;
      title.style.verticalAlign = "middle";
      title.style.padding = "0";
      title.style.margin = "0";
    });
  });

  root.querySelectorAll<HTMLElement>("[data-map-marker-panel]").forEach((panel) => {
    panel.style.display = "none";
  });
}
