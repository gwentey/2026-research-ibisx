import { generateMeta } from "@/lib/utils";

import { FileUploadDialog } from "./components/file-upload-dialog";
import { TableRecentFiles } from "./components/table-recent-files";
import { SummaryCards } from "./components/summary-cards";
import { StorageStatusCard } from "./components/storage status-card";
import { ChartFileTransfer } from "./components/chart-file-transfer";
import { FolderListCards } from "./components/folder-list-cards";

export async function generateMetadata() {
  return generateMeta({
    title: "File Manager Admin Dashboard Template",
    description:
      "Manage files, folders, and storage status with interactive charts. A professional admin page built with React, Next.js, TypeScript, Tailwind CSS, and shadcn/ui.",
    canonical: "/file-manager"
  });
}

export default function Page() {
  return (
    <div className="space-y-4">
      <div className="flex flex-row items-center justify-between">
        <h1 className="text-xl font-bold tracking-tight lg:text-2xl">File Manager</h1>
        <FileUploadDialog />
      </div>
      <SummaryCards />
      <div className="mb-4 grid gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <FolderListCards />
        </div>
        <StorageStatusCard />
      </div>
      <div className="gap-4 space-y-4 lg:grid lg:grid-cols-2 lg:space-y-0">
        <ChartFileTransfer />
        <TableRecentFiles />
      </div>
    </div>
  );
}
