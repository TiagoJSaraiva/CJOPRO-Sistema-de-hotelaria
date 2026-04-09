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
    <section style={{ border: "1px solid #d7dce5", borderRadius: "10px", padding: "0.7rem", display: "grid", gap: "0.55rem" }}>
      <strong>{title}</strong>

      {items.length ? (
        <div style={{ display: "grid", gap: "0.45rem" }}>
          {items.map((item) => (
            <article
              key={item.id}
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                gap: "0.55rem",
                border: "1px solid #e4e8ef",
                borderRadius: "8px",
                padding: "0.45rem 0.55rem",
                background: "#fbfcff"
              }}
            >
              <div style={{ minWidth: 0 }}>
                <p style={{ margin: 0, fontWeight: 600 }}>{item.primary}</p>
                {item.secondary ? <p style={{ margin: "0.1rem 0 0", color: "#5c6876", fontSize: "0.92rem" }}>{item.secondary}</p> : null}
              </div>

              <button
                type="button"
                onClick={() => onRemove(item.id)}
                style={{ border: "1px solid #c83a3a", color: "#b00020", background: "#fff", borderRadius: "7px", padding: "0.22rem 0.5rem", cursor: "pointer" }}
                aria-label={`Remover ${item.primary}`}
              >
                X
              </button>
            </article>
          ))}
        </div>
      ) : (
        <p style={{ margin: 0, color: "#5e6976" }}>{emptyMessage}</p>
      )}

      <button
        type="button"
        onClick={onAdd}
        style={{ justifySelf: "start", border: "1px solid #186a5c", color: "#0f5d51", background: "#fff", borderRadius: "8px", padding: "0.42rem 0.65rem", cursor: "pointer" }}
      >
        {addLabel}
      </button>
    </section>
  );
}
