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

  // Dropdown States
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

  // Refs for Click Outside Detection
  const profileRef = useRef(null);
  const notifRef = useRef(null);
  const messageRef = useRef(null);
  const searchRef = useRef(null);

  const handleLogout = async () => {
    const isConfirmed = await confirm({
      title: 'Sign Out',
      message: 'Are you sure you want to sign out of JS Labels CRM?',
      confirmLabel: 'Sign Out',
      cancelLabel: 'Stay Logged In',
      variant: 'danger'
    });

    if (isConfirmed) {
      await logout();
      navigate('/login');
    }
  };

  // Fetch Notifications & Reminders
  useEffect(() => {
    let isMounted = true;

    const fetchTopBarData = async () => {
      try {
        // 1. Fetch Recent Leads for Bell Notifications
        const leadsRes = await api.get('/leads');
        const allLeads = leadsRes.data.leads || [];
        const sortedLeads = [...allLeads].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)).slice(0, 5);
        if (isMounted) {
          setRecentLeads(sortedLeads);
          setUnreadNotifCount(sortedLeads.length);
        }

        // 2. Fetch Reminders for Message Icon
        const remRes = await api.get('/reminders');
        const rems = remRes.data || [];
        const urgentRems = rems.slice(0, 5);
        if (isMounted) {
          setRemindersList(urgentRems);
          setPendingRemindersCount(rems.length);
        }
      } catch (err) {
        console.error('Error fetching TopBar notifications:', err);
      }
    };

    fetchTopBarData();
    return () => { isMounted = false; };
  }, []);

  // Handle Global Search Input with Debounce
  useEffect(() => {
    if (!searchQuery.trim() || searchQuery.trim().length < 2) {
      setSearchResults(null);
      setIsSearchOpen(false);
      return;
    }

    const timer = setTimeout(async () => {
      setIsSearching(true);
      try {
        const res = await api.get('/search', { params: { q: searchQuery } });
        setSearchResults(res.data);
        setIsSearchOpen(true);
      } catch (err) {
        console.error('Error performing search:', err);
        setSearchResults(null);
      } finally {
        setIsSearching(false);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Click Outside Listener
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (profileRef.current && !profileRef.current.contains(event.target)) {
        setIsProfileOpen(false);
      }
      if (notifRef.current && !notifRef.current.contains(event.target)) {
        setIsNotifOpen(false);
      }
      if (messageRef.current && !messageRef.current.contains(event.target)) {
        setIsMessageOpen(false);
      }
      if (searchRef.current && !searchRef.current.contains(event.target)) {
        setIsSearchOpen(false);
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
          <div className="w-8 h-8 rounded-lg bg-red-600 text-white flex items-center justify-center font-black text-sm shadow-xs">
            JS
          </div>
          <span className="font-extrabold text-slate-900 text-sm tracking-tight">JS LABELS</span>
        </div>

        {/* Global Search Input */}
        <div className="relative w-full hidden md:block">
          <span className="absolute inset-y-0 left-0 flex items-center pl-3.5 pointer-events-none text-slate-400">
            {isSearching ? (
              <div className="w-4 h-4 border-2 border-red-600 border-t-transparent rounded-full animate-spin"></div>
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
            placeholder="Search leads, customers, orders, products..."
            className="w-full pl-10 pr-8 py-2 bg-slate-100/80 border border-slate-200 rounded-xl text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-red-500 focus:bg-white transition"
          />
          {searchQuery && (
            <button
              onClick={() => {
                setSearchQuery('');
                setSearchResults(null);
                setIsSearchOpen(false);
              }}
              className="absolute inset-y-0 right-0 flex items-center pr-3 text-slate-400 hover:text-slate-600 font-bold text-xs"
            >
              <X size={14} />
            </button>
          )}

          {/* Global Search Live Results Dropdown */}
          {isSearchOpen && searchResults && (
            <div className="absolute top-full left-0 right-0 mt-2 bg-white rounded-2xl border border-slate-200 shadow-2xl overflow-hidden z-50 max-h-[75vh] overflow-y-auto scrollbar-hide">
              <div className="p-3 bg-slate-50 border-b border-slate-100 flex items-center justify-between text-xs font-bold text-slate-500 uppercase tracking-wider">
                <span>Search Results for "{searchQuery}"</span>
                <button onClick={() => setIsSearchOpen(false)} className="text-slate-400 hover:text-slate-600"><X size={16} /></button>
              </div>

              {/* Leads Results */}
              {searchResults.leads?.length > 0 && (
                <div className="p-2 border-b border-slate-100">
                  <div className="px-2 py-1 text-[11px] font-extrabold text-blue-600 uppercase tracking-wider flex items-center gap-1.5">
                    <UserPlus size={14} />
                    <span>Leads ({searchResults.leads.length})</span>
                  </div>
                  {searchResults.leads.map((l) => (
                    <Link
                      key={l._id}
                      to={`/leads/${l._id}/followup`}
                      onClick={() => setIsSearchOpen(false)}
                      className="p-2 hover:bg-slate-50 rounded-xl flex items-center justify-between transition group"
                    >
                      <div>
                        <div className="font-bold text-slate-900 text-xs group-hover:text-red-600">{l.name}</div>
                        <div className="text-[11px] text-slate-500">{l.company || 'Individual'} • {l.phone}</div>
                      </div>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-blue-50 text-blue-700 uppercase">{l.status}</span>
                    </Link>
                  ))}
                </div>
              )}

              {/* Customers Results */}
              {searchResults.customers?.length > 0 && (
                <div className="p-2 border-b border-slate-100">
                  <div className="px-2 py-1 text-[11px] font-extrabold text-purple-600 uppercase tracking-wider flex items-center gap-1.5">
                    <Building2 size={14} />
                    <span>Customers ({searchResults.customers.length})</span>
                  </div>
                  {searchResults.customers.map((c) => (
                    <Link
                      key={c._id}
                      to={`/customers/${c._id}`}
                      onClick={() => setIsSearchOpen(false)}
                      className="p-2 hover:bg-slate-50 rounded-xl flex items-center justify-between transition group"
                    >
                      <div>
                        <div className="font-bold text-slate-900 text-xs group-hover:text-red-600">{c.name}</div>
                        <div className="text-[11px] text-slate-500">{c.company || ''} {c.city ? `• ${c.city}` : ''}</div>
                      </div>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-purple-50 text-purple-700 uppercase">View 360°</span>
                    </Link>
                  ))}
                </div>
              )}

              {/* Orders Results */}
              {searchResults.orders?.length > 0 && (
                <div className="p-2 border-b border-slate-100">
                  <div className="px-2 py-1 text-[11px] font-extrabold text-emerald-600 uppercase tracking-wider flex items-center gap-1.5">
                    <Package size={14} />
                    <span>Orders ({searchResults.orders.length})</span>
                  </div>
                  {searchResults.orders.map((o) => (
                    <Link
                      key={o._id}
                      to="/orders"
                      onClick={() => setIsSearchOpen(false)}
                      className="p-2 hover:bg-slate-50 rounded-xl flex items-center justify-between transition group"
                    >
                      <div>
                        <div className="font-bold text-slate-900 text-xs group-hover:text-red-600">{o.orderNo || `Order #${o._id.slice(-6)}`}</div>
                        <div className="text-[11px] text-slate-500">Customer: {o.customerId?.name || 'Customer'} • ₹{(o.amount || 0).toLocaleString('en-IN')}</div>
                      </div>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 uppercase">{o.status}</span>
                    </Link>
                  ))}
                </div>
              )}

              {/* Products Results */}
              {searchResults.products?.length > 0 && (
                <div className="p-2 border-b border-slate-100">
                  <div className="px-2 py-1 text-[11px] font-extrabold text-amber-600 uppercase tracking-wider flex items-center gap-1.5">
                    <Tag size={14} />
                    <span>Products ({searchResults.products.length})</span>
                  </div>
                  {searchResults.products.map((p) => (
                    <Link
                      key={p._id}
                      to="/products"
                      onClick={() => setIsSearchOpen(false)}
                      className="p-2 hover:bg-slate-50 rounded-xl flex items-center justify-between transition group"
                    >
                      <div>
                        <div className="font-bold text-slate-900 text-xs group-hover:text-red-600">{p.name}</div>
                        <div className="text-[11px] text-slate-500">Category: {p.category || 'General'} • ₹{p.unitPrice}</div>
                      </div>
                    </Link>
                  ))}
                </div>
              )}

              {/* No Results Fallback */}
              {(!searchResults.leads?.length && !searchResults.customers?.length && !searchResults.orders?.length && !searchResults.products?.length) && (
                <div className="p-6 text-center text-slate-400 text-xs font-semibold">
                  No records match "{searchQuery}"
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Right section: Messages, Notifications, Profile */}
      <div className="flex items-center gap-2 md:gap-4">
        
        {/* 1. Message Icon / Pending Reminders */}
        <div className="relative" ref={messageRef}>
          <button
            type="button"
            title="Messages & Pending Reminders"
            onClick={() => {
              setIsMessageOpen(!isMessageOpen);
              setIsNotifOpen(false);
              setIsProfileOpen(false);
            }}
            onMouseEnter={() => setIsMessageOpen(true)}
            className="p-2 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-xl transition relative flex items-center justify-center"
          >
            <MessageSquare size={20} />
            {pendingRemindersCount > 0 && (
              <span className="absolute top-1 right-1 w-4 h-4 rounded-full bg-amber-500 text-white text-[10px] font-black flex items-center justify-center border-2 border-white">
                {pendingRemindersCount > 9 ? '9+' : pendingRemindersCount}
              </span>
            )}
          </button>

          {/* Messages & Reminders Dropdown */}
          {isMessageOpen && (
            <div className="absolute right-0 mt-2 w-80 bg-white rounded-2xl border border-slate-200 shadow-2xl overflow-hidden z-50 animate-scale-up">
              <div className="p-3 bg-slate-900 text-white flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Bell size={16} className="text-amber-400" />
                  <h4 className="font-bold text-xs tracking-wider uppercase">Reorder Reminders ({pendingRemindersCount})</h4>
                </div>
                <Link to="/reminders" onClick={() => setIsMessageOpen(false)} className="text-[11px] text-amber-400 hover:underline font-bold">
                  View All
                </Link>
              </div>

              <div className="divide-y divide-slate-100 max-h-72 overflow-y-auto scrollbar-hide">
                {remindersList.length === 0 ? (
                  <div className="p-6 text-center text-xs text-slate-400 font-medium">
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
                        <div className="font-bold text-slate-900 text-xs">{rem.customer.name}</div>
                        <span className={`px-1.5 py-0.5 rounded text-[10px] font-black uppercase ${
                          rem.isOverdue ? 'bg-rose-100 text-rose-800' : 'bg-amber-100 text-amber-800'
                        }`}>
                          {rem.isOverdue ? 'Overdue' : `${rem.daysUntilReorder}d left`}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-500 mt-0.5 truncate">
                        {rem.customer.company || 'Customer'} • Probability {rem.probabilityScore}%
                      </p>
                    </Link>
                  ))
                )}
              </div>
            </div>
          )}
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
            onMouseEnter={() => setIsNotifOpen(true)}
            className="p-2 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-xl transition relative flex items-center justify-center"
          >
            <Bell size={20} />
            {unreadNotifCount > 0 && (
              <span className="absolute top-1 right-1 w-4 h-4 rounded-full bg-red-600 text-white text-[10px] font-black flex items-center justify-center border-2 border-white">
                {unreadNotifCount}
              </span>
            )}
          </button>

          {/* Notifications Dropdown */}
          {isNotifOpen && (
            <div className="absolute right-0 mt-2 w-80 bg-white rounded-2xl border border-slate-200 shadow-2xl overflow-hidden z-50 animate-scale-up">
              <div className="p-3 bg-red-600 text-white flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <UserPlus size={16} />
                  <h4 className="font-bold text-xs tracking-wider uppercase">New Leads Added ({unreadNotifCount})</h4>
                </div>
                <button
                  onClick={() => setUnreadNotifCount(0)}
                  className="text-[10px] bg-white/20 hover:bg-white/30 text-white font-bold px-2 py-0.5 rounded transition"
                >
                  Clear Badge
                </button>
              </div>

              <div className="divide-y divide-slate-100 max-h-72 overflow-y-auto scrollbar-hide">
                {recentLeads.length === 0 ? (
                  <div className="p-6 text-center text-xs text-slate-400 font-medium">
                    No new lead notifications
                  </div>
                ) : (
                  recentLeads.map((lead) => (
                    <Link
                      key={lead._id}
                      to={`/leads/${lead._id}/followup`}
                      onClick={() => setIsNotifOpen(false)}
                      className="p-3 hover:bg-slate-50 transition block"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="font-bold text-slate-900 text-xs">{lead.name}</div>
                        <span className="text-[10px] text-slate-400 font-medium">{getRelativeTime(lead.createdAt)}</span>
                      </div>
                      <p className="text-[11px] text-slate-500 mt-0.5 truncate">
                        Company: {lead.company || 'Individual'} • Source: {lead.source}
                      </p>
                    </Link>
                  ))
                )}
              </div>

              <div className="p-2 border-t border-slate-100 bg-slate-50 text-center">
                <Link to="/leads" onClick={() => setIsNotifOpen(false)} className="text-xs text-red-600 font-bold hover:underline inline-flex items-center gap-1">
                  <span>Go to Leads Kanban Board</span>
                  <ArrowRight size={12} />
                </Link>
              </div>
            </div>
          )}
        </div>

        <div className="h-6 w-px bg-slate-200"></div>

        {/* 3. Profile Section with Dropdown */}
        <div className="relative" ref={profileRef}>
          <button
            type="button"
            onClick={() => {
              setIsProfileOpen(!isProfileOpen);
              setIsNotifOpen(false);
              setIsMessageOpen(false);
            }}
            className="flex items-center gap-2.5 p-1 rounded-xl hover:bg-slate-100 transition group focus:outline-none"
          >
            <div className="w-9 h-9 rounded-xl bg-slate-900 text-white flex items-center justify-center font-bold text-xs shadow-sm ring-2 ring-transparent group-hover:ring-red-500 transition">
              {getInitials(user?.name)}
            </div>
            <div className="hidden md:block text-left">
              <p className="text-sm font-bold text-slate-900 leading-tight">{user?.name}</p>
              <span className="inline-block text-[10px] font-bold uppercase tracking-wider text-red-600 bg-red-50 px-1.5 py-0.5 rounded border border-red-100">
                {role}
              </span>
            </div>
            <ChevronDown size={16} className={`text-slate-400 transition-transform duration-200 ${isProfileOpen ? 'rotate-180 text-red-600' : ''}`} />
          </button>

          {/* Profile Dropdown Menu */}
          {isProfileOpen && (
            <div className="absolute right-0 mt-2 w-64 bg-white rounded-2xl border border-slate-200 shadow-2xl overflow-hidden z-50 animate-scale-up">
              {/* Profile Header */}
              <div className="p-4 bg-slate-900 text-white">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-red-600 text-white flex items-center justify-center font-black text-sm">
                    {getInitials(user?.name)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-bold text-sm truncate">{user?.name}</p>
                    <p className="text-xs text-slate-400 truncate">{user?.email}</p>
                  </div>
                </div>
                <div className="mt-3 pt-2 border-t border-slate-800 flex items-center justify-between text-xs">
                  <span className="text-slate-400">Role</span>
                  <span className="font-bold uppercase tracking-wider text-red-400">{role}</span>
                </div>
              </div>

              {/* Navigation Quick Links */}
              <div className="p-2 space-y-1">
                {permissions.dashboard?.includes('view') && (
                  <Link
                    to="/dashboard"
                    onClick={() => setIsProfileOpen(false)}
                    className="flex items-center gap-2.5 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100 rounded-xl transition"
                  >
                    <LayoutDashboard size={16} className="text-slate-400" />
                    Dashboard
                  </Link>
                )}

                {permissions.settings?.includes('view') && (
                  <Link
                    to="/settings"
                    onClick={() => setIsProfileOpen(false)}
                    className="flex items-center gap-2.5 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100 rounded-xl transition"
                  >
                    <SettingsIcon size={16} className="text-slate-400" />
                    Settings
                  </Link>
                )}

                {permissions.users?.includes('view') && (
                  <Link
                    to="/users"
                    onClick={() => setIsProfileOpen(false)}
                    className="flex items-center gap-2.5 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100 rounded-xl transition"
                  >
                    <UsersIcon size={16} className="text-slate-400" />
                    User Management
                  </Link>
                )}

                {role === 'super_admin' && (
                  <Link
                    to="/trash"
                    onClick={() => setIsProfileOpen(false)}
                    className="flex items-center gap-2.5 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100 rounded-xl transition"
                  >
                    <Trash2 size={16} className="text-slate-400" />
                    System Trash & Recovery
                  </Link>
                )}
              </div>

              {/* Sign Out Button */}
              <div className="p-2 border-t border-slate-100 bg-slate-50">
                <button
                  type="button"
                  onClick={handleLogout}
                  className="w-full px-3 py-2 text-xs font-bold text-red-600 bg-red-50 hover:bg-red-100 border border-red-200 rounded-xl transition flex items-center justify-center gap-2"
                >
                  <LogOut size={16} />
                  <span>Sign Out</span>
                </button>
              </div>
            </div>
          )}
        </div>

      </div>

    </header>
  );
}
