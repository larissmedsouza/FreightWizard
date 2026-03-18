'use client';

import { useEffect, useState, useRef } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';

const API_URL = 'https://freightwizard-production.up.railway.app';

const Icon = ({ name, className = "w-6 h-6", style }: { name: string; className?: string; style?: React.CSSProperties }) => (
  <img src={`/icons/${name}.svg`} alt={name} className={className} style={style} />
);

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
  const [session, setSession] = useState<string | null>(null);
  const [darkMode, setDarkMode] = useState(true);
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

  const theme = darkMode ? {
    bg: 'bg-[#050510]',
    card: 'bg-[#0a0a1a]',
    cardBorder: 'border-white/5',
    text: 'text-white',
    textMuted: 'text-gray-400',
    textDim: 'text-gray-500',
    hover: 'hover:bg-white/5',
    input: 'bg-[#0f0f1f] border-white/10 text-white placeholder-gray-600',
    iconFilter: { filter: 'brightness(0) invert(1)' },
  } : {
    bg: 'bg-gradient-to-br from-slate-100 via-blue-50 to-indigo-50',
    card: 'bg-white/80 backdrop-blur-sm',
    cardBorder: 'border-slate-200/50',
    text: 'text-slate-900',
    textMuted: 'text-slate-600',
    textDim: 'text-slate-500',
    hover: 'hover:bg-slate-100/50',
    input: 'bg-white border-slate-200 text-slate-900 placeholder-slate-400',
    iconFilter: { filter: 'brightness(0) saturate(100%) invert(19%) sepia(96%) saturate(5765%) hue-rotate(268deg) brightness(102%) contrast(101%)' },
  };

  const notify = (type: 'success' | 'error', msg: string) => {
    setNotification({ type, msg });
    setTimeout(() => setNotification(null), 3000);
  };

  useEffect(() => {
    const savedTheme = localStorage.getItem('fw_theme');
    if (savedTheme) setDarkMode(savedTheme === 'dark');
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
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      setPastedText(text);
    };
    reader.readAsText(file);
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
        body: JSON.stringify({
          text: pastedText,
          fileName: fileName || 'document.txt',
          sessionId: session,
        }),
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

    let report = `SHIPMENT DOCUMENT EXTRACTION REPORT
Generated: ${date}
Document Type: ${doc.document_type}
Confidence Score: ${doc.confidence}%

═══════════════════════════════════════
SHIPMENT OVERVIEW
═══════════════════════════════════════
BL/AWB Number: ${blNum}
Booking Number: ${doc.references?.booking_number || 'N/A'}
Mode: ${doc.shipment_summary?.mode || 'N/A'}
Route: ${route}
Incoterm: ${doc.shipment_summary?.incoterm || 'N/A'}
Freight Terms: ${doc.freight?.terms || 'N/A'}

═══════════════════════════════════════
PARTIES
═══════════════════════════════════════
Shipper: ${doc.parties?.shipper || 'N/A'}
Consignee: ${doc.parties?.consignee || 'N/A'}
Notify Party: ${doc.parties?.notify_party || 'N/A'}

═══════════════════════════════════════
TRANSPORT
═══════════════════════════════════════
Vessel: ${doc.transport?.vessel || 'N/A'}
Voyage: ${doc.transport?.voyage || 'N/A'}
ETD: ${doc.transport?.etd || 'N/A'}
ETA: ${doc.transport?.eta || 'N/A'}
Final Destination: ${doc.transport?.final_destination || 'N/A'}

═══════════════════════════════════════
CARGO
═══════════════════════════════════════
Description: ${doc.cargo?.description || 'N/A'}
HS Code: ${doc.cargo?.hs_code || 'N/A'}
Container Type: ${doc.cargo?.container_type || 'N/A'}
Container Numbers: ${doc.references?.container_numbers?.map(c => c.value).join(', ') || 'N/A'}
Seal Numbers: ${doc.cargo?.seal_numbers?.join(', ') || 'N/A'}
Packages: ${doc.cargo?.packages || 'N/A'}
Gross Weight: ${doc.cargo?.gross_weight?.value ? `${doc.cargo.gross_weight.value} ${doc.cargo.gross_weight.unit}` : 'N/A'}
Net Weight: ${doc.cargo?.net_weight?.value ? `${doc.cargo.net_weight.value} ${doc.cargo.net_weight.unit}` : 'N/A'}
Tare Weight: ${doc.cargo?.tare_weight?.value ? `${doc.cargo.tare_weight.value} ${doc.cargo.tare_weight.unit}` : 'N/A'}
Volume: ${doc.cargo?.volume_cbm ? `${doc.cargo.volume_cbm} CBM` : 'N/A'}`;

    if (doc.cargo?.dangerous_goods?.is_dangerous) {
      report += `\n\n⚠️ DANGEROUS GOODS\nUN Number: ${doc.cargo.dangerous_goods.un_number || 'N/A'}\nClass: ${doc.cargo.dangerous_goods.class || 'N/A'}\nPacking Group: ${doc.cargo.dangerous_goods.packing_group || 'N/A'}\nProper Shipping Name: ${doc.cargo.dangerous_goods.proper_shipping_name || 'N/A'}`;
    }

    report += `\n\n═══════════════════════════════════════
COMPLIANCE
═══════════════════════════════════════
Country of Origin: ${doc.compliance?.country_of_origin || 'N/A'}
Customs Value: ${doc.compliance?.customs_value ? `${doc.compliance.customs_value} ${doc.compliance.currency || ''}` : 'N/A'}
Export License: ${doc.compliance?.export_license || 'N/A'}`;

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

  const getConfidenceColor = (score: number) => {
    if (score >= 80) return 'text-green-400';
    if (score >= 60) return 'text-yellow-400';
    return 'text-red-400';
  };

  const getConfidenceBg = (score: number) => {
    if (score >= 80) return 'bg-green-500';
    if (score >= 60) return 'bg-yellow-500';
    return 'bg-red-500';
  };

  const getDocTypeIcon = (type: string) => {
    const map: Record<string, string> = {
      'HBL': 'Dashboard_documents_HBL',
      'MBL': 'Dashboard_documents_MBL',
      'AWB': 'Dashboard_documents_other',
      'Invoice': 'Dashboard_documents_other',
      'Packing List': 'Dashboard_documents_other',
      'Other': 'Dashboard_documents_other',
    };
    return map[type] || 'Dashboard_documents_other';
  };

  const getModeIconName = (mode: string) => {
    const map: Record<string, string> = {
      'ocean': 'Dashboard_documents_ocean',
      'air': 'Dashboard_documents_air',
      'road': 'Dashboard_documents_road',
      'rail': 'Dashboard_documents_rail',
    };
    return map[mode?.toLowerCase()] || 'Dashboard_documents_ocean';
  };

  const displayAnalysis = selected ? selected.analysis : analysis;

  const generateRiskEmail = () => {
    if (!displayAnalysis?.risks?.length) return;
    const risks = displayAnalysis.risks.join('\n- ');
    const missing = displayAnalysis.missing_information?.join('\n- ') || 'None';
    const text = `Dear Partner,\n\nWe have reviewed the shipping document ${displayAnalysis.references?.bl_number || ''} and identified the following issues:\n\nRisks:\n- ${risks}\n\nMissing information:\n- ${missing}\n\nKindly address the above at your earliest convenience.\n\nBest regards,\nFreight Team`;
    navigator.clipboard.writeText(text);
    notify('success', 'Risk email copied!');
  };

  const tabs = [
    { key: 'summary', icon: 'Dashboard_documents_summary', label: 'Summary' },
    { key: 'parties', icon: 'Dashboard_documents_parties', label: 'Parties' },
    { key: 'cargo', icon: 'Dashboard_documents_cargo', label: 'Cargo' },
    { key: 'compliance', icon: 'Dashboard_documents_compliance', label: 'Compliance' },
    { key: 'risks', icon: 'Dashboard_documents_risks', label: 'Risks' },
  ] as const;

  return (
    <div className={`min-h-screen ${theme.bg} ${theme.text} transition-colors`}>
      {notification && (
        <div className={`fixed top-4 right-4 z-50 px-6 py-3 rounded-xl shadow-xl text-white ${notification.type === 'success' ? 'bg-green-500' : 'bg-red-500'}`}>
          {notification.msg}
        </div>
      )}

      {/* Report Modal */}
      {showReport && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className={`${theme.card} border ${theme.cardBorder} rounded-2xl w-full max-w-2xl max-h-[80vh] flex flex-col shadow-2xl`}>
            <div className="flex items-center justify-between p-6 border-b border-white/5">
              <h2 className="text-lg font-bold flex items-center gap-2">
                <Icon name="Dashboard_documents_extraction_report" className="w-5 h-5" style={theme.iconFilter} />
                Document Extraction Report
              </h2>
              <div className="flex gap-2">
                <button onClick={copyReport} className="px-4 py-2 bg-gradient-to-r from-[#9E14FB] to-[#1BA1FF] rounded-xl text-white text-sm font-medium flex items-center gap-2">
                  <Icon name="Dashboard_documents_copy_all" className="w-4 h-4" style={{ filter: 'brightness(0) invert(1)' }} />
                  Copy All
                </button>
                <button onClick={() => setShowReport(false)} className={`px-4 py-2 ${theme.hover} border ${theme.cardBorder} rounded-xl text-sm`}>
                  ✕ Close
                </button>
              </div>
            </div>
            <div className="flex-1 overflow-y-auto p-6">
              <pre className={`whitespace-pre-wrap font-mono text-xs ${theme.textMuted} leading-relaxed`}>
                {reportText}
              </pre>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <header className={`${theme.card} border-b ${theme.cardBorder} px-6 py-4 flex items-center justify-between sticky top-0 z-40`}>
        <div className="flex items-center gap-4">
          <Link href="/dashboard" className="flex items-center gap-2">
            <img src="/icons/webpage_main_logo_white.svg" alt="FreightWizard" className={`h-6 w-6 object-contain ${darkMode ? '' : 'brightness-0'}`} />
            <span className="text-lg font-bold">FreightWizard</span>
          </Link>
          <span className={`text-sm ${theme.textMuted}`}>/ Document Intelligence</span>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => { setDarkMode(!darkMode); localStorage.setItem('fw_theme', !darkMode ? 'dark' : 'light'); }}
            className={`p-2 rounded-full ${theme.hover} border ${theme.cardBorder}`}
          >
            <Icon
              name={darkMode ? 'Dashboard_documents_sun_light_mode' : 'Dashboard_documents_moon_dark_mode'}
              className="w-5 h-5"
              style={theme.iconFilter}
            />
          </button>
          <Link href={`/dashboard?session=${session}`} className={`px-4 py-2 text-sm ${theme.textMuted} border ${theme.cardBorder} rounded-full ${theme.hover}`}>
            ← Dashboard
          </Link>
          <Link href={`/documents/compare?session=${session}`} className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-[#9E14FB] via-[#5200FF] to-[#1BA1FF] rounded-full text-sm font-medium text-white">
  🔍 Compare Docs
</Link>
        </div>
      </header>

      <div className="max-w-7xl mx-auto p-6">
        <div className="mb-8 flex items-center gap-3">
          <Icon name="Dashboard_documents" className="w-8 h-8" style={theme.iconFilter} />
          <div>
            <h1 className="text-3xl font-bold">Document Intelligence</h1>
            <p className={theme.textMuted}>Upload shipping documents for AI-powered analysis, risk detection and report generation</p>
          </div>
        </div>

        <div className="grid lg:grid-cols-3 gap-6">
          {/* Left: Upload + History */}
          <div className="space-y-4">
            <div className={`${theme.card} border ${theme.cardBorder} rounded-2xl p-5`}>
              <h2 className="font-semibold mb-4 flex items-center gap-2">
                <Icon name="Dashboard_documents_Analyze_document" className="w-5 h-5" style={theme.iconFilter} />
                Analyze Document
              </h2>

              {/* Mode Toggle */}
              <div className={`flex gap-1 p-1 ${darkMode ? 'bg-white/5' : 'bg-slate-100'} rounded-xl mb-4`}>
                <button
                  onClick={() => setInputMode('upload')}
                  className={`flex-1 py-2 text-sm rounded-lg transition flex items-center justify-center gap-2 ${inputMode === 'upload' ? 'bg-gradient-to-r from-[#9E14FB] to-[#1BA1FF] text-white' : theme.textMuted}`}
                >
                  <Icon
                    name="Dashboard_documents_upload_file"
                    className="w-4 h-4"
                    style={inputMode === 'upload' ? { filter: 'brightness(0) invert(1)' } : theme.iconFilter}
                  />
                  Upload File
                </button>
                <button
                  onClick={() => setInputMode('paste')}
                  className={`flex-1 py-2 text-sm rounded-lg transition flex items-center justify-center gap-2 ${inputMode === 'paste' ? 'bg-gradient-to-r from-[#9E14FB] to-[#1BA1FF] text-white' : theme.textMuted}`}
                >
                  <Icon
                    name="Dashboard_documents_paste_text"
                    className="w-4 h-4"
                    style={inputMode === 'paste' ? { filter: 'brightness(0) invert(1)' } : theme.iconFilter}
                  />
                  Paste Text
                </button>
              </div>

              {inputMode === 'upload' ? (
                <div
                  onClick={() => fileRef.current?.click()}
                  className={`border-2 border-dashed ${darkMode ? 'border-white/10 hover:border-[#5200FF]/50' : 'border-slate-200 hover:border-[#5200FF]/50'} rounded-xl p-6 text-center cursor-pointer transition mb-4`}
                >
                  <div className="w-12 h-12 mx-auto mb-3 p-2 rounded-xl bg-gradient-to-r from-[#9E14FB]/20 to-[#1BA1FF]/20">
                    <Icon name="Dashboard_documents_Click_to_upload" className="w-full h-full" style={theme.iconFilter} />
                  </div>
                  <p className={`text-sm ${theme.textMuted}`}>
                    {fileName ? `✅ ${fileName}` : 'Click to upload TXT or paste document text'}
                  </p>
                  <p className={`text-xs ${theme.textDim} mt-1`}>Supports BL, AWB, Invoice, Packing List</p>
                  <input
                    ref={fileRef}
                    type="file"
                    accept=".txt,.csv"
                    className="hidden"
                    onChange={(e) => e.target.files?.[0] && handleFileUpload(e.target.files[0])}
                  />
                </div>
              ) : (
                <textarea
                  value={pastedText}
                  onChange={(e) => setPastedText(e.target.value)}
                  placeholder="Paste document text here..."
                  rows={6}
                  className={`w-full px-4 py-3 rounded-xl border ${theme.input} mb-4 focus:outline-none focus:border-[#5200FF] resize-none text-sm`}
                />
              )}

              {inputMode === 'upload' && pastedText && (
                <div className={`${darkMode ? 'bg-green-500/10' : 'bg-green-50'} border border-green-500/20 rounded-xl p-3 mb-4`}>
                  <p className="text-green-400 text-xs">✅ File loaded — {pastedText.length} characters</p>
                </div>
              )}

              <button
                onClick={analyzeDocument}
                disabled={loading || !pastedText.trim()}
                className="w-full py-3 bg-gradient-to-r from-[#9E14FB] via-[#5200FF] to-[#1BA1FF] rounded-xl font-medium text-white disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {loading ? (
                  <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div> Analyzing...</>
                ) : (
                  <>
                    <Icon name="Dashboard_documents_Analyze_document" className="w-5 h-5" style={{ filter: 'brightness(0) invert(1)' }} />
                    Analyze Document
                  </>
                )}
              </button>
            </div>

            {/* History */}
            {history.length > 0 && (
              <div className={`${theme.card} border ${theme.cardBorder} rounded-2xl p-5`}>
                <h2 className="font-semibold mb-3 flex items-center gap-2">
                  <Icon name="Dashboard_documents_recent_documents" className="w-5 h-5" style={theme.iconFilter} />
                  Recent Documents
                </h2>
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {history.map((doc) => (
                    <div
                      key={doc.id}
                      onClick={() => { setSelected(doc); setAnalysis(null); setActiveTab('summary'); setShowReport(false); }}
                      className={`p-3 rounded-xl border cursor-pointer transition ${selected?.id === doc.id ? 'border-[#5200FF]/50 bg-gradient-to-r from-[#9E14FB]/10 to-[#1BA1FF]/10' : `${theme.cardBorder} ${theme.hover}`}`}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <div className="flex items-center gap-2">
                          <Icon name={getDocTypeIcon(doc.document_type)} className="w-4 h-4" style={theme.iconFilter} />
                          <span className="text-sm font-medium">{doc.document_type}</span>
                        </div>
                        <span className={`text-xs font-bold ${getConfidenceColor(doc.confidence)}`}>{doc.confidence}%</span>
                      </div>
                      <p className={`text-xs ${theme.textDim} truncate`}>{doc.file_name}</p>
                      <p className={`text-xs ${theme.textDim}`}>{new Date(doc.created_at).toLocaleDateString()}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Right: Analysis Results */}
          <div className="lg:col-span-2">
            {displayAnalysis ? (
              <div className={`${theme.card} border ${theme.cardBorder} rounded-2xl overflow-hidden`}>
                {/* Document Header */}
                <div className="p-6 border-b border-white/5 bg-gradient-to-r from-[#9E14FB]/10 to-[#1BA1FF]/10">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 p-2 rounded-xl bg-gradient-to-r from-[#9E14FB]/20 to-[#1BA1FF]/20">
                        <Icon name={getDocTypeIcon(displayAnalysis.document_type)} className="w-full h-full" style={theme.iconFilter} />
                      </div>
                      <div>
                        <h2 className="text-xl font-bold">{displayAnalysis.document_type}</h2>
                        <div className="flex items-center gap-1">
                          <Icon name={getModeIconName(displayAnalysis.shipment_summary?.mode)} className="w-4 h-4" style={theme.iconFilter} />
                          <p className={`text-sm ${theme.textMuted}`}>{displayAnalysis.shipment_summary?.route}</p>
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className={`text-3xl font-bold ${getConfidenceColor(displayAnalysis.confidence)}`}>
                        {displayAnalysis.confidence}%
                      </div>
                      <p className={`text-xs ${theme.textDim}`}>Confidence</p>
                      <div className={`h-1.5 w-24 ${darkMode ? 'bg-white/10' : 'bg-slate-200'} rounded-full mt-1 ml-auto`}>
                        <div className={`h-full rounded-full ${getConfidenceBg(displayAnalysis.confidence)}`} style={{ width: `${displayAnalysis.confidence}%` }} />
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-3 mb-4">
                    {[
                      { label: 'Incoterm', value: displayAnalysis.shipment_summary?.incoterm || '—' },
                      { label: 'Freight', value: displayAnalysis.freight?.terms || '—' },
                      { label: 'Mode', value: displayAnalysis.shipment_summary?.mode || '—' },
                    ].map((stat, i) => (
                      <div key={i} className={`${darkMode ? 'bg-white/5' : 'bg-white/60'} rounded-xl p-3 text-center`}>
                        <p className={`text-xs ${theme.textDim} mb-1`}>{stat.label}</p>
                        <p className="text-sm font-semibold capitalize">{stat.value}</p>
                      </div>
                    ))}
                  </div>

                  {/* Generate Report Button */}
                  <button
                    onClick={handleGenerateReport}
                    className="w-full py-3 bg-gradient-to-r from-[#9E14FB] via-[#5200FF] to-[#1BA1FF] rounded-xl font-medium text-white flex items-center justify-center gap-2"
                  >
                    <Icon name="Dashboard_documents_generate_extraction_report" className="w-5 h-5" style={{ filter: 'brightness(0) invert(1)' }} />
                    Generate Extraction Report
                  </button>
                </div>

                {/* Dangerous Goods Alert */}
                {displayAnalysis.cargo?.dangerous_goods?.is_dangerous && (
                  <div className="mx-6 mt-4 p-4 bg-red-500/20 border border-red-500/40 rounded-xl">
                    <h3 className="text-red-400 font-bold flex items-center gap-2 mb-2">
                      ☢️ DANGEROUS GOODS DETECTED
                    </h3>
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      <div><span className={theme.textDim}>UN Number:</span> <span className="text-red-300 font-mono">{displayAnalysis.cargo.dangerous_goods.un_number || '—'}</span></div>
                      <div><span className={theme.textDim}>Class:</span> <span className="text-red-300">{displayAnalysis.cargo.dangerous_goods.class || '—'}</span></div>
                      <div><span className={theme.textDim}>Packing Group:</span> <span className="text-red-300">{displayAnalysis.cargo.dangerous_goods.packing_group || '—'}</span></div>
                      <div><span className={theme.textDim}>PSN:</span> <span className="text-red-300">{displayAnalysis.cargo.dangerous_goods.proper_shipping_name || '—'}</span></div>
                    </div>
                  </div>
                )}

                {/* Risks Banner */}
                {displayAnalysis.risks?.length > 0 && (
                  <div className={`mx-6 mt-4 p-4 ${darkMode ? 'bg-red-500/10' : 'bg-red-50'} border border-red-500/20 rounded-xl`}>
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="text-red-400 font-semibold text-sm flex items-center gap-2">
                        <Icon name="Dashboard_documents_risk_detected" className="w-4 h-4" style={{ filter: 'brightness(0) saturate(100%) invert(40%) sepia(80%) saturate(2000%) hue-rotate(330deg)' }} />
                        {displayAnalysis.risks.length} Risk{displayAnalysis.risks.length > 1 ? 's' : ''} Detected
                      </h3>
                      <button onClick={generateRiskEmail} className="text-xs px-3 py-1 bg-red-500/20 text-red-400 rounded-full hover:bg-red-500/30 transition flex items-center gap-1">
                        <Icon name="Dashboard_documents_copy_risk_email" className="w-3 h-3" style={{ filter: 'brightness(0) saturate(100%) invert(40%) sepia(80%) saturate(2000%) hue-rotate(330deg)' }} />
                        Copy Risk Email
                      </button>
                    </div>
                    <ul className="space-y-1">
                      {displayAnalysis.risks.map((risk, i) => (
                        <li key={i} className={`text-xs ${theme.textMuted} flex items-start gap-2`}>
                          <span className="text-red-400 mt-0.5">•</span> {risk}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Missing Info */}
                {displayAnalysis.missing_information?.length > 0 && (
                  <div className={`mx-6 mt-3 p-4 ${darkMode ? 'bg-yellow-500/10' : 'bg-yellow-50'} border border-yellow-500/20 rounded-xl`}>
                    <h3 className="text-yellow-400 font-semibold text-sm mb-2 flex items-center gap-2">
                      <Icon name="Dashboard_documents_missing_information" className="w-4 h-4" style={{ filter: 'brightness(0) saturate(100%) invert(80%) sepia(60%) saturate(800%) hue-rotate(5deg)' }} />
                      Missing Information
                    </h3>
                    <div className="flex flex-wrap gap-2">
                      {displayAnalysis.missing_information.map((item, i) => (
                        <span key={i} className="text-xs px-2 py-1 bg-yellow-500/20 text-yellow-400 rounded-full">{item}</span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Tabs */}
                <div className={`flex gap-1 p-1 mx-6 mt-4 ${darkMode ? 'bg-white/5' : 'bg-slate-100'} rounded-xl`}>
                  {tabs.map((tab) => (
                    <button
                      key={tab.key}
                      onClick={() => setActiveTab(tab.key)}
                      className={`flex-1 py-2 text-xs rounded-lg transition flex items-center justify-center gap-1 ${activeTab === tab.key ? 'bg-gradient-to-r from-[#9E14FB] to-[#1BA1FF] text-white' : theme.textMuted}`}
                    >
                      <Icon
                        name={tab.icon}
                        className="w-3.5 h-3.5"
                        style={activeTab === tab.key ? { filter: 'brightness(0) invert(1)' } : theme.iconFilter}
                      />
                      {tab.label}
                    </button>
                  ))}
                </div>

                {/* Tab Content */}
                <div className="p-6">
                  {activeTab === 'summary' && (
                    <div className="space-y-4">
                      <div>
                        <h3 className={`text-xs font-semibold ${theme.textDim} uppercase tracking-wider mb-3`}>Transport</h3>
                        <div className="grid grid-cols-2 gap-3">
                          {[
                            { label: 'POL', value: `${displayAnalysis.transport?.pol?.name || '—'} (${displayAnalysis.transport?.pol?.code || '—'})` },
                            { label: 'POD', value: `${displayAnalysis.transport?.pod?.name || '—'} (${displayAnalysis.transport?.pod?.code || '—'})` },
                            { label: 'Vessel', value: displayAnalysis.transport?.vessel || '—' },
                            { label: 'Voyage', value: displayAnalysis.transport?.voyage || '—' },
                            { label: 'ETD', value: displayAnalysis.transport?.etd || '—' },
                            { label: 'ETA', value: displayAnalysis.transport?.eta || '—' },
                          ].map((item, i) => (
                            <div key={i} className={`${darkMode ? 'bg-white/5' : 'bg-slate-50'} rounded-xl p-3`}>
                              <p className={`text-xs ${theme.textDim} mb-1`}>{item.label}</p>
                              <p className="text-sm font-medium">{item.value}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                      <div>
                        <h3 className={`text-xs font-semibold ${theme.textDim} uppercase tracking-wider mb-3`}>References</h3>
                        <div className="grid grid-cols-2 gap-3">
                          {[
                            { label: 'BL Number', value: displayAnalysis.references?.bl_number || '—' },
                            { label: 'Booking', value: displayAnalysis.references?.booking_number || '—' },
                          ].map((item, i) => (
                            <div key={i} className={`${darkMode ? 'bg-white/5' : 'bg-slate-50'} rounded-xl p-3`}>
                              <p className={`text-xs ${theme.textDim} mb-1`}>{item.label}</p>
                              <p className="text-sm font-medium font-mono">{item.value}</p>
                            </div>
                          ))}
                        </div>
                        {displayAnalysis.references?.container_numbers?.length > 0 && (
                          <div className={`mt-3 ${darkMode ? 'bg-white/5' : 'bg-slate-50'} rounded-xl p-3`}>
                            <p className={`text-xs ${theme.textDim} mb-2`}>Container Numbers</p>
                            <div className="flex flex-wrap gap-2">
                              {displayAnalysis.references.container_numbers.map((c, i) => (
                                <span key={i} className={`text-xs px-3 py-1 rounded-full font-mono ${c.uncertain ? 'bg-yellow-500/20 text-yellow-400' : 'bg-[#5200FF]/20 text-[#9E14FB]'}`}>
                                  {c.value} {c.uncertain ? '⚠️' : ''}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                      {displayAnalysis.shipment_summary?.description && (
                        <div className={`${darkMode ? 'bg-gradient-to-r from-[#9E14FB]/10 to-[#1BA1FF]/10' : 'bg-gradient-to-r from-purple-50 to-blue-50'} rounded-xl p-4`}>
                          <p className={`text-xs ${theme.textDim} mb-1`}>Operational Summary</p>
                          <p className="text-sm">{displayAnalysis.shipment_summary.description}</p>
                        </div>
                      )}
                    </div>
                  )}

                  {activeTab === 'parties' && (
                    <div className="space-y-3">
                      {[
                        { label: 'Shipper', icon: 'Dashboard_documents_shipper', value: displayAnalysis.parties?.shipper },
                        { label: 'Consignee', icon: 'Dashboard_documents_consignee', value: displayAnalysis.parties?.consignee },
                        { label: 'Notify Party', icon: 'Dashboard_documents_notify_party', value: displayAnalysis.parties?.notify_party },
                      ].map((party, i) => (
                        <div key={i} className={`${darkMode ? 'bg-white/5' : 'bg-slate-50'} rounded-xl p-4`}>
                          <div className="flex items-center gap-2 mb-1">
                            <Icon name={party.icon} className="w-4 h-4" style={theme.iconFilter} />
                            <p className={`text-xs ${theme.textDim}`}>{party.label}</p>
                          </div>
                          <p className="text-sm font-medium">{party.value || '—'}</p>
                        </div>
                      ))}
                    </div>
                  )}

                  {activeTab === 'cargo' && (
                    <div className="space-y-3">
                      <div className="grid grid-cols-2 gap-3">
                        {[
                          { label: 'Container Type', value: displayAnalysis.cargo?.container_type || '—' },
                          { label: 'HS Code', value: displayAnalysis.cargo?.hs_code || '—' },
                          { label: 'Packages', value: displayAnalysis.cargo?.packages ? String(displayAnalysis.cargo.packages) : '—' },
                          { label: 'Volume (CBM)', value: displayAnalysis.cargo?.volume_cbm ? `${displayAnalysis.cargo.volume_cbm} CBM` : '—' },
                          { label: 'Gross Weight', value: displayAnalysis.cargo?.gross_weight?.value ? `${displayAnalysis.cargo.gross_weight.value} ${displayAnalysis.cargo.gross_weight.unit}` : '—' },
                          { label: 'Net Weight', value: displayAnalysis.cargo?.net_weight?.value ? `${displayAnalysis.cargo.net_weight.value} ${displayAnalysis.cargo.net_weight.unit}` : '—' },
                          { label: 'Tare Weight', value: displayAnalysis.cargo?.tare_weight?.value ? `${displayAnalysis.cargo.tare_weight.value} ${displayAnalysis.cargo.tare_weight.unit}` : '—' },
                          { label: 'Freight Charges', value: displayAnalysis.freight?.charges || '—' },
                        ].map((item, i) => (
                          <div key={i} className={`${darkMode ? 'bg-white/5' : 'bg-slate-50'} rounded-xl p-3`}>
                            <p className={`text-xs ${theme.textDim} mb-1`}>{item.label}</p>
                            <p className="text-sm font-medium">{item.value}</p>
                          </div>
                        ))}
                      </div>
                      {displayAnalysis.cargo?.description && (
                        <div className={`${darkMode ? 'bg-white/5' : 'bg-slate-50'} rounded-xl p-4`}>
                          <p className={`text-xs ${theme.textDim} mb-1`}>Cargo Description</p>
                          <p className="text-sm">{displayAnalysis.cargo.description}</p>
                        </div>
                      )}
                      {displayAnalysis.cargo?.seal_numbers?.length > 0 && (
                        <div className={`${darkMode ? 'bg-white/5' : 'bg-slate-50'} rounded-xl p-4`}>
                          <p className={`text-xs ${theme.textDim} mb-2`}>Seal Numbers</p>
                          <div className="flex flex-wrap gap-2">
                            {displayAnalysis.cargo.seal_numbers.map((s, i) => (
                              <span key={i} className="text-xs px-3 py-1 bg-[#5200FF]/20 text-[#9E14FB] rounded-full font-mono">{s}</span>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {activeTab === 'compliance' && (
                    <div className="space-y-3">
                      <div className="grid grid-cols-2 gap-3">
                        {[
                          { label: 'Country of Origin', value: displayAnalysis.compliance?.country_of_origin || '—' },
                          { label: 'Currency', value: displayAnalysis.compliance?.currency || '—' },
                          { label: 'Customs Value', value: displayAnalysis.compliance?.customs_value || '—' },
                          { label: 'Export License', value: displayAnalysis.compliance?.export_license || '—' },
                        ].map((item, i) => (
                          <div key={i} className={`${darkMode ? 'bg-white/5' : 'bg-slate-50'} rounded-xl p-3`}>
                            <p className={`text-xs ${theme.textDim} mb-1`}>{item.label}</p>
                            <p className="text-sm font-medium">{item.value}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {activeTab === 'risks' && (
                    <div className="space-y-4">
                      {displayAnalysis.risks?.length > 0 ? (
                        <div>
                          <h3 className={`text-xs font-semibold ${theme.textDim} uppercase tracking-wider mb-3`}>Risks Detected</h3>
                          <div className="space-y-2">
                            {displayAnalysis.risks.map((risk, i) => (
                              <div key={i} className={`${darkMode ? 'bg-red-500/10' : 'bg-red-50'} border border-red-500/20 rounded-xl p-3`}>
                                <p className="text-sm text-red-400">• {risk}</p>
                              </div>
                            ))}
                          </div>
                        </div>
                      ) : (
                        <div className={`${darkMode ? 'bg-green-500/10' : 'bg-green-50'} border border-green-500/20 rounded-xl p-6 text-center`}>
                          <p className="text-green-400 text-2xl mb-2">✅</p>
                          <p className="text-green-400 font-medium">No risks detected!</p>
                        </div>
                      )}

                      {displayAnalysis.missing_information?.length > 0 && (
                        <div>
                          <h3 className={`text-xs font-semibold ${theme.textDim} uppercase tracking-wider mb-3`}>Missing Information</h3>
                          <div className="space-y-2">
                            {displayAnalysis.missing_information.map((item, i) => (
                              <div key={i} className={`${darkMode ? 'bg-yellow-500/10' : 'bg-yellow-50'} border border-yellow-500/20 rounded-xl p-3`}>
                                <p className="text-sm text-yellow-400">• {item}</p>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      <div className="flex gap-3">
                        <button onClick={generateRiskEmail} className={`flex-1 py-3 ${darkMode ? 'bg-white/10 hover:bg-white/20' : 'bg-slate-200 hover:bg-slate-300'} rounded-xl text-sm font-medium flex items-center justify-center gap-2`}>
                          <Icon name="Dashboard_documents_copy_risk_email" className="w-4 h-4" style={theme.iconFilter} />
                          Copy Risk Email
                        </button>
                        <button onClick={handleGenerateReport} className="flex-1 py-3 bg-gradient-to-r from-[#9E14FB] via-[#5200FF] to-[#1BA1FF] rounded-xl text-white text-sm font-medium flex items-center justify-center gap-2">
                          <Icon name="Dashboard_documents_full_report" className="w-4 h-4" style={{ filter: 'brightness(0) invert(1)' }} />
                          Full Report
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className={`${theme.card} border ${theme.cardBorder} rounded-2xl h-full flex items-center justify-center min-h-96`}>
                <div className="text-center p-8">
                  <div className="w-20 h-20 mx-auto mb-4 p-4 rounded-2xl bg-gradient-to-r from-[#9E14FB]/20 to-[#1BA1FF]/20">
                    <Icon name="Dashboard_documents__document_intelligence" className="w-full h-full" style={theme.iconFilter} />
                  </div>
                  <h3 className="text-xl font-bold mb-2">Document Intelligence</h3>
                  <p className={`${theme.textMuted} mb-6 max-w-sm`}>
                    Upload a shipping document or paste text to extract structured data, detect risks, and generate reports.
                  </p>
                  <div className="flex flex-wrap gap-2 justify-center">
                    {[
                      { label: 'MBL', icon: 'Dashboard_documents_MBL' },
                      { label: 'HBL', icon: 'Dashboard_documents_HBL' },
                      { label: 'AWB', icon: 'Dashboard_documents_AWB' },
{ label: 'Invoice', icon: 'Dashboard_documents_invoice' },
{ label: 'Packing List', icon: 'Dashboard_documents_packing_list' },
                    ].map(type => (
                      <span key={type.label} className={`text-xs px-3 py-1.5 ${darkMode ? 'bg-white/5' : 'bg-slate-100'} rounded-full ${theme.textMuted} flex items-center gap-1.5`}>
                        <Icon name={type.icon} className="w-3 h-3" style={theme.iconFilter} />
                        {type.label}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}