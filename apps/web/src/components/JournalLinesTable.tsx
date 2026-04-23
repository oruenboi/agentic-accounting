import { formatCurrency } from '../lib/format';
import { Table, TableCell, TableRow } from './ui/Table';

export function JournalLinesTable({
  lines
}: {
  lines: Array<{
    id: string;
    lineNumber: number;
    accountCode: string | null;
    accountName: string | null;
    description: string | null;
    debit: string | number;
    credit: string | number;
  }>;
}) {
  return (
    <Table columns={['Line', 'Account', 'Description', 'Debit', 'Credit']}>
      {lines.map((line) => (
        <TableRow key={line.id}>
          <TableCell>{line.lineNumber}</TableCell>
          <TableCell>
            <div className="font-medium text-ink">{line.accountCode ?? '—'}</div>
            <div className="text-xs text-black/55">{line.accountName ?? 'Unknown account'}</div>
          </TableCell>
          <TableCell>{line.description ?? '—'}</TableCell>
          <TableCell>{formatCurrency(line.debit)}</TableCell>
          <TableCell>{formatCurrency(line.credit)}</TableCell>
        </TableRow>
      ))}
    </Table>
  );
}
