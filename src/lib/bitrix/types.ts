/** Типы сущностей Bitrix24 и внутренней модели доски */

export type BitrixId = number | string;

export interface BitrixUser {
  id: number;
  name: string;
  lastName?: string;
  avatar?: string;
}

export interface BitrixGroup {
  id: number;
  name: string;
  /** true — виртуальная зона «без проекта» / Мой план */
  isPersonal?: boolean;
}

export interface BitrixStage {
  id: number;
  title: string;
  sort: number;
  color?: string;
  /** GROUP_ID проекта или 0 для «Мой план» */
  entityId: number;
}

export interface BitrixTask {
  id: number;
  title: string;
  description?: string;
  /** null/0 — задача без проекта (личная) */
  groupId: number | null;
  stageId: number;
  responsibleId: number;
  responsibleName?: string;
  createdBy?: number;
  deadline?: string | null;
  priority?: number;
  status?: number;
}

/** Логическая колонка сводной доски */
export interface LogicalColumn {
  id: string;
  title: string;
  order: number;
}

/**
 * Маппинг: стадия исходного проекта → логическая колонка.
 * Ключ: `${entityId}:${stageId}` (entityId=0 для «Мой план»).
 */
export type StageMapping = Record<string, string>;

export interface BoardFilters {
  groupIds: number[];
  includePersonal: boolean;
  responsibleId: number | null;
  search: string;
}

export interface BoardTask extends BitrixTask {
  groupName: string;
  columnId: string | null;
  /** true если стадия не замаплена — задача «пропала» с колонок */
  unmapped: boolean;
  stageTitle?: string;
}

export interface BoardColumnView {
  column: LogicalColumn;
  tasks: BoardTask[];
}

export interface BoardDiagnostics {
  mode: "mock" | "webhook" | "oauth";
  requestedGroupIds: number[];
  includePersonal: boolean;
  tasksFetched: number;
  tasksVisible: number;
  tasksUnmapped: number;
  errors: string[];
  warnings: string[];
  fetchedAt: string;
}

export interface BoardPayload {
  columns: BoardColumnView[];
  unmappedTasks: BoardTask[];
  groups: BitrixGroup[];
  users: BitrixUser[];
  stages: BitrixStage[];
  mapping: StageMapping;
  logicalColumns: LogicalColumn[];
  diagnostics: BoardDiagnostics;
}

export interface MoveTaskRequest {
  taskId: number;
  /** GROUP_ID задачи (0 для личных / Мой план) */
  groupId: number;
  targetStageId: number;
  /** Логическая колонка назначения (для mock / UI) */
  targetColumnId: string;
}

export interface BitrixRestError {
  error: string;
  error_description?: string;
}

export interface BitrixListResponse<T> {
  result: T;
  total?: number;
  next?: number;
  time?: unknown;
  error?: string;
  error_description?: string;
}
