import { createBrowserRouter, type RouteObject } from 'react-router';
import { MyBookingsPage } from './features/account/MyBookingsPage';
import { ProfilePage } from './features/account/ProfilePage';
import { AdminHomePage } from './features/admin/AdminHomePage';
import { AdminLayout } from './features/admin/AdminLayout';
import { LoginPage } from './features/auth/LoginPage';
import { RegisterBusinessPage } from './features/auth/RegisterBusinessPage';
import { RegisterPage } from './features/auth/RegisterPage';
import { RequireRole } from './features/auth/RequireRole';
import { BookingPage } from './features/booking/BookingPage';
import { BusinessPage } from './features/catalog/BusinessPage';
import { ExplorePage } from './features/catalog/ExplorePage';
import { ProHomePage } from './features/pro/ProHomePage';
import { ProLayout } from './features/pro/ProLayout';
import { PublicLayout } from './layouts/PublicLayout';
import { HomePage } from './pages/HomePage';
import { NotFoundPage } from './pages/NotFoundPage';

export const routes: RouteObject[] = [
  {
    element: <PublicLayout />,
    children: [
      { index: true, element: <HomePage /> },
      { path: 'explorar', element: <ExplorePage /> },
      { path: 'negocios/:slug', element: <BusinessPage /> },
      { path: 'negocios/:slug/reservar', element: <BookingPage /> },
      {
        path: 'mis-reservas',
        element: (
          <RequireRole roles={['CLIENT']}>
            <MyBookingsPage />
          </RequireRole>
        ),
      },
      {
        path: 'mi-perfil',
        element: (
          <RequireRole roles={['CLIENT', 'ADMIN', 'PROFESSIONAL']}>
            <ProfilePage />
          </RequireRole>
        ),
      },
    ],
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
