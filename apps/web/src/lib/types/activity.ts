export type ActivityFeedItem =
  | {
      kind: "lifecycle";
      id: string;
      date: string;
      type: string;
      agentId: string;
      agentName: string;
    }
  | {
      kind: "transaction";
      id: string;
      date: string;
      type: "payment" | "purchase";
      agentId: string | null;
      agentName: string | null;
      amount: string;
      status: string;
      txHash: string | null;
    };
