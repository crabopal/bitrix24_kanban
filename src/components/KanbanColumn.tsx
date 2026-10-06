"use client";

import { useDroppable } from "@dnd-kit/core";
import type { BoardColumnView } from "@/lib/bitrix/types";
import { TaskCard } from "@/components/TaskCard";

export function KanbanColumn({
  columnView,
  portalUrl,
}: {
  columnView: BoardColumnView;
  portalUrl?: string | null;
}) {
  const { setNodeRef, isOver } = useDroppable({
    id: `column-${columnView.column.id}`,
    data: { columnId: columnView.column.id },
  });

  return (
    <section className={`column${isOver ? " over" : ""}`} ref={setNodeRef}>
      <header className="column-header">
        <h2 className="column-title">{columnView.column.title}</h2>
        <span className="column-count">{columnView.tasks.length}</span>
      </header>
      <div className="column-body">
        {columnView.tasks.length === 0 ? (
          <div className="empty-column">Перетащите задачу сюда</div>
        ) : (
          columnView.tasks.map((task) => (
            <TaskCard key={task.id} task={task} portalUrl={portalUrl} />
          ))
        )}
      </div>
    </section>
  );
}
