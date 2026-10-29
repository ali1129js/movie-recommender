import { genreBit } from './genres';
import type { Filters, Mode, SortKey } from './recommender';

export const MAX_PICKS = 10;
export const PAGE_SIZE = 12;

export interface AppState {
  /** Picked film indices, in the order chosen. */
  readonly picks: readonly number[];
  readonly filters: Filters;
  readonly mode: Mode;
  readonly sort: SortKey;
  readonly limit: number;
}

export const initialState: AppState = {
  picks: [],
  filters: { genreMask: 0, decade: null },
  mode: 'popular',
  sort: 'relevance',
  limit: PAGE_SIZE,
};

export type Action =
  | { type: 'pick'; index: number }
  | { type: 'unpick'; index: number }
  | { type: 'clear' }
  | { type: 'toggleGenre'; genre: string }
  | { type: 'clearGenres' }
  | { type: 'setDecade'; decade: number | null }
  | { type: 'setMode'; mode: Mode }
  | { type: 'setSort'; sort: SortKey }
  | { type: 'more' }
  | { type: 'replacePicks'; picks: readonly number[] };

/** Pure reducer: always returns new objects and never mutates `state` (the old app used splice). */
export function reducer(state: AppState, action: Action): AppState {
  switch (action.type) {
    case 'pick':
      if (state.picks.includes(action.index) || state.picks.length >= MAX_PICKS) return state;
      return { ...state, picks: [...state.picks, action.index], limit: PAGE_SIZE };
    case 'unpick':
      return { ...state, picks: state.picks.filter((i) => i !== action.index), limit: PAGE_SIZE };
    case 'clear':
      return { ...state, picks: [], limit: PAGE_SIZE };
    case 'replacePicks':
      return { ...state, picks: [...new Set(action.picks)].slice(0, MAX_PICKS), limit: PAGE_SIZE };
    case 'toggleGenre': {
      const bit = genreBit(action.genre);
      if (bit === 0) return state;
      return { ...state, filters: { ...state.filters, genreMask: state.filters.genreMask ^ bit }, limit: PAGE_SIZE };
    }
    case 'clearGenres':
      return { ...state, filters: { ...state.filters, genreMask: 0 }, limit: PAGE_SIZE };
    case 'setDecade':
      return { ...state, filters: { ...state.filters, decade: action.decade }, limit: PAGE_SIZE };
    case 'setMode':
      return { ...state, mode: action.mode, limit: PAGE_SIZE };
    case 'setSort':
      return { ...state, sort: action.sort };
    case 'more':
      return { ...state, limit: state.limit + PAGE_SIZE };
  }
}
