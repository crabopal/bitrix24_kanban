import type { LogicalColumn, StageMapping } from "@/lib/bitrix/types";
import { DEFAULT_LOGICAL_COLUMNS, DEFAULT_MOCK_MAPPING } from "@/lib/config";

const MAPPING_KEY = "mpk_stage_mapping";
const COLUMNS_KEY = "mpk_logical_columns";
const FILTERS_KEY = "mpk_filters";

export interface StoredFilters {
  groupIds: number[];
  includePersonal: boolean;
  responsibleId: number | null;
  search: string;
}

export function loadMapping(): StageMapping {
  if (typeof window === "undefined") return { ...DEFAULT_MOCK_MAPPING };
  try {
    const raw = localStorage.getItem(MAPPING_KEY);
    if (!raw) return { ...DEFAULT_MOCK_MAPPING };
    return JSON.parse(raw) as StageMapping;
  } catch {
    return { ...DEFAULT_MOCK_MAPPING };
  }
}

export function saveMapping(mapping: StageMapping): void {
  localStorage.setItem(MAPPING_KEY, JSON.stringify(mapping));
}

export function loadLogicalColumns(): LogicalColumn[] {
  if (typeof window === "undefined") return [...DEFAULT_LOGICAL_COLUMNS];
  try {
    const raw = localStorage.getItem(COLUMNS_KEY);
    if (!raw) return [...DEFAULT_LOGICAL_COLUMNS];
    return JSON.parse(raw) as LogicalColumn[];
  } catch {
    return [...DEFAULT_LOGICAL_COLUMNS];
  }
}

export function saveLogicalColumns(columns: LogicalColumn[]): void {
  localStorage.setItem(COLUMNS_KEY, JSON.stringify(columns));
}

export function loadFilters(): StoredFilters {
  const defaults: StoredFilters = {
    groupIds: [],
    includePersonal: true,
    responsibleId: null,
    search: "",
  };
  if (typeof window === "undefined") return defaults;
  try {
    const raw = localStorage.getItem(FILTERS_KEY);
    if (!raw) return defaults;
    return { ...defaults, ...(JSON.parse(raw) as StoredFilters) };
  } catch {
    return defaults;
  }
}

export function saveFilters(filters: StoredFilters): void {
  localStorage.setItem(FILTERS_KEY, JSON.stringify(filters));
}
