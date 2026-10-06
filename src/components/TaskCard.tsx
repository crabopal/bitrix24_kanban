"use client";

import { useDraggable } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import type { BoardTask } from "@/lib/bitrix/types";
import { openBitrixTask } from "@/lib/taskUrl";

function projectTagClass(task: BoardTask): string {
  if (task.groupId === null || task.groupId === 0) return "tag tag-personal";
  if (task.groupId % 2 === 0) return "tag tag-beta";
  return "tag tag-project";
}

export function TaskCard({
  task,
  portalUrl,
}: {
  task: BoardTask;
  portalUrl?: string | null;
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: `task-${task.id}`,
    data: { task },
  });

  const style = {
    transform: CSS.Translate.toString(transform),
  };

  return (
    <article
      ref={setNodeRef}
      style={style}
      className={`card${isDragging ? " dragging" : ""}`}
      {...listeners}
      {...attributes}
    >
      <button
        type="button"
        className="card-title"
        onClick={(e) => {
          e.stopPropagation();
          openBitrixTask(task.id, portalUrl);
        }}
        onPointerDown={(e) => e.stopPropagation()}
      >
        {task.title}
      </button>
      <div className="card-meta">
        <span className={projectTagClass(task)}>{task.groupName}</span>
        {task.responsibleName && <span>{task.responsibleName}</span>}
        {task.deadline && <span>до {task.deadline}</span>}
      </div>
    </article>
  );
}
