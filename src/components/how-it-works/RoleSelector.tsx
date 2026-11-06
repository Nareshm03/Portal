"use client";

import { useState } from "react";
import { UserRound, Plane } from "lucide-react";
import { cn } from "@/lib/utils";

export type Role = "buyer" | "traveler";

export interface RoleSelectorProps {
  selectedRole: Role;
  onRoleChange: (role: Role) => void;
}

export function RoleSelector({
  selectedRole,
  onRoleChange,
}: RoleSelectorProps) {
  return (
    <div className="inline-flex items-center justify-center rounded-xl border border-border-strong bg-surface shadow-sm">
      <button
        onClick={() => onRoleChange("buyer")}
        className={cn(
          "px-6 py-3 rounded-lg transition-colors duration-200 text-sm font-medium",
          selectedRole === "buyer"
            ? "bg-burgundy text-ivory shadow-sm"
            : "bg-transparent text-muted hover:bg-surface-muted hover:text-foreground",
        )}
        aria-pressed={selectedRole === "buyer"}
      >
        <UserRound className="size-4 mr-2" strokeWidth={1.75} aria-hidden="true" />
        Buyer
      </button>
      <button
        onClick={() => onRoleChange("traveler")}
        className={cn(
          "px-6 py-3 rounded-lg transition-colors duration-200 text-sm font-medium",
          selectedRole === "traveler"
            ? "bg-burgundy text-ivory shadow-sm"
            : "bg-transparent text-muted hover:bg-surface-muted hover:text-foreground",
        )}
        aria-pressed={selectedRole === "traveler"}
      >
        <Plane className="size-4 mr-2" strokeWidth={1.75} aria-hidden="true" />
        Traveller
      </button>
    </div>
  );
}