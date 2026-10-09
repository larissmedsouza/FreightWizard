'use client';

import { useEffect, useState, useRef } from 'react';
import { useSearchParams, usePathname } from 'next/navigation';
import Link from 'next/link';
import TrialBanner from '../components/TrialBanner';
import UpgradeModal from '../components/UpgradeModal';
import Icon from '@/app/components/ui/Icon';
import TopBar from '@/app/components/ui/TopBar';
import Modal from '@/app/components/ui/Modal';
import { appRootClass, PageHeader, SectionTitle, EmptyState, Notice } from '@/app/components/ui/Panel';
import { Button, ButtonLink, Spinner } from '@/app/components/ui/Button';
import { inputClass, textareaClass, DataLabel } from '@/app/components/ui/Field';
import { Tag, Chip } from '@/app/components/ui/Tag';
import { Toast, Segmented, th, tr } from '@/app/components/ui/Data';
import { toneClass, MODE_ICON, type Tone } from '@/app/components/ui/tones';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'https://freightwizard-production.up.railway.app';

type Language = 'en' | 'pt' | 'nl';


interface DocumentAnalysis {
  id?: string;
  document_type: string;
  confidence: number;
  file_name?: string;
  created_at?: string;
  shipment_summary: {
    mode: string;
    route: string;
    incoterm: string;
    description: string;
    status: string;
  };
  parties: {
    shipper: string;
    consignee: string;
    notify_party: string;
  };
  references: {
    bl_number: string;
    booking_number: string;
    container_numbers: { value: string; uncertain: boolean }[];
  };
  transport: {
    vessel: string;
    voyage: string;
    pol: { name: string; code: string };
    pod: { name: string; code: string };
    eta: string;
    etd: string;
    final_destination: string;
  };
  cargo: {
    description: string;
    hs_code: string;
    packages: number;
    gross_weight: { value: number; unit: string };
    net_weight: { value: number; unit: string };
    tare_weight: { value: number; unit: string };
    volume_cbm: number;
    container_type: string;
    seal_numbers: string[];
    dangerous_goods: {
      is_dangerous: boolean;
      un_number: string;
      class: string;
      packing_group: string;
      proper_shipping_name: string;
    };
  };
  freight: { terms: string; charges: string };
  compliance: {
    customs_value: string;
    currency: string;
    country_of_origin: string;
    export_license: string;
  };
  risks: string[];
  missing_information: string[];
}

interface SavedDocument {
  id: string;
  document_type: string;
  file_name: string;
  confidence: number;
  created_at: string;
  analysis: DocumentAnalysis;
}

