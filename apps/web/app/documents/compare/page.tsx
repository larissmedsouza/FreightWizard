'use client';

import { useEffect, useState, useRef } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

const API_URL = 'https://freightwizard-production.up.railway.app';

const Icon = ({ name, className = "w-6 h-6", style }: { name: string; className?: string; style?: React.CSSProperties }) => (
  <img src={`/icons/${name}.svg`} alt={name} className={className} style={style} />
);

interface ComparisonField {
  field: string;
  category: string;
  doc1_value: string;
  doc2_value: string;
  status: 'match' | 'mismatch' | 'missing_in_doc1' | 'missing_in_doc2' | 'both_missing';
  severity: 'critical' | 'high' | 'medium' | 'low';
  note: string;
}

interface ComparisonResult {
  doc1_type: string;
  doc2_type: string;
  overall_status: 'match' | 'minor_issues' | 'major_issues' | 'critical_issues';
  match_score: number;
  summary: string;
  comparisons: ComparisonField[];
  critical_mismatches: string[];
  recommendations: string[];
}

export default function ComparePage() {
  const searchParams = useSearchParams();
  const [session, setSession] = useState<string | null>(null);
  const [darkMode, setDarkMode] = useState(true);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ComparisonResult | null>(null);
  const [notification, setNotification] = useState<{ type: 'success' | 'error'; msg: string } | null>(null);
  const [doc1Text, setDoc1Text] = useState('');
  const [doc2Text, setDoc2Text] = useState('');
  const [doc1Name, setDoc1Name] = useState('Document 1');
  const [doc2Name, setDoc2Name] = useState('Document 2');
  const [doc1Loaded, setDoc1Loaded] = useState(false);
  const [doc2Loaded, setDoc2Loaded] = useState(false);
  const [activeFilter, setActiveFilter] = useState<'all' | 'mismatch' | 'missing' | 'match'>('all');
  const file1Ref = useRef<HTMLInputElement>(null);
  const file2Ref = useRef<HTMLInputElement>(null);
  const pathname = usePathname();
  const [language, setLanguage] = useState<'en'|'pt'|'nl'>('en');

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
    if (sid) setSession(sid);
    const savedLang = localStorage.getItem('fw_lang') as 'en'|'pt'|'nl';
    if (savedLang) setLanguage(savedLang);
  }, [searchParams]);

  const handleFile = (file: File, docNum: 1 | 2) => {
    const ext = file.name.split('.').pop()?.toLowerCase();
    const setName = docNum === 1 ? setDoc1Name : setDoc2Name;
    const setText = docNum === 1 ? setDoc1Text : setDoc2Text;
    const setLoaded = docNum === 1 ? setDoc1Loaded : setDoc2Loaded;

    setName(file.name);

    if (['pdf', 'jpg', 'jpeg', 'png'].includes(ext || '')) {
      const reader = new FileReader();
      reader.onload = async (e) => {
        const base64 = (e.target?.result as string).split(',')[1];
        notify('success', '⏳ Extracting text from file...');
        try {
          const res = await fetch(`${API_URL}/api/extract-text`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ base64, mimeType: file.type, fileName: file.name, sessionId: session }),
          });
          const data = await res.json();
          if (data.text) { setText(data.text); setLoaded(true); notify('success', '✅ Text extracted!'); }
          else notify('error', 'Could not extract text from file');
        } catch { notify('error', 'Failed to process file'); }
      };
      reader.readAsDataURL(file);
    } else {
      const reader = new FileReader();
      reader.onload = (e) => { setText(e.target?.result as string); setLoaded(true); };
      reader.readAsText(file);
    }
  };

  const compare = async () => {
    if (!doc1Text.trim() || !doc2Text.trim() || !session) return;
    setLoading(true);
    setResult(null);

    try {
      const res = await fetch(`${API_URL}/api/compare-documents`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ doc1Text, doc1Name, doc2Text, doc2Name, sessionId: session }),
      });
      const data = await res.json();
      if (data.comparison) {
        setResult(data.comparison);
        notify('success', 'Comparison complete!');
      } else {
        notify('error', data.error || 'Comparison failed');
      }
    } catch (e) {
      notify('error', 'Failed to compare documents');
    }
    setLoading(false);
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'match': return '✅';
      case 'mismatch': return '⚠️';
      case 'missing_in_doc1': return '❌';
      case 'missing_in_doc2': return '❌';
      case 'both_missing': return '❓';
      default: return '—';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'match': return 'text-green-400 bg-green-500/10 border-green-500/20';
      case 'mismatch': return 'text-orange-400 bg-orange-500/10 border-orange-500/20';
      case 'missing_in_doc1':
      case 'missing_in_doc2': return 'text-red-400 bg-red-500/10 border-red-500/20';
      case 'both_missing': return 'text-gray-400 bg-gray-500/10 border-gray-500/20';
      default: return theme.textDim;
    }
  };

  const getSeverityBadge = (severity: string) => {
    switch (severity) {
      case 'critical': return 'bg-red-500/20 text-red-400 border-red-500/30';
      case 'high': return 'bg-orange-500/20 text-orange-400 border-orange-500/30';
      case 'medium': return 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30';
      case 'low': return 'bg-blue-500/20 text-blue-400 border-blue-500/30';
      default: return 'bg-gray-500/20 text-gray-400';
    }
  };

  const getOverallColor = (status: string) => {
    switch (status) {
      case 'match': return 'text-green-400';
      case 'minor_issues': return 'text-yellow-400';
      case 'major_issues': return 'text-orange-400';
      case 'critical_issues': return 'text-red-400';
      default: return 'text-gray-400';
    }
  };

  const getScoreColor = (score: number) => {
    if (score >= 90) return 'bg-green-500';
    if (score >= 70) return 'bg-yellow-500';
    if (score >= 50) return 'bg-orange-500';
    return 'bg-red-500';
  };

  const filteredComparisons = result?.comparisons.filter(c => {
    if (activeFilter === 'all') return true;
    if (activeFilter === 'mismatch') return c.status === 'mismatch';
    if (activeFilter === 'missing') return c.status === 'missing_in_doc1' || c.status === 'missing_in_doc2' || c.status === 'both_missing';
    if (activeFilter === 'match') return c.status === 'match';
    return true;
  }) || [];

  const generateComparisonReport = () => {
    if (!result) return;
    const date = new Date().toLocaleDateString('en-GB');
    let report = `DOCUMENT COMPARISON REPORT\nGenerated: ${date}\nDocument 1: ${doc1Name} (${result.doc1_type})\nDocument 2: ${doc2Name} (${result.doc2_type})\nMatch Score: ${result.match_score}%\nOverall Status: ${result.overall_status.replace(/_/g, ' ').toUpperCase()}\n\n═══════════════════════════════════════\nSUMMARY\n═══════════════════════════════════════\n${result.summary}`;

    if (result.critical_mismatches?.length > 0) {
      report += `\n\n═══════════════════════════════════════\n🔴 CRITICAL MISMATCHES\n═══════════════════════════════════════`;
      result.critical_mismatches.forEach(m => { report += `\n• ${m}`; });
    }

    const mismatches = result.comparisons.filter(c => c.status === 'mismatch');
    const missing = result.comparisons.filter(c => c.status !== 'match' && c.status !== 'mismatch');
    const matches = result.comparisons.filter(c => c.status === 'match');

    if (mismatches.length > 0) {
      report += `\n\n═══════════════════════════════════════\n⚠️ MISMATCHES (${mismatches.length})\n═══════════════════════════════════════`;
      mismatches.forEach(c => {
        report += `\n\n${c.field} [${c.severity.toUpperCase()}]\n  ${doc1Name}: ${c.doc1_value || 'N/A'}\n  ${doc2Name}: ${c.doc2_value || 'N/A'}`;
        if (c.note) report += `\n  Note: ${c.note}`;
      });
    }

    if (missing.length > 0) {
      report += `\n\n═══════════════════════════════════════\n❌ MISSING FIELDS (${missing.length})\n═══════════════════════════════════════`;
      missing.forEach(c => { report += `\n• ${c.field}: ${c.status.replace(/_/g, ' ')} [${c.severity}]`; });
    }

    report += `\n\n═══════════════════════════════════════\n✅ MATCHED FIELDS (${matches.length})\n═══════════════════════════════════════`;
    matches.forEach(c => { report += `\n• ${c.field}`; });

    if (result.recommendations?.length > 0) {
      report += `\n\n═══════════════════════════════════════\n💡 RECOMMENDATIONS\n═══════════════════════════════════════`;
      result.recommendations.forEach(r => { report += `\n• ${r}`; });
    }

    report += `\n\n═══════════════════════════════════════\nEnd of Report — Generated by FreightWizard AI\n═══════════════════════════════════════`;
    navigator.clipboard.writeText(report);
    notify('success', 'Comparison report copied!');
  };

  const copyDiscrepancyEmail = () => {
    if (!result) return;
    const discrepancies = result.comparisons.filter(c => c.status !== 'match');
    const text = `Dear Partner,\n\nWe have compared the documents ${doc1Name} and ${doc2Name} and found the following discrepancies that require attention:\n\n${discrepancies.map(c => `• ${c.field}: ${c.doc1_value || 'N/A'} vs ${c.doc2_value || 'N/A'}`).join('\n')}\n\nPlease review and confirm the correct values at your earliest convenience.\n\nBest regards,\nFreight Operations Team`;
    navigator.clipboard.writeText(text);
    notify('success', 'Discrepancy email copied!');
  };

  const counts = result ? {
    match: result.comparisons.filter(c => c.status === 'match').length,
    mismatch: result.comparisons.filter(c => c.status === 'mismatch').length,
    missing: result.comparisons.filter(c => c.status !== 'match' && c.status !== 'mismatch').length,
  } : { match: 0, mismatch: 0, missing: 0 };

  const filterTabs = [
    { key: 'all', label: 'All', icon: 'Dashboard_document_comparison_compare_documents' },
    { key: 'mismatch', label: 'Mismatches', icon: 'Dashboard_document_comparison_mismatches' },
    { key: 'missing', label: 'Missing', icon: 'Dashboard_document_comparison_missing' },
    { key: 'match', label: 'Matches', icon: 'Dashboard_document_comparison_matches' },
  ] as const;

  return (
    <div className={`min-h-screen ${theme.bg} ${theme.text} transition-colors`}>
      {notification && (
        <div className={`fixed top-4 right-4 z-50 px-6 py-3 rounded-xl shadow-xl text-white ${notification.type === 'success' ? 'bg-green-500' : 'bg-red-500'}`}>
          {notification.msg}
        </div>
      )}

      {/* Header */}
      <header className={`${theme.card} border-b ${theme.cardBorder} px-6 py-4 flex items-center justify-between sticky top-0 z-40`}>
        <div className="flex items-center gap-4">
          <Link href="/dashboard" className="flex items-center gap-2">
            <img src="/icons/webpage_main_logo_white.svg" alt="FreightWizard" className={`h-6 w-6 object-contain ${darkMode ? '' : 'brightness-0'}`} />
            <span className="text-lg font-bold">FreightWizard</span>
          </Link>
          <span className={`text-sm ${theme.textMuted}`}>/ Documents /</span>
          <span className={`text-sm ${theme.textMuted}`}>Compare</span>
        </div>
        <div className="flex items-center gap-3">
          <Link href={`/documents?session=${session}`} className={`px-4 py-2 text-sm ${theme.textMuted} border ${theme.cardBorder} rounded-full ${theme.hover}`}>
            ← Documents
          </Link>
          <button
            onClick={() => { setDarkMode(!darkMode); localStorage.setItem('fw_theme', !darkMode ? 'dark' : 'light'); }}
            className={`p-2 rounded-full ${theme.hover} border ${theme.cardBorder}`}
          >
            <Icon
              name={darkMode ? 'Dashboard_document_comparison_sun_light_mode' : 'Dashboard_document_comparison_moon_dark_mode'}
              className="w-5 h-5"
              style={theme.iconFilter}
            />
          </button>
        </div>
      </header>

      <div className="max-w-7xl mx-auto p-6">
        <div className="mb-8 flex items-start gap-3">
  <Icon name="Dashboard_document_comparison_icon" className="w-8 h-8 mt-1" style={theme.iconFilter} />
  <div>
    <h1 className="text-3xl font-bold">Document Comparison</h1>
    <p className={theme.textMuted}>Compare two shipping documents side by side — detect mismatches, missing fields and discrepancies</p>
  </div>
</div>

        {/* Upload Area */}
        <div className="grid md:grid-cols-2 gap-4 mb-6">
          {[
            { num: 1, text: doc1Text, name: doc1Name, loaded: doc1Loaded, setName: setDoc1Name, setText: setDoc1Text, ref: file1Ref },
            { num: 2, text: doc2Text, name: doc2Name, loaded: doc2Loaded, setName: setDoc2Name, setText: setDoc2Text, ref: file2Ref },
          ].map(({ num, text, name, loaded, setName, setText, ref }) => (
            <div key={num} className={`${theme.card} border ${theme.cardBorder} rounded-2xl p-5`}>
              <div className="flex items-center justify-between mb-3">
                <h2 className="font-semibold flex items-center gap-2">
                  <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold text-white ${num === 1 ? 'bg-[#9E14FB]' : 'bg-[#1BA1FF]'}`}>{num}</span>
                  Document {num}
                </h2>
                {loaded && (
                  <div className="flex items-center gap-1.5">
                    <Icon name="Dashboard_document_comparison_loaded" className="w-4 h-4" style={{ filter: 'brightness(0) saturate(100%) invert(60%) sepia(80%) saturate(400%) hue-rotate(80deg)' }} />
                    <span className="text-xs text-green-400">Loaded</span>
                  </div>
                )}
              </div>

              <input
                value={name === `Document ${num}` ? '' : name}
                onChange={(e) => setName(e.target.value || `Document ${num}`)}
                placeholder={`e.g. HBL-2024-001`}
                className={`w-full px-3 py-2 rounded-xl border ${theme.input} mb-3 text-sm focus:outline-none focus:border-[#5200FF]`}
              />

              <textarea
                value={text}
                onChange={(e) => { setText(e.target.value); if (e.target.value) { num === 1 ? setDoc1Loaded(true) : setDoc2Loaded(true); } }}
                placeholder={`Paste Document ${num} text here...`}
                rows={5}
                className={`w-full px-3 py-2 rounded-xl border ${theme.input} mb-3 text-sm focus:outline-none focus:border-[#5200FF] resize-none`}
              />

              <button
                onClick={() => ref.current?.click()}
                className={`w-full py-3 border-2 border-dashed ${darkMode ? 'border-white/10 hover:border-[#5200FF]/50' : 'border-slate-200 hover:border-[#5200FF]/50'} rounded-xl text-sm ${theme.textMuted} transition flex items-center justify-center gap-2`}
              >
                <Icon name="Dashboard_document_comparison_or_upload_file" className="w-4 h-4" style={theme.iconFilter} />
                Upload file (PDF, Word, Excel, Image)
              </button>
              <input
                ref={ref}
                type="file"
                accept=".txt,.csv,.pdf,.doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png"
                className="hidden"
                onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0], num as 1 | 2)}
              />
            </div>
          ))}
        </div>

        {/* Compare Button */}
        <button
          onClick={compare}
          disabled={loading || !doc1Text.trim() || !doc2Text.trim()}
          className="w-full py-4 mb-8 bg-gradient-to-r from-[#9E14FB] via-[#5200FF] to-[#1BA1FF] rounded-2xl font-semibold text-white disabled:opacity-50 flex items-center justify-center gap-3 text-lg"
        >
          {loading ? (
            <><div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div> Comparing Documents...</>
          ) : (
            <>
              <Icon name="Dashboard_document_comparison_compare_documents" className="w-6 h-6" style={{ filter: 'brightness(0) invert(1)' }} />
              Compare Documents
            </>
          )}
        </button>

        {/* Results */}
        {result && (
          <div className="space-y-6">
            {/* Score Card */}
            <div className={`${theme.card} border ${theme.cardBorder} rounded-2xl p-6`}>
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h2 className="text-xl font-bold mb-1">Comparison Result</h2>
                  <p className={`text-sm ${theme.textMuted}`}>
                    <span className="text-[#9E14FB] font-medium">{result.doc1_type}</span>
                    {' vs '}
                    <span className="text-[#1BA1FF] font-medium">{result.doc2_type}</span>
                  </p>
                </div>
                <div className="text-right">
                  <div className={`text-4xl font-bold ${getOverallColor(result.overall_status)}`}>
                    {result.match_score}%
                  </div>
                  <p className={`text-xs ${theme.textDim} capitalize`}>{result.overall_status.replace(/_/g, ' ')}</p>
                  <div className={`h-2 w-32 ${darkMode ? 'bg-white/10' : 'bg-slate-200'} rounded-full mt-2 ml-auto`}>
                    <div className={`h-full rounded-full ${getScoreColor(result.match_score)} transition-all`} style={{ width: `${result.match_score}%` }} />
                  </div>
                </div>
              </div>

              {/* Stats */}
              <div className="grid grid-cols-3 gap-4 mb-6">
                {[
  { label: 'Matched', count: counts.match, color: 'text-green-500', bg: 'bg-green-500/10', icon: 'Dashboard_document_comparison_matches', iconFilter: { filter: 'brightness(0) saturate(100%) invert(55%) sepia(60%) saturate(500%) hue-rotate(80deg)' } },
  { label: 'Mismatched', count: counts.mismatch, color: 'text-orange-400', bg: 'bg-orange-500/10', icon: 'Dashboard_document_comparison_mismatches', iconFilter: { filter: 'brightness(0) saturate(100%) invert(70%) sepia(80%) saturate(800%) hue-rotate(5deg)' } },
  { label: 'Missing', count: counts.missing, color: 'text-red-400', bg: 'bg-red-500/10', icon: 'Dashboard_document_comparison_missing', iconFilter: { filter: 'brightness(0) saturate(100%) invert(40%) sepia(80%) saturate(2000%) hue-rotate(330deg)' } },
].map((stat, i) => (
  <div key={i} className={`${stat.bg} rounded-xl p-4 text-center`}>
    <div className="flex justify-center mb-2">
      <Icon name={stat.icon} className="w-5 h-5" style={stat.iconFilter} />
    </div>
    <p className={`text-2xl font-bold ${stat.color}`}>{stat.count}</p>
    <p className={`text-xs ${theme.textMuted}`}>{stat.label}</p>
  </div>
))}
              </div>

              {/* Summary */}
              {result.summary && (
                <div className={`${darkMode ? 'bg-gradient-to-r from-[#9E14FB]/10 to-[#1BA1FF]/10' : 'bg-gradient-to-r from-purple-50 to-blue-50'} rounded-xl p-4 mb-4`}>
                  <p className={`text-xs ${theme.textDim} mb-1`}>AI Summary</p>
                  <p className="text-sm">{result.summary}</p>
                </div>
              )}

              {/* Critical Mismatches */}
              {result.critical_mismatches?.length > 0 && (
                <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-4 mb-4">
                  <h3 className="text-red-400 font-semibold text-sm mb-2 flex items-center gap-2">
                    <Icon name="Dashboard_document_comparison_critical_mismatches" className="w-4 h-4" style={{ filter: 'brightness(0) saturate(100%) invert(40%) sepia(80%) saturate(2000%) hue-rotate(330deg)' }} />
                    Critical Mismatches
                  </h3>
                  <ul className="space-y-1">
                    {result.critical_mismatches.map((m, i) => (
                      <li key={i} className="text-sm text-red-600">• {m}</li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Actions */}
              <div className="flex gap-3">
                <button
                  onClick={generateComparisonReport}
                  className="flex-1 py-3 bg-gradient-to-r from-[#9E14FB] via-[#5200FF] to-[#1BA1FF] rounded-xl text-white text-sm font-medium flex items-center justify-center gap-2"
                >
                  <Icon name="Dashboard_document_comparison_copy_comparison_report" className="w-4 h-4" style={{ filter: 'brightness(0) invert(1)' }} />
                  Copy Comparison Report
                </button>
                <button
                  onClick={copyDiscrepancyEmail}
                  className={`flex-1 py-3 ${darkMode ? 'bg-white/10 hover:bg-white/20' : 'bg-slate-200 hover:bg-slate-300'} rounded-xl text-sm font-medium flex items-center justify-center gap-2`}
                >
                  <Icon name="Dashboard_document_comparison_copy_discrepancy_email" className="w-4 h-4" style={theme.iconFilter} />
                  Copy Discrepancy Email
                </button>
              </div>
            </div>

            {/* Field Comparison Table */}
            <div className={`${theme.card} border ${theme.cardBorder} rounded-2xl overflow-hidden`}>
              <div className={`p-4 border-b ${theme.cardBorder} flex items-center justify-between`}>
                <h2 className="font-semibold">Field by Field Comparison</h2>
                <div className={`flex gap-1 p-1 ${darkMode ? 'bg-white/5' : 'bg-slate-100'} rounded-xl`}>
                  {filterTabs.map(f => (
                    <button
                      key={f.key}
                      onClick={() => setActiveFilter(f.key)}
                      className={`px-3 py-1.5 text-xs rounded-lg transition flex items-center gap-1.5 ${activeFilter === f.key ? 'bg-gradient-to-r from-[#9E14FB] to-[#1BA1FF] text-white' : theme.textMuted}`}
                    >
                      <Icon
                        name={f.icon}
                        className="w-3 h-3"
                        style={activeFilter === f.key ? { filter: 'brightness(0) invert(1)' } : theme.iconFilter}
                      />
                      {f.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Column Headers */}
              <div className={`grid grid-cols-5 gap-0 px-4 py-2 border-b ${theme.cardBorder} text-xs ${theme.textDim} font-semibold uppercase tracking-wider`}>
                <div>Field</div>
                <div>Severity</div>
                <div className="text-[#9E14FB]">Doc 1</div>
                <div className="text-[#1BA1FF]">Doc 2</div>
                <div>Status</div>
              </div>

              <div className="divide-y divide-white/5 max-h-[500px] overflow-y-auto">
                {filteredComparisons.map((c, i) => (
                  <div key={i} className={`grid grid-cols-5 gap-0 px-4 py-3 items-center ${theme.hover} transition`}>
                    <div>
                      <p className="text-sm font-medium">{c.field}</p>
                      {c.note && <p className={`text-xs ${theme.textDim} mt-0.5`}>{c.note}</p>}
                    </div>
                    <div>
                      <span className={`text-xs px-2 py-0.5 rounded-full border capitalize ${getSeverityBadge(c.severity)}`}>
                        {c.severity}
                      </span>
                    </div>
                    <div>
                      <p className={`text-sm ${c.status === 'missing_in_doc1' || c.status === 'both_missing' ? 'text-red-400 italic' : ''}`}>
                        {c.doc1_value || <span className="text-red-400 italic text-xs">not found</span>}
                      </p>
                    </div>
                    <div>
                      <p className={`text-sm ${c.status === 'missing_in_doc2' || c.status === 'both_missing' ? 'text-red-400 italic' : ''}`}>
                        {c.doc2_value || <span className="text-red-400 italic text-xs">not found</span>}
                      </p>
                    </div>
                    <div>
                     <span className={`text-xs px-2 py-1 rounded-full border flex items-center gap-1 w-fit ${getStatusColor(c.status)}`}>
  <Icon
    name={
      c.status === 'match' ? 'Dashboard_document_comparison_matches' :
      c.status === 'mismatch' ? 'Dashboard_document_comparison_mismatches' :
      'Dashboard_document_comparison_missing'
    }
    className="w-3 h-3"
    style={
      c.status === 'match' ? { filter: 'brightness(0) saturate(100%) invert(60%) sepia(80%) saturate(400%) hue-rotate(80deg)' } :
      c.status === 'mismatch' ? { filter: 'brightness(0) saturate(100%) invert(70%) sepia(80%) saturate(800%) hue-rotate(5deg)' } :
      { filter: 'brightness(0) saturate(100%) invert(40%) sepia(80%) saturate(2000%) hue-rotate(330deg)' }
    }
  />
  {c.status.replace(/_/g, ' ')}
</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Recommendations */}
            {result.recommendations?.length > 0 && (
              <div className={`${theme.card} border ${theme.cardBorder} rounded-2xl p-6`}>
                <h2 className="font-semibold mb-4 flex items-center gap-2">
                  <Icon name="Dashboard_document_comparison_recomendations" className="w-5 h-5" style={theme.iconFilter} />
                  Recommendations
                </h2>
                <div className="space-y-2">
                  {result.recommendations.map((rec, i) => (
                    <div key={i} className={`${darkMode ? 'bg-white/5' : 'bg-slate-50'} rounded-xl p-3`}>
                      <p className="text-sm">• {rec}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Empty State */}
        {!result && !loading && (
          <div className={`${theme.card} border ${theme.cardBorder} rounded-2xl p-12 text-center`}>
            <div className="w-20 h-20 mx-auto mb-4 p-4 rounded-2xl bg-gradient-to-r from-[#9E14FB]/20 to-[#1BA1FF]/20">
              <Icon name="Dashboard_document_comparison_compare_documents" className="w-full h-full" style={theme.iconFilter} />
            </div>
            <h3 className="text-xl font-bold mb-2">Compare Two Documents</h3>
            <p className={`${theme.textMuted} max-w-md mx-auto mb-6`}>
              Paste or upload two shipping documents above to detect mismatches, missing fields and discrepancies automatically.
            </p>
            <div className="flex flex-wrap gap-2 justify-center">
              {['HBL vs MBL', 'Invoice vs Packing List', 'BL Draft vs Final BL', 'AWB vs Invoice'].map(pair => (
                <span key={pair} className={`text-xs px-3 py-1.5 ${darkMode ? 'bg-white/5' : 'bg-slate-100'} rounded-full ${theme.textMuted}`}>
                  {pair}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}