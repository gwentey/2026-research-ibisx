import { SearchIcon } from "lucide-react";

import { Input } from "@/components/ui/input";

/** Barre de recherche à icône — même disposition que projects/page.tsx. */
export function AdminSearchInput({
  value,
  onChange,
  placeholder,
  className
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  className?: string;
}) {
  return (
    <div className={`relative max-w-sm ${className ?? ""}`}>
      <SearchIcon className="text-muted-foreground absolute top-1/2 left-2.5 size-4 -translate-y-1/2" />
      <Input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className="pl-8"
      />
    </div>
  );
}
