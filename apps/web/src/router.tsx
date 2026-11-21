import { createBrowserRouter, type RouteObject } from 'react-router';
import { AdminHomePage } from './features/admin/AdminHomePage';
import { AdminLayout } from './features/admin/AdminLayout';
import { LoginPage } from './features/auth/LoginPage';
import { RegisterBusinessPage } from './features/auth/RegisterBusinessPage';
import { RegisterPage } from './features/auth/RegisterPage';
import { RequireRole } from './features/auth/RequireRole';
import { ProHomePage } from './features/pro/ProHomePage';
import { ProLayout } from './features/pro/ProLayout';
import { PublicLayout } from './layouts/PublicLayout';
import { HomePage } from './pages/HomePage';
import { NotFoundPage } from './pages/NotFoundPage';

export const routes: RouteObject[] = [
  {
    element: <PublicLayout />,
    children: [{ index: true, element: <HomePage /> }],
  },
  { path: '/ingresar', element: <LoginPage /> },
  { path: '/registro', element: <RegisterPage /> },
  { path: '/registro-negocio', element: <RegisterBusinessPage /> },
  {
    path: '/admin',
    element: (
      <RequireRole roles={['ADMIN']}>
        <AdminLayout />
      </RequireRole>
    ),
    children: [{ index: true, element: <AdminHomePage /> }],
  },
  {
    path: '/pro',
    element: (
      <RequireRole roles={['PROFESSIONAL']}>
        <ProLayout />
      </RequireRole>
    ),
    children: [{ index: true, element: <ProHomePage /> }],
  },
  { path: '*', element: <NotFoundPage /> },
];

export function createRouter() {
  return createBrowserRouter(routes);
}
