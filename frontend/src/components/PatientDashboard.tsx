import React, { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  CalendarDaysIcon,
  HeartIcon,
  MagnifyingGlassIcon,
  XMarkIcon,
} from '@heroicons/react/24/outline';
import socketService from '../services/socketService';
import ChatModal from './ChatModal';

/* ----- types ----- */
interface Doctor {
  id: number;
  name: string;
  specialization: string;
  instant_available: boolean;
  is_online: boolean;
  is_active: boolean;
  photo: string | null;
  availability: Record<string, string[]>;
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
        if (res.ok) {
            setAllDoctors(data.doctors);
        } else setError(data.error || 'Failed to fetch doctors');
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
    
    return () => {
        clearInterval(refreshInterval);
    };
  }, []);

  


useEffect(() => {
  const handleAppointmentUpdate = (data: { status: string; chat_active: boolean; appointment_id: number }) => {
    console.log('✅✅✅ PATIENT received appointment_updated event:', data);
    fetchAppointments();
    if (data.status === 'accepted' && data.chat_active) {
      console.log('🎉 Chat is active! Opening modal for appointment:', data.appointment_id);
      setChatAppointmentId(data.appointment_id);
      setShowChatModal(true);
    }
  };

  
  socketService.onAppointmentUpdated(handleAppointmentUpdate);

  
  return () => {
    console.log('🧹 PatientDashboard unmounting, removing listener.');
    socketService.off('appointment_updated');
  };
}, []); 

  useEffect(() => {
    const handleBeforeUnload = () => {
        socketService.disconnect();
    };

    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
        window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, []);

  useEffect(() => {
    if (selectedAppointmentForChat) {
      const appointment = appointments.find(a => a.id === selectedAppointmentForChat);
      if (appointment && appointment.appointment_type === 'instant' && appointment.status === 'accepted') {
        alert(`Your instant appointment with ${appointment.doctor_name} has been accepted! Chat is now active.`);
        setSelectedAppointmentForChat(null);
      }
    }
  }, [selectedAppointmentForChat, appointments]);

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
    const slot = `${bookingForm.day} ${bookingForm.start_time}-${bookingForm.end_time}`;
    const fd = new FormData();
    fd.append('doctor_id', String(selectedDoctor.id));
    fd.append('appointment_type', bookingForm.appointment_type);
    fd.append('start_time', slot);
    fd.append('end_time', slot);
    fd.append('symptoms', bookingForm.symptoms);
    if (bookingForm.report_file) fd.append('report_file', bookingForm.report_file);
    try {
      const res = await fetch(
        'http://127.0.0.1:8000/api/auth/patient/book-appointment',
        {
          method: 'POST',
          headers: { Authorization: `Bearer ${token()}` },
          body: fd,
        }
      );
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
        return allDoctors.filter(d => d.instant_available && d.is_active);
    }
    return allDoctors.filter(d => d.is_active);
  }, [viewMode, allDoctors]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-sky-50 via-white to-sky-100 p-4">
      <header className="max-w-6xl mx-auto flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold text-sky-800">Patient Dashboard</h1>
        <div className="flex gap-2">
          <button
            onClick={() => {
              fetchDoctors();
            }}
            className="px-4 py-2 rounded-lg text-sm font-semibold text-white bg-green-500 hover:bg-green-600 transition"
          >
            Refresh Status
          </button>

          <button
            onClick={() => {
              console.log('🧪 Testing WebSocket connection...');
              console.log('Socket connected:', socketService.socket?.connected);
              console.log('Socket ID:', socketService.socket?.id);
              socketService.socket?.emit('verify_room', { room: `patient_${profile?.user_id}` });
              
              socketService.socket?.on('room_verified', (data) => {
                console.log('✅ Room verification received:', data);
              });
            }}
            className="px-4 py-2 bg-blue-500 text-white rounded"
          >
            Test Connection
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
        <section className="glass p-6">
          <h2 className="text-2xl font-bold text-sky-800 mb-4 flex items-center gap-2">
            <CalendarDaysIcon className="w-6 h-6" /> My Appointments
          </h2>
          {appointments.length ? (
            <div className="space-y-4">
              {appointments.map((a) => (
                <div
                  key={a.id}
                  className="bg-white/70 p-4 rounded-xl shadow-sm hover:shadow-md transition-shadow"
                >
                  <h3 className="font-bold text-lg text-slate-900">
                    {a.doctor_name}
                  </h3>
                  <p className="text-sm text-slate-700">{a.appointment_type}</p>
                  <p className="text-sm text-slate-600">
                    {new Date(a.start_time).toLocaleString()} –{' '}
                    {new Date(a.end_time).toLocaleString()}
                  </p>
                  <span
                    className={`text-sm font-semibold ${
                      a.status === 'accepted' ? 'text-green-600' : 'text-amber-600'
                    }`}
                  >
                    {a.status}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-slate-600">No appointments yet.</p>
          )}
        </section>

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
                  className="glass p-5 rounded-xl flex items-start gap-4 hover:scale-[1.01] transition-transform"
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
                  </div>
                  <div className="flex-1">
                    <h4 className="font-bold text-xl text-slate-900">{doc.name}</h4>
                    <p className="text-md text-slate-700">{doc.specialization}</p>
                    <div className="text-sm text-slate-600 mt-2">
                      {Object.entries(doc.availability).length
                        ? Object.entries(doc.availability).map(([day, slots]) => (
                            <div key={day}>
                              <strong className="text-slate-800">{day}:</strong>{' '}
                              {slots.join(', ')}
                            </div>
                          ))
                        : null}
                    </div>
                    <button
                      onClick={() => openBookingModal(doc, viewMode)}
                      className="mt-4 px-4 py-2 rounded-lg bg-sky-500 text-white font-semibold hover:bg-sky-600 transition"
                    >
                      Book {viewMode === 'instant' ? 'Instant' : 'Normal'} Appointment
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

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
                        onChange={(e) =>
                          setBookingForm({ ...bookingForm, day: e.target.value })
                        }
                        className="block w-full mt-1 px-3 py-2 rounded-lg border border-slate-300 bg-white/80 focus:ring-2 focus:ring-sky-500"
                      >
                        <option value="">Choose day</option>
                        {Object.keys(selectedDoctor.availability).map((d) => (
                          <option key={d} value={d}>
                            {d}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-bold text-sky-800">
                        Available slots
                      </label>
                      <div className="flex flex-wrap gap-2 mt-1">
                        {(selectedDoctor.availability[bookingForm.day] || []).map(
                          (slot) => (
                            <span
                              key={slot}
                              className="bg-sky-100 text-sky-800 px-2 py-1 rounded text-xs"
                            >
                              {slot}
                            </span>
                          )
                        )}
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
                  <label className="block text-sm font-bold text-sky-800">
                    Symptoms
                  </label>
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