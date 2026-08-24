import React, { useState } from 'react';
import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';
import TopBar from './TopBar';
import MobileTabBar from './MobileTabBar';

export default function AppLayout() {
  const [isCollapsed, setIsCollapsed] = useState(() => {
    return localStorage.getItem('js_labels_sidebar_collapsed') === 'true';
  });

  const toggleSidebar = () => {
    setIsCollapsed((prev) => {
      const next = !prev;
      localStorage.setItem('js_labels_sidebar_collapsed', String(next));
      return next;
    });
  };

  return (
    <div className="min-h-screen bg-slate-100 flex flex-row font-sans text-slate-800 antialiased">
      {/* Left Sidebar (Desktop) */}
      <Sidebar isCollapsed={isCollapsed} toggleSidebar={toggleSidebar} />

      {/* Main Content Area */}
      <div className={`flex-1 flex flex-col min-w-0 min-h-screen pb-16 md:pb-0 transition-all duration-300 ${isCollapsed ? 'md:ml-20' : 'md:ml-64'}`}>
        {/* Top Header */}
        <TopBar />

        {/* Dynamic Nested Page Content */}
        <main className="flex-1 p-4 md:p-8 2xl:px-10 max-w-[1920px] w-full mx-auto">
          <Outlet />
        </main>
      </div>

      {/* Bottom Tab Bar (Mobile) */}
      <MobileTabBar />
    </div>
  );
}
