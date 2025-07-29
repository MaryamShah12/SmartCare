import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  CheckCircleIcon,
  XCircleIcon,
  UserCircleIcon,
  ClockIcon,
  CurrencyDollarIcon,
  CalendarDaysIcon,
  Cog6ToothIcon,
  PowerIcon,
  EyeIcon,
  DocumentTextIcon,
  PhotoIcon,
} from '@heroicons/react/24/outline';
import socketService from '../services/socketService';
import ChatModal from './ChatModal';

/* ----------  TYPES  ---------- */
interface Appointment {
  id: number;
  patient_name: string;
  appointment_type: string;
  start_time: string;
  end_time: string;
  status: string;
  symptoms: string | null;
  report_file: string | null;
  patient: PatientInfo;
  chat_active?: boolean;
}
interface PatientInfo {
  id: number;
  name: string;
  age: number;
  gender: string | null;
  medical_history: string | null;
}
interface DoctorProfile {
  user_id: number;
  name: string;
  email: string;
  specialization: string;
  availability: Record<string, string[]>;
  instant_available: boolean;
  is_active: boolean;
  photo: string | null;
  pricing: number;
}

const inputClasses =
  'block w-full px-3 py-2 border border-slate-300 bg-white/80 rounded-lg shadow-sm focus:ring-2 focus:ring-sky-500 placeholder-slate-400 text-slate-900';
const btnPrimaryClasses =
  'px-4 py-2 rounded-lg bg-sky-500 text-white font-semibold hover:bg-sky-600 transition';

const inputSmClasses =
  'px-2 py-1 border border-slate-300 rounded-md text-sm bg-white/80 focus:ring-2 focus:ring-sky-500 focus:border-sky-500';

const weekDays = [
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
  'Sunday',
];


type WeekSchedule = Record<string, { start: string; end: string }>;
const ScheduleEditor: React.FC<{
  value: WeekSchedule;
  onChange: (s: WeekSchedule) => void;
}> = ({ value, onChange }) => (
  <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
    {weekDays.map((day) => {
      const range = value[day] ?? { start: '', end: '' };
      return (
        <div key={day} className="glass p-3 rounded-xl">
          <label className="block text-sm font-semibold text-slate-700 mb-2">
            {day}
          </label>

          {/* Start */}
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs text-slate-500 w-10">Start</span>
            <input
              type="time"
              value={range.start}
              onChange={(e) =>
                onChange({
                  ...value,
                  [day]: { ...range, start: e.target.value },
                })
              }
              className="input-sm"
              key={`${day}-start`}
            />
          </div>

          {/* End */}
          <div className="flex items-center gap-2 mb-2">
            <span className="text-xs text-slate-500 w-10">End</span>
            <input
              type="time"
              value={range.end}
              onChange={(e) =>
                onChange({ ...value, [day]: { ...range, end: e.target.value } })
              }
              className="input-sm"
              key={`${day}-end`}
            />
          </div>

          {/* Remove */}
          <button
            type="button"
            onClick={() => {
              const { [day]: _, ...rest } = value;
              onChange(rest);
            }}
            className="text-xs text-red-500 hover:text-red-700"
          >
            ✕ Clear Slot
          </button>
        </div>
      );
    })}
  </div>
);


