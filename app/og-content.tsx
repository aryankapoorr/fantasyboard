// Shared visual content for opengraph-image.tsx and twitter-image.tsx — not a route itself
// (only files literally named opengraph-image/twitter-image are picked up by Next.js), just a
// place to keep the two generated images from drifting apart.
export function OgContent() {
  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        background: "#12151b",
        padding: "64px 72px",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
          <div style={{ width: 56, height: 13, borderRadius: 6, background: "#e8a33d" }} />
          <div style={{ width: 40, height: 13, borderRadius: 6, background: "#e8a33d" }} />
          <div style={{ width: 24, height: 13, borderRadius: 6, background: "#e8a33d" }} />
        </div>
        <div style={{ display: "flex", fontSize: 34, fontWeight: 700, color: "#eceef2", letterSpacing: 2 }}>
          FANTASYBOARD
        </div>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 22, maxWidth: 1000 }}>
        <div style={{ display: "flex", fontSize: 62, fontWeight: 700, color: "#eceef2", lineHeight: 1.15 }}>
          Walk into your draft with a board that&apos;s actually yours.
        </div>
        <div style={{ display: "flex", fontSize: 28, color: "#8891a3" }}>
          Consensus rankings + live ADP, merged into a board you drag into your own order.
        </div>
      </div>

      <div style={{ display: "flex", fontSize: 22, color: "#e8a33d" }}>fantasydraftboard.vercel.app</div>
    </div>
  );
}
