import React from 'react';
import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';
import TopBar from './TopBar';
import MobileTabBar from './MobileTabBar';

export default function AppLayout() {
  return (
    <div className="min-h-screen bg-slate-100 flex flex-row font-sans text-slate-800 antialiased">
      {/* Left Sidebar (Desktop) */}
      <Sidebar />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 min-h-screen pb-16 md:pb-0 md:ml-64">
        {/* Top Header */}
        <TopBar />

        {/* Dynamic Nested Page Content */}
        <main className="flex-1 p-4 md:p-8 max-w-7xl w-full mx-auto">
          <Outlet />
        </main>
      </div>

      {/* Bottom Tab Bar (Mobile) */}
      <MobileTabBar />
    </div>
  );
}
