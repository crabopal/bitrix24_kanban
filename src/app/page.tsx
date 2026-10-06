import { BoardApp } from "@/components/BoardApp";
import { getPortalUrl, resolveAppMode } from "@/lib/config";

export const dynamic = "force-dynamic";

export default function HomePage() {
  const portalUrl = getPortalUrl();
  const mode = resolveAppMode();

  return (
    <BoardApp
      portalUrl={
        portalUrl ??
        (mode === "mock" ? null : process.env.NEXT_PUBLIC_BITRIX_PORTAL_URL ?? null)
      }
    />
  );
}
