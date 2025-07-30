import React, { useState, useEffect } from 'react'; 
import { useNavigate } from 'react-router-dom';
import { GlobeAltIcon, UserGroupIcon, HeartIcon } from '@heroicons/react/24/outline';
import PatientSignupForm from '../components/PatientSignupForm';
import DoctorSignupForm from '../components/DoctorSignupForm';
import LoginForm from '../components/LoginForm';
import { PatientSignupData, LoginData } from '../types';
import socketService from '../services/socketService'; 

const LandingPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'patient' | 'doctor' | 'login'>('patient');
  const navigate = useNavigate();

  
  useEffect(() => {
    const handleBeforeUnload = () => {
      socketService.logout?.();
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, []);
  

  const handlePatientSignup = async (data: PatientSignupData) => {
    try {
      const res = await fetch('http://127.0.0.1:8000/api/auth/signup/patient', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data),
      });
      const json = await res.json();
      if (res.ok) { alert('Patient registered! Please log in.'); setActiveTab('login'); }
      else alert(json.error || 'Registration failed');
    } catch { alert('Network error'); }
  };

  const handleDoctorSignup = async (fd: FormData) => {
    try {
      const res = await fetch('http://127.0.0.1:8000/api/auth/signup/doctor', { method: 'POST', body: fd });
      const json = await res.json();
      if (res.ok) { alert('Doctor submitted! Awaiting admin approval.'); setActiveTab('login'); }
      else alert(json.error || 'Registration failed');
    } catch { alert('Network error'); }
  };

  const handleLogin = async (data: LoginData) => {
    try {
        const res = await fetch('http://127.0.0.1:8000/api/auth/login', {
            method: 'POST', 
            headers: { 'Content-Type': 'application/json' }, 
            body: JSON.stringify(data),
        });
        const json = await res.json();
        if (res.ok) {
            localStorage.setItem(`${json.role}_token`, json.access_token);
            localStorage.setItem('role', json.role);
            localStorage.setItem('user_id', json.user_id); 
            if (json.role === 'admin') navigate('/admin');
            else if (json.role === 'doctor') navigate('/doctor');
            else if (json.role === 'patient') navigate('/patient');
        } else alert(json.error || 'Login failed');
    } catch { alert('Network error'); }
};

  const tabs = [
    { key: 'patient', label: 'Register as Patient', icon: HeartIcon },
    { key: 'doctor', label: 'Register as Doctor', icon: UserGroupIcon },
    { key: 'login', label: 'Login', icon: GlobeAltIcon },
  ] as const;

  return (
    <main className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-sky-50 via-white to-sky-100">
      <div className="glass max-w-lg w-full p-8 rounded-2xl animate-fade-in-up">
        <h1 className="text-4xl font-bold text-center text-sky-700 mb-2">SmartCare</h1>
        <p className="text-center text-sm text-slate-500 mb-6">Your health, one click away.</p>

        <nav className="flex rounded-full bg-slate-100 p-1 mb-6">
          {tabs.map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              onClick={() => setActiveTab(key)}
              className={`flex-1 flex items-center justify-center gap-2 px-3 py-2 text-sm font-semibold rounded-full transition-all
                ${activeTab === key ? 'bg-white shadow-md text-sky-600' : 'text-slate-600 hover:text-sky-500'}`}
            >
              <Icon className="w-4 h-4" />
              <span className="hidden sm:inline">{label}</span>
            </button>
          ))}
        </nav>

        <section key={activeTab} className="animate-fade-in-up">
          {activeTab === 'patient' && <PatientSignupForm onSubmit={handlePatientSignup} />}
          {activeTab === 'doctor' && <DoctorSignupForm onSubmit={handleDoctorSignup} />}
          {activeTab === 'login' && <LoginForm onSubmit={handleLogin} />}
        </section>
      </div>
    </main>
  );
};

export default LandingPage;