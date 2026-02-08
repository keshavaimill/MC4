'use client';

import { useState } from 'react';
import { FileText, Mail, Download } from 'lucide-react';

interface ReportsProps {
  horizon: 'week' | 'month' | 'year';
}

export default function Reports({ horizon }: ReportsProps) {
  const [selectedReport, setSelectedReport] = useState<string | null>(null);

  const reports = [
    { id: 'monthly-plan', name: 'Monthly Recipe Plan', description: 'Recipe schedule per mill' },
    { id: 'capacity-outlook', name: 'Capacity Outlook', description: '2026 capacity analysis' },
    { id: 'demand-forecast', name: 'Demand Forecast', description: 'SKU-level forecasts' },
    { id: 'raw-material', name: 'Raw Material Report', description: 'Wheat prices and availability' },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Reports & Emails</h1>
        <p className="text-sm text-gray-500 mt-1">Generate and email planning reports</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {reports.map((report) => (
          <div
            key={report.id}
            className="bg-white rounded-lg shadow border border-gray-200 p-6 hover:shadow-md transition-shadow"
          >
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center space-x-3">
                <FileText className="w-6 h-6 text-mc4-blue" />
                <div>
                  <h3 className="font-semibold text-gray-900">{report.name}</h3>
                  <p className="text-sm text-gray-500">{report.description}</p>
                </div>
              </div>
            </div>
            <div className="flex items-center space-x-2">
              <button className="flex-1 px-4 py-2 bg-mc4-blue text-white rounded-lg hover:bg-mc4-dark transition-colors text-sm font-medium flex items-center justify-center space-x-2">
                <Mail className="w-4 h-4" />
                <span>Email</span>
              </button>
              <button className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors">
                <Download className="w-4 h-4 text-gray-600" />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
