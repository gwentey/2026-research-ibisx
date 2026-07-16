import { Metadata } from "next";
import Link from "next/link";
import { PlusIcon } from "@radix-ui/react-icons";
import { generateMeta } from "@/lib/utils";

import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import OrdersDataTable, { Order } from "./data-table";
import ordersData from "./data.json";

export async function generateMetadata(): Promise<Metadata> {
  return generateMeta({
    title: "Orders Page",
    additionalTitle: true,
    description:
      "Orders Page for shadcn/ui built with React, Tailwind CSS, and TypeScript. Manage order history, status, and tracking using responsive data tables and filtering components.",
    canonical: "/pages/orders"
  });
}

export default function Page() {
  return (
    <div className="space-y-4">
      <div className="flex flex-row items-center justify-between">
        <h1 className="text-xl font-bold tracking-tight lg:text-2xl">Orders</h1>
        <Button asChild>
          <Link href="#">
            <PlusIcon /> Create Order
          </Link>
        </Button>
      </div>
      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList>
          <TabsTrigger value="overview">All</TabsTrigger>
          <TabsTrigger value="completed">Completed</TabsTrigger>
          <TabsTrigger value="processed">Processed</TabsTrigger>
          <TabsTrigger value="returned">Returned</TabsTrigger>
          <TabsTrigger value="canceled">Canceled</TabsTrigger>
        </TabsList>
        <OrdersDataTable data={ordersData as unknown as Order[]} />
      </Tabs>
    </div>
  );
}
