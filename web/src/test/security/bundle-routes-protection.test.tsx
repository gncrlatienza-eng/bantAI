import React from 'react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { ProtectedRoute } from '../../routes/ProtectedRoute';
import * as authService from '../../services/authService';

describe('Frontend Security: Protected Routes & Bundle Boundary (W9)', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    localStorage.clear();
  });

  it('redirects unauthenticated users from client protected routes to /login', async () => {
    vi.spyOn(authService, 'getCurrentUser').mockRejectedValue(new Error('Unauthenticated'));

    render(
      <MemoryRouter initialEntries={['/client/overview']}>
        <Routes>
          <Route
            path="/client/overview"
            element={
              <ProtectedRoute role="client">
                <div>Client Dashboard Content</div>
              </ProtectedRoute>
            }
          />
          <Route path="/login" element={<div>Public Login Page</div>} />
        </Routes>
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByText('Public Login Page')).toBeInTheDocument();
      expect(screen.queryByText('Client Dashboard Content')).not.toBeInTheDocument();
    });
  });

  it('redirects unauthenticated users from admin protected routes to /admin-login', async () => {
    vi.spyOn(authService, 'getCurrentUser').mockRejectedValue(new Error('Unauthenticated'));

    render(
      <MemoryRouter initialEntries={['/admin/overview']}>
        <Routes>
          <Route
            path="/admin/overview"
            element={
              <ProtectedRoute role="admin">
                <div>Admin Secret Dashboard</div>
              </ProtectedRoute>
            }
          />
          <Route path="/admin-login" element={<div>Admin Login Page</div>} />
        </Routes>
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByText('Admin Login Page')).toBeInTheDocument();
      expect(screen.queryByText('Admin Secret Dashboard')).not.toBeInTheDocument();
    });
  });

  it('prevents client users from accessing admin routes and redirects to /admin-login', async () => {
    vi.spyOn(authService, 'getCurrentUser').mockResolvedValue({
      id: 'client-1',
      phone: '+639171234567',
      email: 'client@company.com',
      role: 'USER',
      firstName: 'John',
      lastName: 'Client',
    });

    render(
      <MemoryRouter initialEntries={['/admin/users']}>
        <Routes>
          <Route
            path="/admin/users"
            element={
              <ProtectedRoute role="admin">
                <div>Privileged Staff User Management</div>
              </ProtectedRoute>
            }
          />
          <Route path="/admin-login" element={<div>Staff Login Screen</div>} />
        </Routes>
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByText('Staff Login Screen')).toBeInTheDocument();
      expect(screen.queryByText('Privileged Staff User Management')).not.toBeInTheDocument();
    });
  });

  it('allows authenticated admin staff to access admin routes', async () => {
    vi.spyOn(authService, 'getCurrentUser').mockResolvedValue({
      id: 'admin-1',
      phone: '+639170000001',
      email: 'staff@bantai.ph',
      role: 'ADMIN',
      firstName: 'Staff',
      lastName: 'Admin',
      staffRole: 'SUPERADMIN',
      permissions: ['*'],
    });

    render(
      <MemoryRouter initialEntries={['/admin/overview']}>
        <Routes>
          <Route
            path="/admin/overview"
            element={
              <ProtectedRoute role="admin">
                <div>Staff Operations Dashboard</div>
              </ProtectedRoute>
            }
          />
        </Routes>
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByText('Staff Operations Dashboard')).toBeInTheDocument();
    });
  });
});
