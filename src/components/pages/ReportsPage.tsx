'use client';
import { FormEvent, useMemo, useState } from 'react';
import { CalendarClock, Download, FileText, Link2, Plus, Printer } from 'lucide-react';
import { Badge, Button, Field, Modal, Panel, ProGate, StatTile, controlStyle } from '@/components/ui/Primitives';
import { type GeneratedReport, type ReportTemplate } from '@/lib/domain';
import { reportTemplates, useAppStore } from '@/lib/store';
import { downloadCsv, downloadTextFile, formatCurrency } from '@/lib/utils';

const reportTypes: GeneratedReport['type'][] = ['Executive', 'Sales', 'Inventory', 'Customers'];

function reportHtml(title: string, body: string) {
  return `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <title>${title}</title>
  <style>
    body { font-family: Inter, Arial, sans-serif; color: #111827; margin: 40px; }
    h1 { color: #1A3C5E; }
    table { width: 100%; border-collapse: collapse; margin-top: 20px; }
    th, td { border-bottom: 1px solid #e5e7eb; padding: 10px; text-align: left; }
    .brand { color: #E8541A; font-weight: 700; }
    @media print { button { display: none; } }
  </style>
</head>
<body>
  <p class="brand">RhinoPeak Business Dashboard</p>
  <h1>${title}</h1>
  ${body}
</body>
</html>`;
}

