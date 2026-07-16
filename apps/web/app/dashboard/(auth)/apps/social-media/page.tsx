import { Metadata } from "next";
import { generateMeta } from "@/lib/utils";

import { Button } from "@/components/ui/button";

import { SocialMediaSidebar } from "./components/social-media-sidebar";
import { SocialMediaStories } from "./components/social-media-stories";
import { AsideRight } from "./components/aside-right";
import { PostItem } from "./components/post-item";

import { postsData } from "./data";

export async function generateMetadata(): Promise<Metadata> {
  return generateMeta({
    title: "Social Media App",
    additionalTitle: true,
    description:
      "Connect with users, share updates, and interact with social feeds using a modern multi-column layout featuring stories and interactive posts. A professional social media app built with React, TypeScript, Tailwind CSS, and shadcn/ui.",
    canonical: "/apps/social-media"
  });
}

export default function Page() {
  return (
    <div className="grid h-[var(--content-full-height)] flex-1 gap-4 overflow-hidden md:grid-cols-[280px_auto] lg:grid-cols-[280px_auto_280px]">
      <SocialMediaSidebar />

      <main className="flex-1 overflow-y-auto">
        <div className="mx-auto lg:max-w-xl">
          <div className="space-y-4">
            {/* Stories */}
            <SocialMediaStories />

            {/* Posts */}
            <div className="space-y-4 divide-y lg:space-y-6 [&>div]:py-4">
              {postsData.map((post, i) => (
                <PostItem key={i} post={post} />
              ))}

              <div className="text-center">
                <Button variant="outline">More posts</Button>
              </div>
            </div>
          </div>
        </div>
      </main>

      <AsideRight />
    </div>
  );
}
