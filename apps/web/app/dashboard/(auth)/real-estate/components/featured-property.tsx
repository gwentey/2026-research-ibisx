import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

import type { FeaturedPropertyItem } from "../types";

interface FeaturedPropertyProps {
  item: FeaturedPropertyItem;
}

export function FeaturedProperty({ item }: FeaturedPropertyProps) {
  return (
    <Card>
      <CardContent className="gap-4 space-y-4 lg:grid lg:grid-cols-2 lg:space-y-0">
        <div className="flex flex-col justify-between">
          <div className="mb-4">
            <div className="text-xl lg:text-2xl">{item.name}</div>
            <div className="text-muted-foreground text-sm">{item.type}</div>
          </div>
          <div className="flex justify-between gap-2 text-center">
            <div className="bg-muted grow rounded-xl px-2 py-3">
              <p className="text-xl font-bold">{item.sold}</p>
              <p className="text-muted-foreground text-xs">Sold</p>
            </div>
            <div className="bg-muted grow rounded-xl px-2 py-3">
              <p className="text-xl font-bold">{item.rented}</p>
              <p className="text-muted-foreground text-xs">Rented</p>
            </div>
            <div className="bg-muted grow rounded-xl px-2 py-3">
              <p className="text-xl font-bold">{item.views}</p>
              <p className="text-muted-foreground text-xs">Views</p>
            </div>
          </div>
        </div>
        <figure className="relative order-first overflow-hidden lg:order-last">
          <img
            src={item.image}
            alt={item.name}
            className="aspect-video w-full rounded-xl object-cover lg:h-44"
          />
          <div className="absolute top-2 left-2">
            <Badge variant="secondary">Recommended to {item.leads} Leads</Badge>
          </div>
        </figure>
      </CardContent>
    </Card>
  );
}
