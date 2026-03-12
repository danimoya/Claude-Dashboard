/**
 * Dashboard Page
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { projectService } from '../services/projectService';
import Button from '../components/Button';
import Modal from '../components/Modal';
import { toast } from '../stores/toastStore';
import { useState, useMemo } from 'react';
import type { Project } from '@shared/types';
import { Search, Plus, FolderOpen, Zap, Archive, AlertCircle } from 'lucide-react';

export default function DashboardPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  const { data: projects, isLoading } = useQuery({
    queryKey: ['projects'],
    queryFn: projectService.getProjects,
  });

  const { data: stats } = useQuery({
    queryKey: ['project-stats'],
    queryFn: projectService.getProjectStats,
  });

  const filteredProjects = useMemo(() => {
    if (!projects) return [];
    return projects.filter((p) => {
      const matchesSearch = !searchQuery ||
        p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.description?.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesStatus = statusFilter === 'all' || p.status === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [projects, searchQuery, statusFilter]);

  return (
    <div className="space-y-6">
      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatsCard title="Total Projects" value={stats.total} icon={<FolderOpen size={20} />} color="blue" />
          <StatsCard title="Active" value={stats.active} icon={<Zap size={20} />} color="green" />
          <StatsCard title="Inactive" value={stats.inactive} icon={<AlertCircle size={20} />} color="amber" />
          <StatsCard title="Archived" value={stats.archived} icon={<Archive size={20} />} color="gray" />
        </div>
      )}

      {/* Projects Section */}
      <div className="bg-card rounded-lg border border-border">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-6 border-b border-border">
          <h2 className="text-xl font-semibold">Your Projects</h2>
          <Button onClick={() => setShowCreateModal(true)} size="sm">
            <Plus size={16} className="mr-1.5" /> New Project
          </Button>
        </div>

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-3 px-6 py-4 border-b border-border bg-muted/30">
          <div className="relative flex-1 max-w-sm">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search projects..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-2 text-sm border border-input rounded-lg bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-2 text-sm border border-input rounded-lg bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
          >
            <option value="all">All Status</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
            <option value="archived">Archived</option>
          </select>
        </div>

        {/* Project List */}
        <div className="p-6">
          {isLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {[1, 2, 3].map((i) => (
                <div key={i} className="rounded-lg border border-border p-6 animate-pulse">
                  <div className="h-8 w-8 bg-muted rounded mb-4" />
                  <div className="h-5 bg-muted rounded w-3/4 mb-2" />
                  <div className="h-4 bg-muted rounded w-full mb-4" />
                  <div className="h-3 bg-muted rounded w-1/2" />
                </div>
              ))}
            </div>
          ) : filteredProjects.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredProjects.map((project) => (
                <ProjectCard
                  key={project.id}
                  project={project}
                  onClick={() => navigate(`/projects/${project.id}`)}
                />
              ))}
            </div>
          ) : projects && projects.length > 0 ? (
            <div className="text-center py-12">
              <Search size={40} className="mx-auto text-muted-foreground/40 mb-3" />
              <p className="text-muted-foreground">No projects match your search</p>
            </div>
          ) : (
            <div className="text-center py-12">
              <FolderOpen size={40} className="mx-auto text-muted-foreground/40 mb-3" />
              <p className="text-muted-foreground mb-4">No projects yet</p>
              <Button onClick={() => setShowCreateModal(true)}>Create Your First Project</Button>
            </div>
          )}
        </div>
      </div>

      {/* Create Project Modal */}
      <CreateProjectModal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onSuccess={() => {
          setShowCreateModal(false);
          queryClient.invalidateQueries({ queryKey: ['projects'] });
          queryClient.invalidateQueries({ queryKey: ['project-stats'] });
        }}
      />
    </div>
  );
}

function StatsCard({
  title,
  value,
  icon,
  color,
}: {
  title: string;
  value: number;
  icon: React.ReactNode;
  color: 'blue' | 'green' | 'amber' | 'gray';
}) {
  const bgColors = {
    blue: 'bg-blue-500/10 text-blue-600 dark:text-blue-400',
    green: 'bg-green-500/10 text-green-600 dark:text-green-400',
    amber: 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
    gray: 'bg-gray-500/10 text-gray-600 dark:text-gray-400',
  };

  return (
    <div className="bg-card rounded-lg border border-border p-5 flex items-center gap-4">
      <div className={`p-2.5 rounded-lg ${bgColors[color]}`}>{icon}</div>
      <div>
        <p className="text-sm text-muted-foreground">{title}</p>
        <p className="text-2xl font-bold">{value}</p>
      </div>
    </div>
  );
}

