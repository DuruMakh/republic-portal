import type { MetadataRoute } from "next";
import { isProductionEnv } from "@/lib/env";
import { siteUrl } from "@/lib/site";

export default function robots(): MetadataRoute.Robots {
  if (isProductionEnv()) {
    return {
      rules: {
        userAgent: "*",
        allow: "/",
        // Crawlers read these as prefixes: a bare /delegate or /me would also hide public
        // addresses such as /delegates/<slug>, hence the `$` and trailing-slash forms.
        disallow: ["/admin", "/me$", "/me/", "/delegate$", "/delegate/", "/api/", "/auth/"],
      },
      sitemap: `${siteUrl()}/sitemap.xml`,
    };
  }
  return { rules: { userAgent: "*", disallow: "/" } };
}
