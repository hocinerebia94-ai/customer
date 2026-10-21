import React from 'react';
import { CustomerAppView } from './views/CustomerAppView';

export default function App() {
  return (
    <div className="h-screen w-screen bg-slate-50 font-sans text-slate-900 overflow-hidden" dir="rtl">
      <CustomerAppView />
    </div>
  );
}
