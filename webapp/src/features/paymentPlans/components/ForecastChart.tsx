import React from "react";
import { useCaptureForecastMutation, useListForecastsQuery } from "../api";

type Props = { orgId: string };

export function ForecastChart({ orgId }: Props) {
  const { data: snapshots, isLoading } = useListForecastsQuery({ orgId });
  const [captureForecast, { isLoading: isCapturing }] = useCaptureForecastMutation();

  const points = snapshots?.slice().reverse() ?? [];

  return (
    <div className="forecast-card">
      <div className="forecast-card__header">
        <h3>Forecast snapshots</h3>
        <button onClick={() => captureForecast({ orgId })} disabled={isCapturing}>
          {isCapturing ? "Capturing…" : "Capture snapshot"}
        </button>
      </div>
      {isLoading && <p className="info">Loading forecast history…</p>}
      {!isLoading && points.length === 0 && <p className="info">No snapshots captured yet.</p>}
      {!isLoading && points.length > 0 && (
        <svg width="100%" height="180" role="img" aria-label="Forecast trend">
          {points.map((point, index) => {
            const x = (index / (points.length - 1 || 1)) * 100;
            const paygwHeight = point.paygwForecast / 1000;
            const gstHeight = point.gstForecast / 1000;
            return (
              <g key={point.id}>
                <circle cx={`${x}%`} cy={180 - paygwHeight} r={4} fill="#0f62fe" />
                <circle cx={`${x}%`} cy={180 - gstHeight} r={4} fill="#42be65" />
              </g>
            );
          })}
        </svg>
      )}
    </div>
  );
}
