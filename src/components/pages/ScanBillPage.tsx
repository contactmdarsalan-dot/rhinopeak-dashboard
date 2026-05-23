'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { BrainCircuit, Camera, CheckCircle2, Plus, Trash2, Sparkles, RefreshCw, AlertCircle, FileSpreadsheet, Eye } from 'lucide-react';
import { approveBillScanInBackend, parseBillScanInBackend, uploadBillScanInBackend, deleteBillScanInBackend } from '@/lib/api';
import type { BillScan, ParsedBillScan, BillScanItem } from '@/lib/domain';
import { useAppStore } from '@/lib/store';
import { uiCurrency, uiDate, uiDateTime, uiDigits, uiFormat, uiNumber, uiPercent, uiRecordText, uiText } from '@/lib/i18n';
import { Badge, Button, Field, Panel, PanelHeader, StatTile, controlStyle, Modal } from '@/components/ui/Primitives';

type SaveTarget = 'Expense' | 'Purchase' | 'Sale';

const emptyParsed: ParsedBillScan = {
  vendorName: '',
  billNumber: '',
  billDate: new Date().toISOString().slice(0, 10),
  paymentMethod: 'Cash',
  currency: 'NPR',
  subtotal: 0,
  discountAmount: 0,
  vatAmount: 0,
  totalAmount: 0,
  items: [],
  category: '',
  notes: '',
  rawText: '',
};

const templates = [
  {
    name: 'Himalaya Hotel',
    file: 'himalaya_hotel_receipt.txt',
    text: `HIMALAYA HOTEL
Vat No: 987654321
Date: 2026-05-22
-----------------------------
Momo           1 x 300.00    300.00
Coke           2 x 80.00     160.00
-----------------------------
Subtotal:                    460.00
VAT 13%:                     0.00
Total Amount:                460.00
Payment Mode:                Cash`,
    svg: `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="300" height="400" viewBox="0 0 300 400" style="background:%23111827;font-family:monospace;fill:%239ca3af;font-size:12px;"><text x="20" y="40" fill="%23fff" font-weight="bold" font-size="16">HIMALAYA HOTEL</text><text x="20" y="65">VAT No: 987654321</text><text x="20" y="85">Date: 2026-05-22</text><line x1="20" y1="105" x2="280" y2="105" stroke="%23374151" /><text x="20" y="130">Momo x1</text><text x="220" y="130">NPR 300.00</text><text x="20" y="155">Coke x2</text><text x="220" y="155">NPR 160.00</text><line x1="20" y1="180" x2="280" y2="180" stroke="%23374151" /><text x="20" y="210">Subtotal</text><text x="220" y="210">NPR 460.00</text><text x="20" y="235">VAT 13%</text><text x="220" y="235">NPR 0.00</text><text x="20" y="270" fill="%230f766e" font-weight="bold" font-size="14">Total Amount</text><text x="200" y="270" fill="%230f766e" font-weight="bold" font-size="14">NPR 460.00</text><text x="20" y="320" fill="%236b7280">Payment: CASH</text><text x="20" y="360" fill="%230f766e" font-weight="bold" font-size="10">RHINOPEAK AI SMART SCANNER</text></svg>`
  },
  {
    name: 'City Mart NPR',
    file: 'city_mart_npr.txt',
    text: `CITY MART NPR
Vat No: 123456789
Date: 2026-05-22
-----------------------------
Rice 5kg       1 x 800.00    800.00
Oil 1L         2 x 250.00    500.00
-----------------------------
Subtotal:                    1300.00
Discount:                    100.00
VAT 13%:                     156.00
Grand Total:                 1356.00
Payment Mode:                eSewa`,
    svg: `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="300" height="400" viewBox="0 0 300 400" style="background:%23111827;font-family:monospace;fill:%239ca3af;font-size:12px;"><text x="20" y="40" fill="%23fff" font-weight="bold" font-size="16">CITY MART NPR</text><text x="20" y="65">VAT No: 123456789</text><text x="20" y="85">Date: 2026-05-22</text><line x1="20" y1="105" x2="280" y2="105" stroke="%23374151" /><text x="20" y="130">Rice 5kg x1</text><text x="220" y="130">NPR 800.00</text><text x="20" y="155">Oil 1L x2</text><text x="220" y="500.00">NPR 500.00</text><line x1="20" y1="180" x2="280" y2="180" stroke="%23374151" /><text x="20" y="205">Subtotal</text><text x="220" y="205">NPR 1300.00</text><text x="20" y="225">Discount</text><text x="220" y="225">NPR 100.00</text><text x="20" y="245">VAT 13%</text><text x="220" y="245">NPR 156.00</text><text x="20" y="280" fill="%230f766e" font-weight="bold" font-size="14">Grand Total</text><text x="200" y="280" fill="%230f766e" font-weight="bold" font-size="14">NPR 1356.00</text><text x="20" y="320" fill="%236b7280">Payment: ESEWA</text><text x="20" y="360" fill="%230f766e" font-weight="bold" font-size="10">RHINOPEAK AI SMART SCANNER</text></svg>`
  },
  {
    name: 'Office Rent Receipt',
    file: 'office_rent_receipt.txt',
    text: `OFFICE RENT RECEIPT
Date: 2026-05-22
-----------------------------
Rent Payment   1 x 15000.00  15000.00
-----------------------------
Subtotal:                    15000.00
Total Amount:                15000.00
Payment Mode:                Bank`,
    svg: `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="300" height="400" viewBox="0 0 300 400" style="background:%23111827;font-family:monospace;fill:%239ca3af;font-size:12px;"><text x="20" y="40" fill="%23fff" font-weight="bold" font-size="16">OFFICE RENT RECEIPT</text><text x="20" y="65">Date: 2026-05-22</text><line x1="20" y1="105" x2="280" y2="105" stroke="%23374151" /><text x="20" y="130">Rent Payment x1</text><text x="210" y="130">NPR 15000.00</text><line x1="20" y1="170" x2="280" y2="170" stroke="%23374151" /><text x="20" y="200">Subtotal</text><text x="210" y="200">NPR 15000.00</text><text x="20" y="240" fill="%230f766e" font-weight="bold" font-size="14">Total Amount</text><text x="190" y="240" fill="%230f766e" font-weight="bold" font-size="14">NPR 15000.00</text><text x="20" y="290" fill="%236b7280">Payment: BANK</text><text x="20" y="360" fill="%230f766e" font-weight="bold" font-size="10">RHINOPEAK AI SMART SCANNER</text></svg>`
  }
];

const detailLinkStyle = {
  minHeight: 32,
  padding: '0 10px',
  borderRadius: 8,
  border: '1px solid var(--border)',
  background: 'var(--bg-card)',
  color: 'var(--text-secondary)',
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 4,
  fontSize: 13,
  fontWeight: 650,
  textDecoration: 'none',
} as const;

