'use client';

import { ReactNode } from 'react';
import { Sidebar } from '@/components/dashboard/sidebar';
import { Header } from '@/components/dashboard/header';
import { AgentFeed } from '@/components/dashboard/agent-feed';

interface DashboardLayoutProps {
  children: ReactNode;
}

export function DashboardLayout({ children }: DashboardLayoutProps) {
  return (
    <div className="flex h-screen bg-slate-950 overflow-hidden">
      {/* Sidebar */}
      <Sidebar />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <Header />

        {/* Page Content — flex row: main content + permanent right-column feed */}
        <main className="flex-1 flex overflow-hidden">
          {/* Main content — scrollable */}
          <div className="flex-1 overflow-auto">
            {children}
          </div>

          {/* Right column — Agent Feed (always visible) */}
          <div className="w-80 border-l border-slate-800 flex-shrink-0 overflow-hidden h-full">
            <AgentFeed />
          </div>
        </main>
      </div>
    </div>
  );
}
