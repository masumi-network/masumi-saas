import { redirect } from "next/navigation";

/**
 * Withdraw opens as a dialog on the earnings page (?action=withdraw).
 */
export default function WithdrawPage() {
  redirect("/earnings?action=withdraw");
}