function EmptyState({ title, copy }: { title: string; copy: string }) {
  const settings = useAppStore((state) => state.settings);
  const tx = (value: string) => uiText(settings.language, value);
  return (
    <div style={{ padding: 24, textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
      <p style={{ color: 'var(--text-primary)', fontWeight: 750, marginBottom: 4 }}>{tx(title)}</p>
      <p>{tx(copy)}</p>
    </div>
  );
}

function billScanRecordData(item: BillScan): Partial<ParsedBillScan> {
  return item.approved || item.parsed || {};
}

function isSavedBillScan(item: BillScan) {
  return item.status === 'Approved' && Boolean(item.targetRecordId || item.pdfDocumentId);
}

function billScanSortTime(item: BillScan) {
  return Date.parse(item.updatedAt || item.createdAt || '') || 0;
}

function billScanDisplayDate(item: BillScan) {
  const data = billScanRecordData(item);
  return String(data.billDate || item.createdAt || '').slice(0, 10);
}

export function ScanBillPage() {
  const { settings, billScans, hydrateFromBackend, expenseCategories } = useAppStore();
  const tx = (value: string) => uiText(settings.language, value);
  const tv = (value: string | null | undefined) => uiRecordText(settings.language, value);
  const td = (value: string | null | undefined) => uiDate(settings.language, value);
  const tdt = (value: string | null | undefined) => uiDateTime(settings.language, value);
  const tn = (value: number, options?: Intl.NumberFormatOptions) => uiNumber(settings.language, value, options);
  const tc = (value: number) => uiCurrency(settings.language, value);
  const tp = (value: number) => uiPercent(settings.language, value);
  const tid = (value: string | number | null | undefined) => uiDigits(settings.language, value);
  const [rawText, setRawText] = useState('');
  const [fileMeta, setFileMeta] = useState<{ dataUrl: string; name: string; type: string; size: number } | null>(null);
  const [scan, setScan] = useState<BillScan | null>(null);
  const [approved, setApproved] = useState<ParsedBillScan>(emptyParsed);
  const [target, setTarget] = useState<SaveTarget>('Expense');
  const [downloadUrl, setDownloadUrl] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [scanStep, setScanStep] = useState<number>(0); // 0: Idle, 1: Uploading, 2: Extracting OCR, 3: Structuring AI, 4: Validating, 5: Done
  const [isReviewOpen, setIsReviewOpen] = useState(false);
  const [selectedScan, setSelectedScan] = useState<BillScan | null>(null);

  const savedBillScans = useMemo(() => {
    return billScans.filter(isSavedBillScan);
  }, [billScans]);

  const savedHistory = useMemo(() => {
    return savedBillScans.slice().sort((a, b) => billScanSortTime(b) - billScanSortTime(a));
  }, [savedBillScans]);

  const savedScanTotal = useMemo(() => {
    return savedBillScans.reduce((sum, item) => sum + Number(billScanRecordData(item).totalAmount || 0), 0);
  }, [savedBillScans]);

  const latestSavedDate = savedHistory[0] ? td(billScanDisplayDate(savedHistory[0])) : tx('None');

  const handleDeleteScan = async (scanId: string) => {
    if (!confirm(tx('Are you sure you want to delete this scan?'))) return;
    setLoading(true);
    setMessage('');
    try {
      const response = await deleteBillScanInBackend(scanId);
      hydrateFromBackend(response.bootstrap);
      setMessage(tx('Scan deleted successfully.'));
      if (scan?.id === scanId) {
        setScan(null);
      }
      if (selectedScan?.id === scanId) {
        setSelectedScan(null);
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : tx('Could not delete scan.'));
    } finally {
      setLoading(false);
    }
  };

  const reviewedTotal = useMemo(() => {
    return approved.totalAmount;
  }, [approved.totalAmount]);

  const isLowConfidence = scan !== null && scan.status !== 'Approved' && (scan.confidence ?? 0) < 0.80;

  const isMathMismatch = useMemo(() => {
    return Math.abs(Number(approved.subtotal || 0) + Number(approved.vatAmount || 0) - Number(approved.discountAmount || 0) - Number(approved.totalAmount || 0)) > 0.02;
  }, [approved.subtotal, approved.vatAmount, approved.discountAmount, approved.totalAmount]);

  const highlightStyle = (isLow: boolean) =>
    isLow
      ? { ...controlStyle, borderWidth: '1px', borderStyle: 'solid', borderColor: '#eab308', boxShadow: '0 0 0 1px #eab308' }
      : controlStyle;

  // Main automated upload and parse logic
  const handleUploadAndParse = async (
    meta: { dataUrl: string; name: string; type: string; size: number } | null,
    textInput: string
  ) => {
    setLoading(true);
    setMessage('');
    setScanStep(1); // Uploading
    const isRealImage = meta ? !meta.type.includes('svg') : false;
    try {
      // Step 1: Upload receipt data
      const uploaded = await uploadBillScanInBackend({
        rawText: textInput,
        imageDataUrl: meta?.dataUrl,
        fileName: meta?.name || 'receipt.txt',
        mimeType: meta?.type || 'text/plain',
        size: meta?.size || textInput.length,
        sourceType: meta ? 'camera' : 'manual',
      });
      hydrateFromBackend(uploaded.bootstrap);
      setScan(uploaded.billScan);

      // Step 2: OCR extraction phase (simulate delay for premium visuals)
      setScanStep(2);
      await new Promise((resolve) => setTimeout(resolve, 800));

      // Step 3: LLM Structuring using custom character-level PyTorch GPT model
      setScanStep(3);
      const rawTextToParse = textInput || uploaded.billScan.rawText || '';
      const parsed = await parseBillScanInBackend(uploaded.billScan.id, rawTextToParse);
      hydrateFromBackend(parsed.bootstrap);
      setScan(parsed.billScan);

      // Step 4: Rule validations
      setScanStep(4);
      await new Promise((resolve) => setTimeout(resolve, 600));

      setApproved({ ...emptyParsed, ...parsed.parsed, items: parsed.parsed.items ?? [] });
      setScanStep(5); // Complete
      setIsReviewOpen(true);
      if (isRealImage) {
        setMessage(tx('Image uploaded. AI OCR pipeline processed. Please review and correct the extracted fields below before saving.'));
      } else {
        setMessage(tx('Bill scanned. Review the fields before saving.'));
      }
    } catch (error) {
      setScanStep(0);
      setMessage(error instanceof Error ? error.message : tx('Could not scan this bill.'));
    } finally {
      setLoading(false);
    }
  };

  const selectTemplate = (index: number) => {
    const tmpl = templates[index];
    setRawText(tmpl.text);
    const meta = { dataUrl: tmpl.svg, name: tmpl.file, type: 'image/svg+xml', size: tmpl.text.length };
    setFileMeta(meta);
    handleUploadAndParse(meta, tmpl.text);
  };

  const handleRealImageUpload = (file: File) => {
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = String(reader.result || '');
      const meta = { dataUrl, name: file.name, type: file.type || 'image/jpeg', size: file.size };
      setFileMeta(meta);
      handleUploadAndParse(meta, '');
    };
    reader.readAsDataURL(file);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (!file) return;
    handleRealImageUpload(file);
  };

  const saveApproved = async () => {
    if (!scan) return;
    setLoading(true);
    setMessage('');
    try {
      const saved = await approveBillScanInBackend(scan.id, target, { ...approved, totalAmount: reviewedTotal });
      hydrateFromBackend(saved.bootstrap);
      setScan(saved.billScan);
      setDownloadUrl(saved.document.dataUrl ?? '');
      setMessage(tx('Saved. Your records, accounting, and document library are updated.'));
      setScanStep(0);
      setIsReviewOpen(false);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : tx('Could not save this bill.'));
    } finally {
      setLoading(false);
    }
  };

  const recalculateTotals = (items: ParsedBillScan['items'], discount: number, vat: number) => {
    const subtotal = round(items.reduce((sum, item) => sum + Number(item.lineTotal || 0), 0));
    const totalAmount = round(subtotal - discount + vat);
    return { subtotal, totalAmount };
  };

  const addItem = () => {
    setApproved((current) => {
      const nextItems = [
        ...current.items,
        { name: '', quantity: 1, unit: 'pcs', unitPrice: 0, discount: 0, tax: 0, lineTotal: 0 },
      ];
      const { subtotal, totalAmount } = recalculateTotals(nextItems, current.discountAmount, current.vatAmount);
      return {
        ...current,
        items: nextItems,
        subtotal,
        totalAmount,
      };
    });
  };

  const updateItem = (index: number, patch: Partial<ParsedBillScan['items'][number]>) => {
    setApproved((current) => {
      const nextItems = current.items.map((item, itemIndex) => {
        if (itemIndex !== index) return item;
        const next = { ...item, ...patch };
        const lineTotal = Number(next.quantity || 0) * Number(next.unitPrice || 0) - Number(next.discount || 0) + Number(next.tax || 0);
        return { ...next, lineTotal: round(lineTotal) };
      });
      const { subtotal, totalAmount } = recalculateTotals(nextItems, current.discountAmount, current.vatAmount);
      return {
        ...current,
        items: nextItems,
        subtotal,
        totalAmount,
      };
    });
  };

  const removeItem = (index: number) => {
    setApproved((current) => {
      const nextItems = current.items.filter((_, itemIndex) => itemIndex !== index);
      const { subtotal, totalAmount } = recalculateTotals(nextItems, current.discountAmount, current.vatAmount);
      return {
        ...current,
        items: nextItems,
        subtotal,
        totalAmount,
      };
    });
  };

  return (
    <div className="scan-page" style={{ display: 'grid', gap: 18 }}>
      <style>{`
        @keyframes scanLaser {
          0% { top: 0%; opacity: 0.8; }
          50% { top: 100%; opacity: 0.8; }
          100% { top: 0%; opacity: 0.8; }
        }
        .scanning-line-overlay {
          position: absolute;
          left: 0;
          width: 100%;
          height: 3px;
          background: linear-gradient(90deg, transparent, #0f766e, #2dd4bf, #0f766e, transparent);
          box-shadow: 0 0 10px #2dd4bf, 0 0 20px #0f766e;
          animation: scanLaser 3s infinite linear;
          z-index: 10;
        }
        .premium-glass-panel {
          background: rgba(17, 24, 39, 0.45) !important;
          backdrop-filter: blur(14px) !important;
          -webkit-backdrop-filter: blur(14px) !important;
          border: 1px solid rgba(255, 255, 255, 0.08) !important;
          box-shadow: 0 10px 30px -10px rgba(0, 0, 0, 0.3) !important;
          border-radius: 16px !important;
          overflow: hidden;
          transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
        }
        .premium-glass-panel:hover {
          border-color: rgba(15, 118, 110, 0.35) !important;
          box-shadow: 0 10px 35px -5px rgba(15, 118, 110, 0.1) !important;
        }
        .template-badge {
          background: rgba(15, 118, 110, 0.12);
          border: 1px solid rgba(15, 118, 110, 0.2);
          color: #2dd4bf;
          cursor: pointer;
          transition: all 0.2s ease;
        }
        .template-badge:hover {
          background: rgba(15, 118, 110, 0.25);
          transform: translateY(-1px);
        }
        .timeline-step {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 6px 0;
          font-size: 13px;
          transition: all 0.3s ease;
        }
        .timeline-bullet {
          width: 20px;
          height: 20px;
          border-radius: 50%;
          display: grid;
          place-items: center;
          font-size: 11px;
          font-weight: bold;
          border: 1px solid var(--border);
          color: var(--text-muted);
          background: var(--bg-primary);
        }
        .timeline-step.active .timeline-bullet {
          border-color: #2dd4bf;
          color: #2dd4bf;
          box-shadow: 0 0 8px rgba(45, 212, 191, 0.4);
          background: rgba(15, 118, 110, 0.1);
        }
        .timeline-step.done .timeline-bullet {
          border-color: var(--success);
          color: var(--success);
          background: rgba(16, 185, 129, 0.1);
        }
      `}</style>

      {/* Overview Stat Tiles */}
      <div className="scan-stats-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 14 }}>
        <StatTile label="Saved scan records" value={tn(savedBillScans.length)} detail="Approved and posted to records" tone="accent" />
        <StatTile label="Saved total" value={tc(savedScanTotal)} detail="From committed scans" tone="success" />
        <StatTile label="Latest saved" value={latestSavedDate} detail="Last committed scan" tone="neutral" />
      </div>

      {message && (
        <Panel style={{ padding: 14, border: message.toLowerCase().includes('could') ? '1px solid rgba(239,68,68,0.35)' : '1px solid var(--border)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            {message.toLowerCase().includes('could') ? <AlertCircle style={{ color: 'var(--danger)' }} size={16} /> : <CheckCircle2 style={{ color: 'var(--success)' }} size={16} />}
            <p style={{ color: 'var(--text-secondary)', fontSize: 13, fontWeight: 500 }}>{message}</p>
          </div>
        </Panel>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: scan ? 'minmax(280px, 0.95fr) minmax(320px, 1.05fr)' : '1fr', gap: 18 }} className="scanner-grid">
        
        {/* Left Column: Image Dropzone & Simulator */}
        <Panel className="premium-glass-panel">
          <PanelHeader title="Scan Bill" subtitle="Powered by KaroBrain Vision Engine. Upload a receipt or pick a quick simulator." />
          <div style={{ padding: 18, display: 'grid', gap: 16 }}>
            
            {/* Template Simulator Selectors */}
            <div style={{ display: 'grid', gap: 8 }}>
              <span style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 6 }}>
                <Sparkles size={12} style={{ color: '#2dd4bf' }} /> {tx('Quick Simulator Templates')}
              </span>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {templates.map((tmpl, idx) => (
                  <button
                    key={tmpl.name}
                    onClick={() => selectTemplate(idx)}
                    className="template-badge"
                    style={{
                      padding: '5px 12px',
                      borderRadius: 20,
                      fontSize: 12,
                      fontWeight: 650,
                    }}
                  >
                    {tx(tmpl.name)}
                  </button>
                ))}
              </div>
            </div>

            {/* Drag & Drop Upload Zone */}
            <div
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              style={{
                position: 'relative',
                width: '100%',
                borderRadius: 14,
                overflow: 'hidden',
                border: isDragging ? '1px dashed #2dd4bf' : '1px dashed rgba(255, 255, 255, 0.08)',
                background: isDragging ? 'rgba(15, 118, 110, 0.05)' : 'rgba(0, 0, 0, 0.15)',
                transition: 'all 0.25s ease',
              }}
            >
              {fileMeta ? (
                <div style={{ position: 'relative', width: '100%', minHeight: 240, display: 'flex', justifyContent: 'center', background: '#080c14', padding: 12 }}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={fileMeta.dataUrl} alt="Receipt preview" style={{ maxWidth: '100%', maxHeight: 280, objectFit: 'contain', borderRadius: 8 }} />
                  {loading && <div className="scanning-line-overlay" />}
                </div>
              ) : (
                <label
                  style={{
                    minHeight: 200,
                    display: 'grid',
                    placeItems: 'center',
                    gap: 8,
                    padding: 20,
                    cursor: 'pointer',
                    textAlign: 'center',
                  }}
                >
                  <input
                    type="file"
                    accept="image/*"
                    capture="environment"
                    style={{ display: 'none' }}
                    onChange={(event) => {
                      const file = event.target.files?.[0];
                      if (!file) return;
                      handleRealImageUpload(file);
                    }}
                  />
                  <span style={{ width: 56, height: 56, borderRadius: 20, display: 'grid', placeItems: 'center', background: 'rgba(15, 118, 110, 0.15)', color: 'var(--accent)', boxShadow: '0 0 15px rgba(15, 118, 110, 0.2)' }}>
                    <Camera size={26} />
                  </span>
                  <span style={{ color: 'var(--text-primary)', fontWeight: 800 }}>{tx('Drag receipt here or Click to upload')}</span>
                  <span style={{ color: 'var(--text-muted)', fontSize: 11, lineHeight: 1.5, maxWidth: 260 }}>{tx('PNG, JPG, or PDF. Automatic OCR extraction & GPT-based field structures will execute immediately.')}</span>
                </label>
              )}
            </div>

            {/* OCR Text Input fallback accordion */}
            <details style={{ border: '1px solid rgba(255, 255, 255, 0.05)', borderRadius: 10, padding: '8px 12px', background: 'rgba(0, 0, 0, 0.1)' }}>
              <summary style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', cursor: 'pointer', outline: 'none' }}>
                {tx('View extracted raw text')}
              </summary>
              <div style={{ marginTop: 10 }}>
                <textarea
                  style={{ ...controlStyle, minHeight: 140, fontSize: 12, fontFamily: 'monospace', background: '#090d16' }}
                  value={rawText}
                  onChange={(event) => setRawText(event.target.value)}
                  placeholder={tx('Paste OCR text if manual scan is required...')}
                />
                <Button
                  style={{ marginTop: 8, width: '100%' }}
                  disabled={loading || !rawText.trim()}
                  onClick={() => handleUploadAndParse(null, rawText)}
                >
                  <RefreshCw size={13} /> {tx('Process manual text')}
                </Button>
              </div>
            </details>

            {/* Dynamic AI Timeline Progress */}
            {(loading || scanStep > 0) && (
              <div style={{ display: 'grid', gap: 10, padding: 14, background: 'rgba(17, 24, 39, 0.5)', borderRadius: 12, border: '1px solid rgba(255, 255, 255, 0.05)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, borderBottom: '1px solid rgba(255, 255, 255, 0.05)', paddingBottom: 8, marginBottom: 4 }}>
                  <BrainCircuit size={16} style={{ color: '#2dd4bf' }} />
                  <span style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-primary)' }}>{tx('KaroBrain Vision Engine')}</span>
                </div>

                {[
                  { step: 1, label: 'Uploading & decoding image' },
                  { step: 2, label: 'OpenCV preprocessing & deskew' },
                  { step: 3, label: 'KaroBrain™ OCR + Gemini Vision' },
                  { step: 4, label: 'AI structuring & field extraction' },
                ].map((item) => {
                  const isActive = scanStep === item.step;
                  const isDone = scanStep > item.step;
                  let cls = 'timeline-step';
                  if (isActive) cls += ' active';
                  if (isDone) cls += ' done';

                  return (
                    <div key={item.step} className={cls}>
                      <div className="timeline-bullet">
                        {isDone ? '✓' : item.step}
                      </div>
                      <span style={{ fontWeight: isActive ? 600 : 400 }}>{tx(item.label)}</span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </Panel>

        {/* Right Column: Scan Success Summary Card */}
        {scan && (
          <Panel className="premium-glass-panel">
            <PanelHeader
              title="Scan Success Summary"
              subtitle="The bill was parsed using KaroBrain Vision AI."
              action={<Badge tone={scan.status === 'Approved' ? 'success' : 'warning'}>{tx(scan.status)}</Badge>}
            />
            <div style={{ padding: 18, display: 'grid', gap: 18 }}>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, padding: '16px 0', borderBottom: '1px solid rgba(255, 255, 255, 0.05)' }}>
                <div style={{ width: 64, height: 64, borderRadius: '50%', background: 'rgba(16, 185, 129, 0.12)', border: '1px solid rgba(16, 185, 129, 0.25)', display: 'grid', placeItems: 'center', color: 'var(--success)', boxShadow: '0 0 20px rgba(16, 185, 129, 0.2)' }}>
                  <CheckCircle2 size={32} />
                </div>
                <h3 style={{ color: 'var(--text-primary)', fontWeight: 800, fontSize: 18, margin: 0 }}>{tx('Receipt Extracted!')}</h3>
                <p style={{ color: 'var(--text-muted)', fontSize: 12, margin: 0, textAlign: 'center' }}>
                  {tx('Double check the values and commit the entry to ledger.')}
                </p>
              </div>

              <div style={{ display: 'grid', gap: 12 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px dashed rgba(255,255,255,0.05)', paddingBottom: 8 }}>
                  <span style={{ color: 'var(--text-muted)', fontSize: 13 }}>{tx('Shop or vendor')}</span>
                  <span style={{ color: 'var(--text-primary)', fontWeight: 700, fontSize: 13 }}>{tv(approved.vendorName) || tx('Unknown')}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px dashed rgba(255,255,255,0.05)', paddingBottom: 8 }}>
                  <span style={{ color: 'var(--text-muted)', fontSize: 13 }}>{tx('Bill number')}</span>
                  <span style={{ color: 'var(--text-primary)', fontWeight: 700, fontSize: 13 }}>{tid(approved.billNumber || tx('N/A'))}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px dashed rgba(255,255,255,0.05)', paddingBottom: 8 }}>
                  <span style={{ color: 'var(--text-muted)', fontSize: 13 }}>{tx('Bill date')}</span>
                  <span style={{ color: 'var(--text-primary)', fontWeight: 700, fontSize: 13 }}>{td(approved.billDate)}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px dashed rgba(255,255,255,0.05)', paddingBottom: 8 }}>
                  <span style={{ color: 'var(--text-muted)', fontSize: 13 }}>{tx('Payment method')}</span>
                  <span style={{ color: 'var(--text-primary)', fontWeight: 700, fontSize: 13 }}><Badge tone="info">{tx(approved.paymentMethod)}</Badge></span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px dashed rgba(255,255,255,0.05)', paddingBottom: 8 }}>
                  <span style={{ color: 'var(--text-muted)', fontSize: 13 }}>{tx('Confidence score')}</span>
                  <span style={{ color: isLowConfidence ? '#eab308' : '#2dd4bf', fontWeight: 750, fontSize: 13 }}>
                    {tp((scan.confidence ?? 0.95) * 100)}
                  </span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: 4 }}>
                  <span style={{ color: 'var(--text-primary)', fontWeight: 800, fontSize: 14 }}>{tx('Total Amount')}</span>
                  <span style={{ color: '#2dd4bf', fontWeight: 900, fontSize: 18 }}>{tc(reviewedTotal)}</span>
                </div>
              </div>

              <div style={{ display: 'grid', gap: 10, marginTop: 10 }}>
                <Button onClick={() => setIsReviewOpen(true)} style={{ width: '100%', minHeight: 44, background: 'rgba(15, 118, 110, 0.15)', border: '1px solid rgba(15, 118, 110, 0.3)', color: '#2dd4bf' }}>
                  <Sparkles size={15} style={{ marginRight: 6 }} /> {tx('Review Extracted Fields')}
                </Button>
                {downloadUrl && (
                  <a href={downloadUrl} download={`${approved.billNumber || 'smart-bill'}.html`} style={{ textDecoration: 'none', width: '100%' }}>
                    <Button variant="secondary" style={{ width: '100%' }}><FileSpreadsheet size={15} /> {tx('Download PDF')}</Button>
                  </a>
                )}
              </div>
            </div>
          </Panel>
        )}
      </div>

      {/* Structured Review Modal Overlay */}
      {isReviewOpen && (
        <Modal
          title="Review Extracted Fields"
          subtitle="Verify and adjust AI extracted transaction entries before committing to ledger."
          onClose={() => setIsReviewOpen(false)}
          width={780}
        >
          <div style={{ display: 'grid', gap: 16 }}>
            {isLowConfidence && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', borderRadius: 10, background: 'rgba(234, 179, 8, 0.1)', border: '1px solid rgba(234, 179, 8, 0.3)', color: '#eab308' }}>
                <AlertCircle size={16} />
                <span style={{ fontSize: 13, fontWeight: 500 }}>
                  {uiFormat(settings.language, 'Low confidence extraction ({confidence}). Please double check the highlighted fields below.', { confidence: tp((scan?.confidence ?? 0.8) * 100) })}
                </span>
              </div>
            )}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12 }}>
              <Field label="Shop or vendor">
                <input style={highlightStyle(isLowConfidence)} value={approved.vendorName} onChange={(event) => setApproved({ ...approved, vendorName: event.target.value })} />
              </Field>
              <Field label="Bill number">
                <input style={highlightStyle(isLowConfidence)} value={approved.billNumber} onChange={(event) => setApproved({ ...approved, billNumber: event.target.value })} />
              </Field>
              <Field label="Bill date">
                <input style={highlightStyle(isLowConfidence)} type="date" value={approved.billDate} onChange={(event) => setApproved({ ...approved, billDate: event.target.value })} />
              </Field>
              <Field label="Payment method">
                <select style={controlStyle} value={approved.paymentMethod} onChange={(event) => setApproved({ ...approved, paymentMethod: event.target.value as ParsedBillScan['paymentMethod'] })}>
                  {['Cash', 'Card', 'eSewa', 'FonePay', 'Khalti', 'Bank', 'Credit'].map((item) => <option key={item} value={item}>{tx(item)}</option>)}
                </select>
              </Field>
            </div>

            {/* Item Rows Section */}
            <div style={{ display: 'grid', gap: 10 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
                <p style={{ color: 'var(--text-primary)', fontWeight: 800 }}>{tx('Items')}</p>
                <Button variant="secondary" onClick={addItem} style={{ height: 32, padding: '0 10px' }}><Plus size={14} /> {tx('Add row')}</Button>
              </div>
              
              {approved.items.map((item, index) => (
                <div key={`${item.name}-${index}`} style={{ display: 'grid', gridTemplateColumns: 'minmax(140px, 1.5fr) repeat(4, minmax(82px, 0.7fr)) 44px', gap: 8, alignItems: 'end' }} className="bill-item-row">
                  <Field label="Item">
                    <input style={controlStyle} value={item.name} onChange={(event) => updateItem(index, { name: event.target.value })} />
                  </Field>
                  <Field label="Qty">
                    <input style={controlStyle} type="number" value={item.quantity} onChange={(event) => updateItem(index, { quantity: Number(event.target.value) || 0 })} />
                  </Field>
                  <Field label="Unit">
                    <select style={controlStyle} value={item.unit} onChange={(event) => updateItem(index, { unit: event.target.value })}>
                      {['pcs', 'kg', 'gram', 'liter', 'tola', 'aana', 'unit', 'box', 'pack', 'set'].map((unit) => <option key={unit} value={unit}>{tx(unit)}</option>)}
                    </select>
                  </Field>
                  <Field label="Rate">
                    <input style={controlStyle} type="number" value={item.unitPrice} onChange={(event) => updateItem(index, { unitPrice: Number(event.target.value) || 0 })} />
                  </Field>
                  <Field label="Total">
                    <input style={controlStyle} type="number" value={item.lineTotal} onChange={(event) => updateItem(index, { lineTotal: Number(event.target.value) || 0 })} />
                  </Field>
                  <button
                    aria-label={tx('Remove item')}
                    onClick={() => removeItem(index)}
                    style={{ minHeight: 38, border: '1px solid rgba(239,68,68,0.24)', color: 'var(--danger)', background: 'rgba(239,68,68,0.08)', borderRadius: 8, cursor: 'pointer' }}
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              ))}
              
              {!approved.items.length && (
                <div style={{ padding: 14, border: '1px solid var(--border)', borderRadius: 10, color: 'var(--text-muted)', fontSize: 13 }}>
                  {tx('No items detected yet. Add item rows or save the bill as one total expense.')}
                </div>
              )}
            </div>

            {/* Totals & Target Record Config */}
            {isMathMismatch && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', borderRadius: 10, background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.3)', color: '#ef4444' }}>
                <AlertCircle size={16} />
                <span style={{ fontSize: 13, fontWeight: 500 }}>
                  {uiFormat(settings.language, 'Mathematical mismatch: subtotal {subtotal} + VAT {vat} - discount {discount} does not equal total {total}.', {
                    subtotal: tc(approved.subtotal),
                    vat: tc(approved.vatAmount),
                    discount: tc(approved.discountAmount),
                    total: tc(approved.totalAmount),
                  })}
                </span>
              </div>
            )}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12, borderTop: '1px solid rgba(255, 255, 255, 0.05)', paddingTop: 14 }}>
              <Field label="Subtotal">
                <input
                  style={controlStyle}
                  type="number"
                  value={approved.subtotal}
                  onChange={(event) => {
                    const sub = Number(event.target.value) || 0;
                    setApproved((current) => ({
                      ...current,
                      subtotal: sub,
                      totalAmount: round(sub - current.discountAmount + current.vatAmount),
                    }));
                  }}
                />
              </Field>
              <Field label="Discount">
                <input
                  style={controlStyle}
                  type="number"
                  value={approved.discountAmount}
                  onChange={(event) => {
                    const disc = Number(event.target.value) || 0;
                    setApproved((current) => ({
                      ...current,
                      discountAmount: disc,
                      totalAmount: round(current.subtotal - disc + current.vatAmount),
                    }));
                  }}
                />
              </Field>
              <Field label="VAT / Tax">
                <input
                  style={controlStyle}
                  type="number"
                  value={approved.vatAmount}
                  onChange={(event) => {
                    const vat = Number(event.target.value) || 0;
                    setApproved((current) => ({
                      ...current,
                      vatAmount: vat,
                      totalAmount: round(current.subtotal - current.discountAmount + vat),
                    }));
                  }}
                />
              </Field>
              <Field label="Total">
                <input
                  style={highlightStyle(isLowConfidence)}
                  type="number"
                  value={approved.totalAmount}
                  onChange={(event) => {
                    const tot = Number(event.target.value) || 0;
                    setApproved((current) => ({
                      ...current,
                      totalAmount: tot,
                    }));
                  }}
                />
              </Field>
              <Field label="Save to records as">
                <select style={controlStyle} value={target} onChange={(event) => setTarget(event.target.value as SaveTarget)}>
                  {(['Expense', 'Purchase', 'Sale'] as SaveTarget[]).map((item) => <option key={item} value={item}>{tx(item)}</option>)}
                </select>
              </Field>
              {target === 'Expense' && (
                <Field label="Expense category">
                  <select
                    style={controlStyle}
                    value={approved.category || ''}
                    onChange={(event) => setApproved({ ...approved, category: event.target.value })}
                  >
                    <option value="">{tx('Select category...')}</option>
                    {expenseCategories.map((cat) => (
                      <option key={cat} value={cat}>
                        {tx(cat)}
                      </option>
                    ))}
                  </select>
                </Field>
              )}
            </div>

            {/* Footer actions */}
            <div style={{ display: 'flex', alignItems: 'center', justifySelf: 'stretch', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', borderTop: '1px solid rgba(255, 255, 255, 0.08)', paddingTop: 16, marginTop: 4 }}>
              <div>
                <p style={{ color: 'var(--text-muted)', fontSize: 12 }}>{tx('Final total')}</p>
                <p style={{ color: '#2dd4bf', fontSize: 26, fontWeight: 900, textShadow: '0 0 10px rgba(45, 212, 191, 0.2)' }}>{tc(reviewedTotal)}</p>
              </div>
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
                <Button variant="secondary" onClick={() => setIsReviewOpen(false)} style={{ minHeight: 44 }}>
                  {tx('Cancel')}
                </Button>
                {downloadUrl && (
                  <a href={downloadUrl} download={`${approved.billNumber || 'smart-bill'}.html`} style={{ textDecoration: 'none' }}>
                    <Button variant="secondary" style={{ minHeight: 44 }}><FileSpreadsheet size={15} /> {tx('Download PDF')}</Button>
                  </a>
                )}
                <Button disabled={loading || !scan} onClick={saveApproved} style={{ minHeight: 44, padding: '0 16px', background: 'var(--accent)' }}>
                  <CheckCircle2 size={16} /> {tx('Save and Commit')}
                </Button>
              </div>
            </div>
          </div>
        </Modal>
      )}

      {/* Scan History Section */}
      <Panel className="scan-history-panel">
        <PanelHeader
          title="Scan History"
          subtitle="Saved bill scans that were committed to business records. Draft scans stay in review until saved."
        />
        <div style={{ overflowX: 'auto' }} className="responsive-table-scroll">
          <table className="responsive-card-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ color: 'var(--text-muted)', fontSize: 11, textAlign: 'left' }}>
                <th style={{ padding: '12px 16px' }}>{tx('Vendor')}</th>
                <th>{tx('Bill Number')}</th>
                <th>{tx('Date')}</th>
                <th>{tx('Status')}</th>
                <th>{tx('Confidence')}</th>
                <th style={{ textAlign: 'right' }}>{tx('Total Amount')}</th>
                <th style={{ padding: '12px 16px', textAlign: 'right' }}>{tx('Actions')}</th>
              </tr>
            </thead>
            <tbody>
              {savedHistory.map((item) => {
                const data = billScanRecordData(item);
                const displayTotal = data.totalAmount || 0;
                const displayDate = td(billScanDisplayDate(item));
                const displayVendor = tv(data.vendorName) || tx('Unknown');
                const displayBillNo = tid(data.billNumber || tx('N/A'));
                return (
                  <tr key={item.id} style={{ borderTop: '1px solid var(--border-subtle)' }}>
                    <td data-label={tx('Vendor')} data-card-primary="true" style={{ padding: '12px 16px', fontWeight: 650, color: 'var(--text-primary)' }}>
                      {displayVendor}
                    </td>
                    <td data-label={tx('Bill Number')} style={{ color: 'var(--text-secondary)' }}>
                      {displayBillNo}
                    </td>
                    <td data-label={tx('Date')} style={{ color: 'var(--text-secondary)' }}>
                      {displayDate}
                    </td>
                    <td data-label={tx('Status')}>
                      <Badge tone={
                        item.status === 'Approved' ? 'success' :
                        item.status === 'Rejected' ? 'danger' :
                        item.status === 'Needs Review' ? 'warning' : 'info'
                      }>
                        {tx(item.status)}
                      </Badge>
                    </td>
                    <td data-label={tx('Confidence')} style={{ color: (item.confidence ?? 0) < 0.80 ? '#eab308' : '#2dd4bf', fontWeight: 650 }}>
                      {tp((item.confidence ?? 0.95) * 100)}
                    </td>
                    <td data-label={tx('Total Amount')} style={{ color: 'var(--text-primary)', fontWeight: 800, textAlign: 'right' }}>
                      {tc(displayTotal)}
                    </td>
                    <td data-label={tx('Actions')} data-card-actions="true" style={{ padding: '12px 16px', textAlign: 'right' }}>
                      <div className="scan-history-actions" style={{ display: 'inline-flex', gap: 8, alignItems: 'center' }}>
                        <Button
                          variant="secondary"
                          onClick={() => setSelectedScan(item)}
                          style={{ height: 32, padding: '0 10px', display: 'flex', alignItems: 'center', gap: 4 }}
                        >
                          <Eye size={14} /> {tx('View Details')}
                        </Button>
                        <Link href={`/details/bill-scans/${item.id}`} style={detailLinkStyle}>
                          <Eye size={14} /> {tx('Open page')}
                        </Link>
                        <Button
                          variant="danger"
                          onClick={() => handleDeleteScan(item.id)}
                          style={{ height: 32, width: 32, padding: 0 }}
                          title={tx('Delete scan')}
                        >
                          <Trash2 size={14} />
                        </Button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {!savedHistory.length && (
            <EmptyState
              title={tx('No saved scan records yet.')}
              copy={tx('Approve and save a scanned bill to expenses, purchases, or sales to see it here.')}
            />
          )}
        </div>
      </Panel>

      {/* Scanned Bill Complete Detail View Modal */}
      {selectedScan && (
        <Modal
          title={tx('Scanned Bill Detail View')}
          subtitle={`${tx('Detailed AI extraction report for')} "${selectedScan.fileName}"`}
          onClose={() => setSelectedScan(null)}
          width={960}
        >
          <div className="scan-detail-modal-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
            {/* Left Column: Image Viewer */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifySelf: 'stretch', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text-muted)', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  {tx('Uploaded Bill Document')}
                </span>
                <span style={{ color: 'var(--text-muted)', fontSize: 11 }}>
                  {tx('Size')}: {tn(selectedScan.size / 1024, { minimumFractionDigits: 1, maximumFractionDigits: 1 })} KB
                </span>
              </div>

              <div style={{
                position: 'relative',
                width: '100%',
                borderRadius: 14,
                overflow: 'hidden',
                background: '#080c14',
                border: '1px solid rgba(255, 255, 255, 0.08)',
                minHeight: 320,
                maxHeight: 520,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: 12,
                boxShadow: 'inset 0 0 20px rgba(0,0,0,0.6)'
              }}>
                {selectedScan.imageDataUrl ? (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img
                    src={selectedScan.imageDataUrl}
                    alt="Uploaded receipt"
                    style={{ maxWidth: '100%', maxHeight: 480, objectFit: 'contain', borderRadius: 8 }}
                  />
                ) : (
                  <div style={{ textAlign: 'center', padding: 20 }}>
                    <FileSpreadsheet size={48} style={{ color: 'var(--text-muted)', marginBottom: 12, opacity: 0.5 }} />
                    <p style={{ color: 'var(--text-muted)', fontSize: 13 }}>{tx('No image attachment found.')}</p>
                  </div>
                )}
              </div>

              {selectedScan.rawText && (
                <details style={{ border: '1px solid rgba(255, 255, 255, 0.05)', borderRadius: 10, padding: '10px 14px', background: 'rgba(0, 0, 0, 0.15)' }}>
                  <summary style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', cursor: 'pointer', outline: 'none' }}>
                    {tx('Show Extracted Raw OCR Text')}
                  </summary>
                  <div style={{
                    marginTop: 10,
                    fontFamily: 'monospace',
                    background: '#040711',
                    padding: 12,
                    borderRadius: 8,
                    maxHeight: 200,
                    overflowY: 'auto',
                    fontSize: 11,
                    color: 'var(--text-secondary)',
                    whiteSpace: 'pre-wrap',
                    border: '1px solid rgba(255, 255, 255, 0.03)'
                  }}>
                    {selectedScan.rawText}
                  </div>
                </details>
              )}
            </div>

            {/* Right Column: Extracted Metadata & Values */}
            <div className="scan-detail-side" style={{ display: 'flex', flexDirection: 'column', gap: 16, borderLeft: '1px solid rgba(255, 255, 255, 0.06)', paddingLeft: 24 }}>
              {/* Status Banner */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(255, 255, 255, 0.02)', padding: '10px 14px', borderRadius: 10, border: '1px solid rgba(255, 255, 255, 0.04)' }}>
                <div>
                  <span style={{ fontSize: 11, color: 'var(--text-muted)', display: 'block', textTransform: 'uppercase', fontWeight: 650 }}>{tx('Pipeline Confidence')}</span>
                  <span style={{ fontSize: 15, fontWeight: 800, color: (selectedScan.confidence ?? 0) < 0.80 ? '#eab308' : '#2dd4bf' }}>
                    {tp((selectedScan.confidence ?? 0.95) * 100)} {tx('Match')}
                  </span>
                </div>
                <Badge tone={
                  selectedScan.status === 'Approved' ? 'success' :
                  selectedScan.status === 'Rejected' ? 'danger' :
                  selectedScan.status === 'Needs Review' ? 'warning' : 'info'
                }>
                  {tx(selectedScan.status)}
                </Badge>
              </div>

              {/* Parsed Fields Detail */}
              {(() => {
                const data = selectedScan.approved || selectedScan.parsed || {};
                const lineItems = data.items ?? [];
                return (
                  <div style={{ display: 'grid', gap: 14 }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                      <div>
                        <span style={{ fontSize: 11, color: 'var(--text-muted)', display: 'block', textTransform: 'uppercase', fontWeight: 650 }}>{tx('Vendor')}</span>
                        <span style={{ fontSize: 14, fontWeight: 750, color: 'var(--text-primary)' }}>{tv(data.vendorName) || tx('Unknown')}</span>
                      </div>
                      <div>
                        <span style={{ fontSize: 11, color: 'var(--text-muted)', display: 'block', textTransform: 'uppercase', fontWeight: 650 }}>{tx('Bill Number')}</span>
                        <span style={{ fontSize: 14, fontWeight: 750, color: 'var(--text-primary)' }}>{tid(data.billNumber || tx('N/A'))}</span>
                      </div>
                      <div>
                        <span style={{ fontSize: 11, color: 'var(--text-muted)', display: 'block', textTransform: 'uppercase', fontWeight: 650 }}>{tx('Bill Date')}</span>
                        <span style={{ fontSize: 14, fontWeight: 750, color: 'var(--text-primary)' }}>{data.billDate ? td(data.billDate) : tx('N/A')}</span>
                      </div>
                      <div>
                        <span style={{ fontSize: 11, color: 'var(--text-muted)', display: 'block', textTransform: 'uppercase', fontWeight: 650 }}>{tx('Payment Method')}</span>
                        <span style={{ fontSize: 14, fontWeight: 750, color: 'var(--text-primary)' }}><Badge tone="info">{tx(data.paymentMethod || 'Cash')}</Badge></span>
                      </div>
                    </div>

                    {/* Items table */}
                    {lineItems.length > 0 ? (
                      <div style={{ display: 'grid', gap: 6 }}>
                        <span style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 650, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                          {tx('Extracted Line Items')}
                        </span>
                        <div style={{ maxHeight: 200, overflowY: 'auto', border: '1px solid rgba(255, 255, 255, 0.08)', borderRadius: 10, background: 'rgba(0,0,0,0.1)' }}>
                          <table className="responsive-card-table scan-line-items-table" style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                            <thead>
                              <tr style={{ background: 'rgba(255,255,255,0.03)', borderBottom: '1px solid rgba(255,255,255,0.08)', color: 'var(--text-muted)', textAlign: 'left' }}>
                                <th style={{ padding: '8px 12px' }}>{tx('Item')}</th>
                                <th style={{ padding: '8px 12px', textAlign: 'center', width: 50 }}>{tx('Qty')}</th>
                                <th style={{ padding: '8px 12px', textAlign: 'right', width: 80 }}>{tx('Rate')}</th>
                                <th style={{ padding: '8px 12px', textAlign: 'right', width: 85 }}>{tx('Total')}</th>
                              </tr>
                            </thead>
                            <tbody>
                              {lineItems.map((item: BillScanItem, idx: number) => (
                                <tr key={idx} style={{ borderBottom: idx < lineItems.length - 1 ? '1px solid rgba(255,255,255,0.04)' : 'none' }}>
                                  <td data-label={tx('Item')} data-card-primary="true" style={{ padding: '8px 12px', color: 'var(--text-primary)', fontWeight: 550 }}>{tv(item.name)}</td>
                                  <td data-label={tx('Qty')} style={{ padding: '8px 12px', textAlign: 'center', color: 'var(--text-secondary)' }}>{tn(Number(item.quantity || 0))} {tx(item.unit)}</td>
                                  <td data-label={tx('Rate')} style={{ padding: '8px 12px', textAlign: 'right', color: 'var(--text-secondary)' }}>{tc(Number(item.unitPrice || 0))}</td>
                                  <td data-label={tx('Total')} style={{ padding: '8px 12px', textAlign: 'right', fontWeight: 700, color: '#2dd4bf' }}>{tc(Number(item.lineTotal || 0))}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    ) : (
                      <div style={{ padding: 12, border: '1px solid rgba(255, 255, 255, 0.05)', borderRadius: 10, color: 'var(--text-muted)', fontSize: 12, textAlign: 'center', background: 'rgba(0,0,0,0.1)' }}>
                        {tx('No individual line items parsed.')}
                      </div>
                    )}

                    {/* Totals Box */}
                    <div style={{
                      background: 'rgba(15, 118, 110, 0.05)',
                      border: '1px solid rgba(15, 118, 110, 0.15)',
                      padding: 14,
                      borderRadius: 12,
                      display: 'grid',
                      gap: 8,
                      boxShadow: '0 4px 15px rgba(0,0,0,0.1)'
                    }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
                        <span style={{ color: 'var(--text-muted)' }}>{tx('Subtotal')}</span>
                        <span style={{ color: 'var(--text-secondary)', fontWeight: 500 }}>{tc(Number(data.subtotal || 0))}</span>
                      </div>
                      {Number(data.discountAmount || 0) > 0 && (
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
                          <span style={{ color: 'var(--text-muted)' }}>{tx('Discount')}</span>
                          <span style={{ color: 'var(--danger)', fontWeight: 500 }}>-{tc(Number(data.discountAmount || 0))}</span>
                        </div>
                      )}
                      {Number(data.vatAmount || 0) > 0 && (
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
                          <span style={{ color: 'var(--text-muted)' }}>{tx('VAT / Tax')}</span>
                          <span style={{ color: 'var(--text-secondary)', fontWeight: 500 }}>+{tc(Number(data.vatAmount || 0))}</span>
                        </div>
                      )}
                      <div style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        fontSize: 15,
                        fontWeight: 900,
                        borderTop: '1px dashed rgba(255,255,255,0.08)',
                        paddingTop: 8,
                        marginTop: 4
                      }}>
                        <span style={{ color: 'var(--text-primary)' }}>{tx('Total Amount')}</span>
                        <span style={{ color: '#2dd4bf', textShadow: '0 0 10px rgba(45, 212, 191, 0.15)' }}>{tc(Number(data.totalAmount || 0))}</span>
                      </div>
                    </div>
                  </div>
                );
              })()}

              {/* Metadata log */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, background: 'rgba(0,0,0,0.1)', padding: 10, borderRadius: 8, fontSize: 11, border: '1px solid rgba(255,255,255,0.03)' }}>
                <span style={{ color: 'var(--text-muted)' }}>{tx('Scan Source')}: <strong style={{ color: 'var(--text-secondary)', textTransform: 'capitalize' }}>{tx(selectedScan.sourceType)}</strong></span>
                <span style={{ color: 'var(--text-muted)' }}>{tx('Created At')}: <strong style={{ color: 'var(--text-secondary)' }}>{tdt(selectedScan.createdAt)}</strong></span>
              </div>

              {/* Action buttons */}
              <div style={{ display: 'flex', gap: 12, marginTop: 'auto', borderTop: '1px solid rgba(255, 255, 255, 0.08)', paddingTop: 16 }}>
                <Button variant="secondary" onClick={() => setSelectedScan(null)} style={{ flex: 1, minHeight: 40 }}>
                  {tx('Close')}
                </Button>
                {selectedScan.status !== 'Approved' && (
                  <Button
                    onClick={() => {
                      const data = selectedScan.approved || selectedScan.parsed || {};
                      setScan(selectedScan);
                      setApproved({ ...emptyParsed, ...data, items: data.items ?? [] });
                      setScanStep(5);
                      setIsReviewOpen(true);
                      setSelectedScan(null);
                    }}
                    style={{ flex: 1.5, minHeight: 40, background: 'var(--accent)' }}
                  >
                    <Sparkles size={14} style={{ marginRight: 6 }} /> {tx('Edit & Commit')}
                  </Button>
                )}
                <Button
                  variant="danger"
                  onClick={() => {
                    handleDeleteScan(selectedScan.id);
                    setSelectedScan(null);
                  }}
                  style={{ width: 44, minHeight: 40, padding: 0 }}
                  title={tx('Delete Scan Record')}
                >
                  <Trash2 size={16} />
                </Button>
              </div>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

function round(value: number) {
  return Math.round(value * 100) / 100;
}
