import {
  Clock,
  Landmark,
  Lock,
  PackageCheck,
  Plane,
  ReceiptText,
  UserCheck,
  XCircle,
  type LucideIcon,
} from "lucide-react";
import { Badge, type BadgeVariant } from "./badge";
import { cn } from "@/lib/utils";

export const TRACKING_STATUSES = [
  "requested",
  "matched",
  "quoted",
  "payment-secured",
  "in-transit",
  "customs",
  "delivered",
  "cancelled",
] as const;

export type TrackingStatus = (typeof TRACKING_STATUSES)[number];

interface StatusConfig {
  label: string;
  variant: BadgeVariant;
  icon: LucideIcon;
}

const STATUS_CONFIG: Record<TrackingStatus, StatusConfig> = {
  requested: { label: "Requested", variant: "outline", icon: Clock },
  matched: { label: "Traveler matched", variant: "champagne", icon: UserCheck },
  quoted: { label: "Quote received", variant: "sapphire", icon: ReceiptText },
  "payment-secured": {
    label: "Payment secured",
    variant: "champagne",
    icon: Lock,
  },
  "in-transit": { label: "In transit", variant: "sapphire", icon: Plane },
  customs: { label: "Customs clearance", variant: "champagne", icon: Landmark },
  delivered: { label: "Delivered", variant: "emerald", icon: PackageCheck },
  cancelled: { label: "Cancelled", variant: "destructive", icon: XCircle },
};

export interface StatusBadgeProps {
  status: TrackingStatus;
  /** Override the default label for this status. */
  label?: string;
  showIcon?: boolean;
  className?: string;
}

export function StatusBadge({
  status,
  label,
  showIcon = true,
  className,
}: StatusBadgeProps) {
  const config = STATUS_CONFIG[status];
  const Icon = config.icon;

  return (
    <Badge variant={config.variant} className={cn(className)}>
      {showIcon && (
        <Icon
          className="size-3 shrink-0"
          strokeWidth={2}
          aria-hidden="true"
        />
      )}
      {label ?? config.label}
    </Badge>
  );
}
