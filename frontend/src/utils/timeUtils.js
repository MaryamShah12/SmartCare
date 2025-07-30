export const getNextWeekdayDate = (weekdayName) => {
  const today = new Date();
  const weekdays = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const targetDay = weekdays.indexOf(weekdayName);
  
  if (targetDay === -1) return null;
  
  const currentDay = today.getDay();
  let daysAhead = targetDay - currentDay;
  
  
  if (daysAhead <= 0) {
    daysAhead += 7;
  }
  
  const targetDate = new Date(today);
  targetDate.setDate(today.getDate() + daysAhead);
  return targetDate;
};

export const formatAppointmentDateTime = (dateTimeString, appointmentType) => {
  if (appointmentType === 'instant') {
    return {
      date: 'Instant Consultation',
      time: 'Active when accepted',
      day: '',
      isExpired: false
    };
  }

  const date = new Date(dateTimeString);
  const now = new Date();
  
  const options = { 
    weekday: 'long', 
    year: 'numeric', 
    month: 'long', 
    day: 'numeric' 
  };
  const dateStr = date.toLocaleDateString('en-US', options);
  
  // Format time to 12-hour
  const timeStr = date.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true
  });
  
  // Check if expired
  const isExpired = date < now;
  
  return {
    date: dateStr,
    time: timeStr,
    day: date.toLocaleDateString('en-US', { weekday: 'long' }),
    isExpired
  };
};

export const getAppointmentStatus = (appointment) => {
  if (appointment.appointment_type === 'instant') {
    if (appointment.status === 'accepted') {
      const acceptedTime = new Date(appointment.start_time);
      const oneHourLater = new Date(acceptedTime.getTime() + 60 * 60 * 1000);
      const now = new Date();
      
      if (now > oneHourLater) {
        return { status: 'completed', color: 'text-gray-500' };
      }
      return { status: 'active', color: 'text-green-600' };
    }
    return { status: appointment.status, color: 'text-amber-600' };
  }
  
  const startTime = new Date(appointment.start_time);
  const now = new Date();
  
  if (appointment.status === 'accepted') {
    if (startTime < now) {
      return { status: 'expired', color: 'text-red-500' };
    }
    return { status: 'scheduled', color: 'text-green-600' };
  }
  
  return { status: appointment.status, color: 'text-amber-600' };
};