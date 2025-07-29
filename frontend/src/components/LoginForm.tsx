import React, { useState } from 'react';
import { LoginData } from '../types';
import { EnvelopeIcon, LockClosedIcon } from '@heroicons/react/24/outline';

interface Props { onSubmit: (d: LoginData) => void }

const LoginForm: React.FC<Props> = ({ onSubmit }) => {
  const [form, setForm] = useState<LoginData>({ email:'', password:'' });
  const [error, setError] = useState('');
  const [show, setShow] = useState(false);

  const handle = (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm({ ...form, [e.target.name]: e.target.value });

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.email || !form.password) return setError('Email & password required');
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
          <input type={show ? 'text' : 'password'} name="password" value={form.password} onChange={handle} placeholder="••••••••"
                 className="block w-full pl-10 pr-16 py-2 rounded-lg border border-slate-300 bg-white/80 focus:ring-2 focus:ring-sky-500 placeholder-slate-400"/>
          <button type="button" onClick={() => setShow(!show)}
                  className="absolute inset-y-0 right-3 flex items-center text-xs text-sky-600">
            {show ? 'Hide' : 'Show'}
          </button>
        </div>
      </div>

      <button type="submit"
              className="w-full px-4 py-2.5 rounded-lg bg-sky-500 text-white font-semibold hover:bg-sky-600 transition">
        Sign In
      </button>
    </form>
  );
};

export default LoginForm;