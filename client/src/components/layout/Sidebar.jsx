import React from 'react';
import { NavLink } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import {
  LayoutDashboard,
  UserPlus,
  Building2,
  ShoppingBag,
  Calendar,
  Bell,
  BarChart3,
  Users as UsersIcon,
  Settings as SettingsIcon,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';

const LOGO_URL = 'https://res.cloudinary.com/rlokioxu/image/upload/v1787580665/JS-Labels_Logo_kxvyzp.png';
const COLLAPSED_LOGO_URL = 'https://res.cloudinary.com/rlokioxu/image/upload/v1787581286/JS_Labels-Logo_uann2h.png';

const NAV_ITEMS = [
  {
    key: 'dashboard',
    label: 'Dashboard',
    path: '/dashboard',
    icon: <LayoutDashboard size={20} />
  },
  {
    key: 'leads',
    label: 'Leads',
    path: '/leads',
    icon: <UserPlus size={20} />
  },
  {
    key: 'customers',
    label: 'Customers',
    path: '/customers',
    icon: <Building2 size={20} />
  },
  {
    key: 'orders',
    label: 'Orders',
    path: '/orders',
    icon: <ShoppingBag size={20} />
  },
  {
    key: 'followups',
    label: 'Follow-ups',
    path: '/followups',
    icon: <Calendar size={20} />
  },
  {
    key: 'reminders',
    label: 'Reminders',
    path: '/reminders',
    icon: <Bell size={20} />
  },
  {
    key: 'reports',
    label: 'Reports',
    path: '/reports',
    icon: <BarChart3 size={20} />
  },
  {
    key: 'users',
    label: 'Users',
    path: '/users',
    icon: <UsersIcon size={20} />
  },
  {
    key: 'settings',
    label: 'Settings',
    path: '/settings',
    icon: <SettingsIcon size={20} />
  }
];

export default function Sidebar({ isCollapsed = false, toggleSidebar }) {
  const { permissions } = useAuth();

  const allowedNavItems = NAV_ITEMS.filter(item =>
    permissions[item.key]?.includes('view')
  );

  return (
    <aside
      className={`${
        isCollapsed ? 'w-20' : 'w-64'
      } bg-[#0F1729] text-slate-300 flex flex-col fixed top-0 left-0 bottom-0 h-screen z-30 border-r border-slate-800 hidden md:flex transition-all duration-300 ease-in-out`}
    >
      {/* Brand Header */}
      <div
        className={`p-4 flex items-center ${
          isCollapsed ? 'flex-col gap-3 justify-center' : 'justify-between gap-3'
        } border-b border-slate-800/80 transition-all duration-300`}
      >
        <img
          src={isCollapsed ? COLLAPSED_LOGO_URL : LOGO_URL}
          alt="JS Labels Logo"
          className={`${isCollapsed ? 'h-8 w-8' : 'h-9 w-auto'} object-contain shrink-0 transition-all duration-300`}
        />

        <button
          onClick={toggleSidebar}
          title={isCollapsed ? 'Expand Sidebar' : 'Collapse Sidebar'}
          className="p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800/80 active:bg-slate-700/80 transition cursor-pointer shrink-0 border border-transparent hover:border-slate-700/60"
        >
          {isCollapsed ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
        </button>
      </div>

      {/* Navigation Links */}
      <nav className={`flex-1 ${isCollapsed ? 'px-2' : 'px-4'} py-6 space-y-1.5 overflow-y-auto scrollbar-hide`}>
        {!isCollapsed && (
          <div className="px-3 pb-2 text-[11px] font-semibold uppercase tracking-widest text-slate-400">
            Main Menu
          </div>
        )}

        {allowedNavItems.map(item => (
          <NavLink
            key={item.key}
            to={item.path}
            title={isCollapsed ? item.label : undefined}
            className={({ isActive }) =>
              `flex items-center ${
                isCollapsed ? 'justify-center p-3' : 'gap-3.5 px-3.5 py-2.5'
              } rounded-xl text-sm font-medium transition duration-200 ${
                isActive
                  ? 'bg-red-600 text-white font-medium shadow-md shadow-red-600/20'
                  : 'text-slate-400 hover:text-slate-100 hover:bg-slate-800/60'
              }`
            }
          >
            <span className="shrink-0">{item.icon}</span>
            {!isCollapsed && <span className="truncate">{item.label}</span>}
          </NavLink>
        ))}
      </nav>
    </aside>
  );
}
