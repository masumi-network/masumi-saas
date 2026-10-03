import type { X402App } from "./route-context";
import { registerX402AlertsRoutes } from "./routes-alerts";
import { registerX402BudgetsRoutes } from "./routes-budgets";
import { registerX402HistoryRoutes } from "./routes-history";
import { registerX402NetworksRoutes } from "./routes-networks";
import { registerX402PaymentsRoutes } from "./routes-payments";
import { registerX402WalletsRoutes } from "./routes-wallets";

export function registerX402Routes(app: X402App): void {
  registerX402PaymentsRoutes(app);
  registerX402WalletsRoutes(app);
  registerX402NetworksRoutes(app);
  registerX402BudgetsRoutes(app);
  registerX402HistoryRoutes(app);
  registerX402AlertsRoutes(app);
}
