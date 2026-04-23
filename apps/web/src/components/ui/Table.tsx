import type { ReactNode } from 'react';

export function Table({
  columns,
  children
}: {
  columns: string[];
  children: ReactNode;
}) {
  return (
    <div className="overflow-hidden rounded-3xl border border-black/8 bg-white/70 shadow-panel">
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-black/6 text-left text-sm">
          <thead className="bg-black/[0.03]">
            <tr>
              {columns.map((column) => (
                <th key={column} className="px-4 py-3 font-medium text-black/65">
                  {column}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-black/6">{children}</tbody>
        </table>
      </div>
    </div>
  );
}

export function TableRow({ children }: { children: ReactNode }) {
  return <tr className="hover:bg-black/[0.02]">{children}</tr>;
}

export function TableCell({ children, className }: { children: ReactNode; className?: string }) {
  return <td className={`px-4 py-3 align-top ${className ?? ''}`}>{children}</td>;
}
