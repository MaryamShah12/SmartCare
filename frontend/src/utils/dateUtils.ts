// Get the next occurrence of a specific day
export const getNextDateForDay = (dayName: string): Date => {
  const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const today = new Date();
  const todayDayIndex = today.getDay();
  const targetDayIndex = days.indexOf(dayName);
  
  if (targetDayIndex === -1) return today;
  
  let daysUntilTarget = targetDayIndex - todayDayIndex;
  if (daysUntilTarget <= 0) {
    daysUntilTarget += 7; // Next week
  }
  
  const targetDate = new Date(today);
  targetDate.setDate(today.getDate() + daysUntilTarget);
  return targetDate;
};

// Format time to 12-hour format
export const formatTo12Hour = (dateString: string): string => {
  // Parse the datetime string as local time
  const date = new Date(dateString);
  
  // Format to 12-hour time in local timezone
  return date.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
    timeZone: 'Asia/Karachi' // Ensure Pakistan timezone
  });
};

// Format date to readable format
export const formatAppointmentDate = (dateString: string): string => {
  const date = new Date(dateString);
  const today = new Date();
  const tomorrow = new Date(today);
  tomorrow.setDate(today.getDate() + 1);
  
  // Compare dates in local timezone
  const localDate = new Date(date.toLocaleString('en-US', { timeZone: 'Asia/Karachi' }));
  const localToday = new Date(today.toLocaleString('en-US', { timeZone: 'Asia/Karachi' }));
  const localTomorrow = new Date(tomorrow.toLocaleString('en-US', { timeZone: 'Asia/Karachi' }));
  
  if (localDate.toDateString() === localToday.toDateString()) {
    return 'Today';
  } else if (localDate.toDateString() === localTomorrow.toDateString()) {
    return 'Tomorrow';
  } else {
    return localDate.toLocaleDateString('en-US', {
      weekday: 'long',
      month: 'short',
      day: 'numeric',
      timeZone: 'Asia/Karachi'
    });
  }
};

// Check if appointment has passed
export const isAppointmentExpired = (startTime: string): boolean => {
  return new Date(startTime) < new Date();
};