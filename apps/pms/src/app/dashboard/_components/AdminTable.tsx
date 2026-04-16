type AdminTableProps = {
  title: string;
  description: string;
  columns: string[];
  rows: string[][];
};

export function AdminTable({ title, description, columns, rows }: AdminTableProps) {
  return (
    <section className="pms-surface-card">
      <h2 className="pms-panel-title">{title}</h2>
      <p className="pms-panel-description">{description}</p>

      <div className="overflow-x-auto">
        <table className="w-full border-collapse">
          <thead>
            <tr>
              {columns.map((column) => (
                <th key={column} className="border-b border-[#e7e7e7] px-[0.4rem] py-[0.6rem] text-left text-[0.9rem]">
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
                    <td key={`cell-${index}-${cellIndex}`} className="border-b border-[#f1f1f1] px-[0.4rem] py-[0.6rem]">
                      {cell}
                    </td>
                  ))}
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={columns.length} className="px-[0.4rem] py-[0.9rem] text-[#666]">
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
