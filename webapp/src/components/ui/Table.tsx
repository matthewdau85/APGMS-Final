import type {
  HTMLAttributes,
  TableHTMLAttributes,
  ThHTMLAttributes,
  TdHTMLAttributes,
} from 'react';
import './table.css';

type TableProps = TableHTMLAttributes<HTMLTableElement> & {
  /** Enables sticky table header styling when true. */
  stickyHeader?: boolean;
};

type TSectionProps<T> = HTMLAttributes<T> & { className?: string };

type TableHeaderCellProps = ThHTMLAttributes<HTMLTableCellElement> & { className?: string };
type TableDataCellProps = TdHTMLAttributes<HTMLTableCellElement> & { className?: string };

function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(' ');
}

export function Table({ className, stickyHeader = false, children, ...rest }: TableProps) {
  const wrapperClass = cx('table__wrapper', stickyHeader && 'table__wrapper--sticky');
  const tableClass = cx('table', className, stickyHeader && 'table--sticky');

  return (
    <div className={wrapperClass}>
      <table className={tableClass} {...rest}>
        {children}
      </table>
    </div>
  );
}

export function THead({ className, ...rest }: TSectionProps<HTMLTableSectionElement>) {
  return <thead className={cx('table__head', className)} {...rest} />;
}

export function TBody({ className, ...rest }: TSectionProps<HTMLTableSectionElement>) {
  return <tbody className={cx('table__body', className)} {...rest} />;
}

export function Th({ className, ...rest }: TableHeaderCellProps) {
  return <th className={cx('table__cell', 'table__cell--head', className)} {...rest} />;
}

export function Td({ className, ...rest }: TableDataCellProps) {
  return <td className={cx('table__cell', className)} {...rest} />;
}

export default Table;
