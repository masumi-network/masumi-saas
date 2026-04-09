import { redirect } from "next/navigation";

/**
 * External docs hub — route (not next.config redirect) so /docs/* app routes are not shadowed.
 * `redirect()` → 307 temporary; see README (avoid 308 caching while the hub URL may change).
 */
export default function DocsIndexPage() {
  redirect("https://docs.masumi.network/");
}
