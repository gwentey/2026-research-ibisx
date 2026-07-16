import { generateMeta } from "@/lib/utils";

import { BalanceOverview } from "./components/balance-overview";
import { TransactionHistory } from "./components/transaction-history";
import { ExchangeRates } from "./components/exchange-rates";

export async function generateMetadata() {
  return generateMeta({
    title: "Payment Admin Dashboard",
    description:
      "Track balances, transaction history, and exchange rates. A professional payment admin page built with React, TypeScript, Tailwind CSS, and shadcn/ui.",
    canonical: "/payment"
  });
}

export default function Page() {
  return (
    <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
      <div className="space-y-4 lg:col-span-2">
        <BalanceOverview />
        <TransactionHistory />
      </div>
      <div className="space-y-4">
        <ExchangeRates />
      </div>
    </div>
  );
}