function ProjectCard({ project, onClick }: { project: Project; onClick: () => void }) {
  const statusColors: Record<string, string> = {
    active: 'bg-green-500/10 text-green-700 dark:text-green-400',
    inactive: 'bg-gray-500/10 text-gray-700 dark:text-gray-400',
    archived: 'bg-red-500/10 text-red-700 dark:text-red-400',
  };

  return (
    <div
      onClick={onClick}
      className="group rounded-lg border border-border p-5 hover:border-primary/50 hover:shadow-md transition-all cursor-pointer bg-card"
    >
      <div className="flex justify-between items-start mb-3">
        <div className="p-2 rounded-lg bg-primary/10 text-primary">
          {project.type === 'claude-code' ? <FolderOpen size={20} /> : <Zap size={20} />}
        </div>
        <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${statusColors[project.status] || statusColors.inactive}`}>
          {project.status}
        </span>
      </div>
      <h3 className="font-semibold mb-1 group-hover:text-primary transition-colors">{project.name}</h3>
      <p className="text-sm text-muted-foreground line-clamp-2 mb-3">
        {project.description || 'No description'}
      </p>
      <div className="text-xs text-muted-foreground">
        {project.type === 'claude-code' ? 'Claude Code' : 'Claude-B'}
      </div>
    </div>
  );
}

function CreateProjectModal({
  isOpen,
  onClose,
  onSuccess,
}: {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [formData, setFormData] = useState({
    name: '',
    type: 'claude-code' as 'claude-code' | 'claude-b',
    description: '',
    path: '',
  });

  const createMutation = useMutation({
    mutationFn: projectService.createProject,
    onSuccess: () => {
      toast.success(`Project "${formData.name}" created successfully`);
      setFormData({ name: '', type: 'claude-code', description: '', path: '' });
      onSuccess();
    },
    onError: (error: any) => {
      toast.error(error?.response?.data?.error || 'Failed to create project');
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const { path: dirPath, ...rest } = formData;
    createMutation.mutate(dirPath ? { ...rest, path: dirPath } : rest);
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Create New Project" size="md">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium mb-1">Project Name</label>
          <input
            type="text"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            className="w-full px-3 py-2 border border-input rounded-lg bg-background text-foreground focus:ring-2 focus:ring-ring focus:outline-none"
            required
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Project Type</label>
          <select
            value={formData.type}
            onChange={(e) =>
              setFormData({ ...formData, type: e.target.value as 'claude-code' | 'claude-b' })
            }
            className="w-full px-3 py-2 border border-input rounded-lg bg-background text-foreground focus:ring-2 focus:ring-ring focus:outline-none"
          >
            <option value="claude-code">Claude Code</option>
            <option value="claude-b">Claude-B</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Description (optional)</label>
          <textarea
            value={formData.description}
            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            rows={3}
            className="w-full px-3 py-2 border border-input rounded-lg bg-background text-foreground focus:ring-2 focus:ring-ring focus:outline-none"
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Directory Path (optional)</label>
          <input
            type="text"
            value={formData.path}
            onChange={(e) => setFormData({ ...formData, path: e.target.value })}
            placeholder="e.g., my-app or /app/projects/my-app"
            className="w-full px-3 py-2 border border-input rounded-lg bg-background text-foreground focus:ring-2 focus:ring-ring focus:outline-none"
          />
          <p className="text-xs text-muted-foreground mt-1">
            Map to an existing host directory. Leave empty to auto-create.
          </p>
        </div>

        <div className="flex gap-3">
          <Button type="submit" className="flex-1" isLoading={createMutation.isPending}>
            Create Project
          </Button>
          <Button type="button" variant="ghost" onClick={onClose} className="flex-1">
            Cancel
          </Button>
        </div>
      </form>
    </Modal>
  );
}
