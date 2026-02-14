'use client';

import { FileText, Mail, Download } from 'lucide-react';

interface ReportsProps {
  horizon: 'week' | 'month' | 'year';
  fromDate?: string;
  toDate?: string;
}

export default function Reports({ horizon, fromDate, toDate }: ReportsProps) {
  const reports = [
    { id: 'monthly-plan', name: 'Production Plan', description: 'Recipe schedule per mill' },
    { id: 'capacity-outlook', name: 'Capacity Outlook', description: '2026 capacity analysis' },
    { id: 'demand-forecast', name: 'Demand Forecast', description: 'SKU-level forecasts' },
    { id: 'raw-material', name: 'Raw Material Report', description: 'Wheat prices and availability' },
  ];

  return (
    <div className="space-y-8">
      <div>
        <h1 className="screen-title">Reports & Emails</h1>
        <p className="screen-subtitle">Generate and email planning reports</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {reports.map((report) => (
          <div
            key={report.id}
            className="apple-card p-6 flex flex-col"
          >
            <div className="flex items-start gap-3 mb-4">
              <FileText className="w-6 h-6 text-brand shrink-0" />
              <div>
                <h3 className="font-semibold text-ink">{report.name}</h3>
                <p className="text-sm text-ink-secondary mt-0.5">{report.description}</p>
              </div>
            </div>
            <div className="flex items-center gap-2 mt-auto">
              <button
                type="button"
                className="flex-1 px-4 py-2.5 rounded-xl bg-brand text-white text-sm font-medium hover:bg-brand-dark transition-colors flex items-center justify-center gap-2"
              >
                <Mail className="w-4 h-4" />
                Email
              </button>
              <button
                type="button"
                className="p-2.5 rounded-xl border border-border text-ink-secondary hover:bg-surface-hover hover:text-ink transition-all"
              >
                <Download className="w-4 h-4" />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
