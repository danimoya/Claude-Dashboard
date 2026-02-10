# Component Scaffolding & Code Templates

## Overview

This document provides reusable code templates and scaffolding patterns for the Claude Dashboard project. All templates follow SOLID principles, DRY patterns, and TypeScript best practices.

---

## Table of Contents

1. [Backend Components](#backend-components)
2. [Frontend Components](#frontend-components)
3. [Shared Types](#shared-types)
4. [Testing Templates](#testing-templates)
5. [Configuration Files](#configuration-files)

---

## Backend Components

### 1. Service Template

```typescript
// backend/src/modules/[module]/[module].service.ts

import { injectable } from 'tsyringe';
import { Repository } from 'typeorm';
import { AppDataSource } from '@/config/database.config';
import { logger } from '@/utils/logger.util';
import { NotFoundError, ValidationError } from '@/utils/errors.util';
import { [Entity] } from '@/entities/[Entity].entity';
import type { Create[Entity]Dto, Update[Entity]Dto } from './[module].types';

/**
 * [Entity] Service
 *
 * Handles business logic for [entity] operations
 */
@injectable()
export class [Module]Service {
  private repository: Repository<[Entity]>;

  constructor() {
    this.repository = AppDataSource.getRepository([Entity]);
  }

  /**
   * Get all [entities]
   */
  async findAll(userId: string): Promise<[Entity][]> {
    try {
      return await this.repository.find({
        where: { userId },
        order: { createdAt: 'DESC' },
      });
    } catch (error) {
      logger.error(`Failed to fetch [entities]`, { error, userId });
      throw error;
    }
  }

  /**
   * Get [entity] by ID
   */
  async findById(id: string, userId: string): Promise<[Entity]> {
    try {
      const entity = await this.repository.findOne({
        where: { id, userId },
      });

      if (!entity) {
        throw new NotFoundError('[Entity]', id);
      }

      return entity;
    } catch (error) {
      logger.error(`Failed to fetch [entity]`, { error, id, userId });
      throw error;
    }
  }

  /**
   * Create new [entity]
   */
  async create(dto: Create[Entity]Dto, userId: string): Promise<[Entity]> {
    try {
      // Validate input
      this.validateCreateDto(dto);

      // Create entity
      const entity = this.repository.create({
        ...dto,
        userId,
      });

      // Save to database
      const saved = await this.repository.save(entity);

      logger.info(`[Entity] created`, { id: saved.id, userId });

      return saved;
    } catch (error) {
      logger.error(`Failed to create [entity]`, { error, dto, userId });
      throw error;
    }
  }

  /**
   * Update existing [entity]
   */
  async update(
    id: string,
    dto: Update[Entity]Dto,
    userId: string
  ): Promise<[Entity]> {
    try {
      // Verify entity exists
      const entity = await this.findById(id, userId);

      // Validate input
      this.validateUpdateDto(dto);

      // Update entity
      Object.assign(entity, dto);

      // Save changes
      const updated = await this.repository.save(entity);

      logger.info(`[Entity] updated`, { id, userId });

      return updated;
    } catch (error) {
      logger.error(`Failed to update [entity]`, { error, id, dto, userId });
      throw error;
    }
  }

  /**
   * Delete [entity]
   */
  async delete(id: string, userId: string): Promise<void> {
    try {
      // Verify entity exists
      await this.findById(id, userId);

      // Delete entity
      await this.repository.delete({ id, userId });

      logger.info(`[Entity] deleted`, { id, userId });
    } catch (error) {
      logger.error(`Failed to delete [entity]`, { error, id, userId });
      throw error;
    }
  }

  /**
   * Validate create DTO
   */
  private validateCreateDto(dto: Create[Entity]Dto): void {
    // Add validation logic
    if (!dto.name || dto.name.trim().length === 0) {
      throw new ValidationError('Name is required');
    }
  }

  /**
   * Validate update DTO
   */
  private validateUpdateDto(dto: Update[Entity]Dto): void {
    // Add validation logic
    if (dto.name && dto.name.trim().length === 0) {
      throw new ValidationError('Name cannot be empty');
    }
  }
}
```

### 2. Controller Template

```typescript
// backend/src/modules/[module]/[module].controller.ts

import { Request, Response, NextFunction } from 'express';
import { container } from 'tsyringe';
import { [Module]Service } from './[module].service';
import { validateRequest } from '@/middleware/validator';
import { Create[Entity]Schema, Update[Entity]Schema } from './[module].validator';

/**
 * [Entity] Controller
 *
 * Handles HTTP requests for [entity] operations
 */
export class [Module]Controller {
  private service: [Module]Service;

  constructor() {
    this.service = container.resolve([Module]Service);
  }

  /**
   * GET /api/[module]
   * Get all [entities]
   */
  getAll = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = req.user!.id;
      const entities = await this.service.findAll(userId);

      res.json({
        success: true,
        data: entities,
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * GET /api/[module]/:id
   * Get [entity] by ID
   */
  getById = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      const userId = req.user!.id;

      const entity = await this.service.findById(id, userId);

      res.json({
        success: true,
        data: entity,
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * POST /api/[module]
   * Create new [entity]
   */
  create = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = req.user!.id;
      const dto = req.body;

      const entity = await this.service.create(dto, userId);

      res.status(201).json({
        success: true,
        data: entity,
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * PUT /api/[module]/:id
   * Update existing [entity]
   */
  update = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      const userId = req.user!.id;
      const dto = req.body;

      const entity = await this.service.update(id, dto, userId);

      res.json({
        success: true,
        data: entity,
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * DELETE /api/[module]/:id
   * Delete [entity]
   */
  delete = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      const userId = req.user!.id;

      await this.service.delete(id, userId);

      res.json({
        success: true,
        message: '[Entity] deleted successfully',
      });
    } catch (error) {
      next(error);
    }
  };
}
```

### 3. Routes Template

```typescript
// backend/src/routes/[module].routes.ts

import { Router } from 'express';
import { [Module]Controller } from '@/modules/[module]/[module].controller';
import { authenticate } from '@/middleware/auth.middleware';
import { validateRequest } from '@/middleware/validator';
import { Create[Entity]Schema, Update[Entity]Schema } from '@/modules/[module]/[module].validator';

const router = Router();
const controller = new [Module]Controller();

/**
 * [Entity] Routes
 */

// Get all [entities]
router.get(
  '/',
  authenticate,
  controller.getAll
);

// Get [entity] by ID
router.get(
  '/:id',
  authenticate,
  controller.getById
);

// Create new [entity]
router.post(
  '/',
  authenticate,
  validateRequest(Create[Entity]Schema),
  controller.create
);

// Update [entity]
router.put(
  '/:id',
  authenticate,
  validateRequest(Update[Entity]Schema),
  controller.update
);

// Delete [entity]
router.delete(
  '/:id',
  authenticate,
  controller.delete
);

export default router;
```

### 4. Entity Template

```typescript
// backend/src/entities/[Entity].entity.ts

import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { User } from './User.entity';

/**
 * [Entity] Entity
 *
 * Database model for [entity]
 */
@Entity('[entities]')
export class [Entity] {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 255 })
  name: string;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  @Column({ type: 'varchar', length: 50 })
  status: string;

  @Column({ type: 'uuid' })
  userId: string;

  @ManyToOne(() => User, user => user.[entities])
  @JoinColumn({ name: 'userId' })
  user: User;

  @CreateDateColumn({ type: 'timestamp' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamp' })
  updatedAt: Date;

  /**
   * Check if [entity] is active
   */
  isActive(): boolean {
    return this.status === 'active';
  }

  /**
   * Convert to JSON representation
   */
  toJSON() {
    return {
      id: this.id,
      name: this.name,
      description: this.description,
      status: this.status,
      userId: this.userId,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
    };
  }
}
```

### 5. Validator Template

```typescript
// backend/src/modules/[module]/[module].validator.ts

import { z } from 'zod';

/**
 * Validation schemas for [entity] operations
 */

// Create [entity] schema
export const Create[Entity]Schema = z.object({
  name: z.string()
    .min(1, 'Name is required')
    .max(255, 'Name must be less than 255 characters'),

  description: z.string()
    .max(1000, 'Description must be less than 1000 characters')
    .optional(),

  type: z.enum(['type1', 'type2', 'type3']),

  metadata: z.record(z.string(), z.any()).optional(),
});

// Update [entity] schema
export const Update[Entity]Schema = Create[Entity]Schema.partial();

// Export types
export type Create[Entity]Dto = z.infer<typeof Create[Entity]Schema>;
export type Update[Entity]Dto = z.infer<typeof Update[Entity]Schema>;
```

---

## Frontend Components

### 1. React Component Template

```typescript
// frontend/src/components/[Module]/[Component].tsx

import React, { useState, useEffect, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { [module]Api } from '@/api/[module].api';
import { useAuthStore } from '@/stores/authStore';
import { Button } from '@/components/common/Button';
import { Alert } from '@/components/common/Alert';
import type { [Entity] } from '@/types/models.types';

/**
 * [Component] Props
 */
interface [Component]Props {
  [entity]Id?: string;
  onSuccess?: ([entity]: [Entity]) => void;
  onError?: (error: Error) => void;
}

/**
 * [Component]
 *
 * [Description of component]
 *
 * @example
 * ```tsx
 * <[Component] [entity]Id="123" onSuccess={handle[Entity]} />
 * ```
 */
export function [Component]({
  [entity]Id,
  onSuccess,
  onError,
}: [Component]Props) {
  // State
  const [isEditing, setIsEditing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Hooks
  const queryClient = useQueryClient();
  const { user } = useAuthStore();

  // Queries
  const {
    data: [entity],
    isLoading,
    error: fetchError,
  } = useQuery({
    queryKey: ['[entities]', [entity]Id],
    queryFn: () => [module]Api.getById([entity]Id!),
    enabled: !![entity]Id,
  });

  // Mutations
  const updateMutation = useMutation({
    mutationFn: (data: Update[Entity]Dto) =>
      [module]Api.update([entity]Id!, data),
    onSuccess: ([entity]) => {
      queryClient.invalidateQueries({ queryKey: ['[entities]'] });
      setIsEditing(false);
      onSuccess?.([entity]);
    },
    onError: (error: Error) => {
      setError(error.message);
      onError?.(error);
    },
  });

  // Event handlers
  const handleEdit = useCallback(() => {
    setIsEditing(true);
    setError(null);
  }, []);

  const handleCancel = useCallback(() => {
    setIsEditing(false);
    setError(null);
  }, []);

  const handleSubmit = useCallback(
    async (data: Update[Entity]Dto) => {
      await updateMutation.mutateAsync(data);
    },
    [updateMutation]
  );

  // Effects
  useEffect(() => {
    if (fetchError) {
      setError(fetchError.message);
    }
  }, [fetchError]);

  // Render helpers
  const renderContent = () => {
    if (isLoading) {
      return <div>Loading...</div>;
    }

    if (!entity) {
      return <div>No data available</div>;
    }

    if (isEditing) {
      return (
        <[Component]Form
          [entity]={entity}
          onSubmit={handleSubmit}
          onCancel={handleCancel}
          isLoading={updateMutation.isPending}
        />
      );
    }

    return (
      <[Component]View
        [entity]={entity}
        onEdit={handleEdit}
      />
    );
  };

  // Render
  return (
    <div className="[component]-container">
      {error && (
        <Alert variant="error" onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      {renderContent()}
    </div>
  );
}
```

### 2. Custom Hook Template

```typescript
// frontend/src/hooks/use[Hook].ts

import { useState, useEffect, useCallback, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { [module]Api } from '@/api/[module].api';
import type { [Entity] } from '@/types/models.types';

/**
 * Hook options
 */
interface Use[Hook]Options {
  enabled?: boolean;
  onSuccess?: (data: [Entity]) => void;
  onError?: (error: Error) => void;
}

/**
 * Hook return value
 */
interface Use[Hook]Return {
  [entity]: [Entity] | null;
  isLoading: boolean;
  error: Error | null;
  refetch: () => void;
  update: (data: Update[Entity]Dto) => Promise<[Entity]>;
  delete: () => Promise<void>;
}

/**
 * use[Hook]
 *
 * Custom hook for [entity] operations
 *
 * @example
 * ```tsx
 * const { [entity], update, delete } = use[Hook]({ [entity]Id: '123' });
 * ```
 */
export function use[Hook](
  [entity]Id: string,
  options: Use[Hook]Options = {}
): Use[Hook]Return {
  const { enabled = true, onSuccess, onError } = options;

  const queryClient = useQueryClient();
  const [error, setError] = useState<Error | null>(null);

  // Queries
  const query = useQuery({
    queryKey: ['[entities]', [entity]Id],
    queryFn: () => [module]Api.getById([entity]Id),
    enabled,
    onSuccess,
    onError: (err: Error) => {
      setError(err);
      onError?.(err);
    },
  });

  // Mutations
  const updateMutation = useMutation({
    mutationFn: (data: Update[Entity]Dto) =>
      [module]Api.update([entity]Id, data),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['[entities]'] });
      onSuccess?.(data);
    },
    onError: (err: Error) => {
      setError(err);
      onError?.(err);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: () => [module]Api.delete([entity]Id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['[entities]'] });
    },
    onError: (err: Error) => {
      setError(err);
      onError?.(err);
    },
  });

  // Functions
  const refetch = useCallback(() => {
    query.refetch();
  }, [query]);

  const update = useCallback(
    async (data: Update[Entity]Dto) => {
      return updateMutation.mutateAsync(data);
    },
    [updateMutation]
  );

  const deleteEntity = useCallback(async () => {
    return deleteMutation.mutateAsync();
  }, [deleteMutation]);

  return {
    [entity]: query.data ?? null,
    isLoading: query.isLoading,
    error: error || query.error,
    refetch,
    update,
    delete: deleteEntity,
  };
}
```

### 3. Zustand Store Template

```typescript
// frontend/src/stores/[module]Store.ts

import { create } from 'zustand';
import { devtools, persist } from 'zustand/middleware';
import { [module]Api } from '@/api/[module].api';
import type { [Entity] } from '@/types/models.types';

/**
 * Store state
 */
interface [Module]State {
  [entities]: [Entity][];
  selected[Entity]: [Entity] | null;
  isLoading: boolean;
  error: string | null;
}

/**
 * Store actions
 */
interface [Module]Actions {
  fetch[Entities]: () => Promise<void>;
  select[Entity]: ([entity]Id: string) => void;
  clear[Entity]: () => void;
  add[Entity]: ([entity]: [Entity]) => void;
  update[Entity]: ([entity]Id: string, data: Partial<[Entity]>) => void;
  remove[Entity]: ([entity]Id: string) => void;
  setError: (error: string | null) => void;
  reset: () => void;
}

/**
 * Combined store type
 */
type [Module]Store = [Module]State & [Module]Actions;

/**
 * Initial state
 */
const initialState: [Module]State = {
  [entities]: [],
  selected[Entity]: null,
  isLoading: false,
  error: null,
};

/**
 * [Module] Store
 *
 * Global state management for [entities]
 */
export const use[Module]Store = create<[Module]Store>()(
  devtools(
    persist(
      (set, get) => ({
        // State
        ...initialState,

        // Actions
        fetch[Entities]: async () => {
          set({ isLoading: true, error: null });

          try {
            const [entities] = await [module]Api.getAll();
            set({ [entities], isLoading: false });
          } catch (error) {
            set({
              error: error.message,
              isLoading: false,
            });
          }
        },

        select[Entity]: ([entity]Id) => {
          const { [entities] } = get();
          const [entity] = [entities].find((p) => p.id === [entity]Id);

          set({ selected[Entity]: [entity] || null });
        },

        clear[Entity]: () => {
          set({ selected[Entity]: null });
        },

        add[Entity]: ([entity]) => {
          const { [entities] } = get();
          set({ [entities]: [[entity], ...[entities]] });
        },

        update[Entity]: ([entity]Id, data) => {
          const { [entities], selected[Entity] } = get();

          const updated[Entities] = [entities].map(([entity]) =>
            [entity].id === [entity]Id ? { ...[entity], ...data } : [entity]
          );

          set({
            [entities]: updated[Entities],
            selected[Entity]:
              selected[Entity]?.id === [entity]Id
                ? { ...selected[Entity], ...data }
                : selected[Entity],
          });
        },

        remove[Entity]: ([entity]Id) => {
          const { [entities], selected[Entity] } = get();

          set({
            [entities]: [entities].filter(([entity]) => [entity].id !== [entity]Id),
            selected[Entity]:
              selected[Entity]?.id === [entity]Id ? null : selected[Entity],
          });
        },

        setError: (error) => {
          set({ error });
        },

        reset: () => {
          set(initialState);
        },
      }),
      {
        name: '[module]-storage',
        partialize: (state) => ({
          // Only persist selected fields
          [entities]: state.[entities],
        }),
      }
    ),
    {
      name: '[Module]Store',
    }
  )
);
```

### 4. API Client Template

```typescript
// frontend/src/api/[module].api.ts

import { apiClient } from './client';
import type {
  [Entity],
  Create[Entity]Dto,
  Update[Entity]Dto,
} from '@/types/models.types';

/**
 * [Module] API
 *
 * API client for [entity] operations
 */
export const [module]Api = {
  /**
   * Get all [entities]
   */
  getAll: async (): Promise<[Entity][]> => {
    const response = await apiClient.get<{ data: [Entity][] }>('/[entities]');
    return response.data;
  },

  /**
   * Get [entity] by ID
   */
  getById: async (id: string): Promise<[Entity]> => {
    const response = await apiClient.get<{ data: [Entity] }>(`/[entities]/${id}`);
    return response.data;
  },

  /**
   * Create new [entity]
   */
  create: async (data: Create[Entity]Dto): Promise<[Entity]> => {
    const response = await apiClient.post<{ data: [Entity] }>(
      '/[entities]',
      data
    );
    return response.data;
  },

  /**
   * Update existing [entity]
   */
  update: async (id: string, data: Update[Entity]Dto): Promise<[Entity]> => {
    const response = await apiClient.put<{ data: [Entity] }>(
      `/[entities]/${id}`,
      data
    );
    return response.data;
  },

  /**
   * Delete [entity]
   */
  delete: async (id: string): Promise<void> => {
    await apiClient.delete(`/[entities]/${id}`);
  },

  /**
   * Bulk operations
   */
  bulkDelete: async (ids: string[]): Promise<void> => {
    await apiClient.post('/[entities]/bulk-delete', { ids });
  },

  /**
   * Search [entities]
   */
  search: async (query: string): Promise<[Entity][]> => {
    const response = await apiClient.get<{ data: [Entity][] }>(
      '/[entities]/search',
      { params: { q: query } }
    );
    return response.data;
  },
};
```

---

## Shared Types

### Type Definitions Template

```typescript
// shared/types/models.types.ts

/**
 * [Entity] Model
 */
export interface [Entity] {
  id: string;
  name: string;
  description: string | null;
  type: [Entity]Type;
  status: [Entity]Status;
  metadata: Record<string, any>;
  userId: string;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * [Entity] Types
 */
export enum [Entity]Type {
  TYPE_1 = 'type1',
  TYPE_2 = 'type2',
  TYPE_3 = 'type3',
}

/**
 * [Entity] Status
 */
export enum [Entity]Status {
  ACTIVE = 'active',
  INACTIVE = 'inactive',
  PENDING = 'pending',
  COMPLETED = 'completed',
  FAILED = 'failed',
}

/**
 * Create [Entity] DTO
 */
export interface Create[Entity]Dto {
  name: string;
  description?: string;
  type: [Entity]Type;
  metadata?: Record<string, any>;
}

/**
 * Update [Entity] DTO
 */
export interface Update[Entity]Dto extends Partial<Create[Entity]Dto> {
  status?: [Entity]Status;
}

/**
 * [Entity] Filter Options
 */
export interface [Entity]FilterOptions {
  type?: [Entity]Type;
  status?: [Entity]Status;
  search?: string;
  sortBy?: keyof [Entity];
  sortOrder?: 'asc' | 'desc';
  page?: number;
  limit?: number;
}

/**
 * Paginated [Entity] Response
 */
export interface Paginated[Entity]Response {
  data: [Entity][];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}
```

---

## Testing Templates

### 1. Service Unit Test Template

```typescript
// backend/tests/unit/[module].service.test.ts

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { [Module]Service } from '@/modules/[module]/[module].service';
import { AppDataSource } from '@/config/database.config';
import { NotFoundError, ValidationError } from '@/utils/errors.util';

describe('[Module]Service', () => {
  let service: [Module]Service;
  let repository: any;

  beforeEach(() => {
    // Setup
    repository = {
      find: vi.fn(),
      findOne: vi.fn(),
      create: vi.fn(),
      save: vi.fn(),
      delete: vi.fn(),
    };

    vi.spyOn(AppDataSource, 'getRepository').mockReturnValue(repository);

    service = new [Module]Service();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('findAll', () => {
    it('should return all [entities] for user', async () => {
      // Arrange
      const userId = 'user-123';
      const mockEntities = [
        { id: '1', name: 'Test 1', userId },
        { id: '2', name: 'Test 2', userId },
      ];
      repository.find.mockResolvedValue(mockEntities);

      // Act
      const result = await service.findAll(userId);

      // Assert
      expect(repository.find).toHaveBeenCalledWith({
        where: { userId },
        order: { createdAt: 'DESC' },
      });
      expect(result).toEqual(mockEntities);
    });
  });

  describe('findById', () => {
    it('should return [entity] when found', async () => {
      // Arrange
      const id = 'entity-123';
      const userId = 'user-123';
      const mockEntity = { id, name: 'Test', userId };
      repository.findOne.mockResolvedValue(mockEntity);

      // Act
      const result = await service.findById(id, userId);

      // Assert
      expect(repository.findOne).toHaveBeenCalledWith({
        where: { id, userId },
      });
      expect(result).toEqual(mockEntity);
    });

    it('should throw NotFoundError when [entity] not found', async () => {
      // Arrange
      const id = 'entity-123';
      const userId = 'user-123';
      repository.findOne.mockResolvedValue(null);

      // Act & Assert
      await expect(service.findById(id, userId)).rejects.toThrow(NotFoundError);
    });
  });

  describe('create', () => {
    it('should create new [entity]', async () => {
      // Arrange
      const userId = 'user-123';
      const dto = { name: 'New Entity', type: 'type1' };
      const mockEntity = { id: 'new-id', ...dto, userId };

      repository.create.mockReturnValue(mockEntity);
      repository.save.mockResolvedValue(mockEntity);

      // Act
      const result = await service.create(dto, userId);

      // Assert
      expect(repository.create).toHaveBeenCalledWith({ ...dto, userId });
      expect(repository.save).toHaveBeenCalled();
      expect(result).toEqual(mockEntity);
    });

    it('should throw ValidationError for invalid input', async () => {
      // Arrange
      const userId = 'user-123';
      const dto = { name: '', type: 'type1' };

      // Act & Assert
      await expect(service.create(dto, userId)).rejects.toThrow(
        ValidationError
      );
    });
  });
});
```

### 2. React Component Test Template

```typescript
// frontend/tests/components/[Component].test.tsx

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { [Component] } from '@/components/[Module]/[Component]';
import { [module]Api } from '@/api/[module].api';

// Mock API
vi.mock('@/api/[module].api');

describe('[Component]', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });
  });

  const renderComponent = (props = {}) => {
    return render(
      <QueryClientProvider client={queryClient}>
        <[Component] {...props} />
      </QueryClientProvider>
    );
  };

  it('should render loading state', () => {
    // Arrange
    vi.mocked([module]Api.getById).mockImplementation(
      () => new Promise(() => {})
    );

    // Act
    renderComponent({ [entity]Id: '123' });

    // Assert
    expect(screen.getByText('Loading...')).toBeInTheDocument();
  });

  it('should render [entity] data', async () => {
    // Arrange
    const mockEntity = {
      id: '123',
      name: 'Test Entity',
      description: 'Test description',
    };

    vi.mocked([module]Api.getById).mockResolvedValue(mockEntity);

    // Act
    renderComponent({ [entity]Id: '123' });

    // Assert
    await waitFor(() => {
      expect(screen.getByText('Test Entity')).toBeInTheDocument();
    });
  });

  it('should handle edit action', async () => {
    // Arrange
    const mockEntity = { id: '123', name: 'Test Entity' };
    vi.mocked([module]Api.getById).mockResolvedValue(mockEntity);

    renderComponent({ [entity]Id: '123' });

    await waitFor(() => {
      expect(screen.getByText('Test Entity')).toBeInTheDocument();
    });

    // Act
    const editButton = screen.getByRole('button', { name: /edit/i });
    fireEvent.click(editButton);

    // Assert
    expect(screen.getByRole('form')).toBeInTheDocument();
  });

  it('should call onSuccess callback', async () => {
    // Arrange
    const mockEntity = { id: '123', name: 'Test Entity' };
    const onSuccess = vi.fn();

    vi.mocked([module]Api.getById).mockResolvedValue(mockEntity);
    vi.mocked([module]Api.update).mockResolvedValue(mockEntity);

    renderComponent({ [entity]Id: '123', onSuccess });

    // Act
    await waitFor(() => {
      expect(screen.getByText('Test Entity')).toBeInTheDocument();
    });

    const editButton = screen.getByRole('button', { name: /edit/i });
    fireEvent.click(editButton);

    const submitButton = screen.getByRole('button', { name: /save/i });
    fireEvent.click(submitButton);

    // Assert
    await waitFor(() => {
      expect(onSuccess).toHaveBeenCalledWith(mockEntity);
    });
  });
});
```

---

## Configuration Files

### 1. Package.json Template (Backend)

```json
{
  "name": "claude-dashboard-backend",
  "version": "1.0.0",
  "description": "Backend API server for Claude Dashboard",
  "main": "dist/server.js",
  "scripts": {
    "dev": "tsx watch src/server.ts",
    "build": "tsc",
    "start": "node dist/server.js",
    "test": "vitest",
    "test:coverage": "vitest --coverage",
    "lint": "eslint src --ext .ts",
    "format": "prettier --write \"src/**/*.ts\"",
    "migrate": "typeorm migration:run -d src/config/database.config.ts",
    "migrate:revert": "typeorm migration:revert -d src/config/database.config.ts",
    "migrate:generate": "typeorm migration:generate -d src/config/database.config.ts",
    "seed": "tsx src/scripts/seed.ts"
  },
  "dependencies": {
    "express": "^4.18.2",
    "typeorm": "^0.3.17",
    "pg": "^8.11.3",
    "redis": "^4.6.10",
    "bull": "^4.11.5",
    "socket.io": "^4.6.2",
    "jsonwebtoken": "^9.0.2",
    "bcrypt": "^5.1.1",
    "zod": "^3.22.4",
    "winston": "^3.11.0",
    "dotenv": "^16.3.1",
    "cors": "^2.8.5",
    "helmet": "^7.1.0",
    "express-rate-limit": "^7.1.5",
    "tsyringe": "^4.8.0"
  },
  "devDependencies": {
    "@types/express": "^4.17.21",
    "@types/node": "^20.10.5",
    "@types/bcrypt": "^5.0.2",
    "@types/jsonwebtoken": "^9.0.5",
    "@types/cors": "^2.8.17",
    "typescript": "^5.3.3",
    "tsx": "^4.7.0",
    "vitest": "^1.1.0",
    "@vitest/coverage-v8": "^1.1.0",
    "eslint": "^8.56.0",
    "prettier": "^3.1.1"
  }
}
```

### 2. Package.json Template (Frontend)

```json
{
  "name": "claude-dashboard-frontend",
  "version": "1.0.0",
  "description": "Frontend React application for Claude Dashboard",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc && vite build",
    "preview": "vite preview",
    "test": "vitest",
    "test:coverage": "vitest --coverage",
    "lint": "eslint src --ext .ts,.tsx",
    "format": "prettier --write \"src/**/*.{ts,tsx}\""
  },
  "dependencies": {
    "react": "^18.2.0",
    "react-dom": "^18.2.0",
    "react-router-dom": "^6.21.1",
    "@tanstack/react-query": "^5.14.2",
    "zustand": "^4.4.7",
    "axios": "^1.6.2",
    "socket.io-client": "^4.6.2",
    "lucide-react": "^0.303.0",
    "@monaco-editor/react": "^4.6.0",
    "xterm": "^5.3.0",
    "xterm-addon-fit": "^0.8.0",
    "recharts": "^2.10.3",
    "zod": "^3.22.4"
  },
  "devDependencies": {
    "@types/react": "^18.2.45",
    "@types/react-dom": "^18.2.18",
    "@vitejs/plugin-react": "^4.2.1",
    "typescript": "^5.3.3",
    "vite": "^5.0.10",
    "vitest": "^1.1.0",
    "@vitest/coverage-v8": "^1.1.0",
    "@testing-library/react": "^14.1.2",
    "@testing-library/user-event": "^14.5.1",
    "eslint": "^8.56.0",
    "prettier": "^3.1.1",
    "tailwindcss": "^3.4.0",
    "autoprefixer": "^10.4.16",
    "postcss": "^8.4.32"
  }
}
```

### 3. TypeScript Config Template

```json
// tsconfig.json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "commonjs",
    "lib": ["ES2022"],
    "outDir": "./dist",
    "rootDir": "./src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "moduleResolution": "node",
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true,
    "experimentalDecorators": true,
    "emitDecoratorMetadata": true,
    "baseUrl": ".",
    "paths": {
      "@/*": ["src/*"]
    }
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist", "**/*.test.ts"]
}
```

---

## Usage Instructions

### Creating a New Backend Module

1. **Create module directory**: `backend/src/modules/[module]/`
2. **Copy templates**:
   - Service: `[module].service.ts`
   - Controller: `[module].controller.ts`
   - Validator: `[module].validator.ts`
   - Types: `[module].types.ts`
3. **Create entity**: `backend/src/entities/[Entity].entity.ts`
4. **Create routes**: `backend/src/routes/[module].routes.ts`
5. **Replace placeholders** with actual names
6. **Register routes** in `backend/src/routes/index.ts`

### Creating a New Frontend Component

1. **Create component directory**: `frontend/src/components/[Module]/`
2. **Copy component template**: `[Component].tsx`
3. **Create hook** (if needed): `frontend/src/hooks/use[Hook].ts`
4. **Create store** (if needed): `frontend/src/stores/[module]Store.ts`
5. **Create API client**: `frontend/src/api/[module].api.ts`
6. **Replace placeholders** with actual names

### Placeholder Replacement Guide

- `[Module]` → PascalCase module name (e.g., `Project`)
- `[module]` → camelCase module name (e.g., `project`)
- `[Entity]` → PascalCase entity name (e.g., `Project`)
- `[entity]` → camelCase entity name (e.g., `project`)
- `[entities]` → Plural camelCase (e.g., `projects`)
- `[Component]` → PascalCase component name (e.g., `ProjectCard`)
- `[Hook]` → PascalCase hook name (e.g., `Project`)

---

**Document Version:** 1.0
**Last Updated:** 2025-10-05
**Author:** CODER Agent (Hive Mind Swarm)
