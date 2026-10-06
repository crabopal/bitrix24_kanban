import {
  getMockGroups,
  getMockStages,
  getMockTasks,
  getMockUsers,
  mockMoveTask,
} from "@/lib/bitrix/mock";
import type {
  BitrixGroup,
  BitrixListResponse,
  BitrixStage,
  BitrixTask,
  BitrixUser,
} from "@/lib/bitrix/types";
import { getWebhookUrl, PERSONAL_ENTITY_ID, resolveAppMode } from "@/lib/config";

export class BitrixApiError extends Error {
  constructor(
    message: string,
    public readonly method: string,
    public readonly details?: string,
  ) {
    super(message);
    this.name = "BitrixApiError";
  }
}

type RestParams = Record<string, unknown>;

function asNumber(value: unknown, fallback = 0): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function userDisplayName(user: Record<string, unknown>): string {
  const name = String(user.NAME ?? user.name ?? "").trim();
  const last = String(user.LAST_NAME ?? user.lastName ?? "").trim();
  return [name, last].filter(Boolean).join(" ") || `User #${user.ID ?? "?"}`;
}

async function callWebhook<T>(
  method: string,
  params: RestParams = {},
): Promise<T> {
  const base = getWebhookUrl();
  if (!base) {
    throw new BitrixApiError("BITRIX_WEBHOOK_URL не задан", method);
  }

  const url = `${base}${method}.json`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(params),
    cache: "no-store",
  });

  const data = (await res.json()) as BitrixListResponse<T> & {
    error?: string;
    error_description?: string;
  };

  if (!res.ok || data.error) {
    throw new BitrixApiError(
      data.error_description || data.error || `HTTP ${res.status}`,
      method,
      JSON.stringify(data),
    );
  }

  return data.result;
}

/** Постраничная выборка Bitrix list-методов */
async function callWebhookList<T>(
  method: string,
  params: RestParams = {},
): Promise<T[]> {
  const base = getWebhookUrl();
  if (!base) {
    throw new BitrixApiError("BITRIX_WEBHOOK_URL не задан", method);
  }

  const items: T[] = [];
  let start = 0;

  for (let page = 0; page < 50; page += 1) {
    const url = `${base}${method}.json`;
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...params, start }),
      cache: "no-store",
    });

    const data = (await res.json()) as BitrixListResponse<T[] | Record<string, T>> & {
      error?: string;
      error_description?: string;
      next?: number;
    };

    if (!res.ok || data.error) {
      throw new BitrixApiError(
        data.error_description || data.error || `HTTP ${res.status}`,
        method,
        JSON.stringify(data),
      );
    }

    const result = data.result;
    if (Array.isArray(result)) {
      items.push(...result);
    } else if (result && typeof result === "object") {
      items.push(...Object.values(result));
    }

    if (data.next === undefined || data.next === null) break;
    start = data.next;
  }

  return items;
}

function normalizeTask(raw: Record<string, unknown>): BitrixTask {
  // tasks.task.list возвращает { task: {...} } или плоский объект
  const t = (raw.task && typeof raw.task === "object"
    ? (raw.task as Record<string, unknown>)
    : raw) as Record<string, unknown>;

  const groupRaw = t.groupId ?? t.GROUP_ID;
  const groupId =
    groupRaw === null || groupRaw === undefined || groupRaw === "" || groupRaw === "0" || groupRaw === 0
      ? null
      : asNumber(groupRaw);

  const responsible = t.responsible as Record<string, unknown> | undefined;

  return {
    id: asNumber(t.id ?? t.ID),
    title: String(t.title ?? t.TITLE ?? "Без названия"),
    description: t.description ? String(t.description) : undefined,
    groupId,
    stageId: asNumber(t.stageId ?? t.STAGE_ID),
    responsibleId: asNumber(
      t.responsibleId ?? t.RESPONSIBLE_ID ?? responsible?.id ?? responsible?.ID,
    ),
    responsibleName: responsible
      ? userDisplayName(responsible)
      : t.responsibleName
        ? String(t.responsibleName)
        : undefined,
    createdBy: t.createdBy ? asNumber(t.createdBy) : undefined,
    deadline: (t.deadline ?? t.DEADLINE ?? null) as string | null,
    priority: t.priority !== undefined ? asNumber(t.priority) : undefined,
    status: t.status !== undefined ? asNumber(t.status) : undefined,
  };
}

