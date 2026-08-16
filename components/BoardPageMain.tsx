import { AdUnit } from "./AdUnit";

export function BoardPageMain({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto flex w-full max-w-[calc(64rem+23rem)] flex-1 gap-6 px-0 sm:px-4 xl:px-0">
      <div className="hidden w-40 shrink-0 xl:block" aria-hidden="true" />
      <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col">{children}</main>
      <aside className="hidden w-40 shrink-0 overflow-hidden xl:block">
        {/* AdSense's "auto"/full-width-responsive format can pick a size wider than this rail
            (160px is narrow for it) — without a clip here, that bleeds into the flex row and
            pushes the whole page wider than the viewport, showing up as scrollable blank space
            past the right edge. */}
        <div className="sticky top-4">
          <AdUnit slot={process.env.NEXT_PUBLIC_ADSENSE_BOARD_RAIL_SLOT ?? ""} />
        </div>
      </aside>
    </div>
  );
}
