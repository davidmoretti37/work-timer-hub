import { Card } from "@/components/ui/card";
import { format } from "date-fns";
import { Clock } from "lucide-react";
import StatusBadge from "./StatusBadge";

interface SessionCardProps {
  clockIn: string;
  clockOut?: string | null;
  hoursWorked?: number | null;
  userName?: string;
}

const SessionCard = ({ clockIn, clockOut, hoursWorked, userName }: SessionCardProps) => {
  const isActive = !clockOut;

  return (
    <Card className="p-4 hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2">
          <Clock className="h-4 w-4 text-primary" />
          <span className="font-medium text-sm">
            {format(new Date(clockIn), "MMM d, yyyy")}
          </span>
        </div>
        <StatusBadge isClockedIn={isActive} />
      </div>

      <div className="mb-3 text-sm text-muted-foreground">
        User: <span className="font-medium text-foreground">{userName || "Unknown User"}</span>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div>
          <div className="text-xs text-muted-foreground mb-1">Clock In</div>
          <div className="text-sm font-medium">
            {format(new Date(clockIn), "h:mm a")}
          </div>
        </div>

        <div>
          <div className="text-xs text-muted-foreground mb-1">Clock Out</div>
          <div className="text-sm font-medium">
            {clockOut ? format(new Date(clockOut), "h:mm a") : "—"}
          </div>
        </div>

        <div>
          <div className="text-xs text-muted-foreground mb-1">Hours</div>
          <div className="text-sm font-semibold text-primary">
            {hoursWorked ? `${hoursWorked.toFixed(2)}h` : "—"}
          </div>
        </div>
      </div>
    </Card>
  );
};

export default SessionCard;
