# Forecasting snapshots

The predictive engine now persists its outputs so operations teams can reference how shortfall projections evolved over time.

## Data model

* `ForecastSnapshot` stores PAYGW and GST forecasts along with the smoothing parameters and trend metadata.
* Snapshots are linked to an organisation and are indexed by `snapshotDate` to support compliance evidence queries.

## API usage

```
POST /forecasting/snapshots { orgId, lookback?, alpha? }
GET  /forecasting/snapshots?orgId=...
GET  /forecasting/snapshots/latest?orgId=...
```

Use the POST endpoint to capture a new snapshot prior to BAS lodgment. Each call stores a record that the front-end can visualise to explain changes in exposure.

## Front-end

The `/payment-plans` page renders the snapshot series as a lightweight sparkline and lets users issue new requests or approve existing plans in the same view.
