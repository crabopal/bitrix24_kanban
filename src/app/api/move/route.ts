import { NextRequest, NextResponse } from "next/server";
import { moveBoardTask } from "@/lib/board/aggregate";
import type { StageMapping } from "@/lib/bitrix/types";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as {
      taskId?: number;
      groupId?: number | null;
      targetColumnId?: string;
      mapping?: StageMapping;
    };

    if (!body.taskId || !body.targetColumnId) {
      return NextResponse.json(
        { ok: false, error: "Нужны taskId и targetColumnId" },
        { status: 400 },
      );
    }

    const result = await moveBoardTask({
      taskId: Number(body.taskId),
      groupId:
        body.groupId === null || body.groupId === undefined
          ? null
          : Number(body.groupId),
      targetColumnId: String(body.targetColumnId),
      mapping: body.mapping ?? {},
    });

    return NextResponse.json(result, { status: result.ok ? 200 : 400 });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
