"use client";

import React from "react";
import { PlusIcon, Search } from "lucide-react";
import useChatStore from "../useChatStore";
import { ChatItemProps } from "../types";

import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group";
import { ChatListItem } from "./chat-list-item";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuTrigger
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";

export function ChatSidebar({ chats }: { chats: ChatItemProps[] }) {
  const { selectedChat } = useChatStore();
  const [filteredChats, setFilteredChats] = React.useState(chats);

  const changeHandle = (e: React.ChangeEvent<HTMLInputElement>) => {
    const searchTerm = e.target.value.trim();

    const filteredItems = chats.filter((chat) =>
      chat.user.name.toLowerCase().includes(searchTerm.toLowerCase())
    );
    setFilteredChats(filteredItems);
  };

  return (
    <Card className="w-full pb-0 lg:w-80">
      <CardHeader>
        <CardTitle className="font-display text-xl lg:text-xl">Chats</CardTitle>
        <CardAction>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="icon-sm" className="rounded-full">
                <PlusIcon />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuGroup>
                <DropdownMenuItem>New chat</DropdownMenuItem>
                <DropdownMenuItem>Create group</DropdownMenuItem>
                <DropdownMenuItem>Add contact</DropdownMenuItem>
              </DropdownMenuGroup>
            </DropdownMenuContent>
          </DropdownMenu>
        </CardAction>
        <CardDescription className="col-span-2 mt-4 w-full">
          <InputGroup>
            <InputGroupAddon>
              <Search />
            </InputGroupAddon>
            <InputGroupInput type="text" placeholder="Chats search..." onChange={changeHandle} />
          </InputGroup>
        </CardDescription>
      </CardHeader>

      <CardContent className="flex-1 overflow-auto border-t p-0">
        <div className="block min-w-0 divide-y">
          {filteredChats.length ? (
            filteredChats.map((chat, key) => (
              <ChatListItem
                chat={chat}
                key={key}
                active={selectedChat && selectedChat.id === chat.id}
              />
            ))
          ) : (
            <div className="text-muted-foreground mt-4 text-center text-sm">No chat found</div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
