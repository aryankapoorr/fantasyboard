import { ImageResponse } from "next/og";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          gap: 16,
          background: "#12151b",
          padding: "0 34px",
        }}
      >
        <div style={{ width: 112, height: 20, borderRadius: 10, background: "#e8a33d" }} />
        <div style={{ width: 80, height: 20, borderRadius: 10, background: "#e8a33d" }} />
        <div style={{ width: 48, height: 20, borderRadius: 10, background: "#e8a33d" }} />
      </div>
    ),
    { ...size }
  );
}
