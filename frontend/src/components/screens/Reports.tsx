import { useState, useEffect } from 'react';
import axios from 'axios';
import { format } from 'date-fns';
import { FileText, Mail, Download, Loader2, CheckCircle2, AlertCircle } from 'lucide-react';

interface ReportsProps {
  fromDate: Date;
  toDate: Date;
}

interface ReportData {
  [key: string]: any[];
}

export default function Reports({ fromDate, toDate }: ReportsProps) {
  const [reportData, setReportData] = useState<ReportData>({});
  const [loading, setLoading] = useState<{ [key: string]: boolean }>({});
  const [emailStatus, setEmailStatus] = useState<{
    [key: string]: 'idle' | 'sending' | 'success' | 'error';
  }>({});
  const [emailMessage, setEmailMessage] = useState<{ [key: string]: string }>({});

  const reports = [
    { id: 'monthly-plan', name: 'Production Plan', description: 'Recipe schedule per mill' },
    { id: 'capacity-outlook', name: 'Capacity Outlook', description: '2026 capacity analysis' },
    { id: 'demand-forecast', name: 'Demand Forecast', description: 'SKU-level forecasts' },
    {
      id: 'raw-material',
      name: 'Raw Material Report',
      description: 'Wheat prices and availability',
    },
  ];

  useEffect(() => {
    fetchAllReports();
  }, [fromDate, toDate]);

  const fetchAllReports = async () => {
    const newLoading: { [key: string]: boolean } = {};
    const newData: ReportData = {};
    const fromDateStr = format(fromDate, 'yyyy-MM-dd');
    const toDateStr = format(toDate, 'yyyy-MM-dd');

    for (const report of reports) {
      newLoading[report.id] = true;
      try {
        const response = await axios.get(
          `/api/reports/${report.id}?from_date=${fromDateStr}&to_date=${toDateStr}`
        );
        newData[report.id] = response.data.data || [];
      } catch (error) {
        console.error(`Error fetching ${report.id}:`, error);
        newData[report.id] = [];
      } finally {
        newLoading[report.id] = false;
      }
    }

    setReportData(newData);
    setLoading(newLoading);
  };

  const handleDownload = async (reportId: string) => {
    try {
      const fromDateStr = format(fromDate, 'yyyy-MM-dd');
      const toDateStr = format(toDate, 'yyyy-MM-dd');
      const response = await axios.get(
        `/api/reports/${reportId}/download?from_date=${fromDateStr}&to_date=${toDateStr}`,
        {
          responseType: 'blob',
        }
      );

      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;

      const contentDisposition = response.headers['content-disposition'];
      let filename = `${reportId}_${fromDateStr}_to_${toDateStr}.csv`;
      if (contentDisposition) {
        const filenameMatch = contentDisposition.match(/filename="?(.+)"?/i);
        if (filenameMatch) {
          filename = filenameMatch[1];
        }
      }

      link.setAttribute('download', filename);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (error: any) {
      console.error('Error downloading report:', error);
      alert('Failed to download report. Please try again.');
    }
  };

  const handleEmail = async (reportId: string) => {
    setEmailStatus({ ...emailStatus, [reportId]: 'sending' });
    setEmailMessage({ ...emailMessage, [reportId]: '' });

    try {
      const fromDateStr = format(fromDate, 'yyyy-MM-dd');
      const toDateStr = format(toDate, 'yyyy-MM-dd');
      const response = await axios.post(
        `/api/reports/${reportId}/email?from_date=${fromDateStr}&to_date=${toDateStr}`
      );
      setEmailStatus({ ...emailStatus, [reportId]: 'success' });
      setEmailMessage({
        ...emailMessage,
        [reportId]: response.data.message || 'Email sent successfully!',
      });

      setTimeout(() => {
        setEmailStatus({ ...emailStatus, [reportId]: 'idle' });
        setEmailMessage({ ...emailMessage, [reportId]: '' });
      }, 3000);
    } catch (error: any) {
      console.error('Error sending email:', error);
      setEmailStatus({ ...emailStatus, [reportId]: 'error' });
      setEmailMessage({
        ...emailMessage,
        [reportId]:
          error.response?.data?.detail ||
          'Failed to send email. Please check your email configuration.',
      });

      setTimeout(() => {
        setEmailStatus({ ...emailStatus, [reportId]: 'idle' });
        setEmailMessage({ ...emailMessage, [reportId]: '' });
      }, 5000);
    }
  };

  const getRecordCount = (reportId: string) => {
    return reportData[reportId]?.length || 0;
  };

  const getStatusIcon = (reportId: string) => {
    const status = emailStatus[reportId];
    if (status === 'sending') {
      return <Loader2 className="w-4 h-4 animate-spin text-white" />;
    } else if (status === 'success') {
      return <CheckCircle2 className="w-4 h-4 text-white" />;
    } else if (status === 'error') {
      return <AlertCircle className="w-4 h-4 text-white" />;
    }
    return <Mail className="w-4 h-4" />;
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-brown-800">Reports & Emails</h1>
        <p className="text-sm text-brown-600 mt-1">Generate and email planning reports</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {reports.map((report) => {
          const isLoading = loading[report.id];
          const recordCount = getRecordCount(report.id);
          const status = emailStatus[report.id];
          const message = emailMessage[report.id];

          return (
            <div
              key={report.id}
              className="bg-white rounded-lg shadow border border-brown-200 p-6 hover:shadow-md transition-shadow"
            >
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center space-x-3">
                  <FileText className="w-6 h-6 text-mc4-blue" />
                  <div>
                    <h3 className="font-semibold text-brown-800">{report.name}</h3>
                    <p className="text-sm text-brown-600">{report.description}</p>
                    {isLoading ? (
                      <p className="text-xs text-muted-foreground mt-1 flex items-center space-x-1">
                        <Loader2 className="w-3 h-3 animate-spin" />
                        <span>Loading data...</span>
                      </p>
                    ) : (
                      <p className="text-xs text-muted-foreground mt-1">
                        {recordCount} {recordCount === 1 ? 'record' : 'records'} available
                      </p>
                    )}
                  </div>
                </div>
              </div>

              {message && (
                <div
                  className={`mb-3 p-2 rounded text-xs ${
                    status === 'success' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'
                  }`}
                >
                  {message}
                </div>
              )}

              <div className="flex items-center space-x-2">
                <button
                  onClick={() => handleEmail(report.id)}
                  disabled={status === 'sending' || isLoading}
                  className={`flex-1 px-4 py-2 rounded-lg transition-colors text-sm font-medium flex items-center justify-center space-x-2 ${
                    status === 'sending'
                      ? 'bg-muted-foreground cursor-not-allowed'
                      : status === 'success'
                      ? 'bg-green-600 hover:bg-green-700'
                      : status === 'error'
                      ? 'bg-red-600 hover:bg-red-700'
                      : 'bg-mc4-blue hover:bg-mc4-dark'
                  } text-white`}
                >
                  {getStatusIcon(report.id)}
                  <span>
                    {status === 'sending'
                      ? 'Sending...'
                      : status === 'success'
                      ? 'Sent!'
                      : status === 'error'
                      ? 'Error'
                      : 'Email'}
                  </span>
                </button>
                <button
                  onClick={() => handleDownload(report.id)}
                  disabled={isLoading || recordCount === 0}
                  className={`px-4 py-2 border border-border rounded-lg transition-colors ${
                    isLoading || recordCount === 0
                      ? 'opacity-50 cursor-not-allowed'
                      : 'hover:bg-brown-50'
                  }`}
                  title={recordCount === 0 ? 'No data available' : 'Download CSV'}
                >
                  <Download className="w-4 h-4 text-brown-600" />
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
