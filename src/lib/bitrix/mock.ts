import { PERSONAL_ENTITY_ID, PERSONAL_GROUP } from "@/lib/config";
import type {
  BitrixGroup,
  BitrixStage,
  BitrixTask,
  BitrixUser,
} from "@/lib/bitrix/types";

export const MOCK_USERS: BitrixUser[] = [
  { id: 1, name: "Анна", lastName: "Иванова" },
  { id: 2, name: "Борис", lastName: "Петров" },
  { id: 3, name: "Вера", lastName: "Сидорова" },
  { id: 4, name: "Глеб", lastName: "Козлов" },
];

export const MOCK_GROUPS: BitrixGroup[] = [
  { id: 101, name: "Проект Альфа" },
  { id: 102, name: "Проект Бета" },
  { id: 103, name: "Проект Гамма (пустой)" },
  PERSONAL_GROUP,
];

export const MOCK_STAGES: BitrixStage[] = [
  // Альфа
  { id: 1101, title: "Новые", sort: 100, color: "#00c4fb", entityId: 101 },
  { id: 1102, title: "Делаем", sort: 200, color: "#ffa900", entityId: 101 },
  { id: 1103, title: "Проверка", sort: 300, color: "#75d900", entityId: 101 },
  { id: 1104, title: "Закрыто", sort: 400, color: "#00a9f3", entityId: 101 },
  // Бета — другие названия стадий
  { id: 1201, title: "Backlog", sort: 100, color: "#00c4fb", entityId: 102 },
  { id: 1202, title: "Doing", sort: 200, color: "#ffa900", entityId: 102 },
  { id: 1203, title: "QA", sort: 300, color: "#75d900", entityId: 102 },
  { id: 1204, title: "Done", sort: 400, color: "#00a9f3", entityId: 102 },
  // Гамма
  { id: 1301, title: "К работе", sort: 100, color: "#00c4fb", entityId: 103 },
  { id: 1302, title: "В работе", sort: 200, color: "#ffa900", entityId: 103 },
  // Мой план
  { id: 1, title: "Сделать", sort: 100, color: "#00c4fb", entityId: PERSONAL_ENTITY_ID },
  { id: 2, title: "В работе", sort: 200, color: "#ffa900", entityId: PERSONAL_ENTITY_ID },
  { id: 3, title: "Ждёт контроля", sort: 300, color: "#75d900", entityId: PERSONAL_ENTITY_ID },
  { id: 4, title: "Выполнено", sort: 400, color: "#00a9f3", entityId: PERSONAL_ENTITY_ID },
];

/** Мутабельное хранилище задач для mock drag-and-drop */
const mockTasks: BitrixTask[] = [
  {
    id: 1001,
    title: "Сверстать лендинг",
    groupId: 101,
    stageId: 1101,
    responsibleId: 1,
    responsibleName: "Анна Иванова",
    deadline: "2026-10-10",
    priority: 1,
  },
  {
    id: 1002,
    title: "API интеграция оплаты",
    groupId: 101,
    stageId: 1102,
    responsibleId: 2,
    responsibleName: "Борис Петров",
    deadline: "2026-10-08",
    priority: 2,
  },
  {
    id: 1003,
    title: "Ревью дизайн-макетов",
    groupId: 101,
    stageId: 1103,
    responsibleId: 3,
    responsibleName: "Вера Сидорова",
  },
  {
    id: 1004,
    title: "Релиз v1.0",
    groupId: 101,
    stageId: 1104,
    responsibleId: 1,
    responsibleName: "Анна Иванова",
  },
  {
    id: 2001,
    title: "Миграция БД",
    groupId: 102,
    stageId: 1201,
    responsibleId: 2,
    responsibleName: "Борис Петров",
  },
  {
    id: 2002,
    title: "Настроить CI/CD",
    groupId: 102,
    stageId: 1202,
    responsibleId: 4,
    responsibleName: "Глеб Козлов",
    deadline: "2026-10-12",
  },
  {
    id: 2003,
    title: "Нагрузочное тестирование",
    groupId: 102,
    stageId: 1203,
    responsibleId: 4,
    responsibleName: "Глеб Козлов",
  },
  {
    id: 2004,
    title: "Документация API",
    groupId: 102,
    stageId: 1204,
    responsibleId: 3,
    responsibleName: "Вера Сидорова",
  },
  // Личные (без проекта)
  {
    id: 9001,
    title: "Обновить резюме",
    groupId: null,
    stageId: 1,
    responsibleId: 1,
    responsibleName: "Анна Иванова",
  },
  {
    id: 9002,
    title: "Прочитать RFC по канбану",
    groupId: null,
    stageId: 2,
    responsibleId: 1,
    responsibleName: "Анна Иванова",
  },
  {
    id: 9003,
    title: "Личная заметка: созвон с подрядчиком",
    groupId: null,
    stageId: 3,
    responsibleId: 2,
    responsibleName: "Борис Петров",
  },
  // Задача со стадией без маппинга по умолчанию (для демо unmapped)
  {
    id: 13001,
    title: "Задача без маппинга стадии",
    groupId: 103,
    stageId: 1301,
    responsibleId: 3,
    responsibleName: "Вера Сидорова",
  },
];

export function getMockTasks(): BitrixTask[] {
  return mockTasks.map((t) => ({ ...t }));
}

export function getMockGroups(): BitrixGroup[] {
  return MOCK_GROUPS.map((g) => ({ ...g }));
}

export function getMockUsers(): BitrixUser[] {
  return MOCK_USERS.map((u) => ({ ...u }));
}

export function getMockStages(entityId?: number): BitrixStage[] {
  const stages =
    entityId === undefined
      ? MOCK_STAGES
      : MOCK_STAGES.filter((s) => s.entityId === entityId);
  return stages.map((s) => ({ ...s }));
}

export function mockMoveTask(taskId: number, stageId: number): boolean {
  const idx = mockTasks.findIndex((t) => t.id === taskId);
  if (idx === -1) return false;
  mockTasks[idx] = { ...mockTasks[idx], stageId };
  return true;
}

export function resetMockTasks(): void {
  // used in tests / hot reload recovery if needed
}
