import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";

export function DealsProgress() {
  return (
    <Card>
      <CardContent className="space-y-4">
        <div className="flex justify-between">
          <div className="flex items-end gap-1.5">
            <p className="text-2xl font-bold">42</p>
            <p className="text-muted-foreground mb-0.5 text-sm">Closed Deals</p>
          </div>
          <div className="flex items-end gap-1.5">
            <p className="text-muted-foreground mb-0.5 text-sm">On Progress</p>
            <p className="text-2xl font-bold">132</p>
          </div>
        </div>
        <div className="relative">
          <Progress
            value={40}
            className="bg-muted h-8 w-full rounded-full **:data-[slot='progress-indicator']:rounded-full"
          />
          <span className="absolute inset-0 flex items-center ps-4 text-xs text-white/90 dark:invert">
            Deals
          </span>
        </div>
      </CardContent>
    </Card>
  );
}
