/**
 * Floating Action Button to launch Voice Mode
 */

import { Mic } from "lucide-react";
import { type FC, useState } from "react";
import { cn } from "@/lib/utils";
import { VoiceMode } from "./VoiceMode";

interface VoiceFabProps {
  projectId?: string;
  className?: string;
}

export const VoiceFab: FC<VoiceFabProps> = ({ projectId, className }) => {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      {/* FAB Button */}
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className={cn(
          "fixed bottom-6 right-6 z-40",
          "w-14 h-14 rounded-full",
          "bg-primary text-primary-foreground",
          "shadow-lg hover:shadow-xl",
          "flex items-center justify-center",
          "transition-all duration-200",
          "hover:scale-105 active:scale-95",
          "focus:outline-none focus:ring-4 focus:ring-primary/30",
          className,
        )}
        title="Voice Mode"
      >
        <Mic className="w-6 h-6" />
      </button>

      {/* Voice Mode Modal */}
      <VoiceMode
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        projectId={projectId}
      />
    </>
  );
};

export default VoiceFab;
