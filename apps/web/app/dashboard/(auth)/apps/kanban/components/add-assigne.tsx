import * as React from "react";
import { Check, UserPlusIcon } from "lucide-react";

import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger
} from "@/components/ui/dialog";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList
} from "@/components/ui/command";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";

const users = [
  {
    name: "Olivia Martin",
    email: "m@example.com",
    avatar: `https://i.pravatar.cc/150?img=1`
  },
  {
    name: "Isabella Nguyen",
    email: "isabella.nguyen@email.com",
    avatar: `https://i.pravatar.cc/150?img=7`
  },
  {
    name: "Emma Wilson",
    email: "emma@example.com",
    avatar: `https://i.pravatar.cc/150?img=2`
  },
  {
    name: "Jackson Lee",
    email: "lee@example.com",
    avatar: `https://i.pravatar.cc/150?img=9`
  },
  {
    name: "William Kim",
    email: "will@email.com",
    avatar: `https://i.pravatar.cc/150?img=6`
  }
] as const;

type User = (typeof users)[number];

export default function AddAssigne() {
  const [open, setOpen] = React.useState(false);
  const [selectedUsers, setSelectedUsers] = React.useState<User[]>([]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline">
          <UserPlusIcon />
          <span className="hidden lg:inline">Add Assigne</span>
        </Button>
      </DialogTrigger>
      <DialogContent className="gap-0 p-0 outline-hidden">
        <DialogHeader className="px-4 pt-5 pb-4">
          <DialogTitle>Assign Users</DialogTitle>
        </DialogHeader>
        <Command className="overflow-hidden rounded-t-none border-t">
          <CommandInput placeholder="Search user..." />
          <CommandList>
            <CommandEmpty>No users found.</CommandEmpty>
            <CommandGroup className="p-2">
              {users.map((user) => (
                <CommandItem
                  key={user.email}
                  className="flex items-center p-2"
                  onSelect={() => {
                    if (selectedUsers.includes(user)) {
                      return setSelectedUsers(
                        selectedUsers.filter((selectedUser) => selectedUser !== user)
                      );
                    }

                    return setSelectedUsers(
                      [...users].filter((u) => [...selectedUsers, user].includes(u))
                    );
                  }}>
                  <Avatar>
                    <AvatarImage src={user.avatar} alt="Image" />
                    <AvatarFallback>{user.name[0]}</AvatarFallback>
                  </Avatar>
                  <div className="ml-2">
                    <p className="text-sm leading-none font-medium">{user.name}</p>
                    <p className="text-muted-foreground text-sm">{user.email}</p>
                  </div>
                  {selectedUsers.includes(user) ? (
                    <Check className="text-primary ml-auto flex h-5 w-5" />
                  ) : null}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
        <DialogFooter className="flex items-center border-t p-4 sm:justify-between">
          {selectedUsers.length > 0 ? (
            <div className="flex -space-x-2 overflow-hidden">
              {selectedUsers.map((user) => (
                <Avatar key={user.email} className="border-background inline-block border-2">
                  <AvatarImage src={user.avatar} />
                  <AvatarFallback>{user.name[0]}</AvatarFallback>
                </Avatar>
              ))}
            </div>
          ) : (
            <p className="text-muted-foreground text-sm">Select the users to add to this role.</p>
          )}
          <Button
            disabled={selectedUsers.length < 1}
            onClick={() => {
              setOpen(false);
            }}>
            Assign
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
