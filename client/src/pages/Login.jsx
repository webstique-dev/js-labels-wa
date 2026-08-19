import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useNotification } from '../context/NotificationContext';
import { Eye, EyeOff, AlertCircle, LogIn } from 'lucide-react';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { login } = useAuth();
  const notify = useNotification();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      await login(email, password);
      notify.success('Logged in successfully!');
      navigate('/dashboard');
    } catch (err) {
      const errMsg = err.response?.data?.message || 'Invalid login credentials. Please try again.';
      notify.error(errMsg);
    } finally {
      setIsSubmitting(false);
    }
  };

  const fillQuickUser = (userEmail) => {
    setEmail(userEmail);
    setPassword('Test1234!');
  };

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col justify-center items-center p-4">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-xl border border-slate-200/60 p-6 sm:p-8 md:p-10 space-y-6">
        
        {/* Header */}
        <div className="text-center space-y-2">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-red-100 text-red-600 font-black text-xl mb-1 shadow-xs">
            JS
          </div>
          <h1 className="text-2xl md:text-3xl font-extrabold text-slate-900 tracking-tight">
            Welcome Back!
          </h1>
          <p className="text-sm text-slate-500">
            Please enter your details to sign in
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-1.5">
              Email Address
            </label>
            <input
              type="text"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="e.g. super_admin@jslabels.com"
              className="w-full px-4 py-3 bg-slate-50 border border-slate-300 rounded-xl text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-red-500 focus:bg-white transition duration-150"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-1.5">
              Password
            </label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full px-4 py-3 bg-slate-50 border border-slate-300 rounded-xl text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-red-500 focus:bg-white transition duration-150 pr-10"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 focus:outline-none"
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full mt-2 py-3 px-4 bg-red-600 hover:bg-red-700 active:bg-red-800 text-white font-semibold rounded-xl shadow-md hover:shadow-lg transition duration-200 flex justify-center items-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed"
          >
            {isSubmitting ? (
              <>
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                <span>Signing In...</span>
              </>
            ) : (
              <>
                <LogIn size={18} />
                <span>Sign In</span>
              </>
            )}
          </button>
        </form>

        {/* Quick Testing User Shortcuts */}
        <div className="pt-4 border-t border-slate-100">
          <p className="text-xs text-slate-400 text-center mb-2.5 font-medium">Quick Fill Test Accounts:</p>
          <div className="flex flex-wrap justify-center gap-2">
            <button
              type="button"
              onClick={() => fillQuickUser('super_admin@jslabels.com')}
              className="px-2.5 py-1 text-xs font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg transition"
            >
              Super Admin
            </button>
            <button
              type="button"
              onClick={() => fillQuickUser('manager@jslabels.com')}
              className="px-2.5 py-1 text-xs font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg transition"
            >
              Manager
            </button>
            <button
              type="button"
              onClick={() => fillQuickUser('caller@jslabels.com')}
              className="px-2.5 py-1 text-xs font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg transition"
            >
              Caller
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}