function normalizeStage(raw: Record<string, unknown>, entityId: number): BitrixStage {
  return {
    id: asNumber(raw.ID ?? raw.id),
    title: String(raw.TITLE ?? raw.title ?? "Стадия"),
    sort: asNumber(raw.SORT ?? raw.sort, 100),
    color: raw.COLOR ? String(raw.COLOR) : undefined,
    entityId,
  };
}

function normalizeGroup(raw: Record<string, unknown>): BitrixGroup {
  return {
    id: asNumber(raw.ID ?? raw.id),
    name: String(raw.NAME ?? raw.name ?? `Группа #${raw.ID ?? "?"}`),
  };
}

function normalizeUser(raw: Record<string, unknown>): BitrixUser {
  return {
    id: asNumber(raw.ID ?? raw.id),
    name: String(raw.NAME ?? raw.name ?? ""),
    lastName: raw.LAST_NAME ? String(raw.LAST_NAME) : undefined,
    avatar: raw.PERSONAL_PHOTO ? String(raw.PERSONAL_PHOTO) : undefined,
  };
}

export interface BitrixClient {
  mode: "mock" | "webhook" | "oauth";
  getGroups(): Promise<BitrixGroup[]>;
  getUsers(): Promise<BitrixUser[]>;
  getStages(entityId: number): Promise<BitrixStage[]>;
  getTasks(params: {
    groupIds: number[];
    includePersonal: boolean;
    responsibleId?: number | null;
  }): Promise<{ tasks: BitrixTask[]; errors: string[]; warnings: string[] }>;
  moveTask(taskId: number, stageId: number): Promise<boolean>;
  canMoveTask(taskId: number, stageId: number): Promise<boolean>;
}

class MockBitrixClient implements BitrixClient {
  mode = "mock" as const;

  async getGroups() {
    return getMockGroups().filter((g) => !g.isPersonal);
  }

  async getUsers() {
    return getMockUsers();
  }

  async getStages(entityId: number) {
    return getMockStages(entityId);
  }

  async getTasks(params: {
    groupIds: number[];
    includePersonal: boolean;
    responsibleId?: number | null;
  }) {
    let tasks = getMockTasks();
    const allowed = new Set(params.groupIds);

    tasks = tasks.filter((t) => {
      if (t.groupId === null || t.groupId === 0) {
        return params.includePersonal;
      }
      return allowed.has(t.groupId);
    });

    if (params.responsibleId) {
      tasks = tasks.filter((t) => t.responsibleId === params.responsibleId);
    }

    return {
      tasks,
      errors: [] as string[],
      warnings: [] as string[],
    };
  }

  async moveTask(taskId: number, stageId: number) {
    return mockMoveTask(taskId, stageId);
  }

  async canMoveTask() {
    return true;
  }
}

class WebhookBitrixClient implements BitrixClient {
  mode: "webhook" | "oauth" = "webhook";

  async getGroups() {
    const rows = await callWebhookList<Record<string, unknown>>("sonet_group.get", {
      FILTER: { ACTIVE: "Y" },
    });
    return rows.map(normalizeGroup);
  }

  async getUsers() {
    const rows = await callWebhookList<Record<string, unknown>>("user.get", {
      FILTER: { ACTIVE: true },
    });
    return rows.map(normalizeUser);
  }

  async getStages(entityId: number) {
    // task.stages.get — entityId = GROUP_ID, 0 = Мой план
    const result = await callWebhook<
      Record<string, unknown>[] | Record<string, Record<string, unknown>>
    >("task.stages.get", { entityId });

    const rows = Array.isArray(result) ? result : Object.values(result ?? {});
    return rows.map((r) => normalizeStage(r, entityId));
  }