export function ReportsPage() {
  const { reports, sales, customers, inventory, plan, generateReport, hasPermission, setActivePage, settings } = useAppStore();
  const [showModal, setShowModal] = useState(false);
  const [title, setTitle] = useState('Monthly Summary - May 2026');
  const [type, setType] = useState<GeneratedReport['type']>('Executive');
  const [template, setTemplate] = useState<ReportTemplate>('Executive');
  const [range, setRange] = useState('May 1 - May 17, 2026');
  const [scheduled, setScheduled] = useState(false);

  const completedSales = sales.filter((sale) => !sale.deletedAt && sale.status === 'Completed');
  const revenue = completedSales.reduce((sum, sale) => sum + sale.amount, 0);
  const lowStock = inventory.filter((product) => product.status !== 'In Stock').length;
  const canGenerateReports = hasPermission('reports.generate');

  const exportRows = useMemo(() => reports.map((report) => ({
    id: report.id,
    title: report.title,
    type: report.type,
    template: report.template,
    range: report.range,
    status: report.status,
    createdAt: report.createdAt,
  })), [reports]);

  const submitReport = (event: FormEvent) => {
    event.preventDefault();
    const ok = generateReport({ title, type, template, range, scheduled });
    if (ok) setShowModal(false);
  };

  const downloadReport = (report: GeneratedReport) => {
    const body = `
      <p><strong>Business:</strong> ${settings.businessName}</p>
      <p><strong>Range:</strong> ${report.range}</p>
      <table>
        <tr><th>Metric</th><th>Value</th></tr>
        <tr><td>Revenue</td><td>${formatCurrency(revenue)}</td></tr>
        <tr><td>Completed Orders</td><td>${completedSales.length}</td></tr>
        <tr><td>Customers</td><td>${customers.length}</td></tr>
        <tr><td>Low-stock alerts</td><td>${lowStock}</td></tr>
      </table>
    `;
    downloadTextFile(`${report.title.replaceAll(' ', '-').toLowerCase()}.html`, reportHtml(report.title, body), 'text/html;charset=utf-8');
  };

  const printReport = (report: GeneratedReport) => {
    if (typeof window === 'undefined') return;
    const body = `
      <p><strong>Business:</strong> ${settings.businessName}</p>
      <p><strong>Template:</strong> ${report.template}</p>
      <p><strong>Range:</strong> ${report.range}</p>
      <table>
        <tr><th>Metric</th><th>Value</th></tr>
        <tr><td>Revenue</td><td>${formatCurrency(revenue)}</td></tr>
        <tr><td>Completed Orders</td><td>${completedSales.length}</td></tr>
        <tr><td>Customers</td><td>${customers.length}</td></tr>
        <tr><td>Inventory Items</td><td>${inventory.length}</td></tr>
      </table>
    `;
    const printWindow = window.open('', '_blank', 'width=900,height=700');
    printWindow?.document.write(reportHtml(report.title, body));
    printWindow?.document.close();
    printWindow?.print();
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
        <p style={{ color: 'var(--text-secondary)', fontSize: 13 }}>
          Generate branded reports, export module data, print optimized summaries, and schedule Pro delivery.
        </p>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <Button variant="secondary" onClick={() => downloadCsv('rhinopeak-reports.csv', exportRows)}>
            <Download size={14} /> Export Index
          </Button>
          <Button disabled={!canGenerateReports} onClick={() => plan === 'pro' ? setShowModal(true) : setActivePage('billing')} title={canGenerateReports ? 'Generate report' : 'Generate reports permission required'}>
            <Plus size={14} /> Generate Report
          </Button>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12 }}>
        <StatTile label="Generated reports" value={reports.length} />
        <StatTile label="Report revenue base" value={formatCurrency(revenue)} tone="accent" />
        <StatTile label="Templates" value={reportTemplates.length} tone="success" />
        <StatTile label="Scheduled delivery" value={plan === 'pro' ? 'Ready' : 'Locked'} tone={plan === 'pro' ? 'success' : 'warning'} />
      </div>

      {plan !== 'pro' && (
        <ProGate message="PDF-style report generation, scheduling, share links, and template selection are Pro features." onUpgrade={() => setActivePage('billing')} />
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(290px, 1fr))', gap: 14 }}>
        {reports.map((report) => (
          <Panel key={report.id} style={{ padding: 18 }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, marginBottom: 12 }}>
              <div style={{ width: 38, height: 38, borderRadius: 8, background: 'var(--accent-glow)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--accent)' }}>
                <FileText size={17} />
              </div>
              <Badge tone={report.status === 'Ready' ? 'success' : 'warning'}>{report.status}</Badge>
            </div>
            <p style={{ color: 'var(--text-primary)', fontWeight: 750, fontSize: 14, marginBottom: 5 }}>{report.title}</p>
            <p style={{ color: 'var(--text-muted)', fontSize: 12, lineHeight: 1.6, minHeight: 38 }}>
              {report.template} {report.type.toLowerCase()} report for {report.range}.
            </p>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', color: 'var(--text-muted)', fontSize: 11, marginTop: 12 }}>
              <CalendarClock size={12} /> {report.createdAt}
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, marginTop: 16, flexWrap: 'wrap' }}>
              <Button variant="secondary" onClick={() => plan === 'pro' ? downloadReport(report) : setActivePage('billing')}>
                <Download size={13} /> HTML
              </Button>
              <Button variant="secondary" onClick={() => plan === 'pro' ? printReport(report) : setActivePage('billing')}>
                <Printer size={13} /> PDF
              </Button>
              <Button variant="secondary" onClick={() => plan === 'pro' ? navigator.clipboard?.writeText(`https://reports.rhinopeak.local/${report.id}`) : setActivePage('billing')}>
                <Link2 size={13} /> Share
              </Button>
            </div>
          </Panel>
        ))}
      </div>

      {showModal && (
        <Modal title="Generate Report" subtitle="Choose range, report type, template, and delivery mode" onClose={() => setShowModal(false)}>
          <form onSubmit={submitReport} style={{ display: 'grid', gap: 13 }}>
            <Field label="Report title">
              <input value={title} onChange={(event) => setTitle(event.target.value)} style={controlStyle} />
            </Field>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <Field label="Type">
                <select value={type} onChange={(event) => setType(event.target.value as GeneratedReport['type'])} style={controlStyle}>
                  {reportTypes.map((item) => <option key={item}>{item}</option>)}
                </select>
              </Field>
              <Field label="Template">
                <select value={template} onChange={(event) => setTemplate(event.target.value as ReportTemplate)} style={controlStyle}>
                  {reportTemplates.map((item) => <option key={item}>{item}</option>)}
                </select>
              </Field>
            </div>
            <Field label="Date range">
              <input value={range} onChange={(event) => setRange(event.target.value)} style={controlStyle} />
            </Field>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--text-secondary)', fontSize: 13 }}>
              <input type="checkbox" checked={scheduled} onChange={(event) => setScheduled(event.target.checked)} style={{ accentColor: 'var(--accent)' }} />
              Schedule automatic monthly email report
            </label>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
              <Button variant="secondary" onClick={() => setShowModal(false)}>Cancel</Button>
              <Button type="submit">{scheduled ? 'Schedule' : 'Generate'}</Button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
