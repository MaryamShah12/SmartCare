import React, { useState } from 'react';
import { PatientSignupData } from '../types';
import { EnvelopeIcon, LockClosedIcon, IdentificationIcon, CakeIcon } from '@heroicons/react/24/outline';

interface Props { onSubmit: (d: PatientSignupData) => void }

const PatientSignupForm: React.FC<Props> = ({ onSubmit }) => {
  const [form, setForm] = useState<PatientSignupData>({
    email:'', password:'', name:'', age:0, gender:'', medical_history:''
  });
  const [error, setError] = useState('');

  const handle = (e: React.ChangeEvent<HTMLInputElement|HTMLSelectElement|HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setForm({ ...form, [name]: name==='age' ? parseInt(value)||0 : value });
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.email || !form.password || !form.name || !form.age || !form.gender) return setError('All fields except medical history required');
    setError('');
    onSubmit(form);
  };

  return (
    <form onSubmit={submit} className="space-y-5">
      {error && <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">{error}</p>}

      {/* Email */}
      <div>
        <label className="block text-sm font-medium text-slate-700">Email</label>
        <div className="relative mt-1">
          <EnvelopeIcon className="absolute top-1/2 left-3 w-5 h-5 -translate-y-1/2 text-slate-400 pointer-events-none"/>
          <input type="email" name="email" value={form.email} onChange={handle} placeholder="you@example.com"
                 className="block w-full pl-10 pr-3 py-2 rounded-lg border border-slate-300 bg-white/80 focus:ring-2 focus:ring-sky-500 placeholder-slate-400"/>
        </div>
      </div>

      {/* Password */}
      <div>
        <label className="block text-sm font-medium text-slate-700">Password</label>
        <div className="relative mt-1">
          <LockClosedIcon className="absolute top-1/2 left-3 w-5 h-5 -translate-y-1/2 text-slate-400 pointer-events-none"/>
          <input type="password" name="password" value={form.password} onChange={handle} placeholder="••••••••"
                 className="block w-full pl-10 pr-3 py-2 rounded-lg border border-slate-300 bg-white/80 focus:ring-2 focus:ring-sky-500 placeholder-slate-400"/>
        </div>
      </div>

      {/* Name */}
      <div>
        <label className="block text-sm font-medium text-slate-700">Full Name</label>
        <div className="relative mt-1">
          <IdentificationIcon className="absolute top-1/2 left-3 w-5 h-5 -translate-y-1/2 text-slate-400 pointer-events-none"/>
          <input type="text" name="name" value={form.name} onChange={handle} placeholder="John Doe"
                 className="block w-full pl-10 pr-3 py-2 rounded-lg border border-slate-300 bg-white/80 focus:ring-2 focus:ring-sky-500 placeholder-slate-400"/>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        {/* Age */}
        <div>
          <label className="block text-sm font-medium text-slate-700">Age</label>
          <div className="relative mt-1">
            <CakeIcon className="absolute top-1/2 left-3 w-5 h-5 -translate-y-1/2 text-slate-400 pointer-events-none"/>
            <input type="number" name="age" min={1} value={form.age || ''} onChange={handle} placeholder="25"
                   className="block w-full pl-10 pr-3 py-2 rounded-lg border border-slate-300 bg-white/80 focus:ring-2 focus:ring-sky-500 placeholder-slate-400"/>
          </div>
        </div>

        {/* Gender */}
        <div>
          <label className="block text-sm font-medium text-slate-700">Gender</label>
          <select name="gender" value={form.gender} onChange={handle}
                  className="block w-full px-3 py-2 mt-1 rounded-lg border border-slate-300 bg-white/80 focus:ring-2 focus:ring-sky-500">
            <option value="" disabled>Select</option>
            <option>Male</option><option>Female</option><option>Other</option>
          </select>
        </div>
      </div>

      {/* Medical History */}
      <div>
        <label className="block text-sm font-medium text-slate-700">Medical History (optional)</label>
        <textarea name="medical_history" rows={3} value={form.medical_history} onChange={handle}
                  placeholder="Allergies, surgeries, chronic conditions..."
                  className="block w-full px-3 py-2 rounded-lg border border-slate-300 bg-white/80 focus:ring-2 focus:ring-sky-500 placeholder-slate-400"/>
      </div>

      <button type="submit"
              className="w-full px-4 py-2.5 rounded-lg bg-sky-500 text-white font-semibold hover:bg-sky-600 transition">
        Register as Patient
      </button>
    </form>
  );
};

export default PatientSignupForm;