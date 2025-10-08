import { Badge } from "@/components/ui/badge";
import { Clock, CheckCircle, PauseCircle } from "lucide-react";

interface StatusBadgeProps {
  isClockedIn: boolean;
  isPaused?: boolean;
}

const StatusBadge = ({ isClockedIn, isPaused }: StatusBadgeProps) => {
  if (isClockedIn && isPaused) {
    return (
      <Badge className="bg-yellow-500 text-black gap-1.5 px-3 py-1.5">
        <PauseCircle className="h-3.5 w-3.5" />
        On Break
      </Badge>
    );
  }
  if (isClockedIn) {
    return (
      <Badge className="bg-success text-success-foreground gap-1.5 px-3 py-1.5">
        <Clock className="h-3.5 w-3.5 animate-pulse" />
        Clocked In
      </Badge>
    );
  }

  return (
    <Badge variant="secondary" className="gap-1.5 px-3 py-1.5">
      <CheckCircle className="h-3.5 w-3.5" />
      Clocked Out
    </Badge>
  );
};

export default StatusBadge;
