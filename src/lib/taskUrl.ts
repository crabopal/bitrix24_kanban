/** Ссылка на задачу в портале Bitrix24 */
export function buildTaskUrl(portalUrl: string | null | undefined, taskId: number): string {
  if (portalUrl) {
    return `${portalUrl.replace(/\/?$/, "")}/company/personal/user/0/tasks/task/view/${taskId}/`;
  }
  return `#task-${taskId}`;
}

declare global {
  interface Window {
    BX24?: {
      openPath?: (path: string) => void;
      openApplication?: (params: Record<string, unknown>) => void;
      getAuth?: () => { domain?: string; access_token?: string };
      init?: (cb: () => void) => void;
    };
  }
}

export function openBitrixTask(taskId: number, portalUrl?: string | null): void {
  const path = `/company/personal/user/0/tasks/task/view/${taskId}/`;

  if (typeof window !== "undefined" && window.BX24?.openPath) {
    try {
      window.BX24.openPath(path);
      return;
    } catch {
      // fallback ниже
    }
  }

  const url = buildTaskUrl(portalUrl, taskId);
  if (url.startsWith("#")) {
    window.alert(`Задача #${taskId} (mock): откроется в Bitrix при подключении портала.`);
    return;
  }
  window.open(url, "_blank", "noopener,noreferrer");
}
