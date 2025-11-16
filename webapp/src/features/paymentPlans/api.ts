import { createApi, fetchBaseQuery } from "@reduxjs/toolkit/query/react";

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:3001";

export type PaymentPlan = {
  id: string;
  basCycleId: string;
  requestedAt: string;
  reason: string;
  status: string;
  resolvedAt: string | null;
  details: Record<string, unknown>;
};

export type ForecastSnapshot = {
  id: string;
  snapshotDate: string;
  paygwForecast: number;
  gstForecast: number;
  method: string;
  metadata: Record<string, unknown> | null;
};

export const paymentPlansApi = createApi({
  reducerPath: "paymentPlansApi",
  baseQuery: fetchBaseQuery({
    baseUrl: API_BASE,
    prepareHeaders: (headers) => {
      headers.set("Content-Type", "application/json");
      return headers;
    },
  }),
  tagTypes: ["PaymentPlan", "Forecast"],
  endpoints: (builder) => ({
    listPlans: builder.query<PaymentPlan[], { orgId: string }>({
      query: ({ orgId }) => ({ url: `/payment-plans`, params: { orgId } }),
      transformResponse: (response: { plans: PaymentPlan[] }) => response.plans,
      providesTags: (result) =>
        result
          ? [
              ...result.map((plan) => ({ type: "PaymentPlan" as const, id: plan.id })),
              { type: "PaymentPlan" as const, id: "LIST" },
            ]
          : [{ type: "PaymentPlan" as const, id: "LIST" }],
    }),
    createPlan: builder.mutation<PaymentPlan, Partial<PaymentPlan> & { orgId: string; basCycleId: string; weeklyAmount: number; startDate: string; reason: string }>({
      query: (body) => ({ url: `/payment-plans`, method: "POST", body }),
      invalidatesTags: [{ type: "PaymentPlan", id: "LIST" }],
      transformResponse: (response: { plan: PaymentPlan }) => response.plan,
    }),
    updatePlanStatus: builder.mutation<PaymentPlan, { id: string; status: "APPROVED" | "REJECTED" | "CANCELLED"; metadata?: Record<string, unknown> }>({
      query: ({ id, ...body }) => ({ url: `/payment-plans/${id}/status`, method: "POST", body }),
      invalidatesTags: (result, error, arg) => [{ type: "PaymentPlan", id: arg.id }],
      transformResponse: (response: { plan: PaymentPlan }) => response.plan,
    }),
    listForecasts: builder.query<ForecastSnapshot[], { orgId: string }>({
      query: ({ orgId }) => ({ url: `/forecasting/snapshots`, params: { orgId } }),
      transformResponse: (response: { snapshots: ForecastSnapshot[] }) => response.snapshots,
      providesTags: [{ type: "Forecast", id: "LIST" }],
    }),
    captureForecast: builder.mutation<{ snapshot: ForecastSnapshot }, { orgId: string; lookback?: number; alpha?: number; method?: string }>({
      query: (body) => ({ url: `/forecasting/snapshots`, method: "POST", body }),
      invalidatesTags: [{ type: "Forecast", id: "LIST" }],
    }),
  }),
});

export const {
  useListPlansQuery,
  useCreatePlanMutation,
  useUpdatePlanStatusMutation,
  useListForecastsQuery,
  useCaptureForecastMutation,
} = paymentPlansApi;
