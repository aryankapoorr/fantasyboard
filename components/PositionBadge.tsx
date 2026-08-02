import type { Position } from "@/lib/types";

const POSITION_STYLES: Record<Position, string> = {
  QB: "bg-pos-qb/15 text-pos-qb border-pos-qb/40",
  RB: "bg-pos-rb/15 text-pos-rb border-pos-rb/40",
  WR: "bg-pos-wr/15 text-pos-wr border-pos-wr/40",
  TE: "bg-pos-te/15 text-pos-te border-pos-te/40",
  K: "bg-pos-k/15 text-pos-k border-pos-k/40",
  DST: "bg-pos-dst/15 text-pos-dst border-pos-dst/40",
};

export function PositionBadge({ position }: { position: Position }) {
  return (
    <span
      className={`inline-flex items-center justify-center rounded border px-1.5 py-0.5 font-mono text-[10px] font-medium tracking-wide ${POSITION_STYLES[position]}`}
    >
      {position}
    </span>
  );
}

export function positionEdgeColor(position: Position): string {
  const map: Record<Position, string> = {
    QB: "var(--pos-qb)",
    RB: "var(--pos-rb)",
    WR: "var(--pos-wr)",
    TE: "var(--pos-te)",
    K: "var(--pos-k)",
    DST: "var(--pos-dst)",
  };
  return map[position];
}
