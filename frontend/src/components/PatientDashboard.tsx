import React, { useEffect, useState, useMemo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  CalendarDaysIcon,
  HeartIcon,
  MagnifyingGlassIcon,
  XMarkIcon,
} from '@heroicons/react/24/outline';
import socketService from '../services/socketService';
import ChatModal from './ChatModal';
import { getNextWeekdayDate, formatAppointmentDateTime, getAppointmentStatus } from '../utils/timeUtils';


interface Doctor {
  id: number;
  name: string;
  specialization: string;
  instant_available: boolean;
  is_online: boolean;
  is_active: boolean;
  photo: string | null;
  availability: Record<string, string[]>;
  pricing?: number;
}
interface Appointment {
  id: number;
  doctor_name: string;
  appointment_type: string;
  start_time: string;
  end_time: string;
  status: string;
  symptoms: string | null;
  report_file: string | null;
}
interface PatientProfile {
  user_id: number;
  name: string;
  email: string;
  age: number;
  gender: string | null;
  medical_history: string | null;
}

const PatientDashboard: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [allDoctors, setAllDoctors] = useState<Doctor[]>([]);
  const [profile, setProfile] = useState<PatientProfile | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'appointments' | 'instant' | 'normal'>(
    'appointments'
  );
  const [selectedDoctor, setSelectedDoctor] = useState<Doctor | null>(null);
  const [bookingForm, setBookingForm] = useState({
    appointment_type: 'normal' as 'instant' | 'normal',
    day: '',
    start_time: '',
    end_time: '',
    symptoms: '',
    report_file: null as File | null,
    selectedDate: null as Date | null,
  });

  const [instantDoctors, setInstantDoctors] = useState<Doctor[]>([]);
  const [selectedAppointmentForChat, setSelectedAppointmentForChat] = useState<number | null>(null);
  const [showChatModal, setShowChatModal] = useState(false);
  const [chatAppointmentId, setChatAppointmentId] = useState<number | null>(null);

  const token = () => {
    const role = localStorage.getItem('role');
    return localStorage.getItem(`${role}_token`) || '';
  };

  
  const fetchAppointments = async () => {
    try {
      const res = await fetch('http://127.0.0.1:8000/api/auth/patient/appointments', {
        headers: { Authorization: `Bearer ${token()}` },
      });
      const data = await res.json();
      if (res.ok) setAppointments(data.appointments);
      else setError(data.error || 'Failed to fetch appointments');
    } catch {
      setError('Could not connect');
    }
  };

  const fetchDoctors = async () => {
    try {
      const res = await fetch('http://127.0.0.1:8000/api/auth/patient/doctors', {
        headers: { Authorization: `Bearer ${token()}` },
      });
      const data = await res.json();
      if (res.ok) setAllDoctors(data.doctors);
      else setError(data.error || 'Failed to fetch doctors');
    } catch {
      setError('Could not connect');
    }
  };

  const fetchProfile = async () => {
    try {
      const res = await fetch('http://127.0.0.1:8000/api/auth/patient/profile', {
        headers: { Authorization: `Bearer ${token()}` },
      });
      const data = await res.json();
      if (res.ok) setProfile(data);
      else setError(data.error || 'Failed to fetch profile');
    } catch {
      setError('Could not connect');
    }
  };

  
  useEffect(() => {
    fetchAppointments();
    fetchDoctors();
    fetchProfile();
    const refreshInterval = setInterval(fetchAppointments, 30_000);
    return () => clearInterval(refreshInterval);
  }, []);

  
  const handleDoctorClick = (doctorId: number) => {
    navigate(`/doctor-profile/${doctorId}`);
  };

  useEffect(() => {
  if (location.state?.openBooking && location.state?.doctorId) {
    const doctor = allDoctors.find(d => d.id === location.state.doctorId);
    if (doctor) {
      setSelectedDoctor(doctor);
      setBookingForm(prev => ({
        ...prev,
        appointment_type: location.state.appointmentType ?? 'normal',
      }));
    }
    navigate(location.pathname, { replace: true, state: {} });
  }
}, [location.state, allDoctors]);

 
  useEffect(() => {
    const setupListener = () => {
      const handleAppointmentUpdate = (data: {
        status: string;
        chat_active: boolean;
        appointment_id: number;
      }) => {
        fetchAppointments();
        if (data.status === 'accepted' && data.chat_active) {
          setChatAppointmentId(data.appointment_id);
          setShowChatModal(true);
        }
      };
      socketService.off('appointment_updated');
      socketService.onAppointmentUpdated(handleAppointmentUpdate);
    };

    if (socketService.socket?.connected) setupListener();
    else {
      const checkConnection = setInterval(() => {
        if (socketService.socket?.connected) {
          setupListener();
          clearInterval(checkConnection);
        }
      }, 100);
      return () => clearInterval(checkConnection);
    }
    return () => socketService.off('appointment_updated');
  }, []);

  
  const openBookingModal = (doctor: Doctor, type: 'instant' | 'normal') => {
    setSelectedDoctor(doctor);
    setBookingForm({ ...bookingForm, appointment_type: type });
  };
  const closeBookingModal = () => setSelectedDoctor(null);

  
  const handleBook = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedDoctor) return;
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
    fd.append('doctor_id', String(selectedDoctor.id));
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
        closeBookingModal();
        fetchAppointments();
        setViewMode('appointments');
      } else alert(json.error || 'Booking failed');
    } catch {
      alert('Network error');
    }
  };

  const handleInstantBook = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedDoctor) return;
    const fd = new FormData();
    fd.append('doctor_id', String(selectedDoctor.id));
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
        closeBookingModal();
        setViewMode('appointments');
      } else alert(json.error || 'Booking failed');
    } catch {
      alert('Network error');
    }
  };

  
  const displayedDoctors = useMemo(() => {
    if (viewMode === 'instant') {
      return allDoctors.filter((d) => d.instant_available && d.is_active);
    }
    return allDoctors.filter((d) => d.is_active);
  }, [viewMode, allDoctors]);

  
  return (
    <div className="min-h-screen bg-gradient-to-br from-sky-50 via-white to-sky-100 p-4">
      <header className="max-w-6xl mx-auto flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold text-sky-800">Patient Dashboard</h1>
        <div className="flex gap-2">
          <button
            onClick={() => fetchDoctors()}
            className="px-4 py-2 rounded-lg text-sm font-semibold text-white bg-green-500 hover:bg-green-600 transition"
          >
            Refresh Status
          </button>
          <button
            onClick={() => {
              socketService.logout();
              localStorage.clear();
              navigate('/');
            }}
            className="px-4 py-2 rounded-lg text-sm font-semibold text-white bg-red-500 hover:bg-red-600 transition"
          >
            Logout
          </button>
        </div>
      </header>

      {error && (
        <div className="max-w-6xl mx-auto bg-red-100 text-red-700 px-4 py-2 rounded mb-4">
          {error}
        </div>
      )}

      <main className="max-w-6xl mx-auto space-y-8">
        {/* Appointments */}
        <section className="glass p-6">
          <h2 className="text-2xl font-bold text-sky-800 mb-4 flex items-center gap-2">
            <CalendarDaysIcon className="w-6 h-6" /> My Appointments
          </h2>
          {appointments.length ? (
            <div className="space-y-4">
              {appointments.map((a) => {
                const dateTime = formatAppointmentDateTime(a.start_time, a.appointment_type);
                const status = getAppointmentStatus(a);
                return (
                  <div
                    key={a.id}
                    className={`bg-white/70 p-4 rounded-xl shadow-sm hover:shadow-md transition-shadow ${
                      dateTime.isExpired ? 'opacity-60' : ''
                    }`}
                  >
                    <div className="flex justify-between items-start">
                      <div>
                        <h3 className="font-bold text-lg text-slate-900">
                          Dr. {a.doctor_name}
                        </h3>
                        <p className="text-sm text-slate-700 capitalize">
                          {a.appointment_type} Appointment
                        </p>

                        {a.appointment_type === 'instant' ? (
                          <div className="mt-2">
                            <p className="text-sm font-medium text-sky-600">
                              Instant Consultation
                            </p>
                            {a.status === 'accepted' && (
                              <p className="text-xs text-green-600">
                                Active for 1 hour from acceptance
                              </p>
                            )}
                          </div>
                        ) : (
                          <div className="mt-2">
                            <p className="text-sm font-medium text-slate-800">
                              {dateTime.date}
                            </p>
                            <p className="text-sm text-slate-600">{dateTime.time}</p>
                          </div>
                        )}
                      </div>

                      <div className="text-right">
                        <span className={`text-sm font-semibold ${status.color}`}>
                          {status.status}
                        </span>
                        {dateTime.isExpired && (
                          <p className="text-xs text-red-500 mt-1">Expired</p>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-slate-600">No appointments yet.</p>
          )}
        </section>

        {/* Booking section */}
        <section className="glass p-6">
          <h2 className="text-2xl font-bold text-sky-800 mb-4 flex items-center gap-2">
            <HeartIcon className="w-6 h-6" /> Book a New Appointment
          </h2>
          <div className="flex flex-col sm:flex-row gap-4">
            <button
              onClick={() => setViewMode('instant')}
              className={`flex-1 px-4 py-3 rounded-lg border font-semibold transition ${
                viewMode === 'instant'
                  ? 'bg-sky-500 text-white shadow'
                  : 'bg-white text-sky-600 border-sky-400 hover:bg-sky-50'
              }`}
            >
              Instant Appointment
            </button>
            <button
              onClick={() => setViewMode('normal')}
              className={`flex-1 px-4 py-3 rounded-lg border font-semibold transition ${
                viewMode === 'normal'
                  ? 'bg-sky-500 text-white shadow'
                  : 'bg-white text-sky-600 border-sky-400 hover:bg-sky-50'
              }`}
            >
              Normal Appointment
            </button>
          </div>
        </section>

        {/* Doctor list */}
        {(viewMode === 'instant' || viewMode === 'normal') && (
          <section className="glass p-6">
            <div className="flex flex-col sm:flex-row justify-between items-center mb-6 gap-4">
              <h3 className="text-xl font-bold text-sky-800">
                {viewMode === 'instant' ? 'Instant Doctors' : 'Available Doctors'}
              </h3>
              <div className="relative w-full sm:w-80">
                <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-sky-500 pointer-events-none" />
                <input
                  type="text"
                  placeholder="Search name or specialization..."
                  onChange={(e) => {
                    const q = e.target.value.toLowerCase();
                    setAllDoctors((prev) =>
                      prev.filter(
                        (d) =>
                          d.name.toLowerCase().includes(q) ||
                          d.specialization.toLowerCase().includes(q)
                      )
                    );
                  }}
                  className="block w-full pl-10 pr-4 py-2 rounded-lg border border-slate-300 bg-white/80 placeholder-slate-500 focus:ring-2 focus:ring-sky-500"
                />
              </div>
            </div>

            <div className="space-y-5 max-h-[60vh] overflow-y-auto">
              {displayedDoctors.map((doc) => (
                <div
                  key={doc.id}
                  className="glass p-5 rounded-xl flex items-start gap-4 hover:scale-[1.01] transition-transform cursor-pointer"
                  onClick={() => handleDoctorClick(doc.id)}
                >
                  <div className="relative">
                    <img
                      src={
                        doc.photo
                          ? `http://127.0.0.1:8000/api/auth/uploads/${doc.photo}`
                          : '/avatar.png'
                      }
                      alt={doc.name}
                      className="w-20 h-20 rounded-full object-cover"
                    />
                    <div
                      className={`absolute bottom-1 right-1 w-4 h-4 rounded-full border-2 border-white ${
                        doc.is_active ? 'bg-green-500' : 'bg-gray-400'
                      }`}
                    ></div>
                  </div>

                  <div className="flex-1">
                    <div className="flex justify-between items-start mb-2">
                      <div>
                        <h4 className="font-bold text-xl text-slate-900 hover:text-sky-600 transition">
                          Dr. {doc.name}
                        </h4>
                        <p className="text-md text-slate-700">{doc.specialization}</p>
                      </div>

                      <div className="flex flex-col gap-1">
                        {doc.instant_available && (
                          <span className="px-2 py-1 bg-blue-100 text-blue-700 text-xs rounded-full font-medium">
                            Instant Available
                          </span>
                        )}
                        <span
                          className={`px-2 py-1 text-xs rounded-full font-medium text-center ${
                            doc.is_active
                              ? 'bg-green-100 text-green-700'
                              : 'bg-red-100 text-red-700'
                          }`}
                        >
                          {doc.is_active ? 'Online' : 'Offline'}
                        </span>
                      </div>
                    </div>

                    <div className="text-sm text-slate-600 mb-3">
                      {Object.entries(doc.availability).length > 0 ? (
                        <div className="flex flex-wrap gap-2">
                          {Object.entries(doc.availability).slice(0, 3).map(([day, slots]) => (
                            <span
                              key={day}
                              className="bg-sky-50 text-sky-700 px-2 py-1 rounded text-xs"
                            >
                              {day}: {slots[0]}
                            </span>
                          ))}
                          {Object.entries(doc.availability).length > 3 && (
                            <span className="text-sky-600 text-xs">+more</span>
                          )}
                        </div>
                      ) : (
                        <span className="text-slate-500">Schedule not set</span>
                      )}
                    </div>

                    <div className="flex items-center justify-between">
                      <div className="text-sm font-medium text-green-600">
                        PKR {doc.pricing || 0} per consultation
                      </div>

                      <div className="flex gap-2">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            openBookingModal(doc, viewMode);
                          }}
                          className="px-4 py-2 rounded-lg bg-sky-500 text-white font-semibold hover:bg-sky-600 transition text-sm"
                        >
                          Quick Book
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDoctorClick(doc.id);
                          }}
                          className="px-4 py-2 rounded-lg border border-sky-500 text-sky-600 font-semibold hover:bg-sky-50 transition text-sm"
                        >
                          View Profile
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Booking Modal */}
        {selectedDoctor && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fade-in-up">
            <div className="glass max-w-lg w-full p-6 rounded-xl">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-xl font-bold text-sky-800">
                  Book {bookingForm.appointment_type} with {selectedDoctor.name}
                </h3>
                <button
                  onClick={closeBookingModal}
                  className="text-slate-600 hover:text-sky-600"
                >
                  <XMarkIcon className="w-6 h-6" />
                </button>
              </div>
              <form
                onSubmit={
                  bookingForm.appointment_type === 'instant'
                    ? handleInstantBook
                    : handleBook
                }
                className="space-y-5"
              >
                {bookingForm.appointment_type === 'normal' && (
                  <>
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
                        {Object.keys(selectedDoctor.availability).map((d) => {
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
                        {(selectedDoctor.availability[bookingForm.day] || []).map((slot) => (
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
                  </>
                )}

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
                    onClick={closeBookingModal}
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

        {/* Chat Modal */}
        {showChatModal && chatAppointmentId && profile && (
          <ChatModal
            appointmentId={chatAppointmentId}
            userType="patient"
            userId={profile.user_id}
            onClose={() => {
              setShowChatModal(false);
              setChatAppointmentId(null);
            }}
          />
        )}
      </main>
    </div>
  );
};

export default PatientDashboard;