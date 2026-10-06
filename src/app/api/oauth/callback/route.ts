import { NextResponse } from "next/server";

/**
 * Задел под OAuth локального приложения Bitrix24.
 * Полный обмен code → access_token в MVP не реализован.
 */
export async function GET() {
  return NextResponse.json(
    {
      ok: false,
      message:
        "OAuth callback: задел под локальное приложение. Для MVP используйте BITRIX_MODE=webhook или mock.",
    },
    { status: 501 },
  );
}
