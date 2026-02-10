/**
 * Dashboard Page
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '../stores/authStore';
import { projectService } from '../services/projectService';
import { authService } from '../services/authService';
import Button from '../components/Button';
import { useState } from 'react';
import type { Project } from '@shared/types';

export default function DashboardPage() {
  const { user, logout } = useAuthStore();
  const queryClient = useQueryClient();
  const [showCreateModal, setShowCreateModal] = useState(false);

  // Fetch projects
  const { data: projects, isLoading } = useQuery({
    queryKey: ['projects'],
    queryFn: projectService.getProjects,
  });

  // Fetch stats
  const { data: stats } = useQuery({
    queryKey: ['project-stats'],
    queryFn: projectService.getProjectStats,
  });

  // Logout mutation
  const logoutMutation = useMutation({
    mutationFn: authService.logout,
    onSuccess: () => {
      logout();
    },
  });

  const handleLogout = () => {
    logoutMutation.mutate();
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Claude Dashboard</h1>
              <p className="text-sm text-gray-600">Welcome back, {user?.username}!</p>
            </div>
            <Button variant="ghost" onClick={handleLogout} isLoading={logoutMutation.isPending}>
              Logout
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Stats */}
        {stats && (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
            <StatsCard title="Total Projects" value={stats.total} />
            <StatsCard title="Active" value={stats.active} variant="success" />
            <StatsCard title="Inactive" value={stats.inactive} variant="warning" />
            <StatsCard title="Archived" value={stats.archived} variant="danger" />
          </div>
        )}

        {/* Projects Section */}
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-xl font-semibold text-gray-900">Your Projects</h2>
            <Button onClick={() => setShowCreateModal(true)}>+ New Project</Button>
          </div>

          {isLoading ? (
            <div className="text-center py-12">
              <div className="animate-spin h-8 w-8 border-4 border-primary-600 border-t-transparent rounded-full mx-auto" />
              <p className="mt-4 text-gray-600">Loading projects...</p>
            </div>
          ) : projects && projects.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {projects.map((project) => (
                <ProjectCard key={project.id} project={project} />
              ))}
            </div>
          ) : (
            <div className="text-center py-12">
              <p className="text-gray-600 mb-4">No projects yet</p>
              <Button onClick={() => setShowCreateModal(true)}>Create Your First Project</Button>
            </div>
          )}
        </div>
      </main>

      {/* Create Project Modal */}
      {showCreateModal && (
        <CreateProjectModal
          onClose={() => setShowCreateModal(false)}
          onSuccess={() => {
            setShowCreateModal(false);
            queryClient.invalidateQueries({ queryKey: ['projects'] });
            queryClient.invalidateQueries({ queryKey: ['project-stats'] });
          }}
        />
      )}
    </div>
  );
}

// Stats Card Component
function StatsCard({
  title,
  value,
  variant = 'default',
}: {
  title: string;
  value: number;
  variant?: 'default' | 'success' | 'warning' | 'danger';
}) {
  const colors = {
    default: 'bg-blue-50 text-blue-600',
    success: 'bg-green-50 text-green-600',
    warning: 'bg-yellow-50 text-yellow-600',
    danger: 'bg-red-50 text-red-600',
  };

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <p className="text-sm text-gray-600 mb-2">{title}</p>
      <p className={`text-3xl font-bold ${colors[variant].split(' ')[1]}`}>{value}</p>
    </div>
  );
}

// Project Card Component
function ProjectCard({ project }: { project: Project }) {
  const Icon = project.type === 'claude-code' ? '💻' : '⚡';
  const statusColors = {
    active: 'bg-green-100 text-green-800',
    inactive: 'bg-gray-100 text-gray-800',
    archived: 'bg-red-100 text-red-800',
  };

  return (
    <div className="bg-white border rounded-lg p-6 hover:shadow-lg transition cursor-pointer">
      <div className="flex justify-between items-start mb-4">
        <span className="text-3xl">{Icon}</span>
        <span
          className={`px-2 py-1 text-xs font-medium rounded-full ${statusColors[project.status]}`}
        >
          {project.status}
        </span>
      </div>
      <h3 className="text-lg font-semibold text-gray-900 mb-2">{project.name}</h3>
      <p className="text-sm text-gray-600 mb-4">{project.description || 'No description'}</p>
      <div className="flex items-center text-xs text-gray-500">
        <span className="mr-2">📁</span>
        <span className="truncate">{project.type}</span>
      </div>
    </div>
  );
}

// Create Project Modal
function CreateProjectModal({
  onClose,
  onSuccess,
}: {
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [formData, setFormData] = useState({
    name: '',
    type: 'claude-code' as 'claude-code' | 'claude-flow',
    description: '',
  });

  const createMutation = useMutation({
    mutationFn: projectService.createProject,
    onSuccess: () => {
      onSuccess();
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    createMutation.mutate(formData);
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
        <h3 className="text-xl font-semibold mb-4">Create New Project</h3>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Project Name</label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Project Type</label>
            <select
              value={formData.type}
              onChange={(e) =>
                setFormData({ ...formData, type: e.target.value as 'claude-code' | 'claude-flow' })
              }
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
            >
              <option value="claude-code">Claude Code</option>
              <option value="claude-flow">Claude Flow</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Description (optional)
            </label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
            />
          </div>

          {createMutation.isError && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-sm text-red-600">
                {(createMutation.error as any)?.response?.data?.error || 'Failed to create project'}
              </p>
            </div>
          )}

          <div className="flex gap-3">
            <Button type="submit" className="flex-1" isLoading={createMutation.isPending}>
              Create Project
            </Button>
            <Button type="button" variant="ghost" onClick={onClose} className="flex-1">
              Cancel
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
