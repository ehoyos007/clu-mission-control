import { Bot } from "lucide-react";
import type { FC } from "react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export interface CluBadgeProps {
  size?: "sm" | "default";
  className?: string;
}

export const CluBadge: FC<CluBadgeProps> = ({
  size = "default",
  className,
}) => {
  return (
    <Badge
      className={cn(
        "bg-primary text-primary-foreground gap-1",
        size === "sm" && "text-[10px] px-1.5 py-0",
        className,
      )}
    >
      <Bot
        className={cn("shrink-0", size === "sm" ? "w-2.5 h-2.5" : "w-3 h-3")}
      />
      <span>Clu</span>
    </Badge>
  );
};
