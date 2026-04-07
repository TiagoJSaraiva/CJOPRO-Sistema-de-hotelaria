type AdminTableProps = {
  title: string;
  description: string;
  columns: string[];
  rows: string[][];
};

export function AdminTable({ title, description, columns, rows }: AdminTableProps) {
  return (
    <section style={{ background: "#fff", border: "1px solid #e2e2e2", borderRadius: "12px", padding: "1rem" }}>
      <h2 style={{ marginTop: 0, marginBottom: "0.45rem" }}>{title}</h2>
      <p style={{ marginTop: 0, color: "#555" }}>{description}</p>

      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr>
              {columns.map((column) => (
                <th key={column} style={{ textAlign: "left", borderBottom: "1px solid #e7e7e7", padding: "0.6rem 0.4rem", fontSize: "0.9rem" }}>
                  {column}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.length ? (
              rows.map((row, index) => (
                <tr key={`row-${index}`}>
                  {row.map((cell, cellIndex) => (
                    <td key={`cell-${index}-${cellIndex}`} style={{ borderBottom: "1px solid #f1f1f1", padding: "0.6rem 0.4rem" }}>
                      {cell}
                    </td>
                  ))}
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={columns.length} style={{ padding: "0.9rem 0.4rem", color: "#666" }}>
                  Nenhum registro encontrado.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
