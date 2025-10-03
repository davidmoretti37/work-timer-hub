// Utility functions for time formatting

export const formatHoursToReadable = (hours: number | null | undefined): string => {
  if (!hours || hours === 0) return "0m";
  
  const totalMinutes = Math.round(hours * 60);
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  
  if (h === 0) {
    return `${m}m`;
  } else if (m === 0) {
    return `${h}h`;
  } else {
    return `${h}h ${m}m`;
  }
};

export const formatHoursToTime = (hours: number | null | undefined): string => {
  if (!hours || hours === 0) return "00:00";
  
  const totalMinutes = Math.round(hours * 60);
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  
  return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
};

export const formatHoursDetailed = (hours: number | null | undefined): string => {
  if (!hours || hours === 0) return "0 minutes";
  
  const totalMinutes = Math.round(hours * 60);
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  
  if (h === 0) {
    return `${m} minute${m !== 1 ? 's' : ''}`;
  } else if (m === 0) {
    return `${h} hour${h !== 1 ? 's' : ''}`;
  } else {
    return `${h} hour${h !== 1 ? 's' : ''} ${m} minute${m !== 1 ? 's' : ''}`;
  }
};
