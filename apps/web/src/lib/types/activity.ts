/** Tab filter key; maps to API filter (lifecycle = agent lifecycle events). */
export type ActivityTabFilter =
  | "all"
  | "lifecycle"
  | "transactions"
  | "purchases"
  | "payments"
  | "refundRequests"
  | "disputes";

export type ActivityFeedItem =
  | {
      kind: "lifecycle";
      id: string;
      date: string;
      type: string;
      agentId: string | null;
      agentName: string | null;
    }
  | {
      kind: "transaction";
      id: string;
      date: string;
      type: "payment" | "purchase";
      agentId: string | null;
      agentName: string | null;
      /** On-chain registry identifier from the payment node (may be set when `agentId` is still unknown). */
      agentIdentifier: string | null;
      amount: string;
      status: string;
      txHash: string | null;
    };
