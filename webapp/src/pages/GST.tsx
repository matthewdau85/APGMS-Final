import { KeyboardEvent, useEffect, useMemo, useRef, useState } from 'react';
import './GST.css';

const columnLabels = [
  'Outlet 1',
  'Outlet 2',
  'Outlet 3',
  'Outlet 4',
  'Outlet 5',
  'Outlet 6',
  'Outlet 7'
];

const rowLabels = [
  'Week 1',
  'Week 2',
  'Week 3',
  'Week 4',
  'Week 5'
];

const heatmapValues: number[][] = [
  [2, 4, 7, 5, 9, 3, 1],
  [5, 6, 8, 7, 4, 2, 3],
  [3, 2, 4, 6, 8, 7, 5],
  [4, 5, 6, 8, 7, 5, 2],
  [1, 3, 5, 4, 6, 8, 9]
];

function getVarianceCategory(value: number) {
  if (value >= 7) return 'high';
  if (value >= 4) return 'medium';
  return 'low';
}

export default function GSTPage() {
  const [selectedRow, setSelectedRow] = useState(0);
  const [selectedCol, setSelectedCol] = useState(0);
  const [currentStep, setCurrentStep] = useState(0);

  const cellRefs = useRef<(HTMLDivElement | null)[][]>(
    heatmapValues.map((row) => row.map(() => null))
  );

  useEffect(() => {
    const cell = cellRefs.current[selectedRow]?.[selectedCol];
    cell?.focus();
  }, [selectedRow, selectedCol]);

  const steps = useMemo(
    () => [
      {
        title: 'Reconcile GST collected',
        description:
          'Validate point-of-sale GST totals against ledger postings for the reporting period.'
      },
      {
        title: 'Investigate transaction variance',
        description:
          'Drill into mismatched receipts and journals to confirm tax codes and adjustments.'
      },
      {
        title: 'Document resolution and adjustments',
        description:
          'Record findings, apply ledger corrections, and prepare the BAS reconciliation notes.'
      }
    ],
    []
  );

  const handleCellSelection = (rowIndex: number, colIndex: number) => {
    setSelectedRow(rowIndex);
    setSelectedCol(colIndex);
  };

  const handleCellKeyDown = (event: KeyboardEvent<HTMLDivElement>, rowIndex: number, colIndex: number) => {
    let newRow = rowIndex;
    let newCol = colIndex;

    switch (event.key) {
      case 'ArrowUp':
        event.preventDefault();
        newRow = Math.max(0, rowIndex - 1);
        break;
      case 'ArrowDown':
        event.preventDefault();
        newRow = Math.min(heatmapValues.length - 1, rowIndex + 1);
        break;
      case 'ArrowLeft':
        event.preventDefault();
        newCol = Math.max(0, colIndex - 1);
        break;
      case 'ArrowRight':
        event.preventDefault();
        newCol = Math.min(heatmapValues[0].length - 1, colIndex + 1);
        break;
      default:
        return;
    }

    handleCellSelection(newRow, newCol);
  };

  const goToStep = (index: number) => {
    setCurrentStep(index);
  };

  const goToNextStep = () => {
    setCurrentStep((prev) => Math.min(prev + 1, steps.length - 1));
  };

  const goToPreviousStep = () => {
    setCurrentStep((prev) => Math.max(prev - 1, 0));
  };

  return (
    <div className="gst-page">
      <header className="gst-page__header">
        <h1>GST variance reconciliation</h1>
        <p>
          Compare GST reported in your ledger with point-of-sale collections, quickly identify
          discrepancies, and track remediation progress for the Business Activity Statement (BAS).
        </p>
      </header>

      <section className="gst-card" aria-labelledby="gst-heatmap-heading">
        <div className="gst-card__header">
          <h2 id="gst-heatmap-heading">POS vs ledger heatmap</h2>
          <p>
            Navigate the grid to review weekly GST variances across key outlets. Use the arrow keys
            to move between cells and press tab to exit the grid.
          </p>
        </div>

        <div className="gst-heatmap" role="grid" aria-rowcount={rowLabels.length} aria-colcount={columnLabels.length}>
          <div className="gst-heatmap__columns" aria-hidden="true">
            <span className="gst-heatmap__corner" />
            {columnLabels.map((label) => (
              <span key={label}>{label}</span>
            ))}
          </div>
          {heatmapValues.map((row, rowIndex) => (
            <div className="gst-heatmap__row" role="row" key={rowLabels[rowIndex]} aria-label={rowLabels[rowIndex]}>
              <span className="gst-heatmap__row-label" role="rowheader">
                {rowLabels[rowIndex]}
              </span>
              {row.map((value, colIndex) => {
                const isSelected = selectedRow === rowIndex && selectedCol === colIndex;
                const category = getVarianceCategory(value);
                return (
                  <div
                    key={`${rowIndex}-${colIndex}`}
                    ref={(el) => {
                      cellRefs.current[rowIndex][colIndex] = el;
                    }}
                    role="gridcell"
                    tabIndex={isSelected ? 0 : -1}
                    aria-selected={isSelected}
                    aria-label={`${rowLabels[rowIndex]}, ${columnLabels[colIndex]}, variance ${value} basis points`}
                    className={`gst-heatmap__cell gst-heatmap__cell--${category}`}
                    onClick={() => handleCellSelection(rowIndex, colIndex)}
                    onKeyDown={(event) => handleCellKeyDown(event, rowIndex, colIndex)}
                  >
                    <span className="gst-heatmap__value">{value}</span>
                  </div>
                );
              })}
            </div>
          ))}
        </div>

        <div className="gst-heatmap__legend" aria-label="Heatmap legend">
          <h3>Legend</h3>
          <ul>
            <li>
              <span className="gst-heatmap__legend-swatch gst-heatmap__cell--low" aria-hidden="true" />
              <span>Low variance (0-3 basis points, dotted pattern)</span>
            </li>
            <li>
              <span className="gst-heatmap__legend-swatch gst-heatmap__cell--medium" aria-hidden="true" />
              <span>Moderate variance (4-6 basis points, striped pattern)</span>
            </li>
            <li>
              <span className="gst-heatmap__legend-swatch gst-heatmap__cell--high" aria-hidden="true" />
              <span>High variance (7+ basis points, checkered pattern)</span>
            </li>
          </ul>
        </div>
      </section>

      <section className="gst-card" aria-labelledby="gst-stepper-heading">
        <div className="gst-card__header">
          <h2 id="gst-stepper-heading">Resolve discrepancy workflow</h2>
          <p>Track resolution progress across key GST reconciliation tasks.</p>
        </div>

        <div className="gst-stepper" role="group" aria-labelledby="gst-stepper-heading">
          <div className="gst-stepper__status" aria-live="polite">
            {`Current step: ${steps[currentStep].title}`}
          </div>
          <ol className="gst-stepper__list">
            {steps.map((step, index) => (
              <li key={step.title} className="gst-stepper__item">
                <button
                  type="button"
                  className={`gst-stepper__trigger${index === currentStep ? ' gst-stepper__trigger--active' : ''}`}
                  aria-current={index === currentStep ? 'step' : undefined}
                  onClick={() => goToStep(index)}
                >
                  <span className="gst-stepper__label">Step {index + 1}</span>
                  <span className="gst-stepper__title">{step.title}</span>
                </button>
                {index === currentStep && (
                  <div className="gst-stepper__content">
                    <p>{step.description}</p>
                  </div>
                )}
              </li>
            ))}
          </ol>
          <div className="gst-stepper__controls">
            <button type="button" onClick={goToPreviousStep} disabled={currentStep === 0}>
              Previous
            </button>
            <button type="button" onClick={goToNextStep} disabled={currentStep === steps.length - 1}>
              Next
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}
