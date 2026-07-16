import { generateMeta } from "@/lib/utils";

import { WelcomeCard } from "./components/welcome-card";
import { LeaderboardCard } from "./components/leader-board-card";
import { LearningPathCard } from "./components/learning-path-card";
import { ChartMostActivity } from "./components/chart-most-activity";
import { ProgressStatisticsCard } from "./components/progress-statistics-card";
import { StudentSuccessCard } from "./components/student-success-card";
import { CourseProgressByMonth } from "./components/course-progress-by-month";
import { CoursesListTable } from "./components/courses-list";

export async function generateMetadata() {
  return generateMeta({
    title: "Academy Admin Dashboard Template",
    description:
      "Manage courses, student success, and learning paths with analytics. A professional academy admin page built with React, Next.js, TypeScript, Tailwind CSS, and shadcn/ui.",
    canonical: "/academy"
  });
}

export default function Page() {
  return (
    <div className="space-y-4">
      <div className="mb-4">
        <h1 className="text-2xl font-bold tracking-tight">Academy</h1>
      </div>
      <div className="grid gap-4 lg:grid-cols-12">
        <div className="lg:col-span-12 xl:col-span-6">
          <WelcomeCard />
        </div>
        <div className="lg:col-span-6 xl:col-span-3">
          <LearningPathCard />
        </div>
        <div className="lg:col-span-6 xl:col-span-3">
          <LeaderboardCard />
        </div>
      </div>
      <div className="grid gap-4 xl:grid-cols-3">
        <StudentSuccessCard
          currentSuccessRate={88}
          previousSuccessRate={85}
          totalStudents={1500}
          passingStudents={1320}
        />
        <ProgressStatisticsCard />
        <ChartMostActivity />
      </div>
      <div className="mt-4 gap-4 space-y-4 xl:grid xl:grid-cols-2 xl:space-y-0">
        <CourseProgressByMonth />
        <CoursesListTable />
      </div>
    </div>
  );
}
