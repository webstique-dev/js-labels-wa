import React from 'react';
import { NavLink } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import {
  LayoutDashboard,
  UserPlus,
  Building2,
  ShoppingBag,
  Tag,
  Calendar,
  Bell,
  BarChart3,
  Users as UsersIcon,
  Settings as SettingsIcon,
  Trash2
} from 'lucide-react';

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
    key: 'products',
    label: 'Products',
    path: '/products',
    icon: <Tag size={20} />
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
  },
  {
    key: 'trash',
    label: 'Trash',
    path: '/trash',
    icon: <Trash2 size={20} />
  }
];

export default function Sidebar() {
  const { permissions } = useAuth();

  const allowedNavItems = NAV_ITEMS.filter(item => 
    permissions[item.key]?.includes('view')
  );

  return (
    <aside className="w-64 bg-[#0F1729] text-slate-300 flex flex-col fixed top-0 left-0 bottom-0 h-screen z-30 border-r border-slate-800 hidden md:flex">
      {/* Brand Header */}
      <div className="p-6 flex items-center gap-3 border-b border-slate-800/80">
        <div className="w-10 h-10 rounded-xl bg-red-600 text-white flex items-center justify-center font-black text-xl shadow-lg shadow-red-600/30">
          JS
        </div>
        <div>
          <h2 className="font-black text-white tracking-wider text-base leading-tight">JS LABELS</h2>
          <span className="text-[10px] font-bold text-red-500 uppercase tracking-widest">CRM Enterprise</span>
        </div>
      </div>

      {/* Navigation Links */}
      <nav className="flex-1 px-4 py-6 space-y-1.5 overflow-y-auto scrollbar-hide">
        <div className="px-3 pb-2 text-[11px] font-bold uppercase tracking-widest text-slate-500">
          Main Menu
        </div>
        {allowedNavItems.map(item => (
          <NavLink
            key={item.key}
            to={item.path}
            className={({ isActive }) =>
              `flex items-center gap-3.5 px-3.5 py-2.5 rounded-xl text-sm font-medium transition duration-200 ${
                isActive
                  ? 'bg-red-600 text-white font-semibold shadow-md shadow-red-600/20'
                  : 'text-slate-400 hover:text-slate-100 hover:bg-slate-800/60'
              }`
            }
          >
            {item.icon}
            <span>{item.label}</span>
          </NavLink>
        ))}
      </nav>

      {/* Footer info */}
      <div className="p-4 border-t border-slate-800/80 text-xs text-slate-500 text-center font-medium">
        JS Labels v1.0 • 2026
      </div>
    </aside>
  );
}
