import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useNotification } from '../context/NotificationContext';
import api from '../api/axios';
import {
  Mail,
  Lock,
  Eye,
  EyeOff,
  Users,
  ShoppingCart,
  TrendingUp,
  User,
  Phone,
  ShieldCheck,
  UserPlus,
  ArrowLeft,
  ChevronDown
} from 'lucide-react';

export default function Login() {
  const [isRegisterMode, setIsRegisterMode] = useState(false);

  // Login Form State
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Registration Form State
  const [regName, setRegName] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regPhone, setRegPhone] = useState('');
  const [regRole, setRegRole] = useState('caller');
  const [regPassword, setRegPassword] = useState('');
  const [regConfirmPassword, setRegConfirmPassword] = useState('');
  const [showRegPassword, setShowRegPassword] = useState(false);

  const { login } = useAuth();
  const notify = useNotification();
  const navigate = useNavigate();

  // Handle Login Submit
  const handleLoginSubmit = async (e) => {
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

  // Handle Registration Submit
  const handleRegisterSubmit = async (e) => {
    e.preventDefault();

    if (!regName.trim()) {
      notify.error('Please enter your full name');
      return;
    }
    if (!regEmail.trim()) {
      notify.error('Please enter a valid email address');
      return;
    }
    if (regPassword.length < 6) {
      notify.error('Password must be at least 6 characters long');
      return;
    }
    if (regPassword !== regConfirmPassword) {
      notify.error('Passwords do not match. Please verify your password.');
      return;
    }

    setIsSubmitting(true);

    try {
      const res = await api.post('/auth/register', {
        name: regName,
        email: regEmail,
        phone: regPhone,
        role: regRole,
        password: regPassword
      });

      notify.success(res.data?.message || 'Account created successfully! Please sign in.');
      
      // Pre-fill login credentials and switch to Login view
      setEmail(regEmail);
      setPassword(regPassword);
      setIsRegisterMode(false);

      // Reset Registration Form
      setRegName('');
      setRegEmail('');
      setRegPhone('');
      setRegRole('caller');
      setRegPassword('');
      setRegConfirmPassword('');
    } catch (err) {
      const errMsg = err.response?.data?.message || 'Failed to create account. Please check your details.';
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
    <div className="w-full h-screen overflow-hidden bg-white grid grid-cols-1 lg:grid-cols-2 font-sans select-none">
      
      {/* Left Side – Login / Registration Form (Non-scrollable, Fits Viewport) */}
      <div className="h-full px-6 py-5 sm:px-10 lg:px-12 xl:px-14 flex flex-col justify-between bg-white overflow-hidden">
        <div className="w-full max-w-md mx-auto my-auto space-y-4">
          
          {/* JS Labels Brand Logo */}
          <div className="space-y-0.5">
            <img
              src="https://res.cloudinary.com/rlokioxu/image/upload/v1787146422/Js-logo_wnklmo.png"
              alt="JS Labels Logo"
              className="h-10 w-auto object-contain mb-1"
            />
            <h1 className="text-lg sm:text-xl font-semibold text-[#111827] tracking-tight mt-2">
              Lead to Reorder
            </h1>
            <p className="text-xs text-[#6B7280] font-normal">
              Smart CRM for Sustainable Growth
            </p>
          </div>

          {/* Heading Toggle */}
          <div>
            {isRegisterMode ? (
              <div>
                <h2 className="text-xl sm:text-2xl font-semibold text-[#111827] tracking-tight flex items-center gap-2">
                  <UserPlus size={20} className="text-[#E31E24]" />
                  Create Account
                </h2>
                <p className="text-xs text-[#6B7280] mt-0.5 font-normal">
                  Fill details and choose your system role to register
                </p>
              </div>
            ) : (
              <div>
                <h2 className="text-xl sm:text-2xl font-semibold text-[#111827] tracking-tight">
                  Welcome Back!
                </h2>
                <p className="text-xs text-[#6B7280] mt-0.5 font-normal">
                  Sign in to continue to your account
                </p>
              </div>
            )}
          </div>

          {/* LOGIN FORM */}
          {!isRegisterMode ? (
            <form onSubmit={handleLoginSubmit} className="space-y-3.5">
              
              {/* Email Input */}
              <div>
                <label className="block text-xs font-medium text-[#111827] mb-1">
                  Email Address
                </label>
                <div className="relative flex items-center">
                  <Mail className="absolute left-3.5 text-[#9CA3AF]" size={16} />
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="Enter email address"
                    className="w-full h-[42px] pl-10 pr-4 bg-white border border-[#E5E7EB] rounded-[10px] text-xs sm:text-sm text-[#111827] placeholder-[#9CA3AF] focus:outline-none focus:ring-2 focus:ring-[#E31E24] focus:border-transparent transition"
                  />
                </div>
              </div>

              {/* Password Input */}
              <div>
                <label className="block text-xs font-medium text-[#111827] mb-1">
                  Password
                </label>
                <div className="relative flex items-center">
                  <Lock className="absolute left-3.5 text-[#9CA3AF]" size={16} />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Enter your password"
                    className="w-full h-[42px] pl-10 pr-10 bg-white border border-[#E5E7EB] rounded-[10px] text-xs sm:text-sm text-[#111827] placeholder-[#9CA3AF] focus:outline-none focus:ring-2 focus:ring-[#E31E24] focus:border-transparent transition"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3.5 text-[#9CA3AF] hover:text-[#4B5563] transition"
                  >
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              {/* Remember Me & Forgot Password */}
              <div className="flex items-center justify-between pt-0.5">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={rememberMe}
                    onChange={(e) => setRememberMe(e.target.checked)}
                    className="w-3.5 h-3.5 rounded text-[#E31E24] focus:ring-[#E31E24] border-[#E5E7EB] cursor-pointer"
                  />
                  <span className="text-xs text-[#6B7280] font-medium">Remember me</span>
                </label>

                <a
                  href="#forgot"
                  onClick={(e) => {
                    e.preventDefault();
                    notify.info('Please contact your administrator to reset password.');
                  }}
                  className="text-xs text-[#0B4EA2] hover:underline font-semibold"
                >
                  Forgot Password?
                </a>
              </div>

              {/* Sign In Button */}
              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full h-[44px] bg-[#E31E24] hover:bg-[#c8191f] active:bg-[#b01419] text-white font-semibold text-sm rounded-[10px] shadow-sm hover:shadow-md transition duration-200 flex items-center justify-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed cursor-pointer"
              >
                {isSubmitting ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    <span>Signing In...</span>
                  </>
                ) : (
                  <span>Sign In</span>
                )}
              </button>

              {/* Create Account Link */}
              <div className="pt-2 text-center">
                <p className="text-xs text-[#6B7280] font-normal">
                  Don't have an account?{' '}
                  <button
                    type="button"
                    onClick={() => setIsRegisterMode(true)}
                    className="text-[#E31E24] hover:underline font-semibold cursor-pointer"
                  >
                    Create Account
                  </button>
                </p>
              </div>
            </form>
          ) : (
            /* REGISTRATION FORM (Compact, Fit in Viewport) */
            <form onSubmit={handleRegisterSubmit} className="space-y-2.5">
              
              {/* System Role Selection Dropdown */}
              <div>
                <label className="block text-xs font-medium text-[#111827] mb-1">
                  System Role *
                </label>
                <div className="relative flex items-center">
                  <ShieldCheck className="absolute left-3 text-[#9CA3AF]" size={16} />
                  <select
                    value={regRole}
                    onChange={(e) => setRegRole(e.target.value)}
                    className="w-full h-[38px] pl-9 pr-8 bg-white border border-[#E5E7EB] rounded-[10px] text-xs text-[#111827] focus:outline-none focus:ring-2 focus:ring-[#E31E24] focus:border-transparent font-medium transition cursor-pointer appearance-none"
                  >
                    <option value="caller">Tele Caller (Executive & Follow-ups)</option>
                    <option value="manager">Sales Manager (Pipeline & Reports)</option>
                    <option value="super_admin">Super Admin (Full System Access)</option>
                  </select>
                  <ChevronDown className="absolute right-3 text-[#9CA3AF] pointer-events-none" size={16} />
                </div>
              </div>

              {/* Full Name Input */}
              <div>
                <label className="block text-xs font-medium text-[#111827] mb-1">
                  Full Name *
                </label>
                <div className="relative flex items-center">
                  <User className="absolute left-3 text-[#9CA3AF]" size={16} />
                  <input
                    type="text"
                    required
                    value={regName}
                    onChange={(e) => setRegName(e.target.value)}
                    placeholder="e.g. John Doe"
                    className="w-full h-[38px] pl-9 pr-3 bg-white border border-[#E5E7EB] rounded-[10px] text-xs text-[#111827] placeholder-[#9CA3AF] focus:outline-none focus:ring-2 focus:ring-[#E31E24] focus:border-transparent transition"
                  />
                </div>
              </div>

              {/* Email Address Input */}
              <div>
                <label className="block text-xs font-medium text-[#111827] mb-1">
                  Email Address *
                </label>
                <div className="relative flex items-center">
                  <Mail className="absolute left-3 text-[#9CA3AF]" size={16} />
                  <input
                    type="email"
                    required
                    value={regEmail}
                    onChange={(e) => setRegEmail(e.target.value)}
                    placeholder="e.g. john@jslabels.com"
                    className="w-full h-[38px] pl-9 pr-3 bg-white border border-[#E5E7EB] rounded-[10px] text-xs text-[#111827] placeholder-[#9CA3AF] focus:outline-none focus:ring-2 focus:ring-[#E31E24] focus:border-transparent transition"
                  />
                </div>
              </div>

              {/* Phone Number Input */}
              <div>
                <label className="block text-xs font-medium text-[#111827] mb-1">
                  Phone Number (Optional)
                </label>
                <div className="relative flex items-center">
                  <Phone className="absolute left-3 text-[#9CA3AF]" size={16} />
                  <input
                    type="text"
                    value={regPhone}
                    onChange={(e) => setRegPhone(e.target.value)}
                    placeholder="+91 9876543210"
                    className="w-full h-[38px] pl-9 pr-3 bg-white border border-[#E5E7EB] rounded-[10px] text-xs text-[#111827] placeholder-[#9CA3AF] focus:outline-none focus:ring-2 focus:ring-[#E31E24] focus:border-transparent transition"
                  />
                </div>
              </div>

              {/* Password & Confirm Password Grid */}
              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="block text-xs font-medium text-[#111827] mb-1">
                    Password *
                  </label>
                  <div className="relative flex items-center">
                    <Lock className="absolute left-2.5 text-[#9CA3AF]" size={14} />
                    <input
                      type={showRegPassword ? 'text' : 'password'}
                      required
                      value={regPassword}
                      onChange={(e) => setRegPassword(e.target.value)}
                      placeholder="Min 6 chars"
                      className="w-full h-[38px] pl-8 pr-7 bg-white border border-[#E5E7EB] rounded-[10px] text-xs text-[#111827] placeholder-[#9CA3AF] focus:outline-none focus:ring-2 focus:ring-[#E31E24] focus:border-transparent transition"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-[#111827] mb-1">
                    Confirm *
                  </label>
                  <div className="relative flex items-center">
                    <Lock className="absolute left-2.5 text-[#9CA3AF]" size={14} />
                    <input
                      type={showRegPassword ? 'text' : 'password'}
                      required
                      value={regConfirmPassword}
                      onChange={(e) => setRegConfirmPassword(e.target.value)}
                      placeholder="Re-enter"
                      className="w-full h-[38px] pl-8 pr-7 bg-white border border-[#E5E7EB] rounded-[10px] text-xs text-[#111827] placeholder-[#9CA3AF] focus:outline-none focus:ring-2 focus:ring-[#E31E24] focus:border-transparent transition"
                    />
                    <button
                      type="button"
                      onClick={() => setShowRegPassword(!showRegPassword)}
                      className="absolute right-2.5 text-[#9CA3AF] hover:text-[#4B5563] transition"
                    >
                      {showRegPassword ? <EyeOff size={14} /> : <Eye size={14} />}
                    </button>
                  </div>
                </div>
              </div>

              {/* Submit Registration Button */}
              <div className="pt-1">
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full h-[42px] bg-[#E31E24] hover:bg-[#c8191f] active:bg-[#b01419] text-white font-semibold text-xs sm:text-sm rounded-[10px] shadow-sm hover:shadow-md transition duration-200 flex items-center justify-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed cursor-pointer"
                >
                  {isSubmitting ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                      <span>Creating Account...</span>
                    </>
                  ) : (
                    <span>Register & Create Account</span>
                  )}
                </button>
              </div>

              {/* Back to Sign In Link */}
              <div className="text-center pt-0.5">
                <button
                  type="button"
                  onClick={() => setIsRegisterMode(false)}
                  className="text-xs text-[#0B4EA2] hover:underline font-semibold inline-flex items-center gap-1 cursor-pointer"
                >
                  <ArrowLeft size={12} />
                  <span>Already have an account? Sign In</span>
                </button>
              </div>
            </form>
          )}

          {/* Quick Demo Shortcuts */}
          {!isRegisterMode && (
            <div className="pt-1.5 border-t border-[#E5E7EB]/60">
              <p className="text-[11px] text-[#6B7280] text-center mb-1.5 font-medium">Quick Demo Accounts:</p>
              <div className="flex flex-wrap justify-center gap-1.5">
                <button
                  type="button"
                  onClick={() => fillQuickUser('super_admin@jslabels.com')}
                  className="px-2.5 py-1 text-[11px] font-medium text-[#111827] bg-[#F5F7FA] hover:bg-[#E5E7EB] rounded-lg transition cursor-pointer"
                >
                  Super Admin
                </button>
                <button
                  type="button"
                  onClick={() => fillQuickUser('manager@jslabels.com')}
                  className="px-2.5 py-1 text-[11px] font-medium text-[#111827] bg-[#F5F7FA] hover:bg-[#E5E7EB] rounded-lg transition cursor-pointer"
                >
                  Manager
                </button>
                <button
                  type="button"
                  onClick={() => fillQuickUser('caller@jslabels.com')}
                  className="px-2.5 py-1 text-[11px] font-medium text-[#111827] bg-[#F5F7FA] hover:bg-[#E5E7EB] rounded-lg transition cursor-pointer"
                >
                  Caller
                </button>
              </div>
            </div>
          )}

        </div>

        {/* Footer */}
        <div className="text-center py-1 mt-auto">
          <p className="text-[11px] text-[#6B7280] font-normal">
            © 2025 JS Labels. All rights reserved.
          </p>
        </div>
      </div>

      {/* Right Side – Background Image & Floating Feature Cards */}
      <div
        className="relative h-full p-6 sm:p-10 lg:p-12 xl:p-14 border-l border-[#E5E7EB] flex flex-col justify-between hidden lg:flex overflow-hidden bg-cover bg-center bg-no-repeat"
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
                  Analyze performance & increase revenue
                </p>
              </div>
            </div>

            {/* Card 4: Role Based Access */}
            <div className="p-4 bg-white/90 backdrop-blur-md rounded-[16px] border border-white/80 shadow-md space-y-2">
              <div className="w-10 h-10 rounded-full bg-red-50 text-[#E31E24] flex items-center justify-center">
                <ShieldCheck size={20} />
              </div>
              <div>
                <h4 className="font-medium text-[#111827] text-sm">Role Based Access</h4>
                <p className="text-xs text-[#6B7280] leading-snug mt-1 font-normal">
                  Secure access for Admins, Managers & Callers
                </p>
              </div>
            </div>

          </div>

          <div className="bg-white/80 backdrop-blur-md p-4 rounded-[16px] border border-white/80 shadow-sm text-center">
            <p className="text-xs text-[#4B5563] font-medium">
              Need assistance? Contact support at <span className="text-[#E31E24] font-semibold">support@jslabels.com</span>
            </p>
          </div>

        </div>
      </div>

    </div>
  );
}
