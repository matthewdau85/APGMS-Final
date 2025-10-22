import React from "react";

type SortDirection = "asc" | "desc";

export interface DataTableColumn<T> {
  key: keyof T;
  header: React.ReactNode;
  sortable?: boolean;
  align?: "left" | "center" | "right";
  width?: string;
  render?: (row: T) => React.ReactNode;
}

export interface DataTableProps<T> {
  columns: DataTableColumn<T>[];
  data: T[];
  initialSort?: {
    key: keyof T;
    direction?: SortDirection;
  };
  emptyState?: React.ReactNode;
}

export function DataTable<T>({
  columns,
  data,
  initialSort,
  emptyState,
}: DataTableProps<T>) {
  const [sortKey, setSortKey] = React.useState<keyof T | undefined>(
    initialSort?.key,
  );
  const [direction, setDirection] = React.useState<SortDirection>(
    initialSort?.direction ?? "asc",
  );

  const sortedData = React.useMemo(() => {
    if (!sortKey) {
      return data;
    }

    const sorted = [...data].sort((a, b) => {
      const aValue = a[sortKey];
      const bValue = b[sortKey];

      if (aValue === bValue) {
        return 0;
      }

      if (aValue == null) {
        return -1;
      }

      if (bValue == null) {
        return 1;
      }

      if (typeof aValue === "number" && typeof bValue === "number") {
        return aValue - bValue;
      }

      return String(aValue).localeCompare(String(bValue));
    });

    return direction === "asc" ? sorted : sorted.reverse();
  }, [data, sortKey, direction]);

  const handleSort = (key: keyof T, sortable?: boolean) => {
    if (!sortable) return;

    if (sortKey === key) {
      setDirection((prev) => (prev === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setDirection("asc");
    }
  };

  return (
    <div className="w-full overflow-hidden rounded-xl border border-slate-200">
      <table className="min-w-full divide-y divide-slate-200 text-sm">
        <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
          <tr>
            {columns.map((column) => {
              const isActive = column.sortable && column.key === sortKey;
              return (
                <th
                  key={String(column.key)}
                  scope="col"
                  style={{ width: column.width }}
                  className={`px-3 py-2 font-semibold ${
                    column.align === "center"
                      ? "text-center"
                      : column.align === "right"
                        ? "text-right"
                        : "text-left"
                  } ${column.sortable ? "cursor-pointer select-none" : ""}`}
                  onClick={() => handleSort(column.key, column.sortable)}
                >
                  <span className="inline-flex items-center gap-1">
                    {column.header}
                    {isActive ? (
                      <span aria-hidden className="text-slate-400">
                        {direction === "asc" ? "▲" : "▼"}
                      </span>
                    ) : column.sortable ? (
                      <span aria-hidden className="text-slate-300">⇅</span>
                    ) : null}
                  </span>
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-200 bg-white">
          {sortedData.length === 0 ? (
            <tr>
              <td
                colSpan={columns.length}
                className="px-4 py-6 text-center text-sm text-slate-500"
              >
                {emptyState ?? "No data available"}
              </td>
            </tr>
          ) : (
            sortedData.map((row, rowIndex) => (
              <tr key={rowIndex} className="hover:bg-slate-50">
                {columns.map((column) => {
                  const cellValue = row[column.key];
                  return (
                    <td
                      key={String(column.key)}
                      className={`px-3 py-2 ${
                        column.align === "center"
                          ? "text-center"
                          : column.align === "right"
                            ? "text-right"
                            : "text-left"
                      } text-slate-700`}
                    >
                      {column.render
                        ? column.render(row)
                        : ((cellValue ?? "—") as React.ReactNode)}
                    </td>
                  );
                })}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}

export default DataTable;
