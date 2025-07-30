import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeftIcon,
  StarIcon,
  CalendarIcon,
  ClockIcon,
  CurrencyDollarIcon,
  UserIcon,
  AcademicCapIcon,
  MapPinIcon,
  PhoneIcon,
  XMarkIcon,
} from '@heroicons/react/24/outline';
import { getNextWeekdayDate } from '../utils/timeUtils';

interface Doctor {
  id: number;
  name: string;
  specialization: string;
  instant_available: boolean;
  is_active: boolean;
  photo: string | null;
  availability: Record<string, string[]>;
  pricing: number;
  rating?: number;
  experience?: string;
  location?: string;
}

interface Appointment {
  id: number;
  start_time: string;
  end_time: string;
  status: string;
  patient_name?: string;
}

const DoctorProfile: React.FC = () => {
  const { doctorId } = useParams<{ doctorId: string }>();
  const navigate = useNavigate();
  const [doctor, setDoctor] = useState<Doctor | null>(null);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedWeek, setSelectedWeek] = useState(0);
  const [showBookingModal, setShowBookingModal] = useState(false);
  const [showInstantModal, setShowInstantModal] = useState(false);
  const [bookingForm, setBookingForm] = useState({
    appointment_type: 'normal' as 'instant' | 'normal',
    day: '',
    start_time: '',
    end_time: '',
    symptoms: '',
    report_file: null as File | null,
    selectedDate: null as Date | null,
  });

  const token = () => {
    const role = localStorage.getItem('role');
    return localStorage.getItem(`${role}_token`) || '';
  };

  
  const getCurrentWeekDates = (weekOffset = 0) => {
    const today = new Date();
    const currentDay = today.getDay();
    const monday = new Date(today);
    monday.setDate(today.getDate() - currentDay + 1 + (weekOffset * 7));
    
    const weekDates = [];
    for (let i = 0; i < 7; i++) {
      const date = new Date(monday);
      date.setDate(monday.getDate() + i);
      weekDates.push(date);
    }
    return weekDates;
  };

  const weekDays = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
  const currentWeekDates = getCurrentWeekDates(selectedWeek);

  
  const convertToPKT = (utcDateString: string) => {
    const utcDate = new Date(utcDateString);
    const pktOffset = 5 * 60;
    const pktDate = new Date(utcDate.getTime() + (pktOffset * 60 * 1000));
    return pktDate;
  };

 
  const formatTo12Hour = (timeString: string) => {
    const [hours, minutes] = timeString.split(':');
    const hour = parseInt(hours);
    const ampm = hour >= 12 ? 'PM' : 'AM';
    const hour12 = hour % 12 || 12;
    return `${hour12}:${minutes} ${ampm}`;
  };

  
  const formatDatePKT = (date: Date) => {
    return date.toLocaleDateString('en-PK', {
      day: 'numeric',
      month: 'short',
      timeZone: 'Asia/Karachi'
    });
  };

  const fetchDoctorProfile = async () => {
    try {
      const res = await fetch(`http://127.0.0.1:8000/api/auth/patient/doctor-profile/${doctorId}`, {
        headers: { Authorization: `Bearer ${token()}` },
      });
      const data = await res.json();
      if (res.ok) {
        setDoctor(data.doctor);
      } else {
        setError(data.error || 'Failed to fetch doctor profile');
      }
    } catch {
      setError('Could not connect to server');
    }
  };

  const fetchDoctorSchedule = async () => {
    try {
      const res = await fetch(`http://127.0.0.1:8000/api/auth/patient/doctor-schedule/${doctorId}`, {
        headers: { Authorization: `Bearer ${token()}` },
      });
      const data = await res.json();
      if (res.ok) {
        setAppointments(data.appointments);
      } else {
        setError(data.error || 'Failed to fetch schedule');
      }
    } catch {
      setError('Could not connect to server');
    }
  };

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      await Promise.all([fetchDoctorProfile(), fetchDoctorSchedule()]);
      setLoading(false);
    };
    
    if (doctorId) {
      loadData();
    }
  }, [doctorId]);

  
  const isSlotBooked = (dayName: string, timeSlot: string, date: Date) => {
    const [startTime, endTime] = timeSlot.split('-');
    
    return appointments.some(apt => {
      if (apt.status !== 'accepted') return false;
      
      const aptStart = convertToPKT(apt.start_time);
      const aptEnd = convertToPKT(apt.end_time);
      
      const aptDate = aptStart.toDateString();
      const slotDate = date.toDateString();
      
      if (aptDate !== slotDate) return false;
      
      const slotStart = startTime + ':00';
      const slotEnd = endTime + ':00';
      const aptStartTime = aptStart.toTimeString().slice(0, 8);
      const aptEndTime = aptEnd.toTimeString().slice(0, 8);
      
      return (slotStart < aptEndTime && slotEnd > aptStartTime);
    });
  };

  
  const handleBook = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!doctor) return;
    if (!bookingForm.day || !bookingForm.start_time || !bookingForm.end_time) {
      alert('Please select day, start and end time');
      return;
    }

    const targetDate = getNextWeekdayDate(bookingForm.day);
    if (!targetDate) {
      alert('Invalid day selected');
      return;
    }

    const startDateTime = new Date(targetDate);
    const [startHour, startMin] = bookingForm.start_time.split(':');
    startDateTime.setHours(parseInt(startHour), parseInt(startMin), 0, 0);

    const endDateTime = new Date(targetDate);
    const [endHour, endMin] = bookingForm.end_time.split(':');
    endDateTime.setHours(parseInt(endHour), parseInt(endMin), 0, 0);

    const fd = new FormData();
    fd.append('doctor_id', String(doctor.id));
    fd.append('appointment_type', bookingForm.appointment_type);
    fd.append('start_time', startDateTime.toISOString());
    fd.append('end_time', endDateTime.toISOString());
    fd.append('symptoms', bookingForm.symptoms);
    if (bookingForm.report_file) fd.append('report_file', bookingForm.report_file);

    try {
      const res = await fetch('http://127.0.0.1:8000/api/auth/patient/book-appointment', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token()}` },
        body: fd,
      });
      const json = await res.json();
      if (res.ok) {
        alert(json.message);
        setShowBookingModal(false);
        fetchDoctorSchedule();
      } else alert(json.error || 'Booking failed');
    } catch {
      alert('Network error');
    }
  };

  const handleInstantBook = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!doctor) return;
    const fd = new FormData();
    fd.append('doctor_id', String(doctor.id));
    fd.append('symptoms', bookingForm.symptoms);
    if (bookingForm.report_file) fd.append('report_file', bookingForm.report_file);
    try {
      const res = await fetch(
        'http://127.0.0.1:8000/api/auth/patient/book-instant-appointment',
        {
          method: 'POST',
          headers: { Authorization: `Bearer ${token()}` },
          body: fd,
        }
      );
      const json = await res.json();
      if (res.ok) {
        alert('Instant appointment request sent!');
        setShowInstantModal(false);
      } else alert(json.error || 'Booking failed');
    } catch {
      alert('Network error');
    }
  };

  
  const handleBookAppointment = (timeSlot?: string, date?: Date) => {
    setBookingForm({
      ...bookingForm,
      appointment_type: 'normal',
      start_time: timeSlot ? timeSlot.split('-')[0] : '',
      end_time: timeSlot ? timeSlot.split('-')[1] : '',
      selectedDate: date || null,
      day: date ? weekDays[date.getDay()] : '',
    });
    setShowBookingModal(true);
  };

  const handleInstantConsultation = () => {
    setBookingForm({
      ...bookingForm,
      appointment_type: 'instant',
      day: '',
      start_time: '',
      end_time: '',
      selectedDate: null,
    });
    setShowInstantModal(true);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-sky-50 via-white to-sky-100 flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-sky-500"></div>
      </div>
    );
  }

  if (error || !doctor) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-sky-50 via-white to-sky-100 flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-600 mb-4">{error || 'Doctor not found'}</p>
          <button
            onClick={() => navigate('/patient')}
            className="px-4 py-2 bg-sky-500 text-white rounded-lg hover:bg-sky-600 transition"
          >
            Back to Dashboard
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-sky-50 via-white to-sky-100">
      {/* Header */}
      <header className="bg-white/80 backdrop-blur-sm border-b border-sky-200 sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
          <button
            onClick={() => navigate('/patient')}
            className="flex items-center gap-2 text-sky-600 hover:text-sky-800 transition"
          >
            <ArrowLeftIcon className="w-5 h-5" />
            Back to Dashboard
          </button>
          <h1 className="text-xl font-bold text-sky-800">Doctor Profile</h1>
          <div></div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-6">
        {/* Doctor Info Card */}
        <div className="glass p-6 mb-6 animate-fade-in-up">
          <div className="flex flex-col md:flex-row gap-6">
            <div className="flex-shrink-0">
              <img
                src={
                  doctor.photo
                    ? `http://127.0.0.1:8000/api/auth/uploads/${doctor.photo}`
                    : '/avatar.png'
                }
                alt={doctor.name}
                className="w-32 h-32 rounded-full object-cover border-4 border-white shadow-lg"
              />
            </div>

            <div className="flex-1">
              <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
                <div>
                  <h1 className="text-3xl font-bold text-slate-900 mb-2">
                    Dr. {doctor.name}
                  </h1>
                  <div className="flex items-center gap-2 mb-3">
                    <AcademicCapIcon className="w-5 h-5 text-sky-500" />
                    <span className="text-lg text-slate-700">{doctor.specialization}</span>
                  </div>
                  
                  <div className="flex flex-wrap gap-2 mb-4">
                    <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                      doctor.is_active ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                    }`}>
                      {doctor.is_active ? 'Available' : 'Unavailable'}
                    </span>
                    {doctor.instant_available && (
                      <span className="px-3 py-1 rounded-full text-sm font-medium bg-blue-100 text-blue-800">
                        Instant Consultation
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-2 mb-4">
                    <CurrencyDollarIcon className="w-5 h-5 text-green-500" />
                    <span className="text-2xl font-bold text-green-600">
                      PKR {doctor.pricing || 0}
                    </span>
                    <span className="text-slate-500">per consultation</span>
                  </div>
                </div>

                <div className="flex flex-col gap-3">
                  <button
                    onClick={() => handleBookAppointment()}
                    className="px-6 py-3 bg-sky-500 text-white font-semibold rounded-lg hover:bg-sky-600 transition shadow-lg"
                  >
                    Book Appointment
                  </button>
                  {doctor.instant_available && (
                    <button
                      onClick={handleInstantConsultation}
                      className="px-6 py-3 bg-green-500 text-white font-semibold rounded-lg hover:bg-green-600 transition shadow-lg"
                    >
                      Instant Consultation
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Schedule Section */}
        <div className="glass p-6 animate-fade-in-up">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-6">
            <h2 className="text-2xl font-bold text-sky-800 mb-4 sm:mb-0">
              Weekly Schedule
            </h2>
            
            <div className="flex gap-2">
              <button
                onClick={() => setSelectedWeek(0)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
                  selectedWeek === 0
                    ? 'bg-sky-500 text-white'
                    : 'bg-white text-sky-600 hover:bg-sky-50'
                }`}
              >
                This Week
              </button>
              <button
                onClick={() => setSelectedWeek(1)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
                  selectedWeek === 1
                    ? 'bg-sky-500 text-white'
                    : 'bg-white text-sky-600 hover:bg-sky-50'
                }`}
              >
                Next Week
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-7 gap-4">
            {weekDays.map((dayName, index) => {
              const date = currentWeekDates[index];
              const daySchedule = doctor.availability[dayName] || [];
              const isToday = date.toDateString() === new Date().toDateString();
              
              return (
                <div
                  key={dayName}
                  className={`bg-white/70 rounded-xl p-4 border-2 transition ${
                    isToday ? 'border-sky-300 bg-sky-50/70' : 'border-transparent'
                  }`}
                >
                  <div className="text-center mb-3">
                    <h3 className={`font-bold text-lg ${
                      isToday ? 'text-sky-800' : 'text-slate-800'
                    }`}>
                      {dayName}
                    </h3>
                    <p className={`text-sm ${
                      isToday ? 'text-sky-600' : 'text-slate-600'
                    }`}>
                      {formatDatePKT(date)}
                    </p>
                  </div>

                  <div className="space-y-2">
                    {daySchedule.length > 0 ? (
                      daySchedule.map((timeSlot, slotIndex) => {
                        const isBooked = isSlotBooked(dayName, timeSlot, date);
                        const [startTime, endTime] = timeSlot.split('-');
                        
                        return (
                          <div
                            key={slotIndex}
                            className={`p-2 rounded-lg text-center text-sm transition cursor-pointer ${
                              isBooked
                                ? 'bg-red-100 text-red-700 cursor-not-allowed'
                                : 'bg-green-100 text-green-700 hover:bg-green-200'
                            }`}
                            onClick={() => !isBooked && handleBookAppointment(timeSlot, date)}
                          >
                            <div className="font-medium">
                              {formatTo12Hour(startTime)} - {formatTo12Hour(endTime)}
                            </div>
                            <div className="text-xs">
                              {isBooked ? 'Booked' : 'Available'}
                            </div>
                          </div>
                        );
                      })
                    ) : (
                      <div className="text-center text-slate-500 text-sm py-4">
                        Not Available
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          <div className="flex flex-wrap justify-center gap-4 mt-6 pt-6 border-t border-slate-200">
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 bg-green-100 rounded border"></div>
              <span className="text-sm text-slate-600">Available</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 bg-red-100 rounded border"></div>
              <span className="text-sm text-slate-600">Booked</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 bg-sky-100 rounded border-2 border-sky-300"></div>
              <span className="text-sm text-slate-600">Today</span>
            </div>
          </div>
        </div>

        {/* Normal Booking Modal */}
        {showBookingModal && doctor && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fade-in-up">
            <div className="glass max-w-lg w-full p-6 rounded-xl">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-xl font-bold text-sky-800">
                  Book Appointment with {doctor.name}
                </h3>
                <button
                  onClick={() => setShowBookingModal(false)}
                  className="text-slate-600 hover:text-sky-600"
                >
                  <XMarkIcon className="w-6 h-6" />
                </button>
              </div>
              <form onSubmit={handleBook} className="space-y-5">
                <div>
                  <label className="block text-sm font-bold text-sky-800">Day</label>
                  <select
                    required
                    value={bookingForm.day}
                    onChange={(e) => {
                      const selectedDay = e.target.value;
                      const targetDate = getNextWeekdayDate(selectedDay);
                      setBookingForm({
                        ...bookingForm,
                        day: selectedDay,
                        selectedDate: targetDate,
                      });
                    }}
                    className="block w-full mt-1 px-3 py-2 rounded-lg border border-slate-300 bg-white/80 focus:ring-2 focus:ring-sky-500"
                  >
                    <option value="">Choose day</option>
                    {Object.keys(doctor.availability).map((d) => {
                      const nextDate = getNextWeekdayDate(d);
                      return (
                        <option key={d} value={d}>
                          {d} (
                          {nextDate?.toLocaleDateString('en-US', {
                            month: 'short',
                            day: 'numeric',
                          })}
                          )
                        </option>
                      );
                    })}
                  </select>
                </div>

                {bookingForm.day && (
                  <div className="bg-blue-50 p-3 rounded-lg">
                    <p className="text-sm text-blue-800">
                      Selected:{' '}
                      {getNextWeekdayDate(bookingForm.day)?.toLocaleDateString('en-US', {
                        weekday: 'long',
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric',
                      })}
                    </p>
                  </div>
                )}

                <div>
                  <label className="block text-sm font-bold text-sky-800">
                    Available slots
                  </label>
                  <div className="flex flex-wrap gap-2 mt-1">
                    {(doctor.availability[bookingForm.day] || []).map((slot) => (
                      <span
                        key={slot}
                        className="bg-sky-100 text-sky-800 px-2 py-1 rounded text-xs"
                      >
                        {slot}
                      </span>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-bold text-sky-800">
                      Start time
                    </label>
                    <input
                      type="time"
                      required
                      value={bookingForm.start_time}
                      onChange={(e) =>
                        setBookingForm({ ...bookingForm, start_time: e.target.value })
                      }
                      className="block w-full mt-1 px-3 py-2 rounded-lg border border-slate-300 bg-white/80 focus:ring-2 focus:ring-sky-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-sky-800">
                      End time
                    </label>
                    <input
                      type="time"
                      required
                      value={bookingForm.end_time}
                      onChange={(e) =>
                        setBookingForm({ ...bookingForm, end_time: e.target.value })
                      }
                      className="block w-full mt-1 px-3 py-2 rounded-lg border border-slate-300 bg-white/80 focus:ring-2 focus:ring-sky-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-bold text-sky-800">Symptoms</label>
                  <textarea
                    rows={3}
                    required
                    value={bookingForm.symptoms}
                    onChange={(e) =>
                      setBookingForm({ ...bookingForm, symptoms: e.target.value })
                    }
                    className="block w-full mt-1 px-3 py-2 rounded-lg border border-slate-300 bg-white/80 focus:ring-2 focus:ring-sky-500"
                    placeholder="Describe your symptoms..."
                  />
                </div>

                <div>
                  <label className="block text-sm font-bold text-sky-800">
                    Medical report (optional)
                  </label>
                  <input
                    type="file"
                    onChange={(e) =>
                      setBookingForm({ ...bookingForm, report_file: e.target.files?.[0] || null })
                    }
                    className="block w-full mt-1 text-sm text-slate-600 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-sky-100 file:text-sky-700 hover:file:bg-sky-200"
                  />
                </div>

                <div className="flex gap-3 justify-end">
                  <button
                    type="button"
                    onClick={() => setShowBookingModal(false)}
                    className="px-4 py-2 rounded-lg border border-sky-500 text-sky-600 font-semibold hover:bg-sky-50 transition"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 rounded-lg bg-sky-500 text-white font-semibold hover:bg-sky-600 transition"
                  >
                    Confirm Booking
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Instant Booking Modal */}
        {showInstantModal && doctor && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fade-in-up">
            <div className="glass max-w-lg w-full p-6 rounded-xl">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-xl font-bold text-sky-800">
                  Book Instant Consultation with {doctor.name}
                </h3>
                <button
                  onClick={() => setShowInstantModal(false)}
                  className="text-slate-600 hover:text-sky-600"
                >
                  <XMarkIcon className="w-6 h-6" />
                </button>
              </div>
              <form onSubmit={handleInstantBook} className="space-y-5">
                <div>
                  <label className="block text-sm font-bold text-sky-800">Symptoms</label>
                  <textarea
                    rows={3}
                    required
                    value={bookingForm.symptoms}
                    onChange={(e) =>
                      setBookingForm({ ...bookingForm, symptoms: e.target.value })
                    }
                    className="block w-full mt-1 px-3 py-2 rounded-lg border border-slate-300 bg-white/80 focus:ring-2 focus:ring-sky-500"
                    placeholder="Describe your symptoms..."
                  />
                </div>

                <div>
                  <label className="block text-sm font-bold text-sky-800">
                    Medical report (optional)
                  </label>
                  <input
                    type="file"
                    onChange={(e) =>
                      setBookingForm({ ...bookingForm, report_file: e.target.files?.[0] || null })
                    }
                    className="block w-full mt-1 text-sm text-slate-600 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-sky-100 file:text-sky-700 hover:file:bg-sky-200"
                  />
                </div>

                <div className="flex gap-3 justify-end">
                  <button
                    type="button"
                    onClick={() => setShowInstantModal(false)}
                    className="px-4 py-2 rounded-lg border border-sky-500 text-sky-600 font-semibold hover:bg-sky-50 transition"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 rounded-lg bg-sky-500 text-white font-semibold hover:bg-sky-600 transition"
                  >
                    Confirm Booking
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </main>
    </div>
  );
};

export default DoctorProfile;