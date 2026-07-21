import { useState } from "react";
import { QuoteTemplateBuilderPanel } from "./QuoteTemplateBuilderPanel";
import { QuoteTemplateGalleryPanel } from "./QuoteTemplateGalleryPanel";

/** 模板搭建：先模板库首页，点选后再进入块编辑器 */
export function QuoteTemplateBuilderShell() {
  const [view, setView] = useState<"gallery" | "editor">("gallery");
  const [editorTemplateId, setEditorTemplateId] = useState<string | null>(null);

  if (view === "gallery") {
    return (
      <QuoteTemplateGalleryPanel
        onEnterEditor={(id) => {
          setEditorTemplateId(id);
          setView("editor");
        }}
      />
    );
  }

  return (
    <QuoteTemplateBuilderPanel
      entryTemplateId={editorTemplateId}
      onBackToGallery={() => {
        setView("gallery");
        setEditorTemplateId(null);
      }}
    />
  );
}
