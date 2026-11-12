/**
 * @file Header.jsx
 * @description Government boardroom navigation header representing RAC DRDO.
 */

import React from 'react';
import { Link, useLocation } from 'react-router-dom';

export default function Header() {
  const location = useLocation();

  const navLinks = [
    { label: 'Dashboard', path: '/' },
    { label: 'New Interview Setup', path: '/setup' },
    { label: 'Rankings & Reports', path: '/reports' },
  ];

  return (
    <header className="bg-gov-navy text-white shadow-md border-b-2 border-gov-gold select-none">
      {/* Top subtle tricolor stripe */}
      <div className="h-1 w-full flex">
        <div className="flex-1 bg-[#FF9933]" />
        <div className="flex-1 bg-white" />
        <div className="flex-1 bg-[#138808]" />
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3.5">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          {/* Brand & Crest */}
          <Link to="/" className="flex items-center gap-3.5 group focus:outline-none">
            {/* Government / DRDO Shield Emblem */}
            <div className="w-11 h-11 rounded-lg bg-gov-navy-light border border-gov-gold/40 flex items-center justify-center p-1.5 shadow-inner">
              <svg viewBox="0 0 24 24" className="w-full h-full fill-gov-gold" aria-hidden="true">
                <path d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4zm0 2.18l7 3.12v4.7c0 4.54-3.08 8.8-7 9.88-3.92-1.08-7-5.34-7-9.88V6.3l7-3.12zM12 6a4 4 0 100 8 4 4 0 000-8zm0 2a2 2 0 110 4 2 2 0 010-4zm-4 9c0-1.5 2.5-2.5 4-2.5s4 1 4 2.5v1H8v-1z" />
              </svg>
            </div>

            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-bold uppercase tracking-widest text-slate-300">
                  Government of India • Ministry of Defence
                </span>
                <span className="hidden sm:inline-block w-1.5 h-1.5 rounded-full bg-gov-gold" />
                <span className="hidden sm:inline-block text-[10px] text-gov-gold font-mono uppercase">
                  RAC ASSESSMENT SYSTEM
                </span>
              </div>
              <h1 className="text-base sm:text-lg font-extrabold tracking-tight text-white flex items-center gap-2">
                <span>Recruitment and Assessment Centre (RAC)</span>
              </h1>
              <p className="text-xs text-slate-300 font-medium">
                AI-Based Adaptive Candidate Interview & Evaluation Boardroom
              </p>
            </div>
          </Link>

          {/* Navigation & Boardroom Status */}
          <div className="flex items-center gap-4 self-end md:self-center">
            <nav className="flex items-center gap-1 bg-gov-navy-light/80 p-1 rounded-lg border border-slate-700/60" aria-label="Main Navigation">
              {navLinks.map((link) => {
                const isActive = location.pathname === link.path;
                return (
                  <Link
                    key={link.path}
                    to={link.path}
                    className={`px-3.5 py-1.5 rounded-md text-xs font-bold transition-all ${
                      isActive
                        ? 'bg-gov-gold text-slate-950 shadow-sm'
                        : 'text-slate-300 hover:text-white hover:bg-slate-800'
                    }`}
                    aria-current={isActive ? 'page' : undefined}
                  >
                    {link.label}
                  </Link>
                );
              })}
            </nav>

            {/* Official Assessor Badge */}
            <div className="hidden lg:flex items-center gap-1.5 text-xs text-slate-300 bg-slate-800/80 px-2.5 py-1 rounded border border-slate-700">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" aria-hidden="true" />
              <span className="font-semibold text-slate-200">Boardroom Terminal</span>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}