const DoctorDashboard: React.FC = () => {
  const [scheduled, setScheduled] = useState<Appointment[]>([]);
  const [pending, setPending] = useState<Appointment[]>([]);
  const [selected, setSelected] = useState<Appointment | null>(null);
  const [profile, setProfile] = useState<DoctorProfile | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'appointments' | 'profile'>(
    'appointments'
  );
  const [showChatModal, setShowChatModal] = useState(false);
  const [chatAppointmentId, setChatAppointmentId] = useState<number | null>(null);

  const [form, setForm] = useState({
    name: '',
    specialization: '',
    availability: {} as WeekSchedule,
    photo: null as File | null,
    pricing: 0,
  });

  const navigate = useNavigate();
  const token = () => {
    const role = localStorage.getItem('role');
    return localStorage.getItem(`${role}_token`) || '';
  };

  
  const fetchAppointments = async () => {
    try {
      const res = await fetch(
        'http://127.0.0.1:8000/api/auth/doctor/appointments',
        {
          headers: { Authorization: `Bearer ${token()}` },
        }
      );
      const data = await res.json();
      if (res.ok) {
        setScheduled(data.scheduled);
        setPending(
          data.pending.map((a: any) => ({ ...a, patient: a.patient || {} }))
        );
      } else setError(data.error || 'Failed to fetch appointments');
    } catch {
      setError('Could not connect');
    }
  };

  const fetchProfile = async () => {
    try {
      const res = await fetch('http://127.0.0.1:8000/api/auth/doctor/profile', {
        headers: { Authorization: `Bearer ${token()}` },
      });
      const data = await res.json();
      if (res.ok) {
        setProfile(data);
        const schedule: WeekSchedule = {};
        Object.entries(data.availability || {}).forEach(([day, ranges]) => {
          if (Array.isArray(ranges) && ranges[0]) {
            const [start, end] = ranges[0].split('-');
            schedule[day] = { start, end };
          }
        });
        setForm({
          name: data.name,
          specialization: data.specialization,
          availability: schedule,
          photo: null,
          pricing: data.pricing || 0,
        });
      } else setError(data.error || 'Failed to fetch profile');
    } catch {
      setError('Could not connect');
    }
  };

  
  const pollForUpdates = () => {
    const interval = setInterval(() => {
      if (document.visibilityState === 'visible') {
        fetchAppointments();
      }
    }, 5000);
    return interval;
  };

  
  useEffect(() => {
    const handleNewAppointment = (data: any) => {
      console.log('✅ DOCTOR received new_appointment_request:', data);
      setPending((prev) => [...prev, data.appointment]);
      alert(`New instant appointment request from ${data.appointment.patient_name}`);
    };

    
    socketService.onNewAppointmentRequest(handleNewAppointment);

    
    return () => {
      console.log('🧹 DoctorDashboard unmounting, removing listener.');
      socketService.off('new_appointment_request');
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
    fetchAppointments();
    fetchProfile();

    const interval = pollForUpdates();
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        fetchAppointments();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);

  
  const accept = async (id: number) => {
    try {
      console.log(`Accepting appointment ${id}`);
      const res = await fetch(
        `http://127.0.0.1:8000/api/auth/doctor/appointment/${id}/accept`,
        {
          method: 'POST',
          headers: { Authorization: `Bearer ${token()}` },
        }
      );
      const data = await res.json();
      if (res.ok) {
        console.log('Appointment accepted successfully');
        
        
        const acceptedAppointment = pending.find(a => a.id === id);
        if (acceptedAppointment && acceptedAppointment.appointment_type === 'instant') {
          
          setChatAppointmentId(id);
          setShowChatModal(true);
        }
        
        fetchAppointments();
        setSelected(null);
      } else {
        console.error('Failed to accept appointment:', data.error);
        alert(data.error || 'Failed to accept appointment');
      }
    } catch (error) {
      console.error('Network error:', error);
      alert('Network error occurred');
    }
  };

  const reject = async (id: number) => {
    try {
      console.log(`Rejecting appointment ${id}`);
      const res = await fetch(
        `http://127.0.0.1:8000/api/auth/doctor/appointment/${id}/reject`,
        {
          method: 'POST',
          headers: { Authorization: `Bearer ${token()}` },
        }
      );
      const data = await res.json();
      if (res.ok) {
        console.log('Appointment rejected successfully');
        fetchAppointments();
        setSelected(null);
      } else {
        console.error('Failed to reject appointment:', data.error);
        alert(data.error || 'Failed to reject appointment');
      }
    } catch (error) {
      console.error('Network error:', error);
      alert('Network error occurred');
    }
  };

  const toggleInstant = async () => {
    await fetch('http://127.0.0.1:8000/api/auth/doctor/toggle-instant', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token()}` },
    });
    fetchProfile();
  };

  const toggleActive = async () => {
    await fetch('http://127.0.0.1:8000/api/auth/doctor/toggle-active', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token()}` },
    });
    fetchProfile();
  };

  const updateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    const fd = new FormData();
    fd.append('name', form.name);
    fd.append('specialization', form.specialization);
    fd.append('pricing', String(form.pricing));
    fd.append(
      'availability',
      JSON.stringify(
        Object.fromEntries(
          Object.entries(form.availability).map(([d, r]) => [
            d,
            [`${r.start}-${r.end}`],
          ])
        )
      )
    );
    if (form.photo) fd.append('photo', form.photo);

    await fetch('http://127.0.0.1:8000/api/auth/doctor/profile', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token()}` },
      body: fd,
    });
    fetchProfile();
  };

  const logout = () => {
    socketService.logout(); 
    localStorage.clear();
    navigate('/');
  };

  
  return (
    <div className="min-h-screen bg-gradient-to-br from-sky-50 via-white to-sky-100 p-4">
      {/* Header */}
      <header className="max-w-6xl mx-auto mb-6 flex items-center justify-between">
        <h1 className="text-3xl font-bold text-sky-800">Doctor Dashboard</h1>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setActiveTab('appointments')}
            className={`px-4 py-2 rounded-lg font-semibold transition ${
              activeTab === 'appointments'
                ? 'bg-sky-500 text-white shadow'
                : 'bg-white text-sky-600'
            }`}
          >
            Appointments
          </button>
          <button
            onClick={() => setActiveTab('profile')}
            className={`px-4 py-2 rounded-lg font-semibold transition ${
              activeTab === 'profile'
                ? 'bg-sky-500 text-white shadow'
                : 'bg-white text-sky-600'
            }`}
          >
            Profile
          </button>
          <button
            onClick={logout}
            className="flex items-center gap-1 px-4 py-2 rounded-lg bg-red-500 text-white font-semibold hover:bg-red-600 transition"
          >
            <PowerIcon className="w-4 h-4" /> Logout
          </button>
        </div>
      </header>

      <main className="max-w-6xl mx-auto">
        {error && (
          <p className="bg-red-100 text-red-700 px-4 py-2 rounded mb-4">
            {error}
          </p>
        )}

        {/* ----------  APPOINTMENTS VIEW  ---------- */}
        {activeTab === 'appointments' && (
          <div className="space-y-8">
            {/* Toggle switches */}
            <div className="glass p-4 flex items-center gap-6">
              <span className="text-sm font-medium text-slate-700">
                Instant Bookings
              </span>
              <button
                onClick={toggleInstant}
                className={`w-14 h-7 rounded-full p-1 transition ${
                  profile?.instant_available ? 'bg-sky-500' : 'bg-slate-300'
                }`}
              >
                <div
                  className={`w-5 h-5 bg-white rounded-full transition-transform ${
                    profile?.instant_available ? 'translate-x-7' : 'translate-x-0'
                  }`}
                />
              </button>
              <span className="text-sm font-medium text-slate-700">
                Available
              </span>
              <button
                onClick={toggleActive}
                className={`w-14 h-7 rounded-full p-1 transition ${
                  profile?.is_active ? 'bg-sky-500' : 'bg-slate-300'
                }`}
              >
                <div
                  className={`w-5 h-5 bg-white rounded-full transition-transform ${
                    profile?.is_active ? 'translate-x-7' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>

            {/* Pending */}
            <section className="glass p-6">
              <h2 className="text-2xl font-bold text-sky-800 mb-4 flex items-center gap-2">
                <ClockIcon className="w-6 h-6" /> Pending Requests
              </h2>
              {pending.length ? (
                <div className="grid gap-4 md:grid-cols-2">
                  {pending.map((a) => (
                    <div
                      key={a.id}
                      className="bg-white/80 rounded-xl p-4 shadow-sm space-y-2"
                    >
                      <p className="font-bold text-slate-900">
                        {a.patient.name} • {a.appointment_type}
                      </p>
                      <p className="text-sm text-slate-600">
                        {new Date(a.start_time).toLocaleString()} –{' '}
                        {new Date(a.end_time).toLocaleString()}
                      </p>
                      <button
                        onClick={() => setSelected(a)}
                        className="text-sm text-sky-600 font-semibold flex items-center gap-1"
                      >
                        <EyeIcon className="w-4 h-4" /> View Details
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-slate-500">No pending requests right now.</p>
              )}
            </section>

            {/* Scheduled */}
            <section className="glass p-6">
              <h2 className="text-2xl font-bold text-sky-800 mb-4 flex items-center gap-2">
                <CalendarDaysIcon className="w-6 h-6" /> Scheduled Appointments
              </h2>
              {scheduled.length ? (
                <div className="space-y-3">
                  {scheduled.map((a) => (
                    <div
                      key={a.id}
                      className="bg-white/80 rounded-xl p-4 flex justify-between items-center shadow-sm"
                    >
                      <div>
                        <p className="font-bold text-slate-900">
                          {a.patient_name}
                        </p>
                        <p className="text-sm text-slate-600">
                          {a.appointment_type}
                        </p>
                      </div>
                      <p className="text-sm text-slate-600">
                        {new Date(a.start_time).toLocaleString()}
                      </p>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-slate-500">Your calendar is clear.</p>
              )}
            </section>
          </div>
        )}

        {/* ----------  PROFILE VIEW  ---------- */}
        {activeTab === 'profile' && (
          <section className="glass p-6 sm:p-8 animate-fade-in-up">
            {/* Heading */}
            <h2 className="text-2xl font-bold text-sky-800 mb-6 flex items-center gap-2">
              <UserCircleIcon className="w-7 h-7" />
              Profile Settings
            </h2>

            {/* Form */}
            <form onSubmit={updateProfile} className="space-y-6">
              {/* Row 1 */}
              <div className="grid md:grid-cols-2 gap-6">
                {/* Name */}
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1">
                    Full Name
                  </label>
                  <input
                    type="text"
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    className="block w-full px-4 py-2 rounded-lg border border-slate-300 bg-white/80 focus:ring-2 focus:ring-sky-500 focus:border-sky-500 placeholder-slate-400 text-slate-900"
                    placeholder="Dr. Jane Doe"
                  />
                </div>

                {/* Specialization */}
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1">
                    Specialization
                  </label>
                  <input
                    type="text"
                    value={form.specialization}
                    onChange={(e) =>
                      setForm({ ...form, specialization: e.target.value })
                    }
                    className="block w-full px-4 py-2 rounded-lg border border-slate-300 bg-white/80 focus:ring-2 focus:ring-sky-500 focus:border-sky-500 placeholder-slate-400 text-slate-900"
                    placeholder="Cardiologist"
                  />
                </div>
              </div>

              {/* Row 2 */}
              <div className="grid md:grid-cols-2 gap-6">
                {/* Price */}
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1 flex items-center gap-1">
                    <CurrencyDollarIcon className="w-4 h-4 text-sky-500" />{' '}
                    Consultation Price
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={form.pricing}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        pricing: parseFloat(e.target.value) || 0,
                      })
                    }
                    className="block w-full px-4 py-2 rounded-lg border border-slate-300 bg-white/80 focus:ring-2 focus:ring-sky-500 focus:border-sky-500 placeholder-slate-400 text-slate-900"
                    placeholder="50"
                  />
                </div>

                {/* Photo */}
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1 flex items-center gap-1">
                    <PhotoIcon className="w-4 h-4 text-sky-500" /> Profile Photo
                  </label>
                  {profile?.photo && (
                    <img
                      src={`http://127.0.0.1:8000/api/auth/uploads/${profile.photo}`}
                      alt="Profile"
                      className="w-24 h-24 rounded-full object-cover mb-2"
                    />
                  )}
                  <input
                    type="file"
                    accept="image/jpeg,image/png"
                    onChange={(e) =>
                      setForm({ ...form, photo: e.target.files?.[0] || null })
                    }
                    className="block w-full text-sm file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-sky-100 file:text-sky-700 hover:file:bg-sky-200"
                  />
                </div>
              </div>

              {/* Availability */}
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">
                  Weekly Availability
                </label>
                <ScheduleEditor
                  value={form.availability}
                  onChange={(s) => setForm({ ...form, availability: s })}
                />
              </div>

              {/* Save button */}
              <button
                type="submit"
                className="px-6 py-2.5 rounded-lg bg-sky-500 text-white font-semibold hover:bg-sky-600 transition"
              >
                Save Changes
              </button>
            </form>
          </section>
        )}

        {/* ----------  PATIENT DETAILS MODAL  ---------- */}
        {selected && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fade-in-up">
            <div className="glass max-w-lg w-full p-6 rounded-xl space-y-4">
              <h3 className="text-xl font-bold text-sky-800">Patient Details</h3>
              <p className="text-sm">
                <span className="font-semibold">Name:</span> {selected.patient.name}
              </p>
              <p className="text-sm">
                <span className="font-semibold">Age:</span> {selected.patient.age}
              </p>
              <p className="text-sm">
                <span className="font-semibold">Gender:</span>{' '}
                {selected.patient.gender || '—'}
              </p>
              <p className="text-sm">
                <span className="font-semibold">Medical History:</span>{' '}
                {selected.patient.medical_history || 'None'}
              </p>
              <hr />
              <p className="text-sm">
                <span className="font-semibold">Type:</span>{' '}
                {selected.appointment_type}
              </p>
              <p className="text-sm">
                <span className="font-semibold">When:</span>{' '}
                {new Date(selected.start_time).toLocaleString()}
              </p>
              <p className="text-sm whitespace-pre-wrap">
                <span className="font-semibold">Symptoms:</span>{' '}
                {selected.symptoms || 'None'}
              </p>
              {selected.report_file && (
                <a
                  href={`http://127.0.0.1:8000/api/auth/uploads/${selected.report_file}`}
                  target="_blank"
                  rel="noreferrer"
                  className="text-sky-600 underline text-sm"
                >
                  View Report
                </a>
              )}
              <div className="flex justify-end gap-3 pt-4">
                <button
                  onClick={() => reject(selected.id)}
                  className="btn-outline border-red-500 text-red-500"
                >
                  <XCircleIcon className="w-4 h-4 inline mr-1" /> Reject
                </button>
                <button
                  onClick={() => accept(selected.id)}
                  className="btn-primary"
                >
                  <CheckCircleIcon className="w-4 h-4 inline mr-1" /> Accept
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Chat Modal */}
        {showChatModal && chatAppointmentId && profile && (
          <ChatModal
            appointmentId={chatAppointmentId}
            userType="doctor"
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

export default DoctorDashboard;