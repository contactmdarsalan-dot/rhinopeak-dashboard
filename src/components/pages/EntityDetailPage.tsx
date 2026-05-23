'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useState, type ReactNode } from 'react';
import { ArrowLeft, Building2, CreditCard, Download, FileText, Package, Printer, ReceiptText, ShoppingCart, Users, WalletCards } from 'lucide-react';
import { Badge, Panel, PanelHeader, StatTile } from '@/components/ui/Primitives';
import { uiProductList, uiRecordText, uiText } from '@/lib/i18n';
import { getStockStatus, useAppStore } from '@/lib/store';
import { formatCurrency } from '@/lib/utils';

type Tone = 'neutral' | 'success' | 'warning' | 'danger' | 'info' | 'accent';
type StatTone = Exclude<Tone, 'info'>;

type DetailRow = {
  label: string;
  value: ReactNode;
};

type DetailStat = {
  label: string;
  value: ReactNode;
  detail?: string;
  tone?: StatTone;
};

type DetailTable = {
  title: string;
  headers: string[];
  rows: ReactNode[][];
};

type DocumentField = {
  label: string;
  value: string;
};

type DocumentLine = {
  description: string;
  quantity: string;
  rate: string;
  amount: string;
};

type DocumentTotal = {
  label: string;
  value: string;
  strong?: boolean;
};

type DetailDocument = {
  title: string;
  subtitle: string;
  documentNo: string;
  date: string;
  from: DocumentField[];
  to?: DocumentField[];
  lines: DocumentLine[];
  totals: DocumentTotal[];
  notes?: string[];
};

type TimelineItem = {
  id: string;
  title: string;
  meta: string;
  amount?: ReactNode;
  tone?: Tone;
};

type DetailModel = {
  title: string;
  subtitle: string;
  badge?: { label: string; tone?: Tone };
  backHref: string;
  backLabel: string;
  icon: ReactNode;
  stats: DetailStat[];
  sections: Array<{ title: string; rows: DetailRow[] }>;
  document?: DetailDocument;
  tables?: DetailTable[];
  timelineTitle?: string;
  timeline?: TimelineItem[];
};

const buttonLinkStyle = {
  minHeight: 36,
  padding: '8px 12px',
  borderRadius: 8,
  border: '1px solid var(--border)',
  background: 'var(--bg-card)',
  color: 'var(--text-secondary)',
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 7,
  fontSize: 13,
  fontWeight: 650,
  textDecoration: 'none',
} as const;

function detailValue(language: Parameters<typeof uiText>[0], value: ReactNode): ReactNode {
  if (typeof value !== 'string') return value;
  return /\s+x\s+/.test(value) ? uiProductList(language, value) : uiRecordText(language, value);
}

export function EntityDetailPage() {
  const params = useParams<{ entity: string; id: string }>();
  const state = useAppStore();
  const tx = (value: string) => uiText(state.settings.language, value);
  const tv = (value: ReactNode) => detailValue(state.settings.language, value);
  const entity = normalizeEntity(slugParam(params.entity));
  const id = decodeURIComponent(slugParam(params.id));
  const detail = buildDetailModel(state, entity, id);

  if (!detail) {
    return (
      <div style={{ display: 'grid', gap: 14 }}>
        <Link href="/" style={buttonLinkStyle}>
          <ArrowLeft size={15} /> {tx('Back to dashboard')}
        </Link>
        <Panel style={{ padding: 22 }}>
          <p style={{ color: 'var(--text-primary)', fontWeight: 850, fontSize: 18 }}>{tx('Detail not found')}</p>
          <p style={{ color: 'var(--text-muted)', fontSize: 13, marginTop: 4 }}>
            {tx('This record may have been deleted, moved, or not synced from the backend yet.')}
          </p>
        </Panel>
      </div>
    );
  }

  return (
    <div style={{ display: 'grid', gap: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
        <Link href={detail.backHref} style={buttonLinkStyle}>
          <ArrowLeft size={15} /> {tx(detail.backLabel)}
        </Link>
        {detail.badge && <Badge tone={detail.badge.tone ?? 'neutral'}>{tx(detail.badge.label)}</Badge>}
      </div>

      <Panel style={{ padding: 18 }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14, minWidth: 0 }}>
            <span
              style={{
                width: 44,
                height: 44,
                borderRadius: 12,
                display: 'grid',
                placeItems: 'center',
                color: 'var(--accent)',
                background: 'var(--accent-glow)',
                border: '1px solid var(--border)',
                flex: '0 0 auto',
              }}
            >
              {detail.icon}
            </span>
            <div style={{ minWidth: 0 }}>
              <p style={{ color: 'var(--text-primary)', fontSize: 22, lineHeight: 1.15, fontWeight: 900 }}>{tv(detail.title)}</p>
              <p style={{ color: 'var(--text-muted)', fontSize: 13, marginTop: 4 }}>{tv(detail.subtitle)}</p>
            </div>
          </div>
        </div>
      </Panel>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12 }}>
        {detail.stats.map((stat) => (
          <StatTile key={stat.label} label={stat.label} value={tv(stat.value)} detail={stat.detail ? String(tv(stat.detail)) : undefined} tone={stat.tone} />
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(320px, 0.38fr)', gap: 14 }} className="entity-detail-layout">
        <div style={{ display: 'grid', gap: 14, alignContent: 'start' }}>
          {detail.document && <DocumentPreview document={detail.document} />}
          {detail.sections.map((section) => (
            <Panel key={section.title}>
              <PanelHeader title={tx(section.title)} />
              <KeyValueGrid rows={section.rows} />
            </Panel>
          ))}
          {detail.tables?.map((table) => (
            <Panel key={table.title}>
              <PanelHeader title={tx(table.title)} />
              <div style={{ overflowX: 'auto' }}>
                <table className="responsive-card-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid var(--border)' }}>
                      {table.headers.map((header) => (
                        <th key={header} style={{ padding: '11px 14px', color: 'var(--text-muted)', fontSize: 11, fontWeight: 750, textAlign: 'left', textTransform: 'uppercase', whiteSpace: 'nowrap' }}>
                          {tx(header)}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {table.rows.map((row, rowIndex) => (
                      <tr key={`${table.title}-${rowIndex}`} style={{ borderBottom: rowIndex < table.rows.length - 1 ? '1px solid var(--border-subtle)' : 'none' }}>
                        {row.map((cell, cellIndex) => (
                          <td
                            key={`${table.title}-${rowIndex}-${cellIndex}`}
                            data-label={tx(table.headers[cellIndex] ?? '')}
                            data-card-primary={cellIndex === 0 ? 'true' : undefined}
                            style={{ padding: '11px 14px', color: cellIndex === 0 ? 'var(--text-primary)' : 'var(--text-secondary)', fontSize: 13, fontWeight: cellIndex === 0 ? 750 : 500 }}
                          >
                            {tv(cell)}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Panel>
          ))}
        </div>

        <Panel>
          <PanelHeader title={tx(detail.timelineTitle ?? 'Activity')} subtitle={tx('Recent linked records')} />
          <div style={{ padding: 16, display: 'grid', gap: 12 }}>
            {detail.timeline?.length ? detail.timeline.map((item) => (
              <div key={item.id} style={{ borderLeft: `2px solid ${timelineColor(item.tone)}`, paddingLeft: 12 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10 }}>
                  <p style={{ color: 'var(--text-primary)', fontSize: 13, fontWeight: 800 }}>{tv(item.title)}</p>
                  {item.amount && <strong style={{ color: timelineColor(item.tone), fontSize: 13, whiteSpace: 'nowrap' }}>{item.amount}</strong>}
                </div>
                <p style={{ color: 'var(--text-muted)', fontSize: 11, marginTop: 2 }}>{tv(item.meta)}</p>
              </div>
            )) : (
              <p style={{ color: 'var(--text-muted)', fontSize: 13 }}>{tx('No linked activity yet.')}</p>
            )}
          </div>
        </Panel>
      </div>
    </div>
  );
}

function KeyValueGrid({ rows }: { rows: DetailRow[] }) {
  const language = useAppStore((state) => state.settings.language);
  const tx = (value: string) => uiText(language, value);
  return (
    <div style={{ padding: 16, display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12 }}>
      {rows.map((row) => (
        <div key={row.label} style={{ minWidth: 0 }}>
          <p style={{ color: 'var(--text-muted)', fontSize: 10, textTransform: 'uppercase', fontWeight: 800 }}>{tx(row.label)}</p>
          <p style={{ color: 'var(--text-primary)', fontSize: 13, fontWeight: 650, marginTop: 3, overflowWrap: 'anywhere' }}>{detailValue(language, row.value)}</p>
        </div>
      ))}
    </div>
  );
}

function DocumentPreview({ document }: { document: DetailDocument }) {
  const language = useAppStore((state) => state.settings.language);
  const tx = (value: string) => uiText(language, value);
  const [template, setTemplate] = useState<'a4' | 'thermal' | 'voucher'>('a4');
  const templateOptions = [
    { id: 'a4' as const, label: 'A4 bill' },
    { id: 'thermal' as const, label: 'Thermal receipt' },
    { id: 'voucher' as const, label: 'Ledger voucher' },
  ];

  const printDocument = () => {
    const popup = window.open('', '_blank', 'width=900,height=720');
    if (!popup) return;
    popup.document.write(makeDocumentHtml(document, template, language));
    popup.document.close();
    popup.focus();
    popup.print();
  };

  const downloadDocument = () => {
    const blob = new Blob([makeDocumentHtml(document, template, language)], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const anchor = window.document.createElement('a');
    anchor.href = url;
    anchor.download = `${document.documentNo || document.title}.html`.replace(/[\\/:*?"<>|]+/g, '-');
    anchor.click();
    URL.revokeObjectURL(url);
  };

  const paperWidth = template === 'thermal' ? 360 : 760;
  const compact = template === 'thermal';
  const activeTemplateLabel = templateOptions.find((item) => item.id === template)?.label ?? 'A4 bill';

  return (
    <Panel>
      <PanelHeader
        title={tx('Bill template')}
        subtitle={tx('Preview the record as a structured bill, receipt, or voucher.')}
        action={
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
            <button type="button" onClick={printDocument} style={documentActionStyle}>
              <Printer size={14} /> {tx('Print')}
            </button>
            <button type="button" onClick={downloadDocument} style={documentActionStyle}>
              <Download size={14} /> {tx('Download')}
            </button>
          </div>
        }
      />
      <div style={{ padding: 16, display: 'grid', gap: 14 }}>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {templateOptions.map((option) => (
            <button
              key={option.id}
              type="button"
              onClick={() => setTemplate(option.id)}
              style={{
                minHeight: 34,
                padding: '7px 11px',
                borderRadius: 8,
                border: option.id === template ? '1px solid var(--accent)' : '1px solid var(--border)',
                background: option.id === template ? 'var(--accent-glow)' : 'var(--bg-primary)',
                color: option.id === template ? 'var(--accent)' : 'var(--text-secondary)',
                fontSize: 12,
                fontWeight: 750,
                cursor: 'pointer',
              }}
            >
              {tx(option.label)}
            </button>
          ))}
        </div>

        <div style={{ overflowX: 'auto', paddingBottom: 2 }}>
          <ProfessionalDocumentPaper document={document} template={template} templateLabel={activeTemplateLabel} width={paperWidth} compact={compact} />
        </div>
      </div>
    </Panel>
  );
}

function ProfessionalDocumentPaper({
  document,
  template,
  templateLabel,
  width,
  compact,
}: {
  document: DetailDocument;
  template: 'a4' | 'thermal' | 'voucher';
  templateLabel: string;
  width: number;
  compact: boolean;
}) {
  const language = useAppStore((state) => state.settings.language);
  const tx = (value: string) => uiText(language, value);
  const displayDate = formatDocumentDate(document.date);
  const mark = documentInitials(document);
  const isVoucher = template === 'voucher';

  return (
    <div
      style={{
        width: '100%',
        maxWidth: width,
        minWidth: compact ? 320 : 620,
        margin: '0 auto',
        background: '#fbfcfe',
        color: '#111827',
        border: '1px solid #d8e0ea',
        borderRadius: 10,
        boxShadow: '0 22px 70px rgba(15, 23, 42, 0.18)',
        overflow: 'hidden',
        fontFamily: 'Arial, sans-serif',
      }}
    >
      <div style={{ height: 7, background: '#0f766e' }} />
      <div style={{ padding: compact ? 16 : 30 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 20, flexWrap: compact ? 'wrap' : 'nowrap', alignItems: 'flex-start' }}>
          <div style={{ display: 'flex', gap: compact ? 10 : 14, alignItems: 'flex-start', minWidth: 0 }}>
            <div
              style={{
                width: compact ? 38 : 48,
                height: compact ? 38 : 48,
                borderRadius: 12,
                background: '#0f766e',
                color: '#f8fafc',
                display: 'grid',
                placeItems: 'center',
                fontWeight: 900,
                fontSize: compact ? 14 : 16,
                letterSpacing: 0,
                flex: '0 0 auto',
              }}
            >
              {mark}
            </div>
            <div style={{ minWidth: 0 }}>
              <p style={{ color: '#64748b', fontSize: 10, fontWeight: 900, textTransform: 'uppercase', letterSpacing: 0 }}>{tx(templateLabel)}</p>
              <p style={{ fontSize: compact ? 19 : 28, fontWeight: 900, lineHeight: 1.08, color: '#0f172a', marginTop: 4 }}>{tx(document.title)}</p>
              <p style={{ fontSize: 12, color: '#475569', marginTop: 7, lineHeight: 1.45 }}>{tx(document.subtitle)}</p>
            </div>
          </div>
          <div
            style={{
              minWidth: compact ? '100%' : 225,
              border: '1px solid #d8e0ea',
              borderRadius: 10,
              overflow: 'hidden',
              fontSize: 12,
              color: '#334155',
            }}
          >
            {[
              ['Document No.', document.documentNo],
              ['Date', displayDate],
              ['Format', tx(templateLabel)],
            ].map(([label, value]) => (
              <div key={label} style={{ display: 'flex', justifyContent: 'space-between', gap: 12, padding: '9px 11px', borderBottom: label === 'Format' ? 'none' : '1px solid #e2e8f0' }}>
                <span style={{ color: '#64748b', fontWeight: 800 }}>{tx(label)}</span>
                <strong style={{ color: '#0f172a', textAlign: 'right', overflowWrap: 'anywhere' }}>{value}</strong>
              </div>
            ))}
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: compact ? '1fr' : '1fr 1fr', gap: 14, marginTop: compact ? 18 : 24 }}>
          <DocumentPartyBlock title="From" fields={document.from} />
          {document.to && <DocumentPartyBlock title="To" fields={document.to} />}
        </div>

        <div style={{ marginTop: compact ? 16 : 24, overflow: 'hidden', border: '1px solid #d8e0ea', borderRadius: 10 }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: compact ? 11 : 12 }}>
            <thead>
              <tr style={{ background: '#edf3f8' }}>
                {['Description', 'Qty', 'Rate', 'Amount'].map((header, index) => (
                  <th key={header} style={{ padding: compact ? 8 : 11, textAlign: index === 0 ? 'left' : 'right', color: '#334155', fontWeight: 900, borderBottom: '1px solid #d8e0ea' }}>{tx(header)}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {document.lines.map((line, index) => (
                <tr key={`${line.description}-${index}`} style={{ background: index % 2 ? '#f8fafc' : '#fbfcfe' }}>
                  <td style={{ padding: compact ? 9 : 12, color: '#0f172a', fontWeight: 800, borderTop: index ? '1px solid #e7edf4' : 'none' }}>{detailValue(language, line.description)}</td>
                  <td style={{ padding: compact ? 9 : 12, color: '#334155', textAlign: 'right', borderTop: index ? '1px solid #e7edf4' : 'none' }}>{detailValue(language, line.quantity)}</td>
                  <td style={{ padding: compact ? 9 : 12, color: '#334155', textAlign: 'right', borderTop: index ? '1px solid #e7edf4' : 'none' }}>{line.rate}</td>
                  <td style={{ padding: compact ? 9 : 12, color: '#0f172a', textAlign: 'right', fontWeight: 900, borderTop: index ? '1px solid #e7edf4' : 'none' }}>{line.amount}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: compact ? '1fr' : '1fr minmax(240px, 0.42fr)', gap: 18, marginTop: compact ? 16 : 22, alignItems: 'start' }}>
          <div style={{ color: '#475569', fontSize: 12, lineHeight: 1.55, borderTop: compact ? '1px solid #e2e8f0' : 'none', paddingTop: compact ? 12 : 0 }}>
            <p style={{ color: '#0f172a', fontWeight: 900, marginBottom: 5 }}>{tx(isVoucher ? 'Narration' : 'Notes')}</p>
            {(document.notes?.length ? document.notes : ['Thank you.']).map((note) => (
              <p key={note}>{detailValue(language, note)}</p>
            ))}
          </div>
          <div style={{ border: '1px solid #d8e0ea', borderRadius: 10, overflow: 'hidden', background: '#f8fafc' }}>
            {document.totals.map((total) => (
              <div
                key={total.label}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  gap: 12,
                  padding: total.strong ? '13px 14px' : '9px 14px',
                  borderTop: total.strong ? '1px solid #cbd5e1' : 'none',
                  color: total.strong ? '#0f172a' : '#334155',
                  background: total.strong ? '#e7f5f1' : 'transparent',
                  fontSize: total.strong ? 15 : 12,
                  fontWeight: total.strong ? 900 : 750,
                }}
              >
                <span>{tx(total.label)}</span>
                <span>{total.value}</span>
              </div>
            ))}
          </div>
        </div>

        {!compact && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginTop: 30, color: '#64748b', fontSize: 11 }}>
            <div style={{ borderTop: '1px solid #cbd5e1', paddingTop: 8 }}>{tx('Prepared by')}</div>
            <div style={{ borderTop: '1px solid #cbd5e1', paddingTop: 8, textAlign: 'right' }}>{tx(isVoucher ? 'Approved by' : 'Received by')}</div>
          </div>
        )}
      </div>
    </div>
  );
}

function DocumentPartyBlock({ title, fields }: { title: string; fields: DocumentField[] }) {
  const language = useAppStore((state) => state.settings.language);
  return (
    <div style={{ border: '1px solid #d8e0ea', borderRadius: 10, padding: 13, minHeight: 104, background: '#f8fafc' }}>
      <p style={{ color: '#0f766e', fontSize: 10, fontWeight: 900, textTransform: 'uppercase', marginBottom: 9 }}>{uiText(language, title)}</p>
      <div style={{ display: 'grid', gap: 5 }}>
        {fields.map((field) => (
          <p key={`${title}-${field.label}`} style={{ color: '#334155', fontSize: 12, lineHeight: 1.35 }}>
            <strong style={{ color: '#111827' }}>{uiText(language, field.label)}:</strong> {detailValue(language, field.value)}
          </p>
        ))}
      </div>
    </div>
  );
}

const documentActionStyle = {
  minHeight: 34,
  padding: '7px 10px',
  borderRadius: 8,
  border: '1px solid var(--border)',
  background: 'var(--bg-primary)',
  color: 'var(--text-secondary)',
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 7,
  fontSize: 12,
  fontWeight: 750,
  cursor: 'pointer',
} as const;

function primaryDocumentName(document: DetailDocument) {
  return document.from.find((field) => ['Business', 'Vendor', 'Supplier', 'Paid from', 'Account'].includes(field.label))?.value
    ?? document.to?.find((field) => ['Business', 'Customer', 'Supplier', 'Account'].includes(field.label))?.value
    ?? document.title;
}

function documentInitials(document: DetailDocument) {
  const words = primaryDocumentName(document).split(/\s+/).filter(Boolean);
  const initials = words.slice(0, 2).map((word) => word[0]?.toUpperCase()).join('');
  return initials || 'RP';
}

function formatDocumentDate(value: string) {
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (match) {
    const [, year, month, day] = match;
    return new Intl.DateTimeFormat('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }).format(
      new Date(Number(year), Number(month) - 1, Number(day)),
    );
  }
  return value;
}

function makeDocumentHtml(document: DetailDocument, template: 'a4' | 'thermal' | 'voucher', language: Parameters<typeof uiText>[0]) {
  const tt = (value: string) => String(detailValue(language, value));
  const compact = template === 'thermal';
  const isVoucher = template === 'voucher';
  const pageWidth = compact ? '80mm' : '210mm';
  const label = template === 'thermal' ? 'Thermal Receipt' : template === 'voucher' ? 'Ledger Voucher' : 'A4 Bill';
  const displayDate = formatDocumentDate(document.date);
  const mark = documentInitials(document);
  const from = renderHtmlFields(document.from, language);
  const to = document.to ? renderHtmlFields(document.to, language) : '';
  const lines = document.lines.map((line) => `
    <tr>
      <td>${escapeHtml(tt(line.description))}</td>
      <td class="right">${escapeHtml(tt(line.quantity))}</td>
      <td class="right">${escapeHtml(line.rate)}</td>
      <td class="right strong">${escapeHtml(line.amount)}</td>
    </tr>
  `).join('');
  const totals = document.totals.map((total) => `
    <div class="total ${total.strong ? 'grand' : ''}">
      <span>${escapeHtml(uiText(language, total.label))}</span>
      <strong>${escapeHtml(total.value)}</strong>
    </div>
  `).join('');
  const notes = (document.notes?.length ? document.notes : ['Thank you.']).map((note) => `<p>${escapeHtml(tt(note))}</p>`).join('');

  return `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${escapeHtml(uiText(language, document.title))} - ${escapeHtml(document.documentNo)}</title>
    <style>
      * { box-sizing: border-box; }
      @page { size: ${compact ? '80mm auto' : 'A4'}; margin: ${compact ? '4mm' : '12mm'}; }
      body {
        margin: 0;
        background: #e7ebf0;
        color: #0f172a;
        font-family: Arial, Helvetica, sans-serif;
        -webkit-print-color-adjust: exact;
        print-color-adjust: exact;
      }
      .page {
        width: ${pageWidth};
        max-width: calc(100% - 32px);
        margin: ${compact ? '18px auto' : '28px auto'};
        background: #fbfcfe;
        border: 1px solid #d8e0ea;
        box-shadow: ${compact ? 'none' : '0 24px 70px rgba(15, 23, 42, 0.18)'};
        overflow: hidden;
      }
      .top-rule { height: ${compact ? '5px' : '7px'}; background: #0f766e; }
      .inner { padding: ${compact ? '15px' : '32px'}; }
      .masthead {
        display: flex;
        justify-content: space-between;
        align-items: flex-start;
        gap: ${compact ? '12px' : '24px'};
        flex-wrap: ${compact ? 'wrap' : 'nowrap'};
      }
      .brand {
        display: flex;
        align-items: flex-start;
        gap: ${compact ? '10px' : '14px'};
        min-width: 0;
      }
      .mark {
        width: ${compact ? '38px' : '50px'};
        height: ${compact ? '38px' : '50px'};
        border-radius: 12px;
        background: #0f766e;
        color: #f8fafc;
        display: grid;
        place-items: center;
        font-weight: 900;
        font-size: ${compact ? '14px' : '16px'};
        flex: 0 0 auto;
      }
      .eyebrow {
        margin: 0;
        color: #64748b;
        font-size: 10px;
        font-weight: 900;
        text-transform: uppercase;
      }
      h1 {
        margin: 4px 0 0;
        font-size: ${compact ? '20px' : '30px'};
        line-height: 1.08;
        color: #0f172a;
      }
      .subtitle {
        margin: 7px 0 0;
        color: #475569;
        font-size: 12px;
        line-height: 1.45;
      }
      .doc-meta {
        min-width: ${compact ? '100%' : '230px'};
        border: 1px solid #d8e0ea;
        border-radius: 10px;
        overflow: hidden;
        font-size: 12px;
        color: #334155;
      }
      .doc-meta-row {
        display: flex;
        justify-content: space-between;
        gap: 12px;
        padding: 9px 11px;
        border-bottom: 1px solid #e2e8f0;
      }
      .doc-meta-row:last-child { border-bottom: 0; }
      .doc-meta-row span { color: #64748b; font-weight: 800; }
      .doc-meta-row strong { color: #0f172a; text-align: right; overflow-wrap: anywhere; }
      .parties {
        display: grid;
        grid-template-columns: ${compact ? '1fr' : '1fr 1fr'};
        gap: 14px;
        margin-top: ${compact ? '18px' : '24px'};
      }
      .box {
        border: 1px solid #d8e0ea;
        border-radius: 10px;
        padding: 13px;
        background: #f8fafc;
        min-height: ${compact ? 'auto' : '104px'};
      }
      .box-title {
        margin: 0 0 9px;
        color: #0f766e;
        font-size: 10px;
        text-transform: uppercase;
        font-weight: 900;
      }
      .field {
        display: grid;
        grid-template-columns: ${compact ? '1fr' : '94px 1fr'};
        gap: ${compact ? '2px' : '10px'};
        margin-bottom: 6px;
        color: #334155;
        font-size: 12px;
        line-height: 1.35;
      }
      .field-label { color: #64748b; font-weight: 800; }
      .field-value { color: #0f172a; font-weight: 700; overflow-wrap: anywhere; }
      .items {
        margin-top: ${compact ? '16px' : '24px'};
        border: 1px solid #d8e0ea;
        border-radius: 10px;
        overflow: hidden;
      }
      table { width: 100%; border-collapse: collapse; font-size: ${compact ? '11px' : '12px'}; }
      th {
        background: #edf3f8;
        color: #334155;
        text-align: left;
        padding: ${compact ? '8px' : '11px'};
        border-bottom: 1px solid #d8e0ea;
        font-weight: 900;
      }
      td {
        padding: ${compact ? '9px 8px' : '12px 11px'};
        border-top: 1px solid #e7edf4;
        color: #334155;
      }
      tbody tr:first-child td { border-top: 0; }
      tbody tr:nth-child(even) { background: #f8fafc; }
      td:first-child { color: #0f172a; font-weight: 800; }
      .right { text-align: right; }
      .strong { font-weight: 900; color: #0f172a; }
      .settlement {
        display: grid;
        grid-template-columns: ${compact ? '1fr' : '1fr minmax(240px, 0.42fr)'};
        gap: 18px;
        margin-top: ${compact ? '16px' : '22px'};
        align-items: start;
      }
      .notes {
        color: #475569;
        font-size: 12px;
        line-height: 1.55;
        ${compact ? 'border-top: 1px solid #e2e8f0; padding-top: 12px;' : ''}
      }
      .notes-title {
        margin: 0 0 5px;
        color: #0f172a;
        font-weight: 900;
      }
      .notes p { margin: 0 0 5px; }
      .totals {
        border: 1px solid #d8e0ea;
        border-radius: 10px;
        overflow: hidden;
        background: #f8fafc;
      }
      .total {
        display: flex;
        justify-content: space-between;
        gap: 12px;
        color: #334155;
        font-size: 12px;
        font-weight: 750;
        padding: 9px 14px;
      }
      .grand {
        border-top: 1px solid #cbd5e1;
        padding: 13px 14px;
        background: #e7f5f1;
        color: #0f172a;
        font-size: 15px;
        font-weight: 900;
      }
      .signatures {
        display: ${compact ? 'none' : 'grid'};
        grid-template-columns: 1fr 1fr;
        gap: 24px;
        margin-top: 34px;
        color: #64748b;
        font-size: 11px;
      }
      .signature {
        border-top: 1px solid #cbd5e1;
        padding-top: 8px;
      }
      .signature:last-child { text-align: right; }
      @media (max-width: 720px) {
        .page { max-width: calc(100% - 18px); }
        .masthead { flex-wrap: wrap; }
        .doc-meta { min-width: 100%; }
        .parties, .settlement { grid-template-columns: 1fr; }
      }
      @media print {
        body { background: #fbfcfe; }
        .page { width: 100%; max-width: 100%; margin: 0; box-shadow: none; border: 0; }
      }
    </style>
  </head>
  <body>
    <main class="page">
      <div class="top-rule"></div>
      <div class="inner">
        <section class="masthead">
          <div class="brand">
            <div class="mark">${escapeHtml(mark)}</div>
            <div>
              <p class="eyebrow">${escapeHtml(uiText(language, label))}</p>
              <h1>${escapeHtml(uiText(language, document.title))}</h1>
              <p class="subtitle">${escapeHtml(uiText(language, document.subtitle))}</p>
            </div>
          </div>
          <div class="doc-meta">
            <div class="doc-meta-row"><span>${escapeHtml(uiText(language, 'Document No.'))}</span><strong>${escapeHtml(document.documentNo)}</strong></div>
            <div class="doc-meta-row"><span>${escapeHtml(uiText(language, 'Date'))}</span><strong>${escapeHtml(displayDate)}</strong></div>
            <div class="doc-meta-row"><span>${escapeHtml(uiText(language, 'Format'))}</span><strong>${escapeHtml(uiText(language, label))}</strong></div>
          </div>
        </section>
        <section class="parties">
          <div class="box"><p class="box-title">${escapeHtml(uiText(language, 'From'))}</p>${from}</div>
          ${to ? `<div class="box"><p class="box-title">${escapeHtml(uiText(language, 'To'))}</p>${to}</div>` : ''}
        </section>
        <section class="items">
          <table>
            <thead><tr><th>${escapeHtml(uiText(language, 'Description'))}</th><th class="right">${escapeHtml(uiText(language, 'Qty'))}</th><th class="right">${escapeHtml(uiText(language, 'Rate'))}</th><th class="right">${escapeHtml(uiText(language, 'Amount'))}</th></tr></thead>
            <tbody>${lines}</tbody>
          </table>
        </section>
        <section class="settlement">
          <div class="notes">
            <p class="notes-title">${escapeHtml(uiText(language, isVoucher ? 'Narration' : 'Notes'))}</p>
            ${notes}
          </div>
          <div class="totals">${totals}</div>
        </section>
        <section class="signatures">
          <div class="signature">${escapeHtml(uiText(language, 'Prepared by'))}</div>
          <div class="signature">${escapeHtml(uiText(language, isVoucher ? 'Approved by' : 'Received by'))}</div>
        </section>
      </div>
    </main>
  </body>
</html>`;
}

function renderHtmlFields(fields: DocumentField[], language: Parameters<typeof uiText>[0]) {
  const tt = (value: string) => String(detailValue(language, value));
  return fields.map((field) => `
    <div class="field">
      <span class="field-label">${escapeHtml(uiText(language, field.label))}</span>
      <span class="field-value">${escapeHtml(tt(field.value))}</span>
    </div>
  `).join('');
}

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (char) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  }[char] ?? char));
}

function buildDetailModel(state: ReturnType<typeof useAppStore.getState>, entity: string, id: string): DetailModel | null {
  const business = businessProfile(state);

  if (entity === 'sales') {
    const sale = state.sales.find((item) => item.id === id || item.invoiceNo === id);
    if (!sale) return null;
    const customer = state.customers.find((item) => item.id === sale.customerId);
    const journals = state.journalEntries.filter((entry) => entry.source === 'Sale' && entry.sourceId === sale.id);
    const credit = state.creditLedger.filter((entry) => entry.saleId === sale.id);
    const saleSubtotal = sale.items.length ? sale.items.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0) : sale.amount - (sale.vatAmount ?? sale.taxTotal ?? 0);
    const saleDiscount = sale.items.reduce((sum, item) => sum + item.discount, 0);
    const saleVat = sale.vatAmount ?? sale.taxTotal ?? sale.items.reduce((sum, item) => sum + item.tax, 0);
    const saleLines = sale.items.length ? sale.items.map((item) => ({
      description: item.productName,
      quantity: `${item.quantity} ${item.unit ?? ''}`.trim(),
      rate: formatCurrency(item.unitPrice),
      amount: formatCurrency(item.lineTotal ?? item.quantity * item.unitPrice - item.discount + item.tax),
    })) : [{
      description: sale.products,
      quantity: '1',
      rate: formatCurrency(sale.amount),
      amount: formatCurrency(sale.amount),
    }];
    return {
      title: sale.invoiceNo ?? sale.id,
      subtitle: `${sale.customer} · ${sale.date}`,
      badge: { label: sale.status, tone: sale.status === 'Completed' ? 'success' : sale.status === 'Pending' ? 'warning' : 'danger' },
      backHref: '/sales',
      backLabel: 'Back to Sales',
      icon: <ShoppingCart size={20} />,
      stats: [
        { label: 'Sale amount', value: formatCurrency(sale.amount), tone: 'accent' },
        { label: 'VAT', value: formatCurrency(sale.vatAmount ?? sale.taxTotal ?? 0) },
        { label: 'Payment', value: sale.payment, tone: sale.payment === 'Credit' ? 'warning' : 'success' },
        { label: 'Line items', value: sale.items.length || 1 },
      ],
      sections: [
        {
          title: 'Sale details',
          rows: [
            { label: 'Customer', value: sale.customer },
            { label: 'Customer phone', value: customer?.phone || 'Not added' },
            { label: 'Buyer PAN', value: sale.buyerPan || customer?.taxId || 'Not added' },
            { label: 'Invoice type', value: sale.invoiceType ?? 'Normal Bill' },
            { label: 'Created by', value: sale.createdBy },
            { label: 'Notes', value: sale.notes || 'No notes' },
          ],
        },
      ],
      document: {
        title: sale.invoiceType ?? 'Sales bill',
        subtitle: 'Customer sale document',
        documentNo: sale.invoiceNo ?? sale.id,
        date: sale.date,
        from: business,
        to: [
          { label: 'Customer', value: sale.customer },
          { label: 'Phone', value: customer?.phone || 'Not added' },
          { label: 'PAN / VAT', value: sale.buyerPan || customer?.taxId || 'Not added' },
          { label: 'Address', value: customer?.address || 'Not added' },
        ],
        lines: saleLines,
        totals: [
          { label: 'Subtotal', value: formatCurrency(saleSubtotal) },
          { label: 'Discount', value: formatCurrency(saleDiscount) },
          { label: 'VAT', value: formatCurrency(saleVat) },
          { label: 'Grand total', value: formatCurrency(sale.amount), strong: true },
        ],
        notes: [sale.notes, state.settings.receiptFooter].filter((note): note is string => Boolean(note)),
      },
      tables: [{
        title: 'Sold items',
        headers: ['Item', 'Qty', 'Rate', 'Discount', 'VAT', 'Total'],
        rows: sale.items.length ? sale.items.map((item) => [
          item.productName,
          `${item.quantity} ${item.unit ?? ''}`,
          formatCurrency(item.unitPrice),
          formatCurrency(item.discount),
          formatCurrency(item.tax),
          formatCurrency(item.lineTotal ?? item.quantity * item.unitPrice - item.discount + item.tax),
        ]) : [[sale.products, '1', formatCurrency(sale.amount), formatCurrency(0), formatCurrency(sale.vatAmount ?? 0), formatCurrency(sale.amount)]],
      }],
      timelineTitle: 'Sale activity',
      timeline: [
        ...credit.map((entry) => ({ id: entry.id, title: entry.type, meta: `${entry.date} · ${entry.note}`, amount: formatCurrency(entry.amount), tone: entry.type === 'Payment Received' ? 'success' as Tone : 'warning' as Tone })),
        ...journals.map((entry) => ({ id: entry.id, title: entry.memo, meta: `${entry.date} · Journal locked: ${entry.locked ? 'Yes' : 'No'}`, amount: formatCurrency(entry.lines.reduce((sum, line) => sum + line.debit, 0)), tone: 'info' as Tone })),
        ...state.documents.filter((doc) => doc.recordType === 'Sale' && doc.recordId === sale.id).map((doc) => ({ id: doc.id, title: doc.name, meta: `${doc.fileName} · ${Math.round(doc.size / 1024)} KB`, tone: 'neutral' as Tone })),
      ],
    };
  }

  if (entity === 'purchases') {
    const purchase = state.purchases.find((item) => item.id === id || item.billNo === id);
    if (!purchase) return null;
    const supplier = state.suppliers.find((item) => item.id === purchase.supplierId);
    const purchaseSubtotal = purchase.items.reduce((sum, item) => sum + item.quantity * item.unitCost, 0);
    const purchaseDiscount = purchase.items.reduce((sum, item) => sum + item.discount, 0);
    const purchaseLines = purchase.items.length ? purchase.items.map((item) => ({
      description: item.productName,
      quantity: `${item.quantity} ${item.unit}`.trim(),
      rate: formatCurrency(item.unitCost),
      amount: formatCurrency(item.lineTotal),
    })) : [{
      description: 'Supplier bill',
      quantity: '1',
      rate: formatCurrency(purchase.amount),
      amount: formatCurrency(purchase.amount),
    }];
    return {
      title: purchase.billNo,
      subtitle: `${purchase.supplierName} · ${purchase.date}`,
      badge: { label: purchase.status, tone: purchase.status === 'Received' ? 'success' : purchase.status === 'Pending' ? 'warning' : 'danger' },
      backHref: '/purchases',
      backLabel: 'Back to Purchases',
      icon: <ReceiptText size={20} />,
      stats: [
        { label: 'Bill total', value: formatCurrency(purchase.amount), tone: 'accent' },
        { label: 'Supplier payable', value: formatCurrency(supplier?.payableBalance ?? 0), tone: (supplier?.payableBalance ?? 0) > 0 ? 'warning' : 'success' },
        { label: 'VAT', value: formatCurrency(purchase.taxTotal) },
        { label: 'Payment', value: purchase.payment, tone: purchase.payment === 'Credit' ? 'warning' : 'success' },
      ],
      sections: [{
        title: 'Purchase details',
        rows: [
          { label: 'Supplier', value: purchase.supplierName },
          { label: 'Supplier phone', value: supplier?.phone || 'Not added' },
          { label: 'PAN / VAT', value: supplier?.pan || 'Not added' },
          { label: 'Due date', value: purchase.dueDate || 'No due date' },
          { label: 'Created by', value: purchase.createdBy },
          { label: 'Notes', value: purchase.notes || 'No notes' },
        ],
      }],
      document: {
        title: 'Purchase bill',
        subtitle: 'Supplier purchase document',
        documentNo: purchase.billNo,
        date: purchase.date,
        from: [
          { label: 'Supplier', value: purchase.supplierName },
          { label: 'Phone', value: supplier?.phone || 'Not added' },
          { label: 'PAN / VAT', value: supplier?.pan || 'Not added' },
          { label: 'Address', value: supplier?.address || 'Not added' },
        ],
        to: business,
        lines: purchaseLines,
        totals: [
          { label: 'Subtotal', value: formatCurrency(purchaseSubtotal || purchase.amount - purchase.taxTotal) },
          { label: 'Discount', value: formatCurrency(purchaseDiscount) },
          { label: 'VAT', value: formatCurrency(purchase.taxTotal) },
          { label: 'Grand total', value: formatCurrency(purchase.amount), strong: true },
        ],
        notes: [purchase.notes || `Payment: ${purchase.payment}`],
      },
      tables: [{
        title: 'Purchased items',
        headers: ['Item', 'Qty', 'Unit cost', 'Discount', 'VAT', 'Total'],
        rows: purchase.items.map((item) => [
          item.productName,
          `${item.quantity} ${item.unit}`,
          formatCurrency(item.unitCost),
          formatCurrency(item.discount),
          formatCurrency(item.tax),
          formatCurrency(item.lineTotal),
        ]),
      }],
      timelineTitle: 'Linked activity',
      timeline: [
        ...state.inventoryMovements.filter((entry) => entry.referenceId === purchase.id).map((entry) => ({ id: entry.id, title: entry.reason, meta: `${entry.productName} · ${entry.createdAt}`, amount: entry.delta > 0 ? `+${entry.delta}` : entry.delta, tone: entry.delta >= 0 ? 'success' as Tone : 'danger' as Tone })),
        ...state.journalEntries.filter((entry) => entry.source === 'Purchase' && entry.sourceId === purchase.id).map((entry) => ({ id: entry.id, title: entry.memo, meta: `${entry.date} · Journal`, amount: formatCurrency(entry.lines.reduce((sum, line) => sum + line.debit, 0)), tone: 'info' as Tone })),
        ...state.documents.filter((doc) => doc.recordType === 'Purchase' && doc.recordId === purchase.id).map((doc) => ({ id: doc.id, title: doc.name, meta: `${doc.fileName} · ${Math.round(doc.size / 1024)} KB`, tone: 'neutral' as Tone })),
      ],
    };
  }

  if (entity === 'expenses') {
    const expense = state.expenses.find((item) => item.id === id);
    if (!expense) return null;
    const account = state.cashBankAccounts.find((item) => item.id === expense.paymentAccountId);
    return {
      title: expense.category,
      subtitle: `${expense.vendor || 'No vendor'} · ${expense.date}`,
      badge: { label: expense.recurring ? 'Recurring' : 'One time', tone: expense.recurring ? 'info' : 'neutral' },
      backHref: '/expenses',
      backLabel: 'Back to Expenses',
      icon: <CreditCard size={20} />,
      stats: [
        { label: 'Expense amount', value: formatCurrency(expense.amount), tone: 'warning' },
        { label: 'VAT', value: formatCurrency(expense.taxAmount) },
        { label: 'Paid from', value: account?.name ?? 'Unknown account' },
        { label: 'Payment', value: expense.paymentMethod },
      ],
      sections: [{
        title: 'Expense details',
        rows: [
          { label: 'Category', value: expense.category },
          { label: 'Vendor', value: expense.vendor || 'No vendor' },
          { label: 'Payment account', value: account?.name ?? expense.paymentAccountId },
          { label: 'Created by', value: expense.createdBy },
          { label: 'Created at', value: expense.createdAt },
          { label: 'Note', value: expense.note || 'No note' },
        ],
      }],
      document: {
        title: 'Expense voucher',
        subtitle: 'Cash or bank payment document',
        documentNo: expense.id,
        date: expense.date,
        from: [
          { label: 'Paid from', value: account?.name ?? expense.paymentAccountId },
          { label: 'Method', value: expense.paymentMethod },
          { label: 'Prepared by', value: expense.createdBy },
        ],
        to: [
          { label: 'Vendor', value: expense.vendor || 'No vendor' },
          { label: 'Category', value: expense.category },
          { label: 'Recurring', value: expense.recurring ? 'Yes' : 'No' },
        ],
        lines: [{
          description: expense.note || expense.category,
          quantity: '1',
          rate: formatCurrency(expense.amount - expense.taxAmount),
          amount: formatCurrency(expense.amount),
        }],
        totals: [
          { label: 'Taxable amount', value: formatCurrency(expense.amount - expense.taxAmount) },
          { label: 'VAT', value: formatCurrency(expense.taxAmount) },
          { label: 'Grand total', value: formatCurrency(expense.amount), strong: true },
        ],
        notes: [expense.note || 'Expense recorded.'],
      },
      timelineTitle: 'Linked activity',
      timeline: [
        ...state.journalEntries.filter((entry) => entry.source === 'Expense' && entry.sourceId === expense.id).map((entry) => ({ id: entry.id, title: entry.memo, meta: `${entry.date} · Journal`, amount: formatCurrency(entry.lines.reduce((sum, line) => sum + line.debit, 0)), tone: 'info' as Tone })),
        ...state.documents.filter((doc) => doc.recordType === 'Expense' && doc.recordId === expense.id).map((doc) => ({ id: doc.id, title: doc.name, meta: `${doc.fileName} · ${Math.round(doc.size / 1024)} KB`, tone: 'neutral' as Tone })),
      ],
    };
  }

  if (entity === 'cash-bank') {
    const account = state.cashBankAccounts.find((item) => item.id === id);
    if (!account) return null;
    const movements = state.moneyMovements.filter((movement) => movement.accountId === account.id);
    const moneyIn = movements.filter((movement) => movement.type === 'Receipt' || movement.type === 'Deposit').reduce((sum, movement) => sum + movement.amount, 0);
    const moneyOut = movements.filter((movement) => movement.type === 'Payment' || movement.type === 'Withdrawal').reduce((sum, movement) => sum + movement.amount, 0);
    return {
      title: account.name,
      subtitle: `${account.type} account - ${account.active === false ? 'Paused' : 'Active'}`,
      badge: { label: account.active === false ? 'Paused' : 'Active', tone: account.active === false ? 'warning' : 'success' },
      backHref: '/cash-bank',
      backLabel: 'Back to Cash & Bank',
      icon: <WalletCards size={20} />,
      stats: [
        { label: 'Current balance', value: formatCurrency(account.balance), tone: account.balance > 0 ? 'success' : 'neutral' },
        { label: 'Opening balance', value: formatCurrency(account.openingBalance) },
        { label: 'Money in', value: formatCurrency(moneyIn), tone: 'success' },
        { label: 'Money out', value: formatCurrency(moneyOut), tone: moneyOut ? 'warning' : 'neutral' },
      ],
      sections: [{
        title: 'Account profile',
        rows: [
          { label: 'Type', value: account.type },
          { label: 'Institution', value: account.institution || 'Not added' },
          { label: 'Account number', value: account.accountNumber || 'Not added' },
          { label: 'Created at', value: account.createdAt },
          { label: 'Updated at', value: account.updatedAt || 'No update yet' },
          { label: 'Status', value: account.active === false ? 'Paused' : 'Active' },
        ],
      }],
      tables: [{
        title: 'Movement ledger',
        headers: ['Movement', 'Date', 'Note', 'Amount'],
        rows: movements.map((movement) => [
          movement.type,
          movement.date,
          movement.note || 'No note',
          formatCurrency(movement.amount),
        ]),
      }],
      timelineTitle: 'Recent movement',
      timeline: movements.map((movement) => ({
        id: movement.id,
        title: movement.type,
        meta: `${movement.date} - ${movement.note || movement.createdBy}`,
        amount: formatCurrency(movement.amount),
        tone: movement.type === 'Receipt' || movement.type === 'Deposit' ? 'success' : movement.type === 'Payment' || movement.type === 'Withdrawal' ? 'warning' : 'neutral',
      })),
    };
  }

  if (entity === 'money-movements') {
    const movement = state.moneyMovements.find((item) => item.id === id);
    if (!movement) return null;
    const account = state.cashBankAccounts.find((item) => item.id === movement.accountId);
    const isMoneyIn = movement.type === 'Receipt' || movement.type === 'Deposit';
    const isMoneyOut = movement.type === 'Payment' || movement.type === 'Withdrawal';
    return {
      title: `${movement.type} voucher`,
      subtitle: `${movement.accountName} - ${movement.date}`,
      badge: { label: movement.type, tone: isMoneyIn ? 'success' : isMoneyOut ? 'warning' : 'neutral' },
      backHref: '/cash-bank',
      backLabel: 'Back to Cash & Bank',
      icon: <WalletCards size={20} />,
      stats: [
        { label: 'Amount', value: formatCurrency(movement.amount), tone: isMoneyIn ? 'success' : isMoneyOut ? 'warning' : 'accent' },
        { label: 'Account', value: movement.accountName },
        { label: 'Movement', value: movement.type },
        { label: 'Recorded by', value: movement.createdBy },
      ],
      sections: [{
        title: 'Movement details',
        rows: [
          { label: 'Account', value: movement.accountName },
          { label: 'Account type', value: account?.type || 'Not found' },
          { label: 'Party', value: movement.partyName || 'Not linked' },
          { label: 'Reference', value: movement.referenceId || 'No reference' },
          { label: 'Created at', value: movement.createdAt },
          { label: 'Note', value: movement.note || 'No note' },
        ],
      }],
      document: {
        title: `${movement.type} voucher`,
        subtitle: 'Cash and bank movement document',
        documentNo: movement.id,
        date: movement.date,
        from: business,
        to: [
          { label: 'Account', value: movement.accountName },
          { label: 'Account type', value: account?.type || 'Unknown' },
          { label: 'Party', value: movement.partyName || 'Not linked' },
        ],
        lines: [{
          description: movement.note || movement.type,
          quantity: '1',
          rate: formatCurrency(movement.amount),
          amount: formatCurrency(movement.amount),
        }],
        totals: [
          { label: 'Amount', value: formatCurrency(movement.amount), strong: true },
        ],
        notes: [movement.note || `Recorded by ${movement.createdBy}`],
      },
      timelineTitle: 'Voucher trail',
      timeline: [
        { id: movement.id, title: movement.type, meta: `${movement.createdAt} - ${movement.createdBy}`, amount: formatCurrency(movement.amount), tone: isMoneyIn ? 'success' : isMoneyOut ? 'warning' : 'accent' },
      ],
    };
  }

  if (entity === 'parties') {
    const party = state.parties.find((item) => item.id === id);
    if (!party) return null;
    const ledger = state.partyLedger.filter((entry) => entry.partyId === party.id);
    return {
      title: party.name,
      subtitle: `${party.type} · ${party.phone || 'No phone'}`,
      badge: { label: party.type, tone: party.type === 'Supplier' ? 'info' : 'accent' },
      backHref: '/parties',
      backLabel: 'Back to Parties',
      icon: <Building2 size={20} />,
      stats: [
        { label: 'Current balance', value: formatCurrency(party.balance), tone: party.balance ? 'warning' : 'success' },
        { label: 'Opening balance', value: formatCurrency(party.openingBalance) },
        { label: 'Credit limit', value: formatCurrency(party.creditLimit) },
        { label: 'Due days', value: party.dueDays },
      ],
      sections: [{
        title: 'Party profile',
        rows: [
          { label: 'Phone', value: party.phone || 'Not added' },
          { label: 'Email', value: party.email || 'Not added' },
          { label: 'Address', value: party.address || 'Not added' },
          { label: 'PAN / VAT', value: party.pan || 'Not added' },
          { label: 'Created at', value: party.createdAt },
          { label: 'Notes', value: party.notes || 'No notes' },
        ],
      }],
      timelineTitle: 'Ledger timeline',
      timeline: ledger.map((entry) => ({
        id: entry.id,
        title: entry.type,
        meta: `${entry.date} · ${entry.note}`,
        amount: formatCurrency(entry.amount),
        tone: entry.type.includes('Payment') ? 'success' : 'warning',
      })),
    };
  }

  if (entity === 'customers') {
    const customer = state.customers.find((item) => item.id === id);
    if (!customer) return null;
    const sales = state.sales.filter((sale) => !sale.deletedAt && sale.customerId === customer.id);
    const ledger = state.creditLedger.filter((entry) => entry.customerId === customer.id);
    return {
      title: customer.name,
      subtitle: `${customer.segment} · ${customer.phone || customer.email || 'No contact'}`,
      badge: { label: customer.segment, tone: customer.segment === 'VIP' ? 'warning' : customer.segment === 'At-Risk' ? 'danger' : 'info' },
      backHref: '/customers',
      backLabel: 'Back to Customers',
      icon: <Users size={20} />,
      stats: [
        { label: 'Lifetime value', value: formatCurrency(customer.totalSpent), tone: 'accent' },
        { label: 'Orders', value: customer.orders },
        { label: 'Credit due', value: formatCurrency(customer.balance ?? 0), tone: (customer.balance ?? 0) > 0 ? 'warning' : 'success' },
        { label: 'Last order', value: customer.lastOrder || 'No orders' },
      ],
      sections: [{
        title: 'Customer profile',
        rows: [
          { label: 'Email', value: customer.email || 'Not added' },
          { label: 'Phone', value: customer.phone || 'Not added' },
          { label: 'Address', value: customer.address || 'Not added' },
          { label: 'Tax ID', value: customer.taxId || 'Not added' },
          { label: 'Tags', value: customer.tags.join(', ') || 'No tags' },
          { label: 'Notes', value: customer.notes || 'No notes' },
        ],
      }],
      timelineTitle: 'Customer timeline',
      timeline: [
        ...ledger.map((entry) => ({ id: entry.id, title: entry.type, meta: `${entry.date} · ${entry.note}`, amount: formatCurrency(entry.amount), tone: entry.type === 'Payment Received' ? 'success' as Tone : 'warning' as Tone })),
        ...sales.map((sale) => ({ id: sale.id, title: sale.invoiceNo ?? sale.id, meta: `${sale.date} · ${sale.products}`, amount: formatCurrency(sale.amount), tone: 'accent' as Tone })),
      ],
    };
  }

  if (entity === 'inventory') {
    const product = state.inventory.find((item) => item.id === id || item.sku === id);
    if (!product) return null;
    const status = getStockStatus(product.stock, product.reorderLevel);
    const movements = state.inventoryMovements.filter((entry) => entry.productId === product.id);
    const margin = product.price ? ((product.price - product.costPrice) / product.price) * 100 : 0;
    return {
      title: product.name,
      subtitle: `${product.sku} · ${product.category}`,
      badge: { label: status, tone: status === 'In Stock' ? 'success' : status === 'Low Stock' ? 'warning' : 'danger' },
      backHref: '/inventory',
      backLabel: 'Back to Inventory',
      icon: <Package size={20} />,
      stats: [
        { label: 'On hand', value: `${product.stock} ${product.unit ?? 'pcs'}`, tone: status === 'In Stock' ? 'success' : 'warning' },
        { label: 'Retail value', value: formatCurrency(product.stock * product.price), tone: 'accent' },
        { label: 'Cost value', value: formatCurrency(product.stock * product.costPrice) },
        { label: 'Margin', value: `${margin.toFixed(1)}%`, tone: margin > 35 ? 'success' : 'warning' },
      ],
      sections: [{
        title: 'Product details',
        rows: [
          { label: 'Supplier', value: product.supplier || 'Not added' },
          { label: 'Barcode', value: product.barcode || 'Not added' },
          { label: 'Location', value: product.location || 'Not added' },
          { label: 'Reorder level', value: `${product.reorderLevel} ${product.unit ?? 'pcs'}` },
          { label: 'Tax rate', value: `${product.taxRate ?? 0}%` },
          { label: 'Description', value: product.description || 'No description' },
        ],
      }],
      timelineTitle: 'Stock movement',
      timeline: movements.map((entry) => ({
        id: entry.id,
        title: entry.reason,
        meta: `${entry.createdAt} · ${entry.note || entry.user}`,
        amount: entry.delta >= 0 ? `+${entry.delta}` : entry.delta,
        tone: entry.delta >= 0 ? 'success' : 'danger',
      })),
    };
  }

  if (entity === 'bill-scans') {
    const scan = state.billScans.find((item) => item.id === id);
    if (!scan) return null;
    const data = scan.approved || scan.parsed || {};
    const scanLines = (data.items ?? []).length ? (data.items ?? []).map((item) => ({
      description: item.name,
      quantity: `${item.quantity} ${item.unit}`.trim(),
      rate: formatCurrency(item.unitPrice),
      amount: formatCurrency(item.lineTotal),
    })) : [{
      description: data.vendorName || scan.fileName,
      quantity: '1',
      rate: formatCurrency(Number(data.totalAmount ?? 0)),
      amount: formatCurrency(Number(data.totalAmount ?? 0)),
    }];
    return {
      title: data.vendorName || scan.fileName,
      subtitle: `${scan.fileName} · ${scan.createdAt}`,
      badge: { label: scan.status, tone: scan.status === 'Approved' ? 'success' : scan.status === 'Needs Review' ? 'warning' : 'info' },
      backHref: '/scan-bill',
      backLabel: 'Back to Scan Bill',
      icon: <FileText size={20} />,
      stats: [
        { label: 'Detected total', value: formatCurrency(Number(data.totalAmount ?? 0)), tone: 'accent' },
        { label: 'Confidence', value: `${Math.round((scan.confidence ?? 0) * 100)}%`, tone: scan.confidence < 0.8 ? 'warning' : 'success' },
        { label: 'Target record', value: scan.targetRecordType || 'Not committed' },
        { label: 'Source', value: scan.sourceType },
      ],
      sections: [{
        title: 'Scan details',
        rows: [
          { label: 'Bill number', value: data.billNumber || 'Not detected' },
          { label: 'Bill date', value: data.billDate || 'Not detected' },
          { label: 'Payment method', value: data.paymentMethod || 'Not detected' },
          { label: 'Subtotal', value: formatCurrency(Number(data.subtotal ?? 0)) },
          { label: 'Discount', value: formatCurrency(Number(data.discountAmount ?? 0)) },
          { label: 'VAT', value: formatCurrency(Number(data.vatAmount ?? 0)) },
        ],
      }],
      document: {
        title: 'Scanned bill draft',
        subtitle: 'OCR extracted bill template',
        documentNo: data.billNumber || scan.id,
        date: data.billDate || scan.createdAt,
        from: [
          { label: 'Vendor', value: data.vendorName || 'Not detected' },
          { label: 'Source file', value: scan.fileName },
          { label: 'Confidence', value: `${Math.round((scan.confidence ?? 0) * 100)}%` },
        ],
        to: business,
        lines: scanLines,
        totals: [
          { label: 'Subtotal', value: formatCurrency(Number(data.subtotal ?? 0)) },
          { label: 'Discount', value: formatCurrency(Number(data.discountAmount ?? 0)) },
          { label: 'VAT', value: formatCurrency(Number(data.vatAmount ?? 0)) },
          { label: 'Grand total', value: formatCurrency(Number(data.totalAmount ?? 0)), strong: true },
        ],
        notes: ['Review extracted values before posting to accounts.'],
      },
      tables: [{
        title: 'Extracted items',
        headers: ['Item', 'Qty', 'Rate', 'Discount', 'VAT', 'Total'],
        rows: (data.items ?? []).map((item) => [
          item.name,
          `${item.quantity} ${item.unit}`,
          formatCurrency(item.unitPrice),
          formatCurrency(item.discount),
          formatCurrency(item.tax),
          formatCurrency(item.lineTotal),
        ]),
      }],
      timelineTitle: 'Scan activity',
      timeline: [
        { id: scan.id, title: scan.status, meta: `${scan.createdAt} · ${scan.createdBy}`, amount: `${Math.round((scan.confidence ?? 0) * 100)}%`, tone: scan.status === 'Approved' ? 'success' : 'info' },
      ],
    };
  }

  if (entity === 'documents') {
    const document = state.documents.find((item) => item.id === id);
    if (!document) return null;
    return {
      title: document.name,
      subtitle: `${document.fileName} · ${Math.round(document.size / 1024)} KB`,
      badge: { label: document.recordType, tone: 'info' },
      backHref: '/documents',
      backLabel: 'Back to Documents',
      icon: <FileText size={20} />,
      stats: [
        { label: 'File size', value: `${Math.round(document.size / 1024)} KB` },
        { label: 'Record type', value: document.recordType },
        { label: 'Uploaded by', value: document.uploadedBy },
        { label: 'Created at', value: document.createdAt },
      ],
      sections: [{
        title: 'Document details',
        rows: [
          { label: 'File name', value: document.fileName },
          { label: 'MIME type', value: document.mimeType },
          { label: 'Linked record', value: document.recordId || 'No link' },
          { label: 'Download', value: document.dataUrl ? <a href={document.dataUrl} download={document.fileName} style={{ color: 'var(--accent)' }}>Download file</a> : 'No file data' },
        ],
      }],
    };
  }

  return null;
}

function businessProfile(state: ReturnType<typeof useAppStore.getState>): DocumentField[] {
  const activeBusiness = state.businesses.find((item) => item.id === state.activeBusinessId) ?? state.businesses[0];
  return [
    { label: 'Business', value: activeBusiness?.name || state.settings.businessName || 'RhinoPeak Business' },
    { label: 'Address', value: activeBusiness?.address || 'Not added' },
    { label: 'PAN / VAT', value: activeBusiness?.taxId || state.settings.panVatNumber || 'Not added' },
    { label: 'Phone', value: activeBusiness?.phone || 'Not added' },
  ];
}

function normalizeEntity(value: string) {
  const clean = value.toLowerCase();
  if (clean === 'sale') return 'sales';
  if (clean === 'purchase') return 'purchases';
  if (clean === 'expense') return 'expenses';
  if (clean === 'party') return 'parties';
  if (clean === 'customer') return 'customers';
  if (clean === 'product' || clean === 'products' || clean === 'stock') return 'inventory';
  if (clean === 'cashbank' || clean === 'cash-bank' || clean === 'account' || clean === 'accounts') return 'cash-bank';
  if (clean === 'money-movement' || clean === 'money-movements' || clean === 'movement' || clean === 'movements') return 'money-movements';
  if (clean === 'bill-scan' || clean === 'bill-scans' || clean === 'scans') return 'bill-scans';
  if (clean === 'document') return 'documents';
  return clean;
}

function slugParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] ?? '' : value ?? '';
}

function timelineColor(tone: Tone = 'neutral') {
  if (tone === 'success') return 'var(--success)';
  if (tone === 'warning') return 'var(--warning)';
  if (tone === 'danger') return 'var(--danger)';
  if (tone === 'info') return 'var(--info)';
  if (tone === 'accent') return 'var(--accent)';
  return 'var(--border)';
}
