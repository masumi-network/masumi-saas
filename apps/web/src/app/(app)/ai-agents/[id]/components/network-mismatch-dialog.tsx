"use client";

import { ArrowLeftRight } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { PaymentNodeNetwork } from "@/lib/payment-node";

interface NetworkMismatchDialogProps {
  open: boolean;
  agentNetwork: PaymentNodeNetwork;
  currentNetwork: PaymentNodeNetwork;
  onSwitch: () => void;
  onBack: () => void;
}

export function NetworkMismatchDialog({
  open,
  agentNetwork,
  currentNetwork,
  onSwitch,
  onBack,
}: NetworkMismatchDialogProps) {
  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onBack()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Switch Network</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">
          This agent is on{" "}
          <span className="font-medium text-foreground">{agentNetwork}</span>,
          but you&apos;re currently on{" "}
          <span className="font-medium text-foreground">{currentNetwork}</span>.
          Switch networks to view this agent.
        </p>
        <DialogFooter>
          <Button variant="outline" onClick={onBack}>
            Go back
          </Button>
          <Button variant="primary" onClick={onSwitch}>
            <ArrowLeftRight className="h-4 w-4" />
            Switch to {agentNetwork}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
