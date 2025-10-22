import { useSyncExternalStore } from 'react';

export type PartialState<TState> = TState | Partial<TState> | undefined;
export type StateCreator<TState> = (
  setState: SetState<TState>,
  getState: GetState<TState>
) => TState;
export type SetState<TState> = (
  partial: PartialState<TState> | ((state: TState) => PartialState<TState>),
  replace?: boolean
) => void;
export type GetState<TState> = () => TState;
export type StoreApi<TState> = {
  getState: GetState<TState>;
  setState: SetState<TState>;
  subscribe: (listener: () => void) => () => void;
};

type Selector<TState, TSelected> = (state: TState) => TSelected;

type UseStore<TState> = {
  <TSelected = TState>(selector?: Selector<TState, TSelected>): TSelected;
} & StoreApi<TState>;

export function create<TState>(createState: StateCreator<TState>): UseStore<TState> {
  let state: TState;
  const listeners = new Set<() => void>();

  const getState: GetState<TState> = () => state;

  const setState: SetState<TState> = (partial, replace = false) => {
    const partialState =
      typeof partial === 'function'
        ? (partial as (state: TState) => PartialState<TState>)(state)
        : partial;

    if (partialState === undefined || partialState === null) {
      return;
    }

    const nextState = replace
      ? (partialState as TState)
      : Object.assign({}, state, partialState);

    if (Object.is(nextState, state)) {
      return;
    }

    state = nextState;
    listeners.forEach((listener) => listener());
  };

  const subscribe = (listener: () => void) => {
    listeners.add(listener);
    return () => listeners.delete(listener);
  };

  state = createState(setState, getState);

  const useStore = (<TSelected = TState>(
    selector: Selector<TState, TSelected> = ((s: TState) => s as TSelected)
  ) => useSyncExternalStore(subscribe, () => selector(state), () => selector(state))) as UseStore<TState>;

  useStore.getState = getState;
  useStore.setState = setState;
  useStore.subscribe = subscribe;

  return useStore;
}
