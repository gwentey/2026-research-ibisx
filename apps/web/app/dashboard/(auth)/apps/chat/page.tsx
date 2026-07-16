import { generateMeta } from "@/lib/utils";
import { ChatItemProps, UserPropsTypes } from "./types";

import { ChatSidebar, ChatContent } from "./components";
import chatsData from "./data/chats.json";
import contactsData from "./data/contacts.json";

export async function generateMetadata() {
  return generateMeta({
    title: "Chat App",
    additionalTitle: true,
    description:
      "Manage real-time conversations, media sharing, and contact lists with a modern messaging ui. A professional chat application page built with React, Next.js, TypeScript, Tailwind CSS, and shadcn/ui.",
    canonical: "/apps/chat"
  });
}

export default function Page() {
  const contacts = contactsData as unknown as UserPropsTypes[];
  const chats = (chatsData as unknown as ChatItemProps[]).map((item) => ({
    ...item,
    user: contacts.find((contact) => contact.id === item.user_id) as UserPropsTypes
  }));

  return (
    <div className="flex h-[calc(100vh-var(--header-height)-3rem)] w-full">
      <ChatSidebar chats={chats} />
      <div className="grow">
        <ChatContent />
      </div>
    </div>
  );
}
