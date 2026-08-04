import { AdUnit } from "./AdUnit";

export function BoardPageMain({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto flex w-full max-w-[calc(64rem+13rem)] flex-1 gap-6 px-0 sm:px-4 xl:px-0">
      <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col">{children}</main>
      <aside className="hidden w-40 shrink-0 xl:block">
        <div className="sticky top-4">
          <AdUnit slot={process.env.NEXT_PUBLIC_ADSENSE_BOARD_RAIL_SLOT ?? ""} />
        </div>
      </aside>
    </div>
  );
}
