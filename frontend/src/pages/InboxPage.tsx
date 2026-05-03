/**
 * Inbox Page
 *
 * Mailbox-style view of Claude-B notifications. List left, viewer right.
 * Bulk actions (Mark all read, Delete viewed, Delete all) prompt with a
 * dedicated confirmation Modal — never browser confirm() — and surface
 * real error messages on failure.
 */

import { useMemo, useState, type ReactNode } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { clsx } from 'clsx';
import {
  BellOff,
  CheckCircle2,
  Clock,
  Eye,
  Inbox as InboxIcon,
  Loader2,
  Mail,
  MailOpen,
  Trash2,
  XCircle,
} from 'lucide-react';
import { claudeBService, type CBNotification } from '../services/claudeBService';
import Badge from '../components/Badge';
import Button from '../components/Button';
import MarkdownView from '../components/MarkdownView';
import Modal from '../components/Modal';
import { toast } from '../stores/toastStore';

type FilterId = 'all' | 'unread' | 'read';

export default function InboxPage() {
  const qc = useQueryClient();
  const [filter, setFilter] = useState<FilterId>('all');
  const [openId, setOpenId] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<null | {
    title: string;
    body: ReactNode;
    confirmLabel: string;
    danger?: boolean;
    onConfirm: () => void;
  }>(null);

  const { data: notifications, isLoading } = useQuery({
    queryKey: ['cb-notifications'],
    queryFn: () => claudeBService.getNotifications(),
    refetchInterval: 10_000,
  });

  const items = useMemo(() => {
    const list = notifications ?? [];
    if (filter === 'unread') return list.filter((n) => !n.read);
    if (filter === 'read') return list.filter((n) => n.read);
    return list;
  }, [notifications, filter]);

  const open = openId ? items.find((n) => n.id === openId) ?? null : null;
  const unreadCount = (notifications ?? []).filter((n) => !n.read).length;
  const readCount = (notifications ?? []).filter((n) => n.read).length;

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['cb-notifications'] });
    qc.invalidateQueries({ queryKey: ['cb-notif-count'] });
  };

  const markRead = useMutation({
    mutationFn: claudeBService.markNotificationRead,
    onSuccess: invalidate,
    onError: (err: any) => toast.error(extractError(err) || 'Failed to mark read'),
  });
  const markAllRead = useMutation({
    mutationFn: claudeBService.markAllRead,
    onSuccess: () => { invalidate(); toast.success('All marked as read'); },
    onError: (err: any) => toast.error(extractError(err) || 'Failed to mark all read'),
  });
  const del = useMutation({
    mutationFn: claudeBService.deleteNotification,
    onSuccess: () => { invalidate(); toast.success('Message deleted'); setOpenId(null); },
    onError: (err: any) => toast.error(extractError(err) || 'Failed to delete'),
  });
  const delRead = useMutation({
    mutationFn: claudeBService.deleteReadNotifications,
    onSuccess: ({ deleted }) => {
      invalidate();
      toast.success(`${deleted} viewed message${deleted === 1 ? '' : 's'} deleted`);
    },
    onError: (err: any) => toast.error(extractError(err) || 'Failed to delete viewed'),
  });
  const delAll = useMutation({
    mutationFn: claudeBService.deleteAllNotifications,
    onSuccess: ({ deleted }) => {
      invalidate();
      toast.success(`${deleted} message${deleted === 1 ? '' : 's'} deleted`);
      setOpenId(null);
    },
    onError: (err: any) => toast.error(extractError(err) || 'Failed to delete all'),
  });

  return (
    <div className="space-y-4 h-full flex flex-col">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <InboxIcon size={22} className="text-primary" /> Inbox
            {unreadCount > 0 && (
              <span className="inline-flex h-6 min-w-6 items-center justify-center rounded-full bg-primary px-2 text-xs font-bold text-primary-foreground">
                {unreadCount}
              </span>
            )}
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Claude-B daemon notifications — completed prompts, voice replies, system events.
          </p>
        </div>
      </div>

      <div className="border border-border rounded-lg bg-card overflow-hidden flex flex-col flex-1 min-h-[480px]">
        {/* Toolbar */}
        <div className="flex items-center justify-between gap-2 px-3 py-2 border-b border-border bg-muted/30 flex-wrap">
          <div className="flex items-center gap-1">
            {(['all', 'unread', 'read'] as const).map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={clsx(
                  'px-2.5 py-1 text-xs rounded font-medium capitalize transition-colors',
                  filter === f
                    ? 'bg-primary/10 text-primary'
                    : 'text-muted-foreground hover:bg-accent'
                )}
              >
                {f}
                {f === 'unread' && unreadCount > 0 && (
                  <span className="ml-1 text-[10px]">({unreadCount})</span>
                )}
                {f === 'read' && readCount > 0 && (
                  <span className="ml-1 text-[10px]">({readCount})</span>
                )}
              </button>
            ))}
            <span className="text-xs text-muted-foreground ml-2">
              {items.length} message{items.length === 1 ? '' : 's'}
            </span>
          </div>

          <div className="flex items-center gap-1">
            <Button
              size="sm"
              variant="ghost"
              onClick={() => markAllRead.mutate()}
              isLoading={markAllRead.isPending}
              disabled={unreadCount === 0}
              title="Mark every message as read"
            >
              <CheckCircle2 size={13} className="mr-1" /> Mark all read
            </Button>
            <Button
              size="sm"
              variant="ghost"
              disabled={readCount === 0}
              onClick={() =>
                setConfirm({
                  title: 'Delete viewed messages?',
                  body: (
                    <p className="text-sm">
                      This permanently removes <strong>{readCount}</strong> already-read{' '}
                      message{readCount === 1 ? '' : 's'} from the daemon's notification store.
                      Unread messages stay.
                    </p>
                  ),
                  confirmLabel: 'Delete viewed',
                  danger: true,
                  onConfirm: () => delRead.mutate(),
                })
              }
              title="Delete every read message"
            >
              <Trash2 size={13} className="mr-1" /> Delete viewed
            </Button>
            <Button
              size="sm"
              variant="ghost"
              disabled={items.length === 0 && (notifications?.length ?? 0) === 0}
              onClick={() =>
                setConfirm({
                  title: 'Delete all messages?',
                  body: (
                    <p className="text-sm">
                      This permanently removes <strong>{notifications?.length ?? 0}</strong>{' '}
                      message{notifications?.length === 1 ? '' : 's'} — both read and unread.
                      This cannot be undone.
                    </p>
                  ),
                  confirmLabel: 'Delete all',
                  danger: true,
                  onConfirm: () => delAll.mutate(),
                })
              }
              title="Delete every message"
            >
              <Trash2 size={13} className="mr-1" /> Delete all
            </Button>
          </div>
        </div>

        {/* Body */}
        {isLoading ? (
          <div className="flex items-center justify-center flex-1 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin mr-2" /> Loading inbox…
          </div>
        ) : items.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground gap-2">
            {filter === 'unread' ? (
              <MailOpen size={36} className="opacity-40" />
            ) : (
              <BellOff size={36} className="opacity-40" />
            )}
            <p className="text-sm">No messages</p>
          </div>
        ) : (
          <div className="flex-1 grid grid-cols-1 md:grid-cols-[minmax(280px,360px)_1fr] overflow-hidden">
            <div className="overflow-y-auto border-r border-border">
              {items.map((n) => (
                <button
                  key={n.id}
                  onClick={() => {
                    setOpenId(n.id);
                    if (!n.read) markRead.mutate(n.id);
                  }}
                  className={clsx(
                    'w-full text-left px-3 py-2.5 border-b border-border flex flex-col gap-0.5',
                    openId === n.id ? 'bg-accent' : 'hover:bg-muted/40',
                    !n.read && 'bg-primary/5'
                  )}
                >
                  <div className="flex items-center gap-1.5 min-w-0">
                    {n.exitCode === 0 ? (
                      <CheckCircle2 size={14} className="text-green-500 shrink-0" />
                    ) : (
                      <XCircle size={14} className="text-red-500 shrink-0" />
                    )}
                    {!n.read ? (
                      <Mail size={12} className="text-primary shrink-0" />
                    ) : (
                      <MailOpen size={12} className="text-muted-foreground shrink-0" />
                    )}
                    <span className={clsx('text-sm truncate', !n.read && 'font-medium')}>
                      {n.sessionName || n.sessionId}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground line-clamp-2 pl-5 leading-snug">
                    {n.resultPreview || n.prompt || '(no preview)'}
                  </p>
                  <div className="flex items-center gap-2 text-[10px] text-muted-foreground pl-5">
                    <Clock size={10} />
                    {new Date(n.timestamp).toLocaleString()}
                    {(n.durationMs ?? n.duration) != null && (
                      <>
                        <span>·</span>
                        <span>{(((n.durationMs ?? n.duration) ?? 0) / 1000).toFixed(1)}s</span>
                      </>
                    )}
                  </div>
                </button>
              ))}
            </div>

            <div className="overflow-hidden flex flex-col bg-background">
              {open ? (
                <MessageView
                  n={open}
                  onMarkRead={() => markRead.mutate(open.id)}
                  onDelete={() =>
                    setConfirm({
                      title: 'Delete this message?',
                      body: (
                        <p className="text-sm">
                          Permanently remove <strong>{open.sessionName || open.sessionId}</strong>?
                          This cannot be undone.
                        </p>
                      ),
                      confirmLabel: 'Delete',
                      danger: true,
                      onConfirm: () => del.mutate(open.id),
                    })
                  }
                />
              ) : (
                <div className="flex-1 flex items-center justify-center text-muted-foreground gap-2">
                  <InboxIcon size={20} className="opacity-40" />
                  <span className="text-sm">Select a message to read</span>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {confirm && (
        <ConfirmModal
          title={confirm.title}
          body={confirm.body}
          confirmLabel={confirm.confirmLabel}
          danger={confirm.danger}
          onConfirm={() => {
            confirm.onConfirm();
            setConfirm(null);
          }}
          onCancel={() => setConfirm(null)}
        />
      )}
    </div>
  );
}

// ── Message Viewer ─────────────────────────────────────────────

function MessageView({
  n,
  onMarkRead,
  onDelete,
}: {
  n: CBNotification;
  onMarkRead: () => void;
  onDelete: () => void;
}) {
  const body = n.resultFull || n.resultPreview || n.prompt || '';

  return (
    <>
      <div className="flex items-start justify-between px-4 py-3 border-b border-border bg-muted/30 gap-2">
        <div className="min-w-0 flex-1 space-y-1.5">
          <div className="flex items-center gap-2 flex-wrap">
            {n.exitCode === 0 ? (
              <CheckCircle2 size={16} className="text-green-500 shrink-0" />
            ) : (
              <XCircle size={16} className="text-red-500 shrink-0" />
            )}
            <span className="text-base font-semibold truncate">
              {n.sessionName || n.sessionId}
            </span>
            <Badge variant={n.exitCode === 0 ? 'success' : 'danger'} size="sm">
              exit {n.exitCode}
            </Badge>
            {n.type && <Badge variant="default" size="sm">{n.type}</Badge>}
          </div>
          <div className="flex items-center gap-3 text-xs text-muted-foreground flex-wrap">
            <span className="flex items-center gap-1">
              <Clock size={11} />
              {new Date(n.timestamp).toLocaleString()}
            </span>
            {(n.durationMs ?? n.duration) != null && (
              <span>{((n.durationMs ?? n.duration ?? 0) / 1000).toFixed(1)}s</span>
            )}
            {n.goal && (
              <span className="truncate font-mono text-[11px] bg-muted px-1.5 py-0.5 rounded">
                {n.goal}
              </span>
            )}
          </div>
          {n.prompt && n.prompt !== body && (
            <details className="text-xs">
              <summary className="cursor-pointer text-muted-foreground hover:text-foreground">
                Prompt
              </summary>
              <pre className="mt-1.5 p-2 bg-background border border-border rounded text-[12px] font-mono whitespace-pre-wrap text-foreground">
                {n.prompt}
              </pre>
            </details>
          )}
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          {!n.read && (
            <Button size="sm" variant="ghost" onClick={onMarkRead} title="Mark as read">
              <Eye size={13} />
            </Button>
          )}
          <Button size="sm" variant="danger" onClick={onDelete} title="Delete">
            <Trash2 size={13} />
          </Button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-6 py-5 bg-background">
        <article className="max-w-3xl mx-auto">
          <MarkdownView source={body} />
        </article>
        {n.viewCommand && (
          <div className="max-w-3xl mx-auto mt-6 border-t border-border pt-4">
            <p className="text-xs text-muted-foreground mb-1.5">View in CLI:</p>
            <code className="font-mono text-xs px-2.5 py-1.5 bg-muted rounded inline-block">
              {n.viewCommand}
            </code>
          </div>
        )}
      </div>
    </>
  );
}

// ── Confirmation Modal ─────────────────────────────────────────

function ConfirmModal({
  title,
  body,
  confirmLabel,
  danger,
  onConfirm,
  onCancel,
}: {
  title: string;
  body: ReactNode;
  confirmLabel: string;
  danger?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <Modal isOpen onClose={onCancel} title={title}>
      <div className="space-y-4">
        <div>{body}</div>
        <div className="flex gap-2 justify-end">
          <Button variant="ghost" onClick={onCancel}>Cancel</Button>
          <Button variant={danger ? 'danger' : 'primary'} onClick={onConfirm}>
            {confirmLabel}
          </Button>
        </div>
      </div>
    </Modal>
  );
}

// ── Helpers ────────────────────────────────────────────────────

function extractError(err: any): string | null {
  if (!err) return null;
  return (
    err?.response?.data?.error ||
    err?.response?.data?.message ||
    err?.message ||
    null
  );
}
