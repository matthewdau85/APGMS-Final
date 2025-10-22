import type { PropsWithChildren, ReactNode } from 'react';
import styles from './AppShell.module.css';

type AppShellProps = PropsWithChildren<{
  title: string;
  description?: string;
  actions?: ReactNode;
}>;

export function AppShell({ title, description, actions, children }: AppShellProps) {
  return (
    <div className={styles.shell}>
      <div className={styles.inner}>
        <header className={styles.header}>
          <div>
            <h1 className={styles.title}>{title}</h1>
            {description ? <p className={styles.description}>{description}</p> : null}
          </div>
          {actions ? <div className={styles.actions}>{actions}</div> : null}
        </header>
        <main className={styles.main}>{children}</main>
      </div>
    </div>
  );
}
