/**
 * @file App.jsx
 * @description Main application component for the RAC DRDO Adaptive Interview System frontend.
 * Provides application routing, header, layout containers, and footer.
 */

import React from 'react';
import { BrowserRouter, Routes, Route, Link } from 'react-router-dom';
import Header from './components/Header';
import DashboardPage from './pages/DashboardPage';
import SetupWizardPage from './pages/SetupWizardPage';
import InterviewRoomPage from './pages/InterviewRoomPage';
import CompletionPage from './pages/CompletionPage';
import ReportPage from './pages/ReportPage';
import RankingsPage from './pages/RankingsPage';
import AdminSubjectsPage from './pages/AdminSubjectsPage';

function NotFoundPage() {
  return (
    <div className="max-w-3xl mx-auto px-4 py-16 text-center">
      <div className="w-16 h-16 rounded-full bg-slate-200 text-slate-600 mx-auto flex items-center justify-center font-bold text-2xl mb-4">
        404
      </div>
      <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">
        Boardroom Resource Not Found
      </h1>
      <p className="text-sm text-slate-600 mt-2 max-w-md mx-auto">
        The requested interview session, dossier, or configuration route does not exist or has been archived.
      </p>
      <div className="mt-6">
        <Link
          to="/"
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-bold bg-gov-navy text-white hover:bg-gov-navy-light focus:outline-none focus:ring-2 focus:ring-gov-navy shadow-sm transition-colors"
        >
          Return to Dashboard
        </Link>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <div className="min-h-screen flex flex-col bg-slate-50 text-slate-900">
        {/* Government Boardroom Top Header */}
        <Header />

        {/* Main Routed Content Area */}
        <main className="flex-1">
          <Routes>
            <Route path="/" element={<DashboardPage />} />
            <Route path="/setup" element={<SetupWizardPage />} />
            <Route path="/interview/:sessionId" element={<InterviewRoomPage />} />
            <Route path="/interview/:sessionId/done" element={<CompletionPage />} />
            <Route path="/report/:sessionId" element={<ReportPage />} />
            <Route path="/reports" element={<RankingsPage />} />
            <Route path="/admin/subjects" element={<AdminSubjectsPage />} />
            <Route path="*" element={<NotFoundPage />} />
          </Routes>
        </main>

        {/* Boardroom Footer */}
        <footer className="bg-slate-900 text-slate-400 border-t border-slate-800 text-xs py-6 mt-12">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <span className="w-2 h-2 rounded-full bg-gov-gold" />
              <span>
                Recruitment and Assessment Centre (RAC) • Defence Research & Development Organisation (DRDO)
              </span>
            </div>
            <div className="text-slate-400 font-mono text-[11px]">
              Govt. of India • Confidential Boardroom Assessment Portal
            </div>
          </div>
        </footer>
      </div>
    </BrowserRouter>
  );
}

