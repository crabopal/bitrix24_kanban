"use client";

import { useMemo, useState } from "react";
import type { BitrixStage, LogicalColumn, StageMapping } from "@/lib/bitrix/types";
import { stageMappingKey } from "@/lib/config";

export function MappingModal({
  stages,
  groups,
  logicalColumns,
  mapping,
  onClose,
  onSave,
}: {
  stages: BitrixStage[];
  groups: { id: number; name: string }[];
  logicalColumns: LogicalColumn[];
  mapping: StageMapping;
  onClose: () => void;
  onSave: (mapping: StageMapping) => void;
}) {
  const [draft, setDraft] = useState<StageMapping>({ ...mapping });

  const groupName = useMemo(() => {
    const map = new Map(groups.map((g) => [g.id, g.name]));
    map.set(0, "Без проекта (Мой план)");
    return map;
  }, [groups]);

  const rows = useMemo(
    () =>
      [...stages].sort((a, b) => {
        if (a.entityId !== b.entityId) return a.entityId - b.entityId;
        return a.sort - b.sort;
      }),
    [stages],
  );

  return (
    <div className="modal-backdrop" role="presentation" onClick={onClose}>
      <div
        className="modal"
        role="dialog"
        aria-labelledby="mapping-title"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id="mapping-title">Маппинг стадий</h2>
        <p className="hint">
          Сопоставьте стадии проектов и «Мой план» с логическими колонками сводной
          доски. Без маппинга задачи не попадут в колонки.
        </p>

        {rows.length === 0 ? (
          <p className="hint">Стадии ещё не загружены. Выберите проекты и обновите доску.</p>
        ) : (
          <table className="mapping-table">
            <thead>
              <tr>
                <th>Проект</th>
                <th>Стадия</th>
                <th>Колонка сводной доски</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((stage) => {
                const key = stageMappingKey(stage.entityId, stage.id);
                return (
                  <tr key={key}>
                    <td>{groupName.get(stage.entityId) ?? `#${stage.entityId}`}</td>
                    <td>{stage.title}</td>
                    <td>
                      <select
                        value={draft[key] ?? ""}
                        onChange={(e) => {
                          const value = e.target.value;
                          setDraft((prev) => {
                            const next = { ...prev };
                            if (!value) delete next[key];
                            else next[key] = value;
                            return next;
                          });
                        }}
                      >
                        <option value="">— не показывать —</option>
                        {logicalColumns.map((col) => (
                          <option key={col.id} value={col.id}>
                            {col.title}
                          </option>
                        ))}
                      </select>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}

        <div className="modal-actions">
          <button type="button" className="btn" onClick={onClose}>
            Отмена
          </button>
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => onSave(draft)}
          >
            Сохранить
          </button>
        </div>
      </div>
    </div>
  );
}
