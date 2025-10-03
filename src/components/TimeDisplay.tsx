import { format } from "date-fns";

interface TimeDisplayProps {
  time: string;
  label: string;
}

const TimeDisplay = ({ time, label }: TimeDisplayProps) => {
  return (
    <div className="flex flex-col">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className="text-lg font-semibold">
        {format(new Date(time), "h:mm a")}
      </span>
      <span className="text-xs text-muted-foreground">
        {format(new Date(time), "MMM d, yyyy")}
      </span>
    </div>
  );
};

export default TimeDisplay;
