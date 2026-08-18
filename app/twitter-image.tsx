import { ImageResponse } from "next/og";
import { OgContent } from "./og-content";

export const alt = "FantasyBoard — Draft Board";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function TwitterImage() {
  return new ImageResponse(<OgContent />, { ...size });
}
