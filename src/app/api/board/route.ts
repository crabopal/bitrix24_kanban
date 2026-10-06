import { NextRequest, NextResponse } from "next/server";
import { buildBoard } from "@/lib/board/aggregate";
import type { BoardFilters, LogicalColumn, StageMapping } from "@/lib/bitrix/types";

export const dynamic = "force-dynamic";

function parseBody(body: unknown): {
  filters: BoardFilters;
  mapping: StageMapping | null;
  logicalColumns: LogicalColumn[] | null;
} {
  const data = (body && typeof body === "object" ? body : {}) as Record<string, unknown>;
  const filtersRaw = (data.filters ?? {}) as Record<string, unknown>;

  const groupIds = Array.isArray(filtersRaw.groupIds)
    ? filtersRaw.groupIds.map((id) => Number(id)).filter((n) => Number.isFinite(n))
    : [];

  const filters: BoardFilters = {
    groupIds,
    includePersonal: Boolean(filtersRaw.includePersonal ?? true),
    responsibleId:
      filtersRaw.responsibleId === null || filtersRaw.responsibleId === undefined || filtersRaw.responsibleId === ""
        ? null
        : Number(filtersRaw.responsibleId),
    search: String(filtersRaw.search ?? ""),
  };

  return {
    filters,
    mapping: (data.mapping as StageMapping) ?? null,
    logicalColumns: (data.logicalColumns as LogicalColumn[]) ?? null,
  };
}

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const groupIds = (sp.get("groupIds") ?? "")
    .split(",")
    .map((s) => Number(s.trim()))
    .filter((n) => Number.isFinite(n) && n > 0);

  const board = await buildBoard({
    filters: {
      groupIds,
      includePersonal: sp.get("includePersonal") !== "0",
      responsibleId: sp.get("responsibleId") ? Number(sp.get("responsibleId")) : null,
      search: sp.get("search") ?? "",
    },
  });

  return NextResponse.json(board);
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { filters, mapping, logicalColumns } = parseBody(body);
    const board = await buildBoard({ filters, mapping, logicalColumns });
    return NextResponse.json(board);
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return NextResponse.json(
      { error: message, diagnostics: { errors: [message] } },
      { status: 500 },
    );
  }
}
