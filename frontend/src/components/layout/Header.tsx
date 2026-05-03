/**
 * Header Component
 * Top bar with mobile menu toggle, breadcrumbs, and theme toggle.
 */

import { Link, useLocation } from 'react-router-dom';
import { Menu, ChevronRight } from 'lucide-react';
import ThemeToggle from '../ThemeToggle';

interface HeaderProps {
  onMobileMenuToggle: () => void;
}

// Friendly labels for the routes that don't capitalise cleanly.
const ROUTE_LABEL: Record<string, string> = {
  'claude-b': 'Claude-B',
  inbox: 'Inbox',
  sessions: 'Sessions',
  projects: 'Projects',
  settings: 'Settings',
};

function labelFor(segment: string): string {
  if (!segment) return '';
  if (ROUTE_LABEL[segment]) return ROUTE_LABEL[segment];
  return segment.charAt(0).toUpperCase() + segment.slice(1);
}

export default function Header({ onMobileMenuToggle }: HeaderProps) {
  const location = useLocation();
  const pathSegments = location.pathname.split('/').filter(Boolean);

  const breadcrumbs = pathSegments.map((segment, index) => {
    const path = '/' + pathSegments.slice(0, index + 1).join('/');
    const isLast = index === pathSegments.length - 1;

    return { label: labelFor(segment), path, isLast };
  });

  return (
    <header className="flex h-14 items-center justify-between border-b border-border bg-card px-4">
      {/* Left side: hamburger + breadcrumbs */}
      <div className="flex items-center gap-3">
        {/* Mobile hamburger menu */}
        <button
          onClick={onMobileMenuToggle}
          className="rounded-md p-1.5 text-muted-foreground hover:bg-accent hover:text-accent-foreground md:hidden"
          aria-label="Toggle menu"
        >
          <Menu className="h-5 w-5" />
        </button>

        {/* Breadcrumbs */}
        <nav className="flex items-center gap-1 text-sm" aria-label="Breadcrumb">
          {breadcrumbs.map((crumb, index) => (
            <span key={crumb.path} className="flex items-center gap-1">
              {index > 0 && (
                <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
              )}
              {crumb.isLast ? (
                <span className="font-medium text-foreground">{crumb.label}</span>
              ) : (
                <Link
                  to={crumb.path}
                  className="text-muted-foreground transition-colors hover:text-foreground"
                >
                  {crumb.label}
                </Link>
              )}
            </span>
          ))}
          {breadcrumbs.length === 0 && (
            <span className="font-medium text-foreground">Home</span>
          )}
        </nav>
      </div>

      {/* Right side: theme toggle */}
      <div className="flex items-center gap-2">
        <ThemeToggle />
      </div>
    </header>
  );
}