export default function DocumentsPage() {
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const [session, setSession] = useState<string | null>(null);
  const [darkMode, setDarkMode] = useState(true);
  const [language, setLanguage] = useState<Language>('en');
  const [langMenuOpen, setLangMenuOpen] = useState(false);
  const [billingUrgent, setBillingUrgent] = useState(false);
  const [documentsBlocked, setDocumentsBlocked] = useState(false);
  const [loading, setLoading] = useState(false);
  const [analysis, setAnalysis] = useState<DocumentAnalysis | null>(null);
  const [history, setHistory] = useState<SavedDocument[]>([]);
  const [selected, setSelected] = useState<SavedDocument | null>(null);
  const [inputMode, setInputMode] = useState<'upload' | 'paste'>('upload');
  const [pastedText, setPastedText] = useState('');
  const [fileName, setFileName] = useState('');
  const [notification, setNotification] = useState<{ type: 'success' | 'error'; msg: string } | null>(null);
  const [activeTab, setActiveTab] = useState<'summary' | 'parties' | 'cargo' | 'compliance' | 'risks'>('summary');
  const [showReport, setShowReport] = useState(false);
  const [reportText, setReportText] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);


  const notify = (type: 'success' | 'error', msg: string) => {
    setNotification({ type, msg });
    setTimeout(() => setNotification(null), 3000);
  };

  const toggleTheme = () => {
    setDarkMode(!darkMode);
    localStorage.setItem('fw_theme', !darkMode ? 'dark' : 'light');
  };

  const changeLang = (l: Language) => {
    setLanguage(l);
    localStorage.setItem('fw_lang', l);
    setLangMenuOpen(false);
  };

  useEffect(() => {
    const savedTheme = localStorage.getItem('fw_theme');
    const savedLang = localStorage.getItem('fw_lang') as Language;
    if (savedTheme) setDarkMode(savedTheme === 'dark');
    if (savedLang) setLanguage(savedLang);
    const sid = searchParams.get('session') || localStorage.getItem('fw_session');
    if (sid) {
      setSession(sid);
      loadHistory(sid);
    }
  }, [searchParams]);

  const loadHistory = async (sid: string) => {
    try {
      const res = await fetch(`${API_URL}/api/documents?session=${sid}`);
      const data = await res.json();
      if (data.documents) setHistory(data.documents);
    } catch (e) { console.error(e); }
  };

  const handleFileUpload = async (file: File) => {
    setFileName(file.name);
    const ext = file.name.split('.').pop()?.toLowerCase();
    if (['pdf', 'jpg', 'jpeg', 'png'].includes(ext || '')) {
      const reader = new FileReader();
      reader.onload = async (e) => {
        const base64 = (e.target?.result as string).split(',')[1];
        notify('success', 'Extracting text from file...');
        try {
          const res = await fetch(`${API_URL}/api/extract-text`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ base64, mimeType: file.type, fileName: file.name, sessionId: session }),
          });
          const data = await res.json();
          if (data.text) { setPastedText(data.text); notify('success', 'Text extracted!'); }
          else notify('error', 'Could not extract text from file');
        } catch { notify('error', 'Failed to process file'); }
      };
      reader.readAsDataURL(file);
    } else {
      const reader = new FileReader();
      reader.onload = (e) => setPastedText(e.target?.result as string);
      reader.readAsText(file);
    }
  };

  const analyzeDocument = async () => {
    if (!pastedText.trim() || !session) return;
    setLoading(true);
    setAnalysis(null);
    setShowReport(false);
    try {
      const res = await fetch(`${API_URL}/api/analyze-document`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: pastedText, fileName: fileName || 'document.txt', sessionId: session }),
      });
      const data = await res.json();
      if (data.analysis) {
        setAnalysis(data.analysis);
        notify('success', 'Document analyzed successfully!');
        loadHistory(session);
        setActiveTab('summary');
        setSelected(null);
      } else {
        notify('error', data.error || 'Analysis failed');
      }
    } catch (e) {
      notify('error', 'Failed to analyze document');
    }
    setLoading(false);
  };

  const generateReport = (doc: DocumentAnalysis) => {
    const date = new Date().toLocaleDateString('en-GB');
    const blNum = doc.references?.bl_number || 'N/A';
    const route = `${doc.transport?.pol?.name || '?'} (${doc.transport?.pol?.code || '?'}) → ${doc.transport?.pod?.name || '?'} (${doc.transport?.pod?.code || '?'})`;
    let report = `SHIPMENT DOCUMENT EXTRACTION REPORT\nGenerated: ${date}\nDocument Type: ${doc.document_type}\nConfidence Score: ${doc.confidence}%\n\n═══════════════════════════════════════\nSHIPMENT OVERVIEW\n═══════════════════════════════════════\nBL/AWB Number: ${blNum}\nBooking Number: ${doc.references?.booking_number || 'N/A'}\nMode: ${doc.shipment_summary?.mode || 'N/A'}\nRoute: ${route}\nIncoterm: ${doc.shipment_summary?.incoterm || 'N/A'}\nFreight Terms: ${doc.freight?.terms || 'N/A'}\n\n═══════════════════════════════════════\nPARTIES\n═══════════════════════════════════════\nShipper: ${doc.parties?.shipper || 'N/A'}\nConsignee: ${doc.parties?.consignee || 'N/A'}\nNotify Party: ${doc.parties?.notify_party || 'N/A'}\n\n═══════════════════════════════════════\nTRANSPORT\n═══════════════════════════════════════\nVessel: ${doc.transport?.vessel || 'N/A'}\nVoyage: ${doc.transport?.voyage || 'N/A'}\nETD: ${doc.transport?.etd || 'N/A'}\nETA: ${doc.transport?.eta || 'N/A'}\nFinal Destination: ${doc.transport?.final_destination || 'N/A'}\n\n═══════════════════════════════════════\nCARGO\n═══════════════════════════════════════\nDescription: ${doc.cargo?.description || 'N/A'}\nHS Code: ${doc.cargo?.hs_code || 'N/A'}\nContainer Type: ${doc.cargo?.container_type || 'N/A'}\nContainer Numbers: ${doc.references?.container_numbers?.map(c => c.value).join(', ') || 'N/A'}\nSeal Numbers: ${doc.cargo?.seal_numbers?.join(', ') || 'N/A'}\nPackages: ${doc.cargo?.packages || 'N/A'}\nGross Weight: ${doc.cargo?.gross_weight?.value ? `${doc.cargo.gross_weight.value} ${doc.cargo.gross_weight.unit}` : 'N/A'}\nNet Weight: ${doc.cargo?.net_weight?.value ? `${doc.cargo.net_weight.value} ${doc.cargo.net_weight.unit}` : 'N/A'}\nTare Weight: ${doc.cargo?.tare_weight?.value ? `${doc.cargo.tare_weight.value} ${doc.cargo.tare_weight.unit}` : 'N/A'}\nVolume: ${doc.cargo?.volume_cbm ? `${doc.cargo.volume_cbm} CBM` : 'N/A'}`;
    if (doc.cargo?.dangerous_goods?.is_dangerous) {
      report += `\n\n⚠️ DANGEROUS GOODS\nUN Number: ${doc.cargo.dangerous_goods.un_number || 'N/A'}\nClass: ${doc.cargo.dangerous_goods.class || 'N/A'}\nPacking Group: ${doc.cargo.dangerous_goods.packing_group || 'N/A'}\nProper Shipping Name: ${doc.cargo.dangerous_goods.proper_shipping_name || 'N/A'}`;
    }
    report += `\n\n═══════════════════════════════════════\nCOMPLIANCE\n═══════════════════════════════════════\nCountry of Origin: ${doc.compliance?.country_of_origin || 'N/A'}\nCustoms Value: ${doc.compliance?.customs_value ? `${doc.compliance.customs_value} ${doc.compliance.currency || ''}` : 'N/A'}\nExport License: ${doc.compliance?.export_license || 'N/A'}`;
    if (doc.risks?.length > 0) {
      report += `\n\n═══════════════════════════════════════\n⚠️ RISKS DETECTED\n═══════════════════════════════════════`;
      doc.risks.forEach(r => { report += `\n• ${r}`; });
    }
    if (doc.missing_information?.length > 0) {
      report += `\n\n═══════════════════════════════════════\n❓ MISSING INFORMATION\n═══════════════════════════════════════`;
      doc.missing_information.forEach(m => { report += `\n• ${m}`; });
      report += `\n\n═══════════════════════════════════════\n📧 SUGGESTED EMAIL TO REQUEST MISSING INFO\n═══════════════════════════════════════\nDear Partner,\n\nPlease be informed that upon reviewing the shipping document ${blNum}, the following information is missing or incomplete:\n\n${doc.missing_information.map(m => `- ${m}`).join('\n')}\n\nKindly provide the above details at your earliest convenience to avoid delays in processing.\n\nBest regards,\nFreight Operations Team`;
    }
    report += `\n\n═══════════════════════════════════════\nEnd of Report — Generated by FreightWizard AI\n═══════════════════════════════════════`;
    return report;
  };

  const handleGenerateReport = () => {
    const doc = selected ? selected.analysis : analysis;
    if (!doc) return;
    setReportText(generateReport(doc));
    setShowReport(true);
  };

  const copyReport = () => {
    navigator.clipboard.writeText(reportText);
    notify('success', 'Report copied to clipboard!');
  };

  const confidenceTone = (score: number): Tone => (score >= 80 ? 'ok' : score >= 60 ? 'warn' : 'danger');

  const getDocTypeIcon = (type: string) => {
    const map: Record<string, 'docs' | 'air' | 'quote' | 'list'> = { HBL: 'docs', MBL: 'docs', AWB: 'air', Invoice: 'quote', 'Packing List': 'list', Other: 'docs' };
    return map[type] || 'docs';
  };

  const generateRiskEmail = () => {
    if (!displayAnalysis?.risks?.length) return;
    const risks = displayAnalysis.risks.join('\n- ');
    const missing = displayAnalysis.missing_information?.join('\n- ') || 'None';
    const text = `Dear Partner,\n\nWe have reviewed the shipping document ${displayAnalysis.references?.bl_number || ''} and identified the following issues:\n\nRisks:\n- ${risks}\n\nMissing information:\n- ${missing}\n\nKindly address the above at your earliest convenience.\n\nBest regards,\nFreight Team`;
    navigator.clipboard.writeText(text);
    notify('success', 'Risk email copied!');
  };

  const displayAnalysis = selected ? selected.analysis : analysis;

  const tabs = [
    { key: 'summary', icon: 'list', label: 'Summary' },
    { key: 'parties', icon: 'team', label: 'Parties' },
    { key: 'cargo', icon: 'container', label: 'Cargo' },
    { key: 'compliance', icon: 'compliance', label: 'Compliance' },
    { key: 'risks', icon: 'alert', label: 'Risks' },
  ] as const;

  const docField = (label: string, value: React.ReactNode, mono = false) => (
    <div className="rounded-fw-btn border border-app-line bg-app-panel p-3">
      <DataLabel className="mb-1">{label}</DataLabel>
      <p className={mono ? 'font-fw-mono text-app-mono text-app-ink' : 'text-app-ui font-medium capitalize text-app-ink'}>{value}</p>
    </div>
  );

  return (
    <div data-theme={darkMode ? 'dark' : 'light'} className={appRootClass}>
      <Toast notification={notification} />

      {/* Report Modal */}
      {showReport && (
        <Modal title="Document Extraction Report" icon="docs" size="lg" onClose={() => setShowReport(false)}
          footer={<>
            <Button onClick={() => setShowReport(false)}>Close</Button>
            <Button variant="primary" icon="copy" onClick={copyReport}>Copy All</Button>
          </>}>
          <pre className="whitespace-pre-wrap p-5 font-fw-mono text-app-mono-xs leading-relaxed text-app-ink-2">{reportText}</pre>
        </Modal>
      )}

      <TopBar session={session} user={null} darkMode={darkMode} language={language} onToggleTheme={toggleTheme} onChangeLanguage={changeLang} alert={billingUrgent} />

      <TrialBanner session={session} onSubscription={(sub) => {
        setBillingUrgent(sub.plan === 'trial' && sub.trial_days_remaining < 3);
        if (sub.plan === 'starter') setDocumentsBlocked(true);
      }} />

      {documentsBlocked && <UpgradeModal reason="documents_blocked" session={session} darkMode={darkMode} />}

      <main className="mx-auto max-w-7xl p-4 lg:p-6">
        <PageHeader
          className="mb-6"
          title="Document Intelligence"
          description="Upload shipping documents for AI-powered analysis, risk detection and report generation"
          actions={<ButtonLink href={`/documents/compare?session=${session}`} icon="compare">{language === 'pt' ? 'Comparar' : language === 'nl' ? 'Vergelijk' : 'Compare Docs'}</ButtonLink>}
        />

        <div className="grid gap-6 lg:grid-cols-3">
          {/* Left: Upload + History */}
          <div className="space-y-4">
            <section className="rounded-fw-card border border-app-line bg-app-card p-5">
              <SectionTitle icon="sparkle" className="mb-4">Analyze Document</SectionTitle>

              <Segmented className="mb-4 flex w-full [&>button]:flex-1 [&>button]:justify-center" label="Input mode" value={inputMode} onChange={setInputMode}
                options={[{ value: 'upload', label: 'Upload File', icon: 'upload' }, { value: 'paste', label: 'Paste Text', icon: 'copy' }]} />

              {inputMode === 'upload' ? (
                <button type="button" onClick={() => fileRef.current?.click()}
                  className="mb-4 w-full rounded-fw-card border border-dashed border-app-line-strong p-6 text-center transition-colors hover:border-app-accent-fill hover:bg-app-raised">
                  <span className="mx-auto mb-3 flex size-11 items-center justify-center rounded-fw-card border border-app-line text-app-accent">
                    <Icon name="upload" size={20} />
                  </span>
                  <p className="flex items-center justify-center gap-1.5 text-app-ui text-app-ink-2">
                    {fileName ? <><Icon name="check" size={14} className="text-app-ok-ink" /> <span className="font-fw-mono text-app-mono">{fileName}</span></> : 'Click to upload TXT or paste document text'}
                  </p>
                  <p className="mt-1 text-app-ui-sm text-app-ink-3">Supports BL, AWB, Invoice, Packing List</p>
                </button>
              ) : (
                <textarea value={pastedText} onChange={(e) => setPastedText(e.target.value)}
                  placeholder="Paste document text here..." rows={6} aria-label="Document text"
                  className={`${textareaClass} mb-4 font-fw-mono text-app-mono`} />
              )}
              <input ref={fileRef} type="file" accept=".txt,.csv,.pdf,.doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png"
                className="hidden" onChange={(e) => e.target.files?.[0] && handleFileUpload(e.target.files[0])} />

              {inputMode === 'upload' && pastedText && (
                <div className="mb-4">
                  <Notice tone="ok" icon="check">File loaded — <span className="font-fw-mono">{pastedText.length}</span> characters</Notice>
                </div>
              )}

              <Button variant="primary" className="w-full" icon={loading ? undefined : 'sparkle'} onClick={analyzeDocument} disabled={loading || !pastedText.trim()}>
                {loading ? <><Spinner className="size-3.5" /> Analyzing...</> : 'Analyze Document'}
              </Button>
            </section>

            {history.length > 0 && (
              <section className="rounded-fw-card border border-app-line bg-app-card p-5">
                <SectionTitle icon="clock" className="mb-3">Recent Documents</SectionTitle>
                <div className="max-h-64 space-y-2 overflow-y-auto">
                  {history.map((doc) => (
                    <button key={doc.id} type="button"
                      onClick={() => { setSelected(doc); setAnalysis(null); setActiveTab('summary'); setShowReport(false); }}
                      className={`w-full rounded-fw-btn border p-3 text-left transition-colors ${selected?.id === doc.id ? 'border-app-accent-fill bg-app-selected' : 'border-app-line hover:bg-app-raised'}`}>
                      <div className="mb-1 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Icon name={getDocTypeIcon(doc.document_type)} size={15} className="text-app-accent" />
                          <span className="text-app-ui font-medium">{doc.document_type}</span>
                        </div>
                        <span className={`font-fw-mono text-app-mono font-medium ${toneClass[confidenceTone(doc.confidence)].text}`}>{doc.confidence}%</span>
                      </div>
                      <p className="truncate font-fw-mono text-app-mono-xs text-app-ink-3">{doc.file_name}</p>
                      <p className="font-fw-mono text-app-mono-xs text-app-ink-3">{new Date(doc.created_at).toLocaleDateString()}</p>
                    </button>
                  ))}
                </div>
              </section>
            )}
          </div>

          {/* Right: Analysis Results */}
          <div className="lg:col-span-2">
            {displayAnalysis ? (
              <section className="overflow-hidden rounded-fw-card border border-app-line bg-app-card">
                <div className="border-b border-app-line p-5">
                  <div className="mb-4 flex items-start justify-between gap-4">
                    <div className="flex items-center gap-3">
                      <span className="flex size-11 flex-none items-center justify-center rounded-fw-card border border-app-line text-app-accent">
                        <Icon name={getDocTypeIcon(displayAnalysis.document_type)} size={20} />
                      </span>
                      <div>
                        <h2 className="font-fw-display text-app-title-sm font-normal">{displayAnalysis.document_type}</h2>
                        <p className="flex items-center gap-1.5 text-app-ui-sm text-app-ink-2">
                          <Icon name={MODE_ICON[displayAnalysis.shipment_summary?.mode?.toLowerCase()] || 'ocean'} size={14} className="text-app-ink-3" />
                          <span className="font-fw-mono">{displayAnalysis.shipment_summary?.route}</span>
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className={`font-fw-display text-app-kpi font-normal ${toneClass[confidenceTone(displayAnalysis.confidence)].text}`}>{displayAnalysis.confidence}%</p>
                      <DataLabel>Confidence</DataLabel>
                      <div className="ml-auto mt-1 h-1 w-24 bg-app-raised" aria-hidden>
                        <div className={`h-full ${toneClass[confidenceTone(displayAnalysis.confidence)].dot}`} style={{ width: `${displayAnalysis.confidence}%` }} />
                      </div>
                    </div>
                  </div>

                  <div className="mb-4 grid grid-cols-3 gap-3">
                    {docField('Incoterm', displayAnalysis.shipment_summary?.incoterm || '—', true)}
                    {docField('Freight', displayAnalysis.freight?.terms || '—')}
                    {docField('Mode', displayAnalysis.shipment_summary?.mode || '—')}
                  </div>

                  <Button variant="primary" className="w-full" icon="docs" onClick={handleGenerateReport}>Generate Extraction Report</Button>
                </div>

                <div className="space-y-3 px-5 pt-4">
                  {displayAnalysis.cargo?.dangerous_goods?.is_dangerous && (
                    <Notice tone="danger" icon="alert" title="Dangerous goods detected">
                      <dl className="mt-1 grid grid-cols-2 gap-2">
                        <div><span className="text-app-ink-3">UN Number:</span> <span className="font-fw-mono text-app-danger-ink">{displayAnalysis.cargo.dangerous_goods.un_number || '—'}</span></div>
                        <div><span className="text-app-ink-3">Class:</span> <span className="font-fw-mono text-app-danger-ink">{displayAnalysis.cargo.dangerous_goods.class || '—'}</span></div>
                        <div><span className="text-app-ink-3">Packing Group:</span> <span className="font-fw-mono text-app-danger-ink">{displayAnalysis.cargo.dangerous_goods.packing_group || '—'}</span></div>
                        <div><span className="text-app-ink-3">PSN:</span> <span className="text-app-danger-ink">{displayAnalysis.cargo.dangerous_goods.proper_shipping_name || '—'}</span></div>
                      </dl>
                    </Notice>
                  )}

                  {displayAnalysis.risks?.length > 0 && (
                    <Notice tone="danger" icon="alert"
                      title={<><span className="font-fw-mono">{displayAnalysis.risks.length}</span> Risk{displayAnalysis.risks.length > 1 ? 's' : ''} Detected</>}
                      action={<Button size="xs" icon="copy" onClick={generateRiskEmail}>Copy Risk Email</Button>}>
                      <ul className="space-y-1">
                        {displayAnalysis.risks.map((risk, i) => (
                          <li key={i} className="flex items-start gap-2"><span aria-hidden className="mt-1.5 size-1 flex-none rounded-full bg-app-danger-dot" /> {risk}</li>
                        ))}
                      </ul>
                    </Notice>
                  )}

                  {displayAnalysis.missing_information?.length > 0 && (
                    <Notice tone="warn" icon="info" title="Missing Information">
                      <div className="mt-1 flex flex-wrap gap-1.5">
                        {displayAnalysis.missing_information.map((item, i) => <Tag key={i} tone="warn" mono={false}>{item}</Tag>)}
                      </div>
                    </Notice>
                  )}
                </div>

                {/* Tabs */}
                <div className="mt-4 flex border-b border-app-line px-5" role="tablist">
                  {tabs.map((tab) => {
                    const active = activeTab === tab.key;
                    return (
                      <button key={tab.key} role="tab" aria-selected={active} onClick={() => setActiveTab(tab.key)}
                        className={`relative flex items-center gap-1.5 px-3 py-2.5 text-app-ui-sm transition-colors ${active ? 'font-medium text-app-ink' : 'text-app-ink-3 hover:text-app-ink'}`}>
                        <Icon name={tab.icon} size={15} className={active ? 'text-app-accent' : ''} />
                        {tab.label}
                        {active && <span aria-hidden className="absolute inset-x-2 bottom-0 h-0.5 bg-app-accent-fill" />}
                      </button>
                    );
                  })}
                </div>

                <div className="p-5">
                  {activeTab === 'summary' && (
                    <div className="space-y-5">
                      <div>
                        <DataLabel className="mb-2">Transport</DataLabel>
                        <div className="grid grid-cols-2 gap-3">
                          {docField('POL', `${displayAnalysis.transport?.pol?.name || '—'} (${displayAnalysis.transport?.pol?.code || '—'})`, true)}
                          {docField('POD', `${displayAnalysis.transport?.pod?.name || '—'} (${displayAnalysis.transport?.pod?.code || '—'})`, true)}
                          {docField('Vessel', displayAnalysis.transport?.vessel || '—', true)}
                          {docField('Voyage', displayAnalysis.transport?.voyage || '—', true)}
                          {docField('ETD', displayAnalysis.transport?.etd || '—', true)}
                          {docField('ETA', displayAnalysis.transport?.eta || '—', true)}
                        </div>
                      </div>
                      <div>
                        <DataLabel className="mb-2">References</DataLabel>
                        <div className="grid grid-cols-2 gap-3">
                          {docField('BL Number', displayAnalysis.references?.bl_number || '—', true)}
                          {docField('Booking', displayAnalysis.references?.booking_number || '—', true)}
                        </div>
                        {displayAnalysis.references?.container_numbers?.length > 0 && (
                          <div className="mt-3 rounded-fw-btn border border-app-line bg-app-panel p-3">
                            <DataLabel className="mb-2">Container Numbers</DataLabel>
                            <div className="flex flex-wrap gap-1.5">
                              {displayAnalysis.references.container_numbers.map((c, i) => (
                                c.uncertain
                                  ? <Tag key={i} tone="warn" title="Uncertain reading">{c.value}</Tag>
                                  : <Chip key={i} className="font-fw-mono text-app-mono">{c.value}</Chip>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                      {displayAnalysis.shipment_summary?.description && (
                        <div className="rounded-fw-btn border border-app-line bg-app-panel p-4">
                          <DataLabel className="mb-1">Operational Summary</DataLabel>
                          <p className="text-app-ui">{displayAnalysis.shipment_summary.description}</p>
                        </div>
                      )}
                    </div>
                  )}

                  {activeTab === 'parties' && (
                    <div className="space-y-3">
                      {([
                        { label: 'Shipper', icon: 'send', value: displayAnalysis.parties?.shipper },
                        { label: 'Consignee', icon: 'inbox', value: displayAnalysis.parties?.consignee },
                        { label: 'Notify Party', icon: 'bell', value: displayAnalysis.parties?.notify_party },
                      ] as const).map((party, i) => (
                        <div key={i} className="rounded-fw-btn border border-app-line bg-app-panel p-4">
                          <DataLabel className="mb-1 flex items-center gap-1.5"><Icon name={party.icon} size={13} /> {party.label}</DataLabel>
                          <p className="text-app-ui font-medium">{party.value || '—'}</p>
                        </div>
                      ))}
                    </div>
                  )}

                  {activeTab === 'cargo' && (
                    <div className="space-y-3">
                      <div className="grid grid-cols-2 gap-3">
                        {docField('Container Type', displayAnalysis.cargo?.container_type || '—', true)}
                        {docField('HS Code', displayAnalysis.cargo?.hs_code || '—', true)}
                        {docField('Packages', displayAnalysis.cargo?.packages ? String(displayAnalysis.cargo.packages) : '—', true)}
                        {docField('Volume (CBM)', displayAnalysis.cargo?.volume_cbm ? `${displayAnalysis.cargo.volume_cbm} CBM` : '—', true)}
                        {docField('Gross Weight', displayAnalysis.cargo?.gross_weight?.value ? `${displayAnalysis.cargo.gross_weight.value} ${displayAnalysis.cargo.gross_weight.unit}` : '—', true)}
                        {docField('Net Weight', displayAnalysis.cargo?.net_weight?.value ? `${displayAnalysis.cargo.net_weight.value} ${displayAnalysis.cargo.net_weight.unit}` : '—', true)}
                        {docField('Tare Weight', displayAnalysis.cargo?.tare_weight?.value ? `${displayAnalysis.cargo.tare_weight.value} ${displayAnalysis.cargo.tare_weight.unit}` : '—', true)}
                        {docField('Freight Charges', displayAnalysis.freight?.charges || '—', true)}
                      </div>
                      {displayAnalysis.cargo?.description && (
                        <div className="rounded-fw-btn border border-app-line bg-app-panel p-4">
                          <DataLabel className="mb-1">Cargo Description</DataLabel>
                          <p className="text-app-ui">{displayAnalysis.cargo.description}</p>
                        </div>
                      )}
                      {displayAnalysis.cargo?.seal_numbers?.length > 0 && (
                        <div className="rounded-fw-btn border border-app-line bg-app-panel p-4">
                          <DataLabel className="mb-2">Seal Numbers</DataLabel>
                          <div className="flex flex-wrap gap-1.5">
                            {displayAnalysis.cargo.seal_numbers.map((s, i) => <Chip key={i} className="font-fw-mono text-app-mono">{s}</Chip>)}
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {activeTab === 'compliance' && (
                    <div className="grid grid-cols-2 gap-3">
                      {docField('Country of Origin', displayAnalysis.compliance?.country_of_origin || '—')}
                      {docField('Currency', displayAnalysis.compliance?.currency || '—', true)}
                      {docField('Customs Value', displayAnalysis.compliance?.customs_value || '—', true)}
                      {docField('Export License', displayAnalysis.compliance?.export_license || '—', true)}
                    </div>
                  )}

                  {activeTab === 'risks' && (
                    <div className="space-y-4">
                      {displayAnalysis.risks?.length > 0 ? (
                        <div>
                          <DataLabel className="mb-2">Risks Detected</DataLabel>
                          <div className="space-y-2">
                            {displayAnalysis.risks.map((risk, i) => (
                              <div key={i} className="flex items-start gap-2 rounded-fw-btn border border-app-line bg-app-danger-bg p-3 text-app-ui text-app-danger-ink">
                                <Icon name="alert" size={15} className="mt-0.5 flex-none" /> {risk}
                              </div>
                            ))}
                          </div>
                        </div>
                      ) : (
                        <Notice tone="ok" icon="check" title="No risks detected!" />
                      )}

                      {displayAnalysis.missing_information?.length > 0 && (
                        <div>
                          <DataLabel className="mb-2">Missing Information</DataLabel>
                          <div className="space-y-2">
                            {displayAnalysis.missing_information.map((item, i) => (
                              <div key={i} className="flex items-start gap-2 rounded-fw-btn border border-app-line bg-app-warn-bg p-3 text-app-ui text-app-warn-ink">
                                <Icon name="info" size={15} className="mt-0.5 flex-none" /> {item}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      <div className="flex gap-3">
                        <Button className="flex-1" icon="copy" onClick={generateRiskEmail}>Copy Risk Email</Button>
                        <Button variant="primary" className="flex-1" icon="docs" onClick={handleGenerateReport}>Full Report</Button>
                      </div>
                    </div>
                  )}
                </div>
              </section>
            ) : (
              <div className="flex h-full min-h-96 items-center justify-center rounded-fw-card border border-app-line bg-app-card">
                <EmptyState icon="docs" title="Document Intelligence"
                  text="Upload a shipping document or paste text to extract structured data, detect risks, and generate reports."
                  action={
                    <div className="flex flex-wrap justify-center gap-1.5">
                      {(['MBL', 'HBL', 'AWB', 'Invoice', 'Packing List'] as const).map(type => (
                        <Chip key={type}><Icon name={getDocTypeIcon(type)} size={13} className="text-app-ink-3" />{type}</Chip>
                      ))}
                    </div>
                  } />
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
