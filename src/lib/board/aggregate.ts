import { createBitrixClient } from "@/lib/bitrix/client";
import type {
  BoardFilters,
  BoardPayload,
  BoardTask,
  LogicalColumn,
  StageMapping,
  BitrixStage,
} from "@/lib/bitrix/types";
import {
  DEFAULT_LOGICAL_COLUMNS,
  DEFAULT_MOCK_MAPPING,
  PERSONAL_ENTITY_ID,
  PERSONAL_GROUP,
  resolveAppMode,
  stageMappingKey,
} from "@/lib/config";

function resolveColumnId(
  taskGroupId: number | null,
  stageId: number,
  mapping: StageMapping,
): string | null {
  const entityId = taskGroupId ?? PERSONAL_ENTITY_ID;
  const key = stageMappingKey(entityId, stageId);
  return mapping[key] ?? null;
}

function applySearch(tasks: BoardTask[], search: string): BoardTask[] {
  const q = search.trim().toLowerCase();
  if (!q) return tasks;
  return tasks.filter(
    (t) =>
      t.title.toLowerCase().includes(q) ||
      String(t.id).includes(q) ||
      t.groupName.toLowerCase().includes(q),
  );
}

export async function buildBoard(options: {
  filters: BoardFilters;
  mapping?: StageMapping | null;
  logicalColumns?: LogicalColumn[] | null;
}): Promise<BoardPayload> {
  const client = createBitrixClient();
  const mode = resolveAppMode();
  const logicalColumns = [...(options.logicalColumns ?? DEFAULT_LOGICAL_COLUMNS)].sort(
    (a, b) => a.order - b.order,
  );

  const mapping =
    options.mapping && Object.keys(options.mapping).length > 0
      ? options.mapping
      : mode === "mock"
        ? { ...DEFAULT_MOCK_MAPPING }
        : options.mapping ?? {};

  const errors: string[] = [];
  const warnings: string[] = [];

  let groups = await client.getGroups().catch((e: Error) => {
    errors.push(`sonet_group.get: ${e.message}`);
    return [];
  });

  const users = await client.getUsers().catch((e: Error) => {
    errors.push(`user.get: ${e.message}`);
    return [];
  });

  // пустой список = ещё не выбрано на клиенте → берём все доступные проекты
  const selectedGroupIds =
    options.filters.groupIds.length > 0
      ? options.filters.groupIds
      : groups.map((g) => g.id);

  // стадии выбранных проектов + мой план
  const entityIds = [
    ...selectedGroupIds,
    ...(options.filters.includePersonal ? [PERSONAL_ENTITY_ID] : []),
  ];

  const stages: BitrixStage[] = [];
  for (const entityId of entityIds) {
    try {
      const list = await client.getStages(entityId);
      stages.push(...list);
      warnings.push(`stages entityId=${entityId}: ${list.length}`);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      errors.push(`task.stages.get entityId=${entityId}: ${msg}`);
    }
  }

  const { tasks, errors: taskErrors, warnings: taskWarnings } = await client.getTasks({
    groupIds: selectedGroupIds,
    includePersonal: options.filters.includePersonal,
    responsibleId: options.filters.responsibleId,
  });
  errors.push(...taskErrors);
  warnings.push(...taskWarnings);

  if (options.filters.includePersonal) {
    groups = [...groups, PERSONAL_GROUP];
  }

  const groupNameById = new Map(groups.map((g) => [g.id, g.name]));
  const stageTitleByKey = new Map(
    stages.map((s) => [stageMappingKey(s.entityId, s.id), s.title]),
  );

  let boardTasks: BoardTask[] = tasks.map((t) => {
    const entityId = t.groupId ?? PERSONAL_ENTITY_ID;
    const columnId = resolveColumnId(t.groupId, t.stageId, mapping);
    return {
      ...t,
      groupName:
        t.groupId === null || t.groupId === 0
          ? PERSONAL_GROUP.name
          : groupNameById.get(t.groupId) ?? `Проект #${t.groupId}`,
      columnId,
      unmapped: columnId === null,
      stageTitle: stageTitleByKey.get(stageMappingKey(entityId, t.stageId)),
    };
  });

  boardTasks = applySearch(boardTasks, options.filters.search);

  const unmappedTasks = boardTasks.filter((t) => t.unmapped);
  const visible = boardTasks.filter((t) => !t.unmapped);

  const columns = logicalColumns.map((column) => ({
    column,
    tasks: visible
      .filter((t) => t.columnId === column.id)
      .sort((a, b) => a.id - b.id),
  }));

  return {
    columns,
    unmappedTasks,
    groups,
    users,
    stages,
    mapping,
    logicalColumns,
    diagnostics: {
      mode: client.mode,
      requestedGroupIds: selectedGroupIds,
      includePersonal: options.filters.includePersonal,
      tasksFetched: tasks.length,
      tasksVisible: visible.length,
      tasksUnmapped: unmappedTasks.length,
      errors,
      warnings,
      fetchedAt: new Date().toISOString(),
    },
  };
}

/** Найти stageId проекта для логической колонки (первый подходящий по маппингу) */
export function resolveTargetStageId(
  mapping: StageMapping,
  stages: BitrixStage[],
  groupId: number | null,
  targetColumnId: string,
): number | null {
  const entityId = groupId ?? PERSONAL_ENTITY_ID;
  const entityStages = stages.filter((s) => s.entityId === entityId);

  for (const stage of entityStages) {
    const key = stageMappingKey(entityId, stage.id);
    if (mapping[key] === targetColumnId) return stage.id;
  }

  // если маппинга нет — по порядку: индекс колонки ≈ индекс стадии
  return null;
}

export async function moveBoardTask(params: {
  taskId: number;
  groupId: number | null;
  targetColumnId: string;
  mapping: StageMapping;
}): Promise<{ ok: boolean; stageId?: number; error?: string }> {
  const client = createBitrixClient();
  const entityId = params.groupId ?? PERSONAL_ENTITY_ID;

  let stages: BitrixStage[] = [];
  try {
    stages = await client.getStages(entityId);
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : String(e),
    };
  }

  const stageId = resolveTargetStageId(
    params.mapping,
    stages,
    params.groupId,
    params.targetColumnId,
  );

  if (stageId === null) {
    return {
      ok: false,
      error: `Нет стадии проекта (entityId=${entityId}) для колонки «${params.targetColumnId}». Настройте маппинг.`,
    };
  }

  try {
    const can = await client.canMoveTask(params.taskId, stageId);
    if (!can) {
      return { ok: false, error: "Недостаточно прав для переноса (canmovetask)." };
    }
    await client.moveTask(params.taskId, stageId);
    return { ok: true, stageId };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : String(e),
    };
  }
}
