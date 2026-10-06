import type { LogicalColumn, StageMapping } from "@/lib/bitrix/types";

export type AppMode = "mock" | "webhook" | "oauth";

export const DEFAULT_LOGICAL_COLUMNS: LogicalColumn[] = [
  { id: "todo", title: "К выполнению", order: 0 },
  { id: "in_progress", title: "В работе", order: 1 },
  { id: "review", title: "На проверке", order: 2 },
  { id: "done", title: "Готово", order: 3 },
];

/**
 * Модель личных задач (без проекта):
 * - Загружаются отдельно фильтром без GROUP_ID.
 * - Стадии берутся из канбана «Мой план» (entityId = 0).
 * - На сводной доске отображаются в тех же логических колонках
 *   через маппинг стадий entityId:0 → logical column.
 * - Это view + mapping, не клон карточки.
 */
export const PERSONAL_ENTITY_ID = 0;

export const PERSONAL_GROUP: { id: number; name: string; isPersonal: true } = {
  id: PERSONAL_ENTITY_ID,
  name: "Без проекта (Мой план)",
  isPersonal: true,
};

export function resolveAppMode(): AppMode {
  const explicit = process.env.BITRIX_MODE?.toLowerCase();
  if (explicit === "mock" || explicit === "webhook" || explicit === "oauth") {
    return explicit;
  }
  if (process.env.BITRIX_WEBHOOK_URL) return "webhook";
  if (process.env.BITRIX_OAUTH_CLIENT_ID) return "oauth";
  return "mock";
}

export function getWebhookUrl(): string | null {
  return process.env.BITRIX_WEBHOOK_URL?.replace(/\/?$/, "/") ?? null;
}

export function getPortalUrl(): string | null {
  const fromEnv = process.env.BITRIX_PORTAL_URL?.replace(/\/?$/, "");
  if (fromEnv) return fromEnv;
  const webhook = process.env.BITRIX_WEBHOOK_URL;
  if (!webhook) return null;
  try {
    const u = new URL(webhook);
    return `${u.protocol}//${u.host}`;
  } catch {
    return null;
  }
}

/** Дефолтный маппинг для mock-данных и стартовый шаблон */
export const DEFAULT_MOCK_MAPPING: StageMapping = {
  // Проект Альфа (101)
  "101:1101": "todo",
  "101:1102": "in_progress",
  "101:1103": "review",
  "101:1104": "done",
  // Проект Бета (102)
  "102:1201": "todo",
  "102:1202": "in_progress",
  "102:1203": "review",
  "102:1204": "done",
  // Мой план (0)
  "0:1": "todo",
  "0:2": "in_progress",
  "0:3": "review",
  "0:4": "done",
};

export function stageMappingKey(entityId: number, stageId: number): string {
  return `${entityId}:${stageId}`;
}
