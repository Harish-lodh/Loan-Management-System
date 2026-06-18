import React, { useState } from 'react';
import { Outlet } from 'react-router-dom';
import Navbar from '../components/Navbar';
import Sidebar from '../components/Sidebar';

export default function AppLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="min-h-screen">
      <Navbar onMenu={() => setSidebarOpen(true)} />
      <div className="lg:grid lg:grid-cols-[18rem_1fr]">
        <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
        <main className="min-w-0 p-4 lg:p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
