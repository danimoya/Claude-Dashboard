/**
 * Sidebar Component
 * Collapsible sidebar with navigation, user info, and logout.
 */

import { Link, useLocation } from 'react-router-dom';
import { clsx } from 'clsx';
import {
  LayoutDashboard,
  Terminal,
  Settings,
  LogOut,
  PanelLeftClose,
  PanelLeft,
  Sparkles,
  X,
} from 'lucide-react';
import { useAuthStore } from '../../stores/authStore';

interface SidebarProps {
  collapsed: boolean;
  onToggleCollapse: () => void;
  onClose?: () => void;
}

const navItems = [
  { label: 'Dashboard', icon: LayoutDashboard, path: '/dashboard' },
  { label: 'CLI Sessions', icon: Terminal, path: '/cli' },
  { label: 'Settings', icon: Settings, path: '/settings' },
];

export default function Sidebar({ collapsed, onToggleCollapse, onClose }: SidebarProps) {
  const location = useLocation();
  const { user, logout } = useAuthStore();

  const isActive = (path: string) => location.pathname.startsWith(path);

  return (
    <div
      className={clsx(
        'flex h-full flex-col bg-card border-r border-border transition-all duration-200',
        collapsed ? 'w-16' : 'w-64'
      )}
    >
      {/* Brand / Logo */}
      <div className="flex h-14 items-center justify-between px-3 border-b border-border">
        <Link to="/dashboard" className="flex items-center gap-2 overflow-hidden">
          <Sparkles className="h-6 w-6 shrink-0 text-primary" />
          {!collapsed && (
            <span className="text-lg font-semibold text-card-foreground whitespace-nowrap">
              Claude
            </span>
          )}
        </Link>

        <div className="flex items-center gap-1">
          {/* Mobile close button */}
          {onClose && (
            <button
              onClick={onClose}
              className="rounded-md p-1 text-muted-foreground hover:bg-accent hover:text-accent-foreground md:hidden"
              aria-label="Close sidebar"
            >
              <X className="h-5 w-5" />
            </button>
          )}

          {/* Collapse toggle */}
          <button
            onClick={onToggleCollapse}
            className="hidden rounded-md p-1 text-muted-foreground hover:bg-accent hover:text-accent-foreground md:inline-flex"
            aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            {collapsed ? (
              <PanelLeft className="h-5 w-5" />
            ) : (
              <PanelLeftClose className="h-5 w-5" />
            )}
          </button>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 space-y-1 px-2 py-3">
        {navItems.map((item) => {
          const active = isActive(item.path);
          const Icon = item.icon;

          return (
            <Link
              key={item.path}
              to={item.path}
              onClick={onClose}
              title={collapsed ? item.label : undefined}
              className={clsx(
                'sidebar-link',
                active ? 'sidebar-link-active' : 'sidebar-link-inactive',
                collapsed && 'justify-center px-2'
              )}
            >
              <Icon className="h-5 w-5 shrink-0" />
              {!collapsed && <span>{item.label}</span>}
            </Link>
          );
        })}
      </nav>

      {/* User Section */}
      <div className="border-t border-border px-2 py-3">
        {user && (
          <div
            className={clsx(
              'mb-2 overflow-hidden rounded-lg px-3 py-2',
              collapsed && 'px-0 text-center'
            )}
          >
            {!collapsed ? (
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-card-foreground">
                  {user.username}
                </p>
                {user.email && (
                  <p className="truncate text-xs text-muted-foreground">{user.email}</p>
                )}
              </div>
            ) : (
              <div
                className="mx-auto flex h-8 w-8 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs font-bold"
                title={user.username}
              >
                {user.username.charAt(0).toUpperCase()}
              </div>
            )}
          </div>
        )}

        <button
          onClick={logout}
          title={collapsed ? 'Logout' : undefined}
          className={clsx(
            'sidebar-link sidebar-link-inactive w-full text-left',
            collapsed && 'justify-center px-2'
          )}
        >
          <LogOut className="h-5 w-5 shrink-0" />
          {!collapsed && <span>Logout</span>}
        </button>
      </div>
    </div>
  );
}
