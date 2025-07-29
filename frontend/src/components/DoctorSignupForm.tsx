import React, { useState } from 'react';
import { EnvelopeIcon, LockClosedIcon, IdentificationIcon, DocumentTextIcon, CameraIcon } from '@heroicons/react/24/outline';

interface Props { onSubmit: (fd: FormData) => void }

const DoctorSignupForm: React.FC<Props> = ({ onSubmit }) => {
  const [form, setForm] = useState({ email:'', password:'', name:'', specialization:'' });
  const [docs, setDocs]   = useState<File[]>([]);
  const [photo, setPhoto] = useState<File|null>(null);
  const [error, setError] = useState('');

  const handleText = (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm({ ...form, [e.target.name]: e.target.value });

  const handleDocs = (e: React.ChangeEvent<HTMLInputElement>) => {
    const list = Array.from(e.target.files || []).slice(0, 2);
    if (list.length > 2) return setError('Max 2 docs');
    setDocs(list); setError('');
  };

  const handlePhoto = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f && !f.type.match('image/(jpeg|jpg|png)')) return setError('Photo must be JPG/PNG');
    setPhoto(f || null); setError('');
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.email || !form.password || !form.name || !form.specialization) return setError('All fields required');
    const fd = new FormData();
    Object.entries(form).forEach(([k, v]) => fd.append(k, v));
    docs.forEach(d => fd.append('documents', d));
    if (photo) fd.append('photo', photo);
    onSubmit(fd);
  };

  return (
    <form onSubmit={submit} className="space-y-5">
      {error && <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">{error}</p>}

      {/* Email */}
      <div>
        <label className="block text-sm font-medium text-slate-700">Email</label>
        <div className="relative mt-1">
          <EnvelopeIcon className="absolute top-1/2 left-3 w-5 h-5 -translate-y-1/2 text-slate-400 pointer-events-none"/>
          <input type="email" name="email" value={form.email} onChange={handleText} placeholder="you@example.com"
                 className="block w-full pl-10 pr-3 py-2 rounded-lg border border-slate-300 bg-white/80 focus:ring-2 focus:ring-sky-500 placeholder-slate-400"/>
        </div>
      </div>

      {/* Password */}
      <div>
        <label className="block text-sm font-medium text-slate-700">Password</label>
        <div className="relative mt-1">
          <LockClosedIcon className="absolute top-1/2 left-3 w-5 h-5 -translate-y-1/2 text-slate-400 pointer-events-none"/>
          <input type="password" name="password" value={form.password} onChange={handleText} placeholder="••••••••"
                 className="block w-full pl-10 pr-3 py-2 rounded-lg border border-slate-300 bg-white/80 focus:ring-2 focus:ring-sky-500 placeholder-slate-400"/>
        </div>
      </div>

      {/* Name */}
      <div>
        <label className="block text-sm font-medium text-slate-700">Full Name</label>
        <div className="relative mt-1">
          <IdentificationIcon className="absolute top-1/2 left-3 w-5 h-5 -translate-y-1/2 text-slate-400 pointer-events-none"/>
          <input type="text" name="name" value={form.name} onChange={handleText} placeholder="Dr. Jane Doe"
                 className="block w-full pl-10 pr-3 py-2 rounded-lg border border-slate-300 bg-white/80 focus:ring-2 focus:ring-sky-500 placeholder-slate-400"/>
        </div>
      </div>

      {/* Specialization */}
      <div>
        <label className="block text-sm font-medium text-slate-700">Specialization</label>
        <input type="text" name="specialization" value={form.specialization} onChange={handleText} placeholder="e.g. Cardiologist"
               className="block w-full px-3 py-2 rounded-lg border border-slate-300 bg-white/80 focus:ring-2 focus:ring-sky-500 placeholder-slate-400"/>
      </div>

      {/* Documents */}
      <div>
        <label className="flex items-center gap-1 text-sm font-medium text-slate-700">
          <DocumentTextIcon className="w-4 h-4 text-sky-500"/> Documents (PDF/DOC, max 2)
        </label>
        <input type="file" multiple accept=".pdf,.doc,.docx" onChange={handleDocs}
               className="block w-full mt-1 text-sm file:mr-2 file:py-2 file:px-4 file:rounded-md file:border-0 file:bg-sky-100 file:text-sky-700"/>
        {docs.length > 0 && <ul className="mt-1 text-xs text-slate-600">{docs.map(d=><li key={d.name}>{d.name}</li>)}</ul>}
      </div>

      {/* Photo */}
      <div>
        <label className="flex items-center gap-1 text-sm font-medium text-slate-700">
          <CameraIcon className="w-4 h-4 text-sky-500"/> Profile Photo
        </label>
        <input type="file" accept="image/jpeg,image/jpg,image/png" onChange={handlePhoto}
               className="block w-full mt-1 text-sm file:mr-2 file:py-2 file:px-4 file:rounded-md file:border-0 file:bg-sky-100 file:text-sky-700"/>
        {photo && <p className="mt-1 text-xs text-slate-600">{photo.name}</p>}
      </div>

      <button type="submit"
              className="w-full px-4 py-2.5 rounded-lg bg-sky-500 text-white font-semibold hover:bg-sky-600 transition">
        Register as Doctor
      </button>
    </form>
  );
};

export default DoctorSignupForm;