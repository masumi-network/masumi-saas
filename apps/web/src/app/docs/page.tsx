import { redirect } from "next/navigation";

/** External docs hub — implemented as a route (not next.config redirect) so /docs/* app routes win. */
export default function DocsIndexPage() {
  redirect("https://docs.masumi.network/");
}
