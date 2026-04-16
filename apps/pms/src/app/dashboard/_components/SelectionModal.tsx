"use client";

type SelectionModalItem = {
  id: string;
  label: string;
  description?: string;
};

type SelectionModalProps = {
  open: boolean;
  title: string;
  items: SelectionModalItem[];
  emptyMessage: string;
  onSelect: (id: string) => void;
  onClose: () => void;
};

const overlayClassName = "fixed inset-0 z-[1000] grid place-items-center bg-[rgba(9,18,31,0.45)] p-4";
const panelClassName = "grid max-h-[75vh] w-full max-w-[620px] gap-[0.75rem] overflow-auto rounded-xl border border-[#d9dfe7] bg-white p-4";

export function SelectionModal({ open, title, items, emptyMessage, onSelect, onClose }: SelectionModalProps) {
  if (!open) {
    return null;
  }

  return (
    <div className={overlayClassName} role="dialog" aria-modal="true" aria-label={title}>
      <section className={panelClassName}>
        <header className="flex items-center justify-between gap-3">
          <h3 className="m-0">{title}</h3>
          <button
            type="button"
            onClick={onClose}
            className="cursor-pointer rounded-lg border border-[#d2d6db] bg-white px-[0.55rem] py-[0.35rem]"
          >
            Fechar
          </button>
        </header>

        {items.length ? (
          <div className="grid gap-[0.55rem]">
            {items.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => onSelect(item.id)}
                className="cursor-pointer rounded-[10px] border border-[#d5dce7] bg-[#f9fbff] px-[0.75rem] py-[0.6rem] text-left"
              >
                <strong>{item.label}</strong>
                {item.description ? <p className="m-0 mt-[0.25rem] text-[#526070]">{item.description}</p> : null}
              </button>
            ))}
          </div>
        ) : (
          <p className="m-0 text-[#5f6b7a]">{emptyMessage}</p>
        )}
      </section>
    </div>
  );
}
