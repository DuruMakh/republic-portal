import type { MetadataRoute } from "next";
import { isProductionEnv } from "@/lib/env";
import { siteUrl } from "@/lib/site";

export default function robots(): MetadataRoute.Robots {
  if (isProductionEnv()) {
    return { rules: { userAgent: "*", allow: "/" }, sitemap: `${siteUrl()}/sitemap.xml` };
  }
  return { rules: { userAgent: "*", disallow: "/" } };
}
