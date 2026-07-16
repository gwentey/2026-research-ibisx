"use client";

import { Card, CardAction, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarGroup, AvatarImage } from "@/components/ui/avatar";
import { Search } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from "@/components/ui/table";
import { useState } from "react";
import type { ActiveListingRow } from "../types";

interface ActiveListingTableProps {
  items: ActiveListingRow[];
}

const statusVariant: Record<ActiveListingRow["status"], "default" | "secondary" | "destructive"> = {
  Occupied: "default",
  Available: "secondary",
  "Sold Out": "destructive"
};

export function ActiveListingTable({ items }: ActiveListingTableProps) {
  const [search, setSearch] = useState("");
  const q = search.toLowerCase();

  const filteredItems = items.filter(
    (item) => item.property.toLowerCase().includes(q) || item.location.toLowerCase().includes(q)
  );

  return (
    <Card className="min-w-0">
      <CardHeader>
        <CardTitle>Active Listing</CardTitle>
        <CardAction>
          <InputGroup className="max-w-44">
            <InputGroupInput
              placeholder="Search..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <InputGroupAddon>
              <Search />
            </InputGroupAddon>
          </InputGroup>
        </CardAction>
      </CardHeader>
      <CardContent className="min-w-0">
        <Table className="w-max min-w-full">
          <TableHeader>
            <TableRow>
              <TableHead>Property</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Cost</TableHead>
              <TableHead>Active Leads</TableHead>
              <TableHead>Views</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredItems.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-muted-foreground h-24 text-center">
                  {items.length === 0
                    ? "No active listings yet."
                    : "No listings match your search."}
                </TableCell>
              </TableRow>
            ) : (
              filteredItems.map((item) => (
                <TableRow key={item.id}>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <img
                        src={item.image}
                        alt={item.property}
                        className="size-10 shrink-0 rounded-lg object-cover"
                      />
                      <div className="flex-1">
                        <p className="font-semibold" title={item.property}>
                          {item.property}
                        </p>
                        <p className="text-muted-foreground text-sm" title={item.location}>
                          {item.location}
                        </p>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>{item.type}</TableCell>
                  <TableCell>{item.cost}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <AvatarGroup>
                        {item.leads.avatars.slice(0, 2).map((avatar, i) => (
                          <Avatar key={i} className="size-6">
                            <AvatarImage src={avatar} />
                            <AvatarFallback>U</AvatarFallback>
                          </Avatar>
                        ))}
                      </AvatarGroup>
                      <span className="text-muted-foreground text-xs">+{item.leads.count}</span>
                    </div>
                  </TableCell>
                  <TableCell>{item.views}</TableCell>
                  <TableCell>
                    <Badge variant={statusVariant[item.status]}>
                      {item.status === "Occupied"
                        ? `${item.units - 4}/${item.units} Occupied`
                        : item.status}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
