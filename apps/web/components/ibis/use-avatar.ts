"use client";

import { useEffect, useState } from "react";

import { getMyAvatar } from "@/lib/api/generated";
import { useAuthStore } from "@/lib/auth/store";

/** Récupère l'avatar via l'API authentifiée (les fichiers ne sont jamais publics — ADR-005). */
export function useAvatarUrl(): string | null {
  const user = useAuthStore((state) => state.user);
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    let objectUrl: string | null = null;
    if (!user?.has_avatar) {
      setUrl(null);
      return;
    }
    getMyAvatar({ throwOnError: false, parseAs: "blob" }).then(({ data }) => {
      if (data instanceof Blob) {
        objectUrl = URL.createObjectURL(data);
        setUrl(objectUrl);
      }
    });
    return () => {
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [user?.has_avatar, user?.id]);

  return url;
}

export function userInitials(pseudo: string | null, email: string): string {
  const source = pseudo?.trim() || email;
  return source.slice(0, 2).toUpperCase();
}
