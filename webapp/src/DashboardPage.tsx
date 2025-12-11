// src/pages/DashboardPage.tsx
import React from "react";

const DashboardPage: React.FC = () => {
  return (
    <main className="dashboard-page">
      <header className="dashboard-header">
        <h1>APGMS Dashboard</h1>
        <p>
          High-level overview of your PAYGW &amp; GST buffers, cashflow, and
          designated one-way accounts.
        </p>
      </header>

      <section className="dashboard-section">
        <h2>Next steps</h2>
        <ul>
          <li>Replace this placeholder with your real dashboard layout.</li>
          <li>Wire in your API client and data visualisations here.</li>
          <li>
            Keep this file as the single canonical dashboard entry point for
            routing.
          </li>
        </ul>
      </section>
    </main>
  );
};

export default DashboardPage;
