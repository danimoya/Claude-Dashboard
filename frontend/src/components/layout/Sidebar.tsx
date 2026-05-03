/**
 * Sidebar Component
 * Collapsible sidebar with navigation, user info, and logout.
 */

import { Link, useLocation } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { clsx } from 'clsx';
import {
  Terminal,
  Bot,
  Inbox,
  Settings,
  LogOut,
  PanelLeftClose,
  PanelLeft,
  Sparkles,
  X,
} from 'lucide-react';
import { useAuthStore } from '../../stores/authStore';
import { claudeBService } from '../../services/claudeBService';

interface SidebarProps {
  collapsed: boolean;
  onToggleCollapse: () => void;
  onClose?: () => void;
}

const navItems: { label: string; icon: typeof Terminal; path: string; badgeKey?: string }[] = [
  { label: 'Sessions', icon: Terminal, path: '/sessions' },
  { label: 'Claude-B', icon: Bot, path: '/claude-b' },
  { label: 'Inbox', icon: Inbox, path: '/inbox', badgeKey: 'cb-unread' },
  { label: 'Settings', icon: Settings, path: '/settings' },
];

export default function Sidebar({ collapsed, onToggleCollapse, onClose }: SidebarProps) {
  const location = useLocation();
  const { user, logout } = useAuthStore();

  const { data: notifCount } = useQuery({
    queryKey: ['cb-notif-count'],
    queryFn: claudeBService.getNotificationCount,
    refetchInterval: 30_000,
    retry: 1,
  });

  const unreadCount = notifCount?.unread || 0;

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
        <Link to="/sessions" className="flex items-center gap-2 overflow-hidden">
          <Sparkles className="h-6 w-6 shrink-0 text-primary" />
          {!collapsed && (
            <span className="text-lg font-semibold text-card-foreground whitespace-nowrap">
              Claude Dashboard
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
              <span className="relative">
                <Icon className="h-5 w-5 shrink-0" />
                {collapsed && item.badgeKey && unreadCount > 0 && (
                  <span className="absolute -top-1.5 -right-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground">
                    {unreadCount > 9 ? '9+' : unreadCount}
                  </span>
                )}
              </span>
              {!collapsed && (
                <span className="flex items-center gap-2">
                  {item.label}
                  {item.badgeKey && unreadCount > 0 && (
                    <span className="flex h-5 min-w-[20px] items-center justify-center rounded-full bg-primary px-1.5 text-[11px] font-bold text-primary-foreground">
                      {unreadCount > 99 ? '99+' : unreadCount}
                    </span>
                  )}
                </span>
              )}
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
