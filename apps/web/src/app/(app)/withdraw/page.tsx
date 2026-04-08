import { redirect } from "next/navigation";

/** Legacy route; earnings no longer uses an in-app withdraw flow. */
export default function WithdrawPage() {
  redirect("/earnings");
}
