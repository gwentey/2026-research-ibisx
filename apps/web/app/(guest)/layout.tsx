import React from "react";

import { GuestGuard } from "@/components/ibis/auth-guard";

export default function GuestLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return <GuestGuard>{children}</GuestGuard>;
}
