import { ChevronRight } from "lucide-react";

import { Card, CardAction, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

export function LeaderboardCard() {
  const topStudents = [
    {
      id: 1,
      name: "Liam Smith",
      points: 5000,
      avatar: `https://i.pravatar.cc/150?img=1`
    },
    {
      id: 2,
      name: "Emma Brown",
      points: 4800,
      avatar: `https://i.pravatar.cc/150?img=2`
    },
    {
      id: 3,
      name: "Noah Johnson",
      points: 4600,
      avatar: `/imageshttps://i.pravatar.cc/150?img=3`
    },
    {
      id: 4,
      name: "Olivia Davis",
      points: 4400,
      avatar: `https://i.pravatar.cc/150?img=4`
    }
  ];

  return (
    <Card className="h-full">
      <CardHeader className="flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle>Leaderboard</CardTitle>
        <CardAction className="-mt-2.5">
          <Button variant="outline" size="icon">
            <ChevronRight />
          </Button>
        </CardAction>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {topStudents.map((student, index) => (
            <li key={student.id} className="flex items-center space-x-4">
              <span>{index + 1}.</span>
              <Avatar>
                <AvatarImage src={student.avatar} alt={student.name} />
                <AvatarFallback>
                  {student.name
                    .split(" ")
                    .map((n) => n[0])
                    .join("")}
                </AvatarFallback>
              </Avatar>
              <span className="flex-1">{student.name}</span>
              <Badge variant="outline">{student.points} pts</Badge>
            </li>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
