import React, { useState } from 'react';
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
  Trash2,
  Menu,
  X
} from 'lucide-react';

const PRIMARY_KEYS = ['dashboard', 'leads', 'orders', 'reminders'];

const MODULES_INFO = [
  { key: 'dashboard', label: 'Dashboard', path: '/dashboard', icon: <LayoutDashboard size={20} /> },
  { key: 'leads', label: 'Leads', path: '/leads', icon: <UserPlus size={20} /> },
  { key: 'customers', label: 'Customers', path: '/customers', icon: <Building2 size={20} /> },
  { key: 'orders', label: 'Orders', path: '/orders', icon: <ShoppingBag size={20} /> },
  { key: 'followups', label: 'Follow-ups', path: '/followups', icon: <Calendar size={20} /> },
  { key: 'reminders', label: 'Reminders', path: '/reminders', icon: <Bell size={20} /> },
  { key: 'reports', label: 'Reports', path: '/reports', icon: <BarChart3 size={20} /> },
  { key: 'users', label: 'Users', path: '/users', icon: <UsersIcon size={20} /> },
  { key: 'settings', label: 'Settings', path: '/settings', icon: <SettingsIcon size={20} /> },
  { key: 'trash', label: 'Trash', path: '/trash', icon: <Trash2 size={20} /> }
];

export default function MobileTabBar() {
  const { permissions } = useAuth();
  const [showMoreMenu, setShowMoreMenu] = useState(false);

  const allowedModules = MODULES_INFO.filter(item => 
    permissions[item.key]?.includes('view')
  );

  const primaryItems = allowedModules.filter(item => PRIMARY_KEYS.includes(item.key));
  const moreItems = allowedModules.filter(item => !PRIMARY_KEYS.includes(item.key));

  return (
    <>
      {/* Slide-Up Drawer for "More" Menu */}
      {showMoreMenu && (
        <div className="fixed inset-0 z-40 bg-slate-900/60 backdrop-blur-xs flex flex-col justify-end md:hidden">
          <div className="bg-white rounded-t-2xl p-5 border-t border-slate-200 space-y-4 max-h-[75vh] overflow-y-auto scrollbar-hide animate-slide-up">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="font-bold text-slate-900 text-base">More Modules</h3>
              <button
                onClick={() => setShowMoreMenu(false)}
                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg"
              >
                <X size={20} />
              </button>
            </div>
            <div className="grid grid-cols-2 gap-2.5 pt-1">
              {moreItems.map(item => (
                <NavLink
                  key={item.key}
                  to={item.path}
                  onClick={() => setShowMoreMenu(false)}
                  className={({ isActive }) =>
                    `flex items-center gap-3 p-3 rounded-xl border text-sm font-semibold transition ${
                      isActive
                        ? 'bg-red-50 border-red-200 text-red-600'
                        : 'bg-slate-50 border-slate-100 text-slate-700 hover:bg-slate-100'
                    }`
                  }
                >
                  {item.icon}
                  <span>{item.label}</span>
                </NavLink>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Bottom Bar */}
      <nav className="fixed bottom-0 left-0 right-0 z-30 bg-[#0F1729] border-t border-slate-800 px-3 py-2 flex items-center justify-around md:hidden">
        {primaryItems.map(item => (
          <NavLink
            key={item.key}
            to={item.path}
            onClick={() => setShowMoreMenu(false)}
            className={({ isActive }) =>
              `flex flex-col items-center gap-1 py-1 px-3 rounded-xl transition ${
                isActive ? 'text-red-500 font-bold' : 'text-slate-400 hover:text-slate-200 font-medium'
              }`
            }
          >
            {item.icon}
            <span className="text-[10px]">{item.label}</span>
          </NavLink>
        ))}

        {/* More Button */}
        {moreItems.length > 0 && (
          <button
            type="button"
            onClick={() => setShowMoreMenu(!showMoreMenu)}
            className={`flex flex-col items-center gap-1 py-1 px-3 rounded-xl transition ${
              showMoreMenu ? 'text-red-500 font-bold' : 'text-slate-400 hover:text-slate-200 font-medium'
            }`}
          >
            <Menu size={20} />
            <span className="text-[10px]">More</span>
          </button>
        )}
      </nav>
    </>
  );
}
