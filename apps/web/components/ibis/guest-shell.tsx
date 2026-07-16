import Image from "next/image";
import React from "react";

// Coquille des pages invité : reprend la mise en page login/v1 du template
// (visuel plein écran à gauche, formulaire centré à droite) — P6.
export function GuestShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex pb-8 lg:h-screen lg:pb-0">
      <div className="hidden w-1/2 bg-gray-100 lg:block">
        <Image
          width={1000}
          height={1000}
          src="/images/extra/image4.jpg"
          alt=""
          priority
          className="h-full w-full object-cover"
        />
      </div>
      <div className="flex w-full items-center justify-center lg:w-1/2">
        <div className="w-full max-w-md space-y-8 px-4 py-10 lg:py-0">{children}</div>
      </div>
    </div>
  );
}
