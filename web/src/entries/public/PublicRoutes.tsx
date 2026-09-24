import React from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { LandingPage, RequestAccessPage } from '../../pages/public';
import { CheckoutConfirmationPage } from '../../pages/RequestAccess/CheckoutConfirmationPage';
import {
  CheckoutCancelledPage,
  CheckoutPendingPage,
} from '../../pages/RequestAccess/CheckoutPendingPage';
import { LegalDisclosuresPage } from '../../pages/Legal/LegalDisclosuresPage';
import { ClientLoginPage } from '../../pages/Login/ClientLoginPage';
import { AdminLoginPage } from '../../pages/Login/AdminLoginPage';

export function PublicRoutes() {
  return (
    <Routes>
      {/* Public — landing, info sections, access request */}
      <Route path="/" element={<LandingPage />} />
      <Route
        path="/how-it-works"
        element={<Navigate to="/#how-it-works" replace />}
      />
      <Route path="/about" element={<Navigate to="/#about" replace />} />
      <Route path="/research" element={<Navigate to="/" replace />} />
      <Route path="/request-access" element={<RequestAccessPage />} />
      <Route
        path="/request-access/checkout"
        element={<CheckoutConfirmationPage />}
      />
      <Route path="/request-access/pending" element={<CheckoutPendingPage />} />
      <Route
        path="/request-access/cancelled"
        element={<CheckoutCancelledPage />}
      />

      {/* Commerce & Legal Disclosures */}
      <Route path="/legal" element={<LegalDisclosuresPage />} />
      <Route path="/terms" element={<Navigate to="/legal?tab=terms" replace />} />
      <Route path="/privacy" element={<Navigate to="/legal?tab=privacy" replace />} />
      <Route path="/license-terms" element={<Navigate to="/legal?tab=license" replace />} />
      <Route path="/disclosures" element={<Navigate to="/legal" replace />} />

      {/* Auth Entry Points */}
      <Route path="/login" element={<ClientLoginPage />} />
      <Route path="/admin-login" element={<AdminLoginPage />} />
      <Route
        path="/register"
        element={<Navigate to="/request-access" replace />}
      />

      {/* Catch-all redirect */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
