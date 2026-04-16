"use client";

type RelationListItem = {
  id: string;
  primary: string;
  secondary?: string;
};

type RelationListEditorProps = {
  title: string;
  addLabel: string;
  emptyMessage: string;
  items: RelationListItem[];
  onAdd: () => void;
  onRemove: (id: string) => void;
};

export function RelationListEditor({ title, addLabel, emptyMessage, items, onAdd, onRemove }: RelationListEditorProps) {
  return (
    <section className="grid gap-[0.55rem] rounded-[10px] border border-[#d7dce5] p-[0.7rem]">
      <strong>{title}</strong>

      {items.length ? (
        <div className="grid gap-[0.45rem]">
          {items.map((item) => (
            <article
              key={item.id}
              className="flex items-center justify-between gap-[0.55rem] rounded-lg border border-[#e4e8ef] bg-[#fbfcff] px-[0.55rem] py-[0.45rem]"
            >
              <div className="min-w-0">
                <p className="m-0 font-semibold">{item.primary}</p>
                {item.secondary ? <p className="m-0 mt-[0.1rem] text-[0.92rem] text-[#5c6876]">{item.secondary}</p> : null}
              </div>

              <button
                type="button"
                onClick={() => onRemove(item.id)}
                className="cursor-pointer rounded-[7px] border border-[#c83a3a] bg-white px-[0.5rem] py-[0.22rem] text-[#b00020]"
                aria-label={`Remover ${item.primary}`}
              >
                X
              </button>
            </article>
          ))}
        </div>
      ) : (
        <p className="m-0 text-[#5e6976]">{emptyMessage}</p>
      )}

      <button
        type="button"
        onClick={onAdd}
        className="justify-self-start rounded-lg border border-[#186a5c] bg-white px-[0.65rem] py-[0.42rem] text-[#0f5d51]"
      >
        {addLabel}
      </button>
    </section>
  );
}
