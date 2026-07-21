import { useState } from "react";
import { useT } from "../i18n/useT";

type AddCategoryFolderFooterProps = {
  onAdd: (nameZh: string, nameEn?: string) => void;
  onOpenCategoryLibrary?: () => void;
};

export function AddCategoryFolderFooter({ onAdd, onOpenCategoryLibrary }: AddCategoryFolderFooterProps) {
  const t = useT();
  const [zh, setZh] = useState("");
  const [en, setEn] = useState("");

  return (
    <div className="shrink-0 border-t border-app-line-subtle p-2">
      <div className="flex flex-col gap-1.5">
        <input
          value={en}
          onChange={(e) => setEn(e.target.value)}
          placeholder={t("mat.phNameEn")}
          className="w-full rounded border border-app-input-border bg-app-input-bg px-2 py-1 text-xs"
        />
        <input
          value={zh}
          onChange={(e) => setZh(e.target.value)}
          placeholder={t("mat.phNameZh")}
          className="w-full rounded border border-app-input-border bg-app-input-bg px-2 py-1 text-xs"
        />
        <button
          type="button"
          className="ui-toolBtn rounded border border-app-line-mid bg-app-surface/30 py-1.5 text-xs text-app-text"
          onClick={() => {
            const en0 = en.trim();
            const zh0 = zh.trim();
            if (!en0 && !zh0) return;
            if (zh0) {
              onAdd(zh0, en0 || undefined);
            } else {
              onAdd(en0, undefined);
            }
            setZh("");
            setEn("");
          }}
        >
          {t("mat.addCat")}
        </button>
        {onOpenCategoryLibrary ? (
          <button
            type="button"
            className="text-center text-xs font-medium text-app-link hover:underline"
            onClick={onOpenCategoryLibrary}
          >
            {t("mat.openCategoryLibrary")}
          </button>
        ) : null}
      </div>
    </div>
  );
}
