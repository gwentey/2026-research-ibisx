"use client";

import { useMemo, useState } from "react";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from "@/components/ui/select";
import {
  ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent
} from "@/components/ui/chart";
import { Area, AreaChart, CartesianGrid, XAxis } from "recharts";
import type { ListingData } from "../../types";

type MarketValueSectionProps = {
  marketValue: ListingData["marketValue"];
};

const chartConfig = {
  sales: {
    label: "Sales",
    color: "var(--chart-2)"
  },
  rent: {
    label: "Rent",
    color: "var(--chart-5)"
  },
  buy: {
    label: "Buy",
    color: "var(--chart-3)"
  }
} satisfies ChartConfig;

export function MarketValueSection({ marketValue }: MarketValueSectionProps) {
  const years = useMemo(
    () =>
      Array.from(new Set(marketValue.history.map((item) => item.year))).sort(
        (a, b) => Number(b) - Number(a)
      ),
    [marketValue.history]
  );
  const [selectedYear, setSelectedYear] = useState(years[0] ?? "");
  const filteredHistory = useMemo(
    () => marketValue.history.filter((item) => item.year === selectedYear),
    [marketValue.history, selectedYear]
  );

  return (
    <section className="grid gap-4 lg:grid-cols-[280px_1fr]">
      <h2 className="text-3xl font-semibold text-balance">{marketValue.title}</h2>

      <div className="space-y-5">
        <div className="grid gap-3 md:grid-cols-3">
          <Card>
            <CardContent className="space-y-2 px-4">
              <p className="text-muted-foreground text-sm">Zestimate</p>
              <p className="text-3xl font-semibold">{marketValue.stats.zestimate}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="space-y-2 px-4">
              <p className="text-muted-foreground text-sm">Sales range</p>
              <p className="text-3xl font-semibold">{marketValue.stats.salesRange}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="space-y-2 px-4">
              <p className="text-muted-foreground text-sm">Rent</p>
              <p className="text-3xl font-semibold">{marketValue.stats.rent}</p>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>History</CardTitle>
            <CardDescription>Market trend overview</CardDescription>
            <CardAction>
              <Select value={selectedYear} onValueChange={setSelectedYear}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {years.map((year) => (
                    <SelectItem key={year} value={year}>
                      {year}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </CardAction>
          </CardHeader>
          <CardContent className="px-4">
            <ChartContainer config={chartConfig} className="aspect-auto h-[250px] w-full">
              <AreaChart accessibilityLayer data={filteredHistory} margin={{ left: 12, right: 12 }}>
                <defs>
                  <linearGradient id="fillSales" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="var(--color-sales)" stopOpacity={0.8} />
                    <stop offset="95%" stopColor="var(--color-sales)" stopOpacity={0.1} />
                  </linearGradient>
                  <linearGradient id="fillRent" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="var(--color-rent)" stopOpacity={0.8} />
                    <stop offset="95%" stopColor="var(--color-rent)" stopOpacity={0.1} />
                  </linearGradient>
                  <linearGradient id="fillBuy" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="var(--color-buy)" stopOpacity={0.8} />
                    <stop offset="95%" stopColor="var(--color-buy)" stopOpacity={0.1} />
                  </linearGradient>
                </defs>
                <CartesianGrid vertical={false} />
                <XAxis
                  dataKey="month"
                  tickLine={false}
                  axisLine={false}
                  tickMargin={8}
                  tickFormatter={(value: string) => value.slice(0, 3)}
                />
                <ChartTooltip cursor={false} content={<ChartTooltipContent />} />
                <Area
                  dataKey="sales"
                  type="natural"
                  fill="url(#fillSales)"
                  fillOpacity={0.4}
                  stroke="var(--color-sales)"
                  stackId="a"
                />
                <Area
                  dataKey="rent"
                  type="natural"
                  fill="url(#fillRent)"
                  fillOpacity={0.4}
                  stroke="var(--color-rent)"
                  stackId="a"
                />
                <Area
                  dataKey="buy"
                  type="natural"
                  fill="url(#fillBuy)"
                  fillOpacity={0.4}
                  stroke="var(--color-buy)"
                  stackId="a"
                />
              </AreaChart>
            </ChartContainer>
          </CardContent>
        </Card>
      </div>
    </section>
  );
}
