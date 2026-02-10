/**
 * Register Page
 */

import { useState, type FormEvent, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useMutation } from '@tanstack/react-query';
import { useAuthStore } from '../stores/authStore';
import { authService } from '../services/authService';
import Button from '../components/Button';
import Input from '../components/Input';
import ThemeToggle from '../components/ThemeToggle';

export default function RegisterPage() {
  const navigate = useNavigate();
  const setAuth = useAuthStore((state) => state.setAuth);

  const [formData, setFormData] = useState({
    username: '',
    email: '',
    password: '',
    confirmPassword: '',
  });

  const [errors, setErrors] = useState<Record<string, string>>({});

  const registerMutation = useMutation({
    mutationFn: ({ username, password, email }: { username: string; password: string; email?: string }) =>
      authService.register(username, password, email),
    onSuccess: (data) => {
      setAuth(data.user, data.tokens);
      navigate('/dashboard');
    },
  });

  const passwordStrength = useMemo(() => {
    const p = formData.password;
    if (!p) return { score: 0, label: '', color: '' };
    let score = 0;
    if (p.length >= 8) score++;
    if (p.length >= 12) score++;
    if (/[A-Z]/.test(p) && /[a-z]/.test(p)) score++;
    if (/\d/.test(p)) score++;
    if (/[^A-Za-z0-9]/.test(p)) score++;

    if (score <= 1) return { score, label: 'Weak', color: 'bg-red-500' };
    if (score <= 2) return { score, label: 'Fair', color: 'bg-amber-500' };
    if (score <= 3) return { score, label: 'Good', color: 'bg-blue-500' };
    return { score, label: 'Strong', color: 'bg-green-500' };
  }, [formData.password]);

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};
    if (formData.username.length < 3) newErrors.username = 'Username must be at least 3 characters';
    if (formData.password.length < 8) newErrors.password = 'Password must be at least 8 characters';
    if (formData.password !== formData.confirmPassword) newErrors.confirmPassword = 'Passwords do not match';
    if (formData.email && !/\S+@\S+\.\S+/.test(formData.email)) newErrors.email = 'Invalid email address';
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!validateForm()) return;
    registerMutation.mutate({
      username: formData.username,
      password: formData.password,
      email: formData.email || undefined,
    });
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-950 dark:to-gray-900 px-4">
      <div className="absolute top-4 right-4">
        <ThemeToggle />
      </div>

      <div className="max-w-md w-full space-y-8">
        <div className="text-center">
          <h1 className="text-4xl font-bold text-foreground mb-2">Claude Dashboard</h1>
          <p className="text-muted-foreground">Create your account</p>
        </div>

        <div className="bg-card text-card-foreground rounded-lg shadow-xl p-8 border border-border">
          <form onSubmit={handleSubmit} className="space-y-6">
            <Input
              label="Username"
              type="text"
              value={formData.username}
              onChange={(e) => setFormData({ ...formData, username: e.target.value })}
              placeholder="Choose a username"
              required
              autoComplete="username"
              error={errors.username}
            />

            <Input
              label="Email (optional)"
              type="email"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              placeholder="your.email@example.com"
              autoComplete="email"
              error={errors.email}
            />

            <div>
              <Input
                label="Password"
                type="password"
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                placeholder="Choose a strong password"
                required
                autoComplete="new-password"
                error={errors.password}
              />
              {formData.password && (
                <div className="mt-2">
                  <div className="flex gap-1 mb-1">
                    {[1, 2, 3, 4, 5].map((i) => (
                      <div
                        key={i}
                        className={`h-1.5 flex-1 rounded-full transition-colors ${
                          i <= passwordStrength.score ? passwordStrength.color : 'bg-muted'
                        }`}
                      />
                    ))}
                  </div>
                  <p className="text-xs text-muted-foreground">{passwordStrength.label}</p>
                </div>
              )}
            </div>

            <Input
              label="Confirm Password"
              type="password"
              value={formData.confirmPassword}
              onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
              placeholder="Confirm your password"
              required
              autoComplete="new-password"
              error={errors.confirmPassword}
            />

            {registerMutation.isError && (
              <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-lg">
                <p className="text-sm text-destructive">
                  {(registerMutation.error as any)?.response?.data?.error || 'Registration failed'}
                </p>
              </div>
            )}

            <Button type="submit" className="w-full" size="lg" isLoading={registerMutation.isPending}>
              Create Account
            </Button>
          </form>

          <div className="mt-6 text-center">
            <p className="text-sm text-muted-foreground">
              Already have an account?{' '}
              <Link to="/login" className="text-primary hover:underline font-medium">
                Sign in
              </Link>
            </p>
          </div>
        </div>

        <p className="text-center text-xs text-muted-foreground">
          Powered by Claude Code &amp; Claude-B
        </p>
      </div>
    </div>
  );
}
