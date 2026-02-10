/**
 * AppLayout Component
 * Main authenticated layout with collapsible sidebar, header, and content area.
 */

import { useState, useCallback, type ReactNode } from 'react';
import Sidebar from './Sidebar';
import Header from './Header';

interface AppLayoutProps {
  children: ReactNode;
}

export default function AppLayout({ children }: AppLayoutProps) {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

  const handleToggleCollapse = useCallback(() => {
    setSidebarCollapsed((prev) => !prev);
  }, []);

  const handleMobileMenuToggle = useCallback(() => {
    setMobileSidebarOpen((prev) => !prev);
  }, []);

  const handleMobileClose = useCallback(() => {
    setMobileSidebarOpen(false);
  }, []);

  return (
    <div className="flex h-screen bg-background">
      {/* Desktop sidebar */}
      <div className="hidden md:flex md:flex-shrink-0">
        <Sidebar
          collapsed={sidebarCollapsed}
          onToggleCollapse={handleToggleCollapse}
        />
      </div>

      {/* Mobile sidebar overlay */}
      {mobileSidebarOpen && (
        <div className="fixed inset-0 z-40 md:hidden">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/50"
            onClick={handleMobileClose}
            aria-hidden="true"
          />

          {/* Sidebar panel */}
          <div className="relative z-50 h-full w-64 animate-slide-in-from-right">
            <Sidebar
              collapsed={false}
              onToggleCollapse={handleToggleCollapse}
              onClose={handleMobileClose}
            />
          </div>
        </div>
      )}

      {/* Main area: header + content */}
      <div className="flex flex-1 flex-col overflow-hidden">
        <Header onMobileMenuToggle={handleMobileMenuToggle} />

        <main className="flex-1 overflow-y-auto p-4 md:p-6">
          {children}
        </main>
      </div>
    </div>
  );
}
