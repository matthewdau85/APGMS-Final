import { configureStore } from "@reduxjs/toolkit";
import { setupListeners } from "@reduxjs/toolkit/query";
import { paymentPlansApi } from "./features/paymentPlans/api";

export const store = configureStore({
  reducer: {
    [paymentPlansApi.reducerPath]: paymentPlansApi.reducer,
  },
  middleware: (getDefault) => getDefault().concat(paymentPlansApi.middleware),
});

setupListeners(store.dispatch);

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
