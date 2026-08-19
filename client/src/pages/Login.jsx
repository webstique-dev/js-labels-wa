import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useNotification } from '../context/NotificationContext';
import {
  Mail,
  Lock,
  Eye,
  EyeOff,
  Users,
  ShoppingCart,
  TrendingUp,
  RotateCcw
} from 'lucide-react';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(true);
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
    <div className="w-full min-h-screen lg:h-screen lg:overflow-hidden bg-white grid grid-cols-1 lg:grid-cols-2 font-sans">
      
      {/* Left Side – Login Form (Full Height, Edge-to-Edge) */}
      <div className="h-full p-6 sm:p-10 lg:p-14 xl:p-16 flex flex-col justify-between bg-white overflow-y-auto">
        <div className="w-full max-w-md mx-auto space-y-6 lg:space-y-8 my-auto">
          
          {/* JS Labels Brand Logo */}
          <div className="space-y-1">
            <img
              src="https://res.cloudinary.com/rlokioxu/image/upload/v1787146422/Js-logo_wnklmo.png"
              alt="JS Labels Logo"
              className="h-12 w-auto object-contain mb-2"
            />
            <h1 className="text-xl sm:text-2xl font-semibold text-[#111827] tracking-tight mt-4">
              Lead to Reorder
            </h1>
            <p className="text-xs sm:text-sm text-[#6B7280] font-normal">
              Smart CRM for Sustainable Growth
            </p>
          </div>

          {/* Welcome Heading */}
          <div className="pt-2">
            <h2 className="text-2xl sm:text-3xl font-semibold text-[#111827] tracking-tight">
              Welcome Back!
            </h2>
            <p className="text-xs sm:text-sm text-[#6B7280] mt-1 font-normal">
              Sign in to continue to your account
            </p>
          </div>

          {/* Login Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            
            {/* Email or Phone Input */}
            <div>
              <label className="block text-xs sm:text-sm font-medium text-[#111827] mb-1.5">
                Email or Phone
              </label>
              <div className="relative flex items-center">
                <Mail className="absolute left-3.5 text-[#9CA3AF]" size={18} />
                <input
                  type="text"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Enter email or phone number"
                  className="w-full h-[48px] pl-10 pr-4 bg-white border border-[#E5E7EB] rounded-[12px] text-sm text-[#111827] placeholder-[#9CA3AF] focus:outline-none focus:ring-2 focus:ring-[#E31E24] focus:border-transparent transition"
                />
              </div>
            </div>

            {/* Password Input */}
            <div>
              <label className="block text-xs sm:text-sm font-medium text-[#111827] mb-1.5">
                Password
              </label>
              <div className="relative flex items-center">
                <Lock className="absolute left-3.5 text-[#9CA3AF]" size={18} />
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter your password"
                  className="w-full h-[48px] pl-10 pr-11 bg-white border border-[#E5E7EB] rounded-[12px] text-sm text-[#111827] placeholder-[#9CA3AF] focus:outline-none focus:ring-2 focus:ring-[#E31E24] focus:border-transparent transition"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3.5 text-[#9CA3AF] hover:text-[#4B5563] transition"
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            {/* Remember Me & Forgot Password Row */}
            <div className="flex items-center justify-between pt-1">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  className="w-4 h-4 rounded text-[#E31E24] focus:ring-[#E31E24] border-[#E5E7EB] cursor-pointer"
                />
                <span className="text-xs sm:text-sm text-[#6B7280] font-medium">Remember me</span>
              </label>

              <a
                href="#forgot"
                onClick={(e) => {
                  e.preventDefault();
                  notify.info('Please contact your administrator to reset password.');
                }}
                className="text-xs sm:text-sm text-[#0B4EA2] hover:underline font-semibold"
              >
                Forgot Password?
              </a>
            </div>

            {/* Full Width Sign In Button */}
            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full h-[48px] bg-[#E31E24] hover:bg-[#c8191f] active:bg-[#b01419] text-white font-semibold text-base rounded-[12px] shadow-md hover:shadow-lg transition duration-200 flex items-center justify-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed"
            >
              {isSubmitting ? (
                <>
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  <span>Signing In...</span>
                </>
              ) : (
                <span>Sign In</span>
              )}
            </button>
          </form>

          {/* Quick Demo Shortcuts */}
          <div className="pt-2 border-t border-[#E5E7EB]/60">
            <p className="text-[11px] text-[#6B7280] text-center mb-2 font-medium">Quick Demo Accounts:</p>
            <div className="flex flex-wrap justify-center gap-1.5">
              <button
                type="button"
                onClick={() => fillQuickUser('super_admin@jslabels.com')}
                className="px-2.5 py-1 text-[11px] font-medium text-[#111827] bg-[#F5F7FA] hover:bg-[#E5E7EB] rounded-lg transition"
              >
                Super Admin
              </button>
              <button
                type="button"
                onClick={() => fillQuickUser('manager@jslabels.com')}
                className="px-2.5 py-1 text-[11px] font-medium text-[#111827] bg-[#F5F7FA] hover:bg-[#E5E7EB] rounded-lg transition"
              >
                Manager
              </button>
              <button
                type="button"
                onClick={() => fillQuickUser('caller@jslabels.com')}
                className="px-2.5 py-1 text-[11px] font-medium text-[#111827] bg-[#F5F7FA] hover:bg-[#E5E7EB] rounded-lg transition"
              >
                Caller
              </button>
            </div>
          </div>

        </div>

        {/* Footer */}
        <div className="pt-4 text-center mt-auto">
          <p className="text-xs text-[#6B7280] font-normal">
            © 2025 JS Labels. All rights reserved.
          </p>
        </div>
      </div>

      {/* Right Side – Background Image & Floating Feature Cards */}
      <div
        className="relative h-full p-6 sm:p-10 lg:p-12 xl:p-14 border-l border-[#E5E7EB] flex flex-col justify-between hidden lg:flex overflow-y-auto bg-cover bg-center bg-no-repeat"
        style={{
          backgroundImage: `url('https://res.cloudinary.com/rlokioxu/image/upload/v1787145696/Js-Labels-login_r0lkfd.png')`
        }}
      >
        {/* Semi-transparent Overlay gradient to ensure contrast and readability */}
        <div className="absolute inset-0 bg-gradient-to-b from-white/70 via-white/30 to-transparent pointer-events-none" />

        <div className="relative z-10 w-full max-w-lg mx-auto flex flex-col h-full justify-between space-y-6">
          
          {/* 2x2 Feature Cards Grid */}
          <div className="grid grid-cols-2 gap-4 sm:gap-5">
            
            {/* Card 1: Manage Leads */}
            <div className="p-4 bg-white/90 backdrop-blur-md rounded-[16px] border border-white/80 shadow-md space-y-2">
              <div className="w-10 h-10 rounded-full bg-red-50 text-[#E31E24] flex items-center justify-center">
                <Users size={20} />
              </div>
              <div>
                <h4 className="font-medium text-[#111827] text-sm">Manage Leads</h4>
                <p className="text-xs text-[#6B7280] leading-snug mt-1 font-normal">
                  Capture and manage high-quality leads
                </p>
              </div>
            </div>

            {/* Card 2: Track Orders */}
            <div className="p-4 bg-white/90 backdrop-blur-md rounded-[16px] border border-white/80 shadow-md space-y-2">
              <div className="w-10 h-10 rounded-full bg-red-50 text-[#E31E24] flex items-center justify-center">
                <ShoppingCart size={20} />
              </div>
              <div>
                <h4 className="font-medium text-[#111827] text-sm">Track Orders</h4>
                <p className="text-xs text-[#6B7280] leading-snug mt-1 font-normal">
                  Track every order from start to delivery
                </p>
              </div>
            </div>

            {/* Card 3: Boost Sales */}
            <div className="p-4 bg-white/90 backdrop-blur-md rounded-[16px] border border-white/80 shadow-md space-y-2">
              <div className="w-10 h-10 rounded-full bg-red-50 text-[#E31E24] flex items-center justify-center">
                <TrendingUp size={20} />
              </div>
              <div>
                <h4 className="font-medium text-[#111827] text-sm">Boost Sales</h4>
                <p className="text-xs text-[#6B7280] leading-snug mt-1 font-normal">
                  Increase conversions and customer retention
                </p>
              </div>
            </div>

            {/* Card 4: Drive Reorders */}
            <div className="p-4 bg-white/90 backdrop-blur-md rounded-[16px] border border-white/80 shadow-md space-y-2">
              <div className="w-10 h-10 rounded-full bg-red-50 text-[#E31E24] flex items-center justify-center">
                <RotateCcw size={20} />
              </div>
              <div>
                <h4 className="font-medium text-[#111827] text-sm">Drive Reorders</h4>
                <p className="text-xs text-[#6B7280] leading-snug mt-1 font-normal">
                  Smart reminders to increase repeat business
                </p>
              </div>
            </div>

          </div>

        </div>
      </div>

    </div>
  );
}
