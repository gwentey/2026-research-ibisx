import React from "react";

import { AuthBrandPanel } from "@/components/ibis/auth-brand-panel";

// Coquille des pages invité : panneau de marque "sentier balisé" (desktop, w-1/2 pleine
// hauteur) / bande compacte (mobile, en tête de page), formulaire centré en vis-à-vis — P6
// (refonte 02 : remplace l'ancienne photo stock `/images/extra/image4.jpg`).
export function GuestShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-col pb-8 lg:h-screen lg:flex-row lg:pb-0">
      <AuthBrandPanel />
      <div className="flex w-full flex-1 items-center justify-center lg:w-1/2">
        <div className="w-full max-w-md space-y-8 px-4 py-10 lg:py-0">{children}</div>
      </div>
    </div>
  );
}
