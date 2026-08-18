import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/site";

// /boards and /boards/[boardId] are sign-in-gated and per-user — nothing there for a crawler to
// index, so only the public, unauthenticated routes are listed.
export default function sitemap(): MetadataRoute.Sitemap {
  return [
    { url: `${SITE_URL}/`, changeFrequency: "weekly", priority: 1 },
    { url: `${SITE_URL}/guest`, changeFrequency: "weekly", priority: 0.9 },
    { url: `${SITE_URL}/privacy`, changeFrequency: "yearly", priority: 0.2 },
  ];
}
