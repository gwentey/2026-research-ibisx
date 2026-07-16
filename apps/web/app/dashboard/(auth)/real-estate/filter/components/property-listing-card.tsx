"use client";

import { Bath, BedDouble, Heart, Home, MapPin, Star } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { RealEstateProperty } from "../../types";

export type Property = RealEstateProperty;

type PropertyListingCardProps = {
  property: Property;
  isFavorite: boolean;
  onOpenDetail: (property: Property) => void;
  onToggleFavorite: (id: number, event: React.MouseEvent) => void;
  formatPrice: (price: number) => string;
};

export function PropertyListingCard({
  property,
  isFavorite,
  onOpenDetail,
  onToggleFavorite,
  formatPrice
}: PropertyListingCardProps) {
  return (
    <Card
      className="cursor-pointer gap-4 overflow-hidden pt-0 transition-shadow hover:shadow-lg"
      onClick={() => onOpenDetail(property)}>
      <div className="relative">
        <img src={property.image} alt={property.title} className="h-48 w-full object-cover" />
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={(event) => onToggleFavorite(property.id, event)}
          className={cn(
            "bg-background text-muted-foreground hover:text-destructive absolute top-3 right-3 rounded-full",
            {
              "text-destructive": isFavorite
            }
          )}>
          <Heart fill={isFavorite ? "currentColor" : "none"} />
        </Button>
      </div>
      <CardContent>
        <h3 className="mb-1 text-base font-semibold">{property.title}</h3>
        <div className="text-muted-foreground flex items-center gap-1 text-sm">
          <MapPin className="size-3" />
          <span className="truncate">{property.address}</span>
        </div>
        <div className="my-4 flex flex-wrap gap-2">
          <Badge variant="outline" className="gap-1 font-normal">
            <Home className="h-3 w-3" />
            {property.rooms} Rooms
          </Badge>
          <Badge variant="outline" className="gap-1 font-normal">
            <BedDouble className="h-3 w-3" />
            {property.beds} Beds
          </Badge>
          <Badge variant="outline" className="gap-1 font-normal">
            <Bath className="h-3 w-3" />
            {property.baths} Baths
          </Badge>
        </div>
        <div className="flex items-center justify-between">
          <div>
            {property.originalPrice && (
              <span className="text-muted-foreground mr-2 text-sm line-through">
                {formatPrice(property.originalPrice)}
              </span>
            )}
            <span className="text-lg font-bold">{formatPrice(property.price)}</span>
            <span className="text-muted-foreground text-sm">/{property.priceType}</span>
          </div>
          <div className="flex items-center gap-1">
            <Star className="size-3 fill-amber-500 text-amber-500" />
            <span className="text-muted-foreground text-xs">{property.rating.toFixed(1)}</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
