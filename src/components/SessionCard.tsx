import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { format } from "date-fns";
import { Clock, Edit2, Save, X, Trash2 } from "lucide-react";
import StatusBadge from "./StatusBadge";
import { formatHoursToReadable } from "@/utils/timeUtils";
import { useState } from "react";

interface SessionCardProps {
  clockIn: string;
  clockOut?: string | null;
  hoursWorked?: number | null;
  userName?: string;
  sessionId?: string;
  isAdmin?: boolean;
  onUpdate?: (sessionId: string, clockIn: string, clockOut: string | null) => void;
  onDelete?: (sessionId: string) => void;
}

const SessionCard = ({ clockIn, clockOut, hoursWorked, userName, sessionId, isAdmin, onUpdate, onDelete }: SessionCardProps) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editClockIn, setEditClockIn] = useState('');
  const [editClockOut, setEditClockOut] = useState('');
  const isActive = !clockOut;

  const handleStartEdit = () => {
    setEditClockIn(format(new Date(clockIn), "yyyy-MM-dd'T'HH:mm"));
    setEditClockOut(clockOut ? format(new Date(clockOut), "yyyy-MM-dd'T'HH:mm") : '');
    setIsEditing(true);
  };

  const handleSave = () => {
    if (!sessionId || !onUpdate) return;
    
    const newClockOut = editClockOut ? new Date(editClockOut).toISOString() : null;
    onUpdate(sessionId, new Date(editClockIn).toISOString(), newClockOut);
    setIsEditing(false);
  };

  const handleCancel = () => {
    setIsEditing(false);
  };

  const handleDelete = () => {
    if (!sessionId || !onDelete) return;
    if (confirm('Are you sure you want to delete this session?')) {
      onDelete(sessionId);
    }
  };

  return (
    <Card className="p-4 hover:shadow-md transition-shadow container-shadow">
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2">
          <Clock className="h-4 w-4 text-primary" />
          <span className="font-medium text-sm">
            {format(new Date(clockIn), "MMM d, yyyy")}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <StatusBadge isClockedIn={isActive} />
          {isAdmin && sessionId && (
            <div className="flex gap-1">
              {!isEditing ? (
                <>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleStartEdit}
                    className="h-7 w-7 p-0"
                  >
                    <Edit2 className="h-3 w-3" />
                  </Button>
                  <Button
                    variant="ghost"  
                    size="sm"
                    onClick={handleDelete}
                    className="h-7 w-7 p-0 text-destructive hover:text-destructive"
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </>
              ) : (
                <>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleSave}
                    className="h-7 w-7 p-0 text-green-600 hover:text-green-700"
                  >
                    <Save className="h-3 w-3" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleCancel}
                    className="h-7 w-7 p-0"
                  >
                    <X className="h-3 w-3" />
                  </Button>
                </>
              )}
            </div>
          )}
        </div>
      </div>

      {userName && (
        <div className="mb-3 text-sm text-muted-foreground">
          User: <span className="font-medium text-foreground">{userName}</span>
        </div>
      )}

      {isEditing ? (
        <div className="grid grid-cols-3 gap-4">
          <div>
            <div className="text-xs text-muted-foreground mb-1">Clock In</div>
            <Input
              type="datetime-local"
              value={editClockIn}
              onChange={(e) => setEditClockIn(e.target.value)}
              className="text-sm"
            />
          </div>

          <div>
            <div className="text-xs text-muted-foreground mb-1">Clock Out</div>
            <Input
              type="datetime-local"
              value={editClockOut}
              onChange={(e) => setEditClockOut(e.target.value)}
              className="text-sm"
              disabled={isActive}
            />
          </div>

          <div>
            <div className="text-xs text-muted-foreground mb-1">Hours</div>
            <div className="text-sm font-semibold text-primary flex items-center h-9">
              {hoursWorked ? formatHoursToReadable(hoursWorked) : "—"}
            </div>
          </div>
        </div>
      ) : (
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
              {hoursWorked ? formatHoursToReadable(hoursWorked) : "—"}
            </div>
          </div>
        </div>
      )}
    </Card>
  );
};

export default SessionCard;
