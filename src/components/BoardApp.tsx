"use client";

import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { useCallback, useEffect, useMemo, useState } from "react";
import { KanbanColumn } from "@/components/KanbanColumn";
import { MappingModal } from "@/components/MappingModal";
import type {
  BoardPayload,
  BoardTask,
  StageMapping,
} from "@/lib/bitrix/types";
import {
  loadFilters,
  loadLogicalColumns,
  loadMapping,
  saveFilters,
  saveMapping,
} from "@/lib/storage";

type LoadState = "idle" | "loading" | "error" | "ready";

export function BoardApp({ portalUrl }: { portalUrl?: string | null }) {
  const [board, setBoard] = useState<BoardPayload | null>(null);
  const [state, setState] = useState<LoadState>("idle");
  const [error, setError] = useState<string | null>(null);
  const [mapping, setMapping] = useState<StageMapping>({});
  const [groupIds, setGroupIds] = useState<number[]>([]);
  const [includePersonal, setIncludePersonal] = useState(true);
  const [responsibleId, setResponsibleId] = useState<number | null>(null);
  const [search, setSearch] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [showMapping, setShowMapping] = useState(false);
  const [toast, setToast] = useState<{ text: string; error?: boolean } | null>(
    null,
  );
  const [activeTask, setActiveTask] = useState<BoardTask | null>(null);
  const [hydrated, setHydrated] = useState(false);
  const [groupsInitialized, setGroupsInitialized] = useState(false);
  const [availableGroups, setAvailableGroups] = useState<
    { id: number; name: string; isPersonal?: boolean }[]
  >([]);

  const logicalColumns = useMemo(() => loadLogicalColumns(), []);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
  );

  useEffect(() => {
    const stored = loadFilters();
    setGroupIds(stored.groupIds);
    setIncludePersonal(stored.includePersonal);
    setResponsibleId(stored.responsibleId);
    setSearch(stored.search);
    setSearchInput(stored.search);
    setMapping(loadMapping());
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3200);
    return () => clearTimeout(t);
  }, [toast]);

  const loadBoard = useCallback(async () => {
    if (!hydrated) return;
    setState("loading");
    setError(null);

    try {
      const res = await fetch("/api/board", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          filters: {
            groupIds,
            includePersonal,
            responsibleId,
            search,
          },
          mapping,
          logicalColumns,
        }),
      });

      const data = (await res.json()) as BoardPayload & { error?: string };
      if (!res.ok) {
        throw new Error(data.error || "Не удалось загрузить доску");
      }

      setBoard(data);
      const realGroups = data.groups.filter((g) => !g.isPersonal);
      setAvailableGroups(realGroups);

      // при первом ответе, если проекты не выбраны — выбираем все
      if (!groupsInitialized && groupIds.length === 0 && realGroups.length > 0) {
        const allIds = realGroups.map((g) => g.id);
        setGroupIds(allIds);
        saveFilters({
          groupIds: allIds,
          includePersonal,
          responsibleId,
          search,
        });
      }
      if (!groupsInitialized) setGroupsInitialized(true);

      setState("ready");
    } catch (e) {
      setState("error");
      setError(e instanceof Error ? e.message : String(e));
    }
  }, [
    hydrated,
    groupsInitialized,
    groupIds,
    includePersonal,
    responsibleId,
    search,
    mapping,
    logicalColumns,
  ]);

  useEffect(() => {
    void loadBoard();
  }, [loadBoard]);

  const persistFilters = (next: {
    groupIds?: number[];
    includePersonal?: boolean;
    responsibleId?: number | null;
    search?: string;
  }) => {
    const payload = {
      groupIds: next.groupIds ?? groupIds,
      includePersonal: next.includePersonal ?? includePersonal,
      responsibleId:
        next.responsibleId === undefined ? responsibleId : next.responsibleId,
      search: next.search ?? search,
    };
    saveFilters(payload);
  };

  const toggleGroup = (id: number) => {
    const next = groupIds.includes(id)
      ? groupIds.filter((g) => g !== id)
      : [...groupIds, id];
    setGroupIds(next);
    persistFilters({ groupIds: next });
  };

  const onDragStart = (event: DragStartEvent) => {
    const task = event.active.data.current?.task as BoardTask | undefined;
    setActiveTask(task ?? null);
  };

  const onDragEnd = async (event: DragEndEvent) => {
    setActiveTask(null);
    const task = event.active.data.current?.task as BoardTask | undefined;
    const overId = event.over?.id;
    if (!task || !overId) return;

    const overStr = String(overId);
    const targetColumnId = overStr.startsWith("column-")
      ? overStr.replace("column-", "")
      : null;
    if (!targetColumnId || targetColumnId === task.columnId) return;

    // оптимистичное обновление
    setBoard((prev) => {
      if (!prev) return prev;
      const columns = prev.columns.map((col) => ({
        ...col,
        tasks: col.tasks.filter((t) => t.id !== task.id),
      }));
      const target = columns.find((c) => c.column.id === targetColumnId);
      if (target) {
        target.tasks = [
          ...target.tasks,
          { ...task, columnId: targetColumnId, unmapped: false },
        ];
      }
      return { ...prev, columns };
    });

    try {
      const res = await fetch("/api/move", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          taskId: task.id,
          groupId: task.groupId,
          targetColumnId,
          mapping,
        }),
      });
      const data = (await res.json()) as { ok: boolean; error?: string };
      if (!res.ok || !data.ok) {
        throw new Error(data.error || "Не удалось перенести задачу");
      }
      setToast({ text: `Задача #${task.id} перенесена` });
    } catch (e) {
      setToast({
        text: e instanceof Error ? e.message : String(e),
        error: true,
      });
      void loadBoard();
    }
  };

  const mode = board?.diagnostics.mode ?? "mock";

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          <h1>Мультипроектный Канбан</h1>
          <p>Сводная доска задач Bitrix24 без дублирования карточек</p>
          <div className="mode-pill">
            <span className={`mode-dot${mode === "mock" ? " warn" : ""}`} />
            Режим: {mode === "mock" ? "mock (без портала)" : mode}
          </div>
        </div>
        <div className="toolbar">
          <button type="button" className="btn" onClick={() => setShowMapping(true)}>
            Маппинг стадий
          </button>
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => void loadBoard()}
            disabled={state === "loading"}
          >
            Обновить
          </button>
        </div>
      </header>

      <section className="filters">
        <div className="field" style={{ minWidth: 220, flex: 1 }}>
          <label htmlFor="search">Поиск</label>
          <input
            id="search"
            value={searchInput}
            placeholder="Название или ID задачи"
            onChange={(e) => setSearchInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                setSearch(searchInput);
                persistFilters({ search: searchInput });
              }
            }}
            onBlur={() => {
              setSearch(searchInput);
              persistFilters({ search: searchInput });
            }}
          />
        </div>

        <div className="field">
          <label htmlFor="responsible">Исполнитель</label>
          <select
            id="responsible"
            value={responsibleId ?? ""}
            onChange={(e) => {
              const value = e.target.value ? Number(e.target.value) : null;
              setResponsibleId(value);
              persistFilters({ responsibleId: value });
            }}
          >
            <option value="">Все</option>
            {(board?.users ?? []).map((u) => (
              <option key={u.id} value={u.id}>
                {[u.name, u.lastName].filter(Boolean).join(" ")}
              </option>
            ))}
          </select>
        </div>

        <div className="checkbox-field">
          <label>
            <input
              type="checkbox"
              checked={includePersonal}
              onChange={(e) => {
                setIncludePersonal(e.target.checked);
                persistFilters({ includePersonal: e.target.checked });
              }}
            />
            Задачи без проекта
          </label>
        </div>
      </section>

      <div className="projects-chips">
        <span className="chip">Проекты:</span>
        {availableGroups.length === 0 && state === "ready" ? (
          <span className="chip">Нет доступных проектов</span>
        ) : (
          availableGroups.map((g) => (
            <label key={g.id} className={`chip${groupIds.includes(g.id) ? " active" : ""}`}>
              <input
                type="checkbox"
                checked={groupIds.includes(g.id)}
                onChange={() => toggleGroup(g.id)}
              />
              {g.name}
            </label>
          ))
        )}
      </div>

      {board && (
        <details className="diagnostics">
          <summary>
            Диагностика: запрошено групп {board.diagnostics.requestedGroupIds.length},
            задач {board.diagnostics.tasksFetched}, на доске{" "}
            {board.diagnostics.tasksVisible}, без маппинга{" "}
            {board.diagnostics.tasksUnmapped}
          </summary>
          <ul>
            <li>
              groupIds: {board.diagnostics.requestedGroupIds.join(", ") || "—"}
            </li>
            <li>личные: {board.diagnostics.includePersonal ? "да" : "нет"}</li>
            <li>время: {new Date(board.diagnostics.fetchedAt).toLocaleString("ru-RU")}</li>
            {board.diagnostics.warnings.map((w) => (
              <li key={w} className="warn">
                {w}
              </li>
            ))}
            {board.diagnostics.errors.map((err) => (
              <li key={err} className="err">
                {err}
              </li>
            ))}
          </ul>
        </details>
      )}

      {board && board.unmappedTasks.length > 0 && (
        <div className="unmapped">
          <h3>Задачи без маппинга стадии ({board.unmappedTasks.length})</h3>
          <p>
            Настройте маппинг стадий, иначе эти задачи не видны в колонках — типичная
            причина «пустой» доски на проде.
          </p>
          <div className="unmapped-list">
            {board.unmappedTasks.map((t) => (
              <span key={t.id} className="chip">
                #{t.id} {t.title} · {t.groupName}
                {t.stageTitle ? ` · ${t.stageTitle}` : ""}
              </span>
            ))}
          </div>
        </div>
      )}

      {state === "loading" && !board && (
        <div className="state-box loading">
          <div className="spinner" />
          <h2>Загрузка доски…</h2>
          <p>Получаем задачи, стадии и проекты</p>
        </div>
      )}

      {state === "error" && (
        <div className="state-box error">
          <h2>Ошибка загрузки</h2>
          <p>{error}</p>
          <p style={{ marginTop: 12 }}>
            Проверьте scopes (task, группы, пользователи), права вебхука и ID проектов.
          </p>
          <button
            type="button"
            className="btn btn-primary"
            style={{ marginTop: 14 }}
            onClick={() => void loadBoard()}
          >
            Повторить
          </button>
        </div>
      )}

      {state === "ready" && board && board.columns.every((c) => c.tasks.length === 0) && (
        <div className="state-box">
          <h2>Нет задач для отображения</h2>
          <p>
            Выберите проекты, включите личные задачи или проверьте маппинг стадий.
            Смотрите блок диагностики выше.
          </p>
        </div>
      )}

      {board && (
        <div className="board-wrap">
          <DndContext
            sensors={sensors}
            onDragStart={onDragStart}
            onDragEnd={(e) => void onDragEnd(e)}
          >
            <div className="board">
              {board.columns.map((col) => (
                <KanbanColumn
                  key={col.column.id}
                  columnView={col}
                  portalUrl={portalUrl}
                />
              ))}
            </div>
            <DragOverlay>
              {activeTask ? (
                <div className="card" style={{ cursor: "grabbing" }}>
                  <div className="card-title">{activeTask.title}</div>
                  <div className="card-meta">
                    <span className="tag tag-project">{activeTask.groupName}</span>
                  </div>
                </div>
              ) : null}
            </DragOverlay>
          </DndContext>
        </div>
      )}

      {showMapping && board && (
        <MappingModal
          stages={board.stages}
          groups={board.groups}
          logicalColumns={board.logicalColumns}
          mapping={mapping}
          onClose={() => setShowMapping(false)}
          onSave={(next) => {
            setMapping(next);
            saveMapping(next);
            setShowMapping(false);
            setToast({ text: "Маппинг сохранён" });
          }}
        />
      )}

      {toast && (
        <div className={`toast${toast.error ? " error" : ""}`} role="status">
          {toast.text}
        </div>
      )}
    </div>
  );
}
