import type { ReactNode } from 'react';
import './card.css';

type CardProps = {
  /**
   * Optional title rendered in the card header. Strings are wrapped in an h3 for semantics,
   * while custom nodes are rendered as-is.
   */
  title?: ReactNode;
  /**
   * Optional content rendered inside the card footer.
   */
  footer?: ReactNode;
  /**
   * Main content of the card, rendered within the body section.
   */
  children: ReactNode;
  /**
   * Additional className applied to the card container.
   */
  className?: string;
};

export default function Card({ title, footer, children, className }: CardProps) {
  const hasHeader = title !== undefined && title !== null;
  const hasFooter = footer !== undefined && footer !== null;
  const classes = ['card', className].filter(Boolean).join(' ');

  return (
    <section className={classes}>
      {hasHeader ? (
        <header className="card__header">
          {typeof title === 'string' ? <h3 className="card__title">{title}</h3> : title}
        </header>
      ) : null}
      <div className="card__body">{children}</div>
      {hasFooter ? <footer className="card__footer">{footer}</footer> : null}
    </section>
  );
}