  async getTasks(params: {
    groupIds: number[];
    includePersonal: boolean;
    responsibleId?: number | null;
  }) {
    const errors: string[] = [];
    const warnings: string[] = [];
    const tasks: BitrixTask[] = [];
    const select = [
      "ID",
      "TITLE",
      "DESCRIPTION",
      "GROUP_ID",
      "STAGE_ID",
      "RESPONSIBLE_ID",
      "CREATED_BY",
      "DEADLINE",
      "PRIORITY",
      "STATUS",
    ];

    for (const groupId of params.groupIds) {
      try {
        const filter: Record<string, unknown> = { GROUP_ID: groupId };
        if (params.responsibleId) {
          filter.RESPONSIBLE_ID = params.responsibleId;
        }

        const rows = await callWebhookList<Record<string, unknown>>("tasks.task.list", {
          filter,
          select,
        });

        const normalized = rows.map(normalizeTask);
        warnings.push(`groupId=${groupId}: получено задач ${normalized.length}`);
        tasks.push(...normalized);
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        errors.push(`groupId=${groupId}: ${msg}`);
      }
    }

    if (params.includePersonal) {
      try {
        // Личные задачи: без проекта. В Bitrix фильтр GROUP_ID часто работает как 0 / false.
        const filter: Record<string, unknown> = { GROUP_ID: 0 };
        if (params.responsibleId) {
          filter.RESPONSIBLE_ID = params.responsibleId;
        }

        let rows = await callWebhookList<Record<string, unknown>>("tasks.task.list", {
          filter,
          select,
        });

        // fallback: некоторые порталы отдают личные иначе
        if (rows.length === 0) {
          const all = await callWebhookList<Record<string, unknown>>("tasks.task.list", {
            filter: params.responsibleId
              ? { RESPONSIBLE_ID: params.responsibleId }
              : {},
            select,
          });
          rows = all.filter((raw) => {
            const t = normalizeTask(raw);
            return t.groupId === null;
          });
        }

        const personal = rows
          .map(normalizeTask)
          .filter((t) => t.groupId === null || t.groupId === 0)
          .map((t) => ({ ...t, groupId: null }));

        warnings.push(
          `личные (entityId=${PERSONAL_ENTITY_ID}): получено задач ${personal.length}`,
        );
        tasks.push(...personal);
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        errors.push(`личные задачи: ${msg}`);
      }
    }

    // дедуп по id
    const byId = new Map<number, BitrixTask>();
    for (const t of tasks) byId.set(t.id, t);

    return { tasks: [...byId.values()], errors, warnings };
  }

  async moveTask(taskId: number, stageId: number) {
    await callWebhook("task.stages.movetask", { id: taskId, stageId });
    return true;
  }

  async canMoveTask(taskId: number, stageId: number) {
    try {
      const result = await callWebhook<boolean | { result?: boolean }>(
        "task.stages.canmovetask",
        { id: taskId, stageId },
      );
      if (typeof result === "boolean") return result;
      return Boolean(result);
    } catch {
      // если метод недоступен — пробуем перенос
      return true;
    }
  }
}

/**
 * Задел под OAuth локального приложения.
 * Пока использует webhook-клиент как fallback или бросает понятную ошибку.
 */
class OauthBitrixClient extends WebhookBitrixClient {
  mode: "webhook" | "oauth" = "oauth";

  // В MVP OAuth-токены не реализованы end-to-end.
  // При BITRIX_MODE=oauth без webhook — явная ошибка в диагностике.
}

export function createBitrixClient(): BitrixClient {
  const mode = resolveAppMode();
  if (mode === "mock") return new MockBitrixClient();
  if (mode === "oauth" && !getWebhookUrl()) {
    // Задел: без access_token пока работаем только если задан webhook
    return new MockBitrixClient();
  }
  if (mode === "oauth") return new OauthBitrixClient();
  return new WebhookBitrixClient();
}
