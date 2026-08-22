import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useConfirm } from '../../context/ConfirmContext';
import api from '../../api/axios';
import {
  Search,
  MessageSquare,
  Bell,
  ChevronDown,
  LogOut,
  LayoutDashboard,
  Settings as SettingsIcon,
  Users as UsersIcon,
  Trash2,
  X,
  Tag,
  Package,
  Building2,
  UserPlus,
  ArrowRight
} from 'lucide-react';

const getInitials = (name) => {
  if (!name) return 'JS';
  const parts = name.trim().split(' ');
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return name.substring(0, 2).toUpperCase();
};

const getRelativeTime = (dateString) => {
  if (!dateString) return 'Recently';
  const date = new Date(dateString);
  const now = new Date();
  const diffInSeconds = Math.floor((now - date) / 1000);

  if (diffInSeconds < 60) return 'Just now';
  if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m ago`;
  if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}h ago`;
  return `${Math.floor(diffInSeconds / 86400)}d ago`;
};

export default function TopBar() {
  const { user, role, permissions, logout } = useAuth();
  const confirm = useConfirm();
  const navigate = useNavigate();

  // Dropdown Interactive States
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [isNotifOpen, setIsNotifOpen] = useState(false);
  const [isMessageOpen, setIsMessageOpen] = useState(false);

  // Global Search State
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState(null);
  const [isSearching, setIsSearching] = useState(false);
  const [isSearchOpen, setIsSearchOpen] = useState(false);

  // Notification & Reminder Data
  const [recentLeads, setRecentLeads] = useState([]);
  const [unreadNotifCount, setUnreadNotifCount] = useState(0);

  const [remindersList, setRemindersList] = useState([]);
  const [pendingRemindersCount, setPendingRemindersCount] = useState(0);

  // Click Outside References
  const searchRef = useRef(null);
  const profileRef = useRef(null);
  const notifRef = useRef(null);
  const messageRef = useRef(null);

  // Fetch Notifications & Messages Data
  useEffect(() => {
    const fetchTopBarData = async () => {
      try {
        if (permissions.leads?.includes('view')) {
          const leadsRes = await api.get('/leads?limit=5');
          const leadsData = leadsRes.data?.leads || [];
          setRecentLeads(leadsData);
          setUnreadNotifCount(leadsData.filter(l => l.status === 'new').length);
        }

        if (permissions.reminders?.includes('view')) {
          const remRes = await api.get('/reminders');
          const remData = remRes.data || [];
          setRemindersList(remData.slice(0, 5));
          setPendingRemindersCount(remData.length);
        }
      } catch (err) {
        console.warn('Non-fatal error fetching TopBar notifications:', err);
      }
    };

    fetchTopBarData();
    const interval = setInterval(fetchTopBarData, 45000);
    return () => clearInterval(interval);
  }, [permissions]);

  // Debounced Global Search Handler
  useEffect(() => {
    if (!searchQuery.trim()) {
      setSearchResults(null);
      setIsSearchOpen(false);
      return;
    }

    const timer = setTimeout(async () => {
      try {
        setIsSearching(true);
        const res = await api.get(`/search?q=${encodeURIComponent(searchQuery)}`);
        setSearchResults(res.data);
        setIsSearchOpen(true);
      } catch (err) {
        console.error('Error conducting global search:', err);
      } finally {
        setIsSearching(false);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Handle Sign Out with Confirmation Modal
  const handleSignOut = async () => {
    setIsProfileOpen(false);
    const isConfirmed = await confirm({
      title: 'Sign Out Account',
      message: 'Are you sure you want to end your active session and sign out?',
      confirmLabel: 'Sign Out',
      cancelLabel: 'Stay Logged In',
      variant: 'danger'
    });

    if (isConfirmed) {
      logout();
      navigate('/login');
    }
  };

  // Close dropdowns automatically when clicking anywhere outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (searchRef.current && !searchRef.current.contains(event.target)) {
        setIsSearchOpen(false);
      }
      if (profileRef.current && !profileRef.current.contains(event.target)) {
        setIsProfileOpen(false);
      }
      if (notifRef.current && !notifRef.current.contains(event.target)) {
        setIsNotifOpen(false);
      }
      if (messageRef.current && !messageRef.current.contains(event.target)) {
        setIsMessageOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <header className="bg-white border-b border-slate-200/80 px-4 md:px-8 py-3 flex items-center justify-between sticky top-0 z-20 shadow-xs">
      
      {/* Left section: Mobile Logo & Global Search Bar */}
      <div className="flex items-center gap-3 flex-1 max-w-xs md:max-w-md" ref={searchRef}>
        {/* Mobile-only logo mark */}
        <div className="flex items-center gap-2 md:hidden">
          <div className="w-8 h-8 rounded-lg bg-red-600 text-white flex items-center justify-center font-semibold text-sm shadow-xs">
            JS
          </div>
          <span className="font-semibold text-slate-900 text-sm tracking-tight">JS LABELS</span>
        </div>

        {/* Global Search Input */}
        <div className="relative w-full hidden md:block">
          <span className="absolute inset-y-0 left-0 flex items-center pl-3.5 pointer-events-none text-slate-400">
            {isSearching ? (
              <div className="w-4 h-4 border-2 border-slate-400 border-t-transparent rounded-full animate-spin"></div>
            ) : (
              <Search size={16} />
            )}
          </span>

          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onFocus={() => {
              if (searchResults) setIsSearchOpen(true);
            }}
            placeholder="Search leads, customers, orders..."
            className="w-full pl-10 pr-9 py-2 bg-slate-50 border border-slate-200/90 rounded-xl text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-500 focus:bg-white transition duration-150 font-medium"
          />

          {searchQuery && (
            <button
              onClick={() => {
                setSearchQuery('');
                setSearchResults(null);
                setIsSearchOpen(false);
              }}
              className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600"
            >
              <X size={14} />
            </button>
          )}

          {/* Search Results Dropdown Panel */}
          {searchResults && (
            <div
              className={`absolute top-full left-0 right-0 mt-2 bg-white rounded-2xl border border-slate-200 shadow-2xl overflow-hidden z-50 max-h-96 overflow-y-auto scrollbar-hide transition-all duration-200 ease-out origin-top ${
                isSearchOpen
                  ? 'opacity-100 scale-100 translate-y-0 pointer-events-auto'
                  : 'opacity-0 scale-95 -translate-y-2 pointer-events-none'
              }`}
            >
              {/* Leads Results */}
              {searchResults.leads?.length > 0 && (
                <div className="p-3 border-b border-slate-100">
                  <div className="flex items-center gap-1.5 text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-2">
                    <UserPlus size={12} />
                    <span>Leads ({searchResults.leads.length})</span>
                  </div>
                  <div className="space-y-1">
                    {searchResults.leads.map((l) => (
                      <Link
                        key={l._id}
                        to="/leads"
                        onClick={() => setIsSearchOpen(false)}
                        className="flex items-center justify-between p-2 hover:bg-slate-50 rounded-lg text-xs transition"
                      >
                        <div>
                          <span className="font-semibold text-slate-900 block">{l.name}</span>
                          <span className="text-slate-400 text-[11px] font-normal">{l.company || l.phone}</span>
                        </div>
                        <span className="px-2 py-0.5 bg-blue-50 text-blue-700 text-[10px] font-medium rounded uppercase">
                          {l.status}
                        </span>
                      </Link>
                    ))}
                  </div>
                </div>
              )}

              {/* Customers Results */}
              {searchResults.customers?.length > 0 && (
                <div className="p-3 border-b border-slate-100">
                  <div className="flex items-center gap-1.5 text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-2">
                    <Building2 size={12} />
                    <span>Customers ({searchResults.customers.length})</span>
                  </div>
                  <div className="space-y-1">
                    {searchResults.customers.map((c) => (
                      <Link
                        key={c._id}
                        to={`/customers/${c._id}`}
                        onClick={() => setIsSearchOpen(false)}
                        className="flex items-center justify-between p-2 hover:bg-slate-50 rounded-lg text-xs transition"
                      >
                        <div>
                          <span className="font-semibold text-slate-900 block">{c.name}</span>
                          <span className="text-slate-400 text-[11px] font-normal">{c.company || c.phone}</span>
                        </div>
                        <span className="px-2 py-0.5 bg-purple-50 text-purple-700 text-[10px] font-medium rounded uppercase">
                          Customer
                        </span>
                      </Link>
                    ))}
                  </div>
                </div>
              )}

              {/* Orders Results */}
              {searchResults.orders?.length > 0 && (
                <div className="p-3 border-b border-slate-100">
                  <div className="flex items-center gap-1.5 text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-2">
                    <Package size={12} />
                    <span>Orders ({searchResults.orders.length})</span>
                  </div>
                  <div className="space-y-1">
                    {searchResults.orders.map((o) => (
                      <Link
                        key={o._id}
                        to="/orders"
                        onClick={() => setIsSearchOpen(false)}
                        className="flex items-center justify-between p-2 hover:bg-slate-50 rounded-lg text-xs transition"
                      >
                        <div>
                          <span className="font-semibold text-slate-900 block">{o.orderNo}</span>
                          <span className="text-slate-400 text-[11px] font-normal">₹{(o.amount || 0).toLocaleString('en-IN')}</span>
                        </div>
                        <span className="px-2 py-0.5 bg-emerald-50 text-emerald-700 text-[10px] font-medium rounded uppercase">
                          {o.status}
                        </span>
                      </Link>
                    ))}
                  </div>
                </div>
              )}

              {/* No Results Found State */}
              {(!searchResults.leads?.length && !searchResults.customers?.length && !searchResults.orders?.length) && (
                <div className="p-8 text-center text-xs text-slate-400 font-normal">
                  No matching records found for "{searchQuery}"
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Right Section: Header Controls & Profile Options */}
      <div className="flex items-center gap-2 sm:gap-3">
        
        {/* 1. Pending Messages & Reorder Reminders Icon */}
        <div className="relative" ref={messageRef}>
          <button
            type="button"
            title="Messages & Reminders"
            onClick={() => {
              setIsMessageOpen(!isMessageOpen);
              setIsNotifOpen(false);
              setIsProfileOpen(false);
            }}
            className="p-2 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-xl transition relative flex items-center justify-center cursor-pointer"
          >
            <MessageSquare size={20} />
            {pendingRemindersCount > 0 && (
              <span className="absolute top-1 right-1 w-4 h-4 rounded-full bg-amber-500 text-white text-[10px] font-semibold flex items-center justify-center border-2 border-white">
                {pendingRemindersCount > 9 ? '9+' : pendingRemindersCount}
              </span>
            )}
          </button>

          {/* Messages & Reminders Dropdown with Smooth Transition */}
          <div
            className={`absolute right-0 mt-2 w-80 bg-white rounded-2xl border border-slate-200 shadow-2xl overflow-hidden z-50 transition-all duration-200 ease-out origin-top-right ${
              isMessageOpen
                ? 'opacity-100 scale-100 translate-y-0 pointer-events-auto'
                : 'opacity-0 scale-95 -translate-y-2 pointer-events-none'
            }`}
          >
            <div className="p-3 bg-slate-900 text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Bell size={16} className="text-amber-400" />
                <h4 className="font-semibold text-xs tracking-wider uppercase">Reorder Reminders ({pendingRemindersCount})</h4>
              </div>
              <Link to="/reminders" onClick={() => setIsMessageOpen(false)} className="text-[11px] text-amber-400 hover:underline font-semibold">
                View All
              </Link>
            </div>

            <div className="divide-y divide-slate-100 max-h-72 overflow-y-auto scrollbar-hide">
              {remindersList.length === 0 ? (
                <div className="p-6 text-center text-xs text-slate-400 font-normal">
                  No pending reorder reminders
                </div>
              ) : (
                remindersList.map((rem) => (
                  <Link
                    key={rem._id}
                    to={`/customers/${rem.customer._id}`}
                    onClick={() => setIsMessageOpen(false)}
                    className="p-3 hover:bg-slate-50 transition block"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="font-semibold text-slate-900 text-xs">{rem.customer.name}</div>
                      <span className={`px-1.5 py-0.5 rounded text-[10px] font-semibold uppercase ${
                        rem.isOverdue ? 'bg-rose-100 text-rose-800' : 'bg-amber-100 text-amber-800'
                      }`}>
                        {rem.isOverdue ? 'Overdue' : `${rem.daysUntilReorder}d left`}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-500 mt-0.5 truncate font-normal">
                      {rem.customer.company || 'Customer'} • Probability {rem.probabilityScore}%
                    </p>
                  </Link>
                ))
              )}
            </div>
          </div>
        </div>

        {/* 2. Notification Bell Icon (New Leads) */}
        <div className="relative" ref={notifRef}>
          <button
            type="button"
            title="Lead Notifications"
            onClick={() => {
              setIsNotifOpen(!isNotifOpen);
              setIsMessageOpen(false);
              setIsProfileOpen(false);
            }}
            className="p-2 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-xl transition relative flex items-center justify-center cursor-pointer"
          >
            <Bell size={20} />
            {unreadNotifCount > 0 && (
              <span className="absolute top-1 right-1 w-4 h-4 rounded-full bg-red-600 text-white text-[10px] font-semibold flex items-center justify-center border-2 border-white">
                {unreadNotifCount}
              </span>
            )}
          </button>

          {/* Notifications Dropdown with Smooth Transition */}
          <div
            className={`absolute right-0 mt-2 w-80 bg-white rounded-2xl border border-slate-200 shadow-2xl overflow-hidden z-50 transition-all duration-200 ease-out origin-top-right ${
              isNotifOpen
                ? 'opacity-100 scale-100 translate-y-0 pointer-events-auto'
                : 'opacity-0 scale-95 -translate-y-2 pointer-events-none'
            }`}
          >
            <div className="p-3 bg-slate-900 text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Bell size={16} className="text-red-400" />
                <h4 className="font-semibold text-xs tracking-wider uppercase">New Leads ({unreadNotifCount})</h4>
              </div>
              <Link to="/leads" onClick={() => setIsNotifOpen(false)} className="text-[11px] text-red-400 hover:underline font-semibold">
                Lead Board
              </Link>
            </div>

            <div className="divide-y divide-slate-100 max-h-72 overflow-y-auto scrollbar-hide">
              {recentLeads.length === 0 ? (
                <div className="p-6 text-center text-xs text-slate-400 font-normal">
                  No recent lead notifications
                </div>
              ) : (
                recentLeads.map((ld) => (
                  <Link
                    key={ld._id}
                    to="/leads"
                    onClick={() => setIsNotifOpen(false)}
                    className="p-3 hover:bg-slate-50 transition block"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-slate-900 text-xs">{ld.name}</span>
                      <span className="text-[10px] text-slate-400 font-normal">{getRelativeTime(ld.createdAt)}</span>
                    </div>
                    <p className="text-[11px] text-slate-500 mt-0.5 truncate font-normal">
                      Company: {ld.company || 'N/A'} • Source: {ld.source}
                    </p>
                    <div className="mt-1 flex items-center gap-1.5">
                      <span className={`px-1.5 py-0.5 rounded text-[10px] font-semibold uppercase ${
                        ld.priority === 'high' ? 'bg-rose-100 text-rose-800' : 'bg-slate-100 text-slate-700'
                      }`}>
                        {ld.priority} priority
                      </span>
                    </div>
                  </Link>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Divider */}
        <div className="h-6 w-px bg-slate-200 mx-1"></div>

        {/* 3. Interactive Profile Menu Dropdown */}
        <div className="relative" ref={profileRef}>
          <button
            onClick={() => {
              setIsProfileOpen(!isProfileOpen);
              setIsNotifOpen(false);
              setIsMessageOpen(false);
            }}
            className="flex items-center gap-2.5 p-1.5 hover:bg-slate-100 rounded-xl transition cursor-pointer"
          >
            {/* User Initials Avatar */}
            <div className="w-9 h-9 rounded-xl bg-slate-900 text-white flex items-center justify-center font-semibold text-xs shadow-xs border border-slate-800">
              {getInitials(user?.name)}
            </div>

            <div className="hidden md:block text-left">
              <p className="text-sm font-semibold text-slate-900 leading-tight">{user?.name}</p>
              <span className="inline-block text-[10px] font-semibold uppercase tracking-wider text-red-600 bg-red-50 px-1.5 py-0.5 rounded border border-red-100">
                {role}
              </span>
            </div>
            <ChevronDown size={16} className={`text-slate-400 transition-transform duration-200 ${isProfileOpen ? 'rotate-180 text-red-600' : ''}`} />
          </button>

          {/* Profile Dropdown Menu with Smooth Transition */}
          <div
            className={`absolute right-0 mt-2 w-64 bg-white rounded-2xl border border-slate-200 shadow-2xl overflow-hidden z-50 transition-all duration-200 ease-out origin-top-right ${
              isProfileOpen
                ? 'opacity-100 scale-100 translate-y-0 pointer-events-auto'
                : 'opacity-0 scale-95 -translate-y-2 pointer-events-none'
            }`}
          >
            {/* Profile Header */}
            <div className="p-4 bg-slate-900 text-white">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-red-600 text-white flex items-center justify-center font-semibold text-sm">
                  {getInitials(user?.name)}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-sm truncate">{user?.name}</p>
                  <p className="text-xs text-slate-400 truncate font-normal">{user?.email}</p>
                </div>
              </div>
              <div className="mt-3 pt-2 border-t border-slate-800 flex items-center justify-between text-xs">
                <span className="text-slate-400 font-normal">Role</span>
                <span className="font-semibold uppercase tracking-wider text-red-400">{role}</span>
              </div>
            </div>

            {/* Navigation Quick Links */}
            <div className="p-2 space-y-1">
              {permissions.dashboard?.includes('view') && (
                <Link
                  to="/dashboard"
                  onClick={() => setIsProfileOpen(false)}
                  className="flex items-center gap-2.5 px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-100 rounded-xl transition"
                >
                  <LayoutDashboard size={16} className="text-slate-400" />
                  <span>Dashboard</span>
                </Link>
              )}

              {permissions.users?.includes('view') && (
                <Link
                  to="/users"
                  onClick={() => setIsProfileOpen(false)}
                  className="flex items-center gap-2.5 px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-100 rounded-xl transition"
                >
                  <UsersIcon size={16} className="text-slate-400" />
                  <span>Users & Access</span>
                </Link>
              )}

              {permissions.settings?.includes('view') && (
                <Link
                  to="/settings"
                  onClick={() => setIsProfileOpen(false)}
                  className="flex items-center gap-2.5 px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-100 rounded-xl transition"
                >
                  <SettingsIcon size={16} className="text-slate-400" />
                  <span>System Settings</span>
                </Link>
              )}
            </div>

            {/* Sign Out Button */}
            <div className="p-2 border-t border-slate-100">
              <button
                type="button"
                onClick={handleSignOut}
                className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-semibold text-rose-600 hover:bg-rose-50 rounded-xl transition"
              >
                <LogOut size={16} />
                <span>Sign Out</span>
              </button>
            </div>

          </div>
        </div>

      </div>

    </header>
  );
}
