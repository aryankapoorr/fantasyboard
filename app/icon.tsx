import { ImageResponse } from "next/og";

export const size = { width: 32, height: 32 };
export const contentType = "image/png";

// Three descending bars = a ranked/tiered draft board — the app's core concept — rather than a
// generic monogram or logo mark.
export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          gap: 3,
          background: "#12151b",
          padding: "0 6px",
        }}
      >
        <div style={{ width: 20, height: 4, borderRadius: 2, background: "#e8a33d" }} />
        <div style={{ width: 14, height: 4, borderRadius: 2, background: "#e8a33d" }} />
        <div style={{ width: 8, height: 4, borderRadius: 2, background: "#e8a33d" }} />
      </div>
    ),
    { ...size }
  );
}
