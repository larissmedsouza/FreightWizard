'use client';

import { useEffect, useState, useRef } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
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
        notify('success', 'Extracting text from file...');
        try {
          const res = await fetch(`${API_URL}/api/extract-text`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ base64, mimeType: file.type, fileName: file.name, sessionId: session }),
          });
          const data = await res.json();
          if (data.text) { setText(data.text); setLoaded(true); notify('success', 'Text extracted!'); }
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
    { key: 'all', label: 'All' },
    { key: 'mismatch', label: 'Mismatches' },
    { key: 'missing', label: 'Missing' },
    { key: 'match', label: 'Matches' },
  ] as const;

  const changeLang = (l: 'en' | 'pt' | 'nl') => { setLanguage(l); localStorage.setItem('fw_lang', l); };
  const toggleTheme = () => { setDarkMode(!darkMode); localStorage.setItem('fw_theme', !darkMode ? 'dark' : 'light'); };
  const discrepancyCount = counts.mismatch + counts.missing;
  const scoreTone: Tone = !result ? 'neutral' : result.match_score >= 90 ? 'ok' : result.match_score >= 70 ? 'warn' : 'danger';
  // Display names follow the A/B column labels unless the user named the document.
  const nameA = doc1Name === 'Document 1' ? 'Document A' : doc1Name;
  const nameB = doc2Name === 'Document 2' ? 'Document B' : doc2Name;
  const missingLabel: Record<string, string> = { missing_in_doc1: 'missing in A', missing_in_doc2: 'missing in B', both_missing: 'missing in both' };
  const isMissing = (s: ComparisonField['status']) => s === 'missing_in_doc1' || s === 'missing_in_doc2' || s === 'both_missing';

  return (
    <div data-theme={darkMode ? 'dark' : 'light'} className={appRootClass}>
      <Toast notification={notification} />

      <TopBar session={session} user={null} darkMode={darkMode} language={language} onToggleTheme={toggleTheme} onChangeLanguage={changeLang} />

      <main className="mx-auto max-w-7xl p-4 lg:p-6">
        <PageHeader className="mb-6" title="Document Comparison"
          description="Compare two shipping documents side by side — detect mismatches, missing fields and discrepancies" />

        {/* Upload Area */}
        <div className="mb-4 grid gap-4 md:grid-cols-2">
          {[
            { num: 1, letter: 'A', text: doc1Text, name: doc1Name, loaded: doc1Loaded, setName: setDoc1Name, setText: setDoc1Text, ref: file1Ref },
            { num: 2, letter: 'B', text: doc2Text, name: doc2Name, loaded: doc2Loaded, setName: setDoc2Name, setText: setDoc2Text, ref: file2Ref },
          ].map(({ num, letter, text, name, loaded, setName, setText, ref }) => (
            <section key={num} className="rounded-fw-card border border-app-line bg-app-card p-5">
              <div className="mb-3 flex items-center justify-between">
                <h2 className="flex items-center gap-2 text-app-ui font-semibold">
                  <span className="flex size-6 items-center justify-center rounded-fw-btn border border-app-line font-fw-mono text-app-mono-xs text-app-accent">{letter}</span>
                  Document {letter}
                </h2>
                {loaded && <Tag tone="ok">Loaded</Tag>}
              </div>

              <input
                value={name === `Document ${num}` ? '' : name}
                onChange={(e) => setName(e.target.value || `Document ${num}`)}
                placeholder="e.g. HBL-2024-001"
                aria-label={`Document ${letter} name`}
                className={`${inputClass} mb-3 font-fw-mono`}
              />

              <textarea
                value={text}
                onChange={(e) => { setText(e.target.value); if (e.target.value) { num === 1 ? setDoc1Loaded(true) : setDoc2Loaded(true); } }}
                placeholder={`Paste Document ${letter} text here...`}
                aria-label={`Document ${letter} text`}
                rows={5}
                className={`${textareaClass} mb-3 font-fw-mono text-app-mono`}
              />

              <button
                type="button"
                onClick={() => ref.current?.click()}
                className="flex w-full items-center justify-center gap-2 rounded-fw-btn border border-dashed border-app-line-strong py-3 text-app-ui-sm text-app-ink-2 transition-colors hover:border-app-accent-fill hover:bg-app-raised"
              >
                <Icon name="upload" size={15} />
                Upload file (PDF, Word, Excel, Image)
              </button>
              <input
                ref={ref}
                type="file"
                accept=".txt,.csv,.pdf,.doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png"
                className="hidden"
                onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0], num as 1 | 2)}
              />
            </section>
          ))}
        </div>

        {/* Compare Button */}
        <Button variant="primary" size="lg" className="mb-8 w-full" icon={loading ? undefined : 'compare'} onClick={compare} disabled={loading || !doc1Text.trim() || !doc2Text.trim()}>
          {loading ? <><Spinner className="size-4" /> Comparing Documents...</> : 'Compare Documents'}
        </Button>

        {/* Results */}
        {result && (
          <div className="space-y-4">
            {/* Result header: score + actions */}
            <section className="rounded-fw-card border border-app-line bg-app-card p-5">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="min-w-0">
                  <p className="mb-1 font-fw-mono text-app-mono-xs uppercase text-app-ink-3">Comparison result</p>
                  <h2 className="font-fw-display text-app-title-sm font-normal">
                    <span className="font-fw-mono text-app-mono">{nameA}</span> <span className="text-app-ink-3">({result.doc1_type})</span>
                    <span className="mx-2 text-app-ink-3">vs</span>
                    <span className="font-fw-mono text-app-mono">{nameB}</span> <span className="text-app-ink-3">({result.doc2_type})</span>
                  </h2>
                  <p className="mt-1 text-app-ui-sm capitalize text-app-ink-2">{result.overall_status.replace(/_/g, ' ')}</p>
                </div>
                <div className="text-right">
                  <p className={`font-fw-display text-app-kpi font-normal ${toneClass[scoreTone].text}`}>{result.match_score}%</p>
                  <DataLabel>Match score</DataLabel>
                  <div className="ml-auto mt-1 h-1 w-32 bg-app-raised" aria-hidden>
                    <div className={`h-full ${toneClass[scoreTone].dot}`} style={{ width: `${result.match_score}%` }} />
                  </div>
                </div>
              </div>

              <div className="mt-4 flex flex-wrap items-center gap-2">
                <Button size="sm" icon="copy" onClick={generateComparisonReport}>Copy Comparison Report</Button>
                <Button size="sm" icon="mail" onClick={copyDiscrepancyEmail}>Copy Discrepancy Email</Button>
                <span className="ml-auto flex flex-wrap items-center gap-1.5">
                  <Tag tone="ok">{counts.match} matched</Tag>
                  <Tag tone="warn">{counts.mismatch} mismatched</Tag>
                  <Tag tone="warn">{counts.missing} missing</Tag>
                </span>
              </div>

              {/* Summary */}
              {result.summary && (
                <div className="mt-4 rounded-fw-btn border border-app-line bg-app-panel p-4">
                  <DataLabel className="mb-1">AI Summary</DataLabel>
                  <p className="text-app-ui">{result.summary}</p>
                </div>
              )}

              {/* Critical Mismatches */}
              {result.critical_mismatches?.length > 0 && (
                <div className="mt-3">
                  <Notice tone="danger" icon="alert" title="Critical Mismatches">
                    <ul className="space-y-1">
                      {result.critical_mismatches.map((m, i) => (
                        <li key={i} className="flex items-start gap-2"><span aria-hidden className="mt-1.5 size-1 flex-none rounded-full bg-app-danger-dot" /> {m}</li>
                      ))}
                    </ul>
                  </Notice>
                </div>
              )}
            </section>

            {/* Field Comparison Table */}
            <section className="overflow-hidden rounded-fw-card border border-app-line bg-app-card" aria-label="Field by field comparison">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-app-line px-4 py-3">
                <p className="font-fw-mono text-app-mono-xs uppercase text-app-ink-3">Field by field comparison</p>
                <Segmented label="Filter rows" value={activeFilter} onChange={setActiveFilter}
                  options={filterTabs.map(f => ({ value: f.key, label: f.label }))} />
              </div>

              <div className="max-h-[560px] overflow-auto" tabIndex={0} role="region" aria-label="Comparison table">
                <table className="w-full min-w-[640px] border-collapse">
                  <thead className="sticky top-0 z-10 bg-app-card">
                    <tr className="border-b border-app-line">
                      <th scope="col" className={th}>Field</th>
                      <th scope="col" className={th}>Document A</th>
                      <th scope="col" className={th}>Document B</th>
                      <th scope="col" className={`${th} text-right`}>Result</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredComparisons.map((c, i) => {
                      const ok = c.status === 'match';
                      return (
                        <tr key={i} className={`${tr} ${ok ? '' : 'bg-app-warn-bg/60'}`}>
                          <th scope="row" className="px-4 py-3 text-left align-top font-normal">
                            <p className="text-app-ui font-medium text-app-ink">{c.field}</p>
                            {!ok && <p className="mt-0.5 font-fw-mono text-app-mono-xs uppercase text-app-ink-3">{c.severity}{isMissing(c.status) ? ` · ${missingLabel[c.status]}` : ''}</p>}
                            {c.note && <p className="mt-0.5 text-app-ui-sm text-app-ink-3">{c.note}</p>}
                          </th>
                          <td className="px-4 py-3 align-top font-fw-mono text-app-mono text-app-ink">
                            {c.doc1_value || <span className="font-fw-sans text-app-ui-sm italic text-app-ink-3">not found</span>}
                          </td>
                          <td className={`px-4 py-3 align-top font-fw-mono text-app-mono ${ok ? 'text-app-ink' : 'font-medium text-app-warn-ink'}`}>
                            {c.doc2_value || <span className="font-fw-sans text-app-ui-sm font-normal italic text-app-ink-3">not found</span>}
                          </td>
                          <td className="px-4 py-3 text-right align-top">
                            <Tag tone={ok ? 'ok' : 'warn'}>{ok ? 'Match' : 'Check'}</Tag>
                          </td>
                        </tr>
                      );
                    })}
                    {filteredComparisons.length === 0 && (
                      <tr><td colSpan={4}><EmptyState icon="filter" title="No fields in this view." /></td></tr>
                    )}
                  </tbody>
                </table>
              </div>
              <p className="border-t border-app-line bg-app-panel px-4 py-3 text-app-ui-sm text-app-ink-2">
                <span className="font-fw-mono">{discrepancyCount}</span> discrepanc{discrepancyCount === 1 ? 'y' : 'ies'} for operator review
              </p>
            </section>

            {/* Recommendations */}
            {result.recommendations?.length > 0 && (
              <section className="rounded-fw-card border border-app-line bg-app-card p-5">
                <SectionTitle icon="info" className="mb-3">Recommendations</SectionTitle>
                <ul className="space-y-2">
                  {result.recommendations.map((rec, i) => (
                    <li key={i} className="flex items-start gap-2 rounded-fw-btn border border-app-line bg-app-panel p-3 text-app-ui">
                      <Icon name="arrow-right" size={14} className="mt-0.5 flex-none text-app-accent" /> {rec}
                    </li>
                  ))}
                </ul>
              </section>
            )}
          </div>
        )}

        {/* Empty State */}
        {!result && !loading && (
          <div className="rounded-fw-card border border-app-line bg-app-card">
            <EmptyState icon="compare" title="Compare Two Documents"
              text="Paste or upload two shipping documents above to detect mismatches, missing fields and discrepancies automatically."
              action={
                <div className="flex flex-wrap justify-center gap-1.5">
                  {['HBL vs MBL', 'Invoice vs Packing List', 'BL Draft vs Final BL', 'AWB vs Invoice'].map(pair => <Chip key={pair}>{pair}</Chip>)}
                </div>
              } />
          </div>
        )}
      </main>
    </div>
  );
}
