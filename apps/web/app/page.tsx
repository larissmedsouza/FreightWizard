'use client';

import { useState } from 'react';
import Link from 'next/link';

const API_URL = 'https://freightwizard-production.up.railway.app';

export default function HomePage() {
  const [faqOpen, setFaqOpen] = useState<number | null>(null);
  const [annual, setAnnual] = useState(false);
  const [lang, setLang] = useState('EN');

  const prices = {
    starter: annual ? 790 : 79,
    professional: annual ? 1790 : 179,
    enterprise: annual ? 3990 : 399,
  };

  const faqs = [
    { q: 'How does FreightWizard access my emails?', a: 'FreightWizard connects via secure OAuth — the same standard used by Google and Microsoft. We never store your password. You can revoke access at any time from your email provider settings.' },
    { q: 'Is my data secure?', a: 'All data is encrypted in transit and at rest. Your emails are processed to generate analysis and are never used to train AI models. We are GDPR compliant and your data is never shared with third parties.' },
    { q: 'Can I edit AI-generated replies?', a: 'Yes, always. Every AI-generated reply is a draft that you review before sending. You can edit, rewrite, or discard it entirely. Nothing is sent without your approval.' },
    { q: 'What email providers do you support?', a: 'Currently Gmail and Outlook (Microsoft 365). Google Workspace and Microsoft 365 business accounts are fully supported.' },
    { q: 'How accurate is the AI analysis?', a: 'Accuracy depends on the quality of the incoming email. For standard freight emails with clear cargo details, accuracy is high. For ambiguous or incomplete emails, FreightWizard flags the missing information so you can follow up.' },
    { q: 'Can I try before buying?', a: 'Yes. Every account starts with a 14-day free trial with full Professional access and up to 30 email analyses. No credit card required.' },
  ];

  return (
    <div style={{ fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif", background: '#FAFAFA', color: '#111827', margin: 0, padding: 0 }}>

      <style>{`
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { background: #FAFAFA; }

        /* Squared button style */
        .btn-primary {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          padding: 11px 24px;
          background: #111827;
          color: #fff;
          font-size: 14px;
          font-weight: 500;
          border-radius: 4px;
          border: none;
          cursor: pointer;
          text-decoration: none;
          transition: background 0.15s, transform 0.1s;
          letter-spacing: -0.01em;
        }
        .btn-primary:hover { background: #1F2937; }

        .btn-outline {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          padding: 11px 24px;
          background: transparent;
          color: #111827;
          font-size: 14px;
          font-weight: 500;
          border-radius: 4px;
          border: 1.5px solid #D1D5DB;
          cursor: pointer;
          text-decoration: none;
          transition: border-color 0.15s, background 0.15s;
          letter-spacing: -0.01em;
        }
        .btn-outline:hover { border-color: #9CA3AF; background: #F3F4F6; }

        .btn-accent {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          padding: 11px 24px;
          background: #2563EB;
          color: #fff;
          font-size: 14px;
          font-weight: 500;
          border-radius: 4px;
          border: none;
          cursor: pointer;
          text-decoration: none;
          transition: background 0.15s;
          letter-spacing: -0.01em;
        }
        .btn-accent:hover { background: #1D4ED8; }

        .nav-link {
          font-size: 14px;
          color: #374151;
          text-decoration: none;
          font-weight: 450;
          transition: color 0.15s;
          letter-spacing: -0.01em;
        }
        .nav-link:hover { color: #111827; }

        .section { padding: 96px 0; }
        .section-sm { padding: 64px 0; }
        .container { max-width: 1120px; margin: 0 auto; padding: 0 32px; }
        .container-narrow { max-width: 720px; margin: 0 auto; padding: 0 32px; }

        .label {
          font-size: 11px;
          font-weight: 600;
          letter-spacing: 0.08em;
          text-transform: uppercase;
          color: #6B7280;
          margin-bottom: 12px;
        }

        .heading-xl {
          font-size: clamp(36px, 5vw, 60px);
          font-weight: 600;
          letter-spacing: -0.03em;
          line-height: 1.08;
          color: #111827;
        }

        .heading-lg {
          font-size: clamp(28px, 3vw, 40px);
          font-weight: 600;
          letter-spacing: -0.025em;
          line-height: 1.15;
          color: #111827;
        }

        .heading-md {
          font-size: 22px;
          font-weight: 600;
          letter-spacing: -0.02em;
          line-height: 1.3;
          color: #111827;
        }

        .body-lg { font-size: 17px; line-height: 1.65; color: #4B5563; font-weight: 400; }
        .body-md { font-size: 15px; line-height: 1.6; color: #6B7280; }

        .divider { border: none; border-top: 1px solid #E5E7EB; }

        .feature-card {
          padding: 32px;
          background: #fff;
          border: 1px solid #E5E7EB;
          border-radius: 6px;
        }

        .step-number {
          font-size: 12px;
          font-weight: 600;
          color: #9CA3AF;
          letter-spacing: 0.05em;
          margin-bottom: 16px;
        }

        .plan-card {
          padding: 32px;
          background: #fff;
          border: 1px solid #E5E7EB;
          border-radius: 6px;
          position: relative;
        }

        .plan-card-featured {
          padding: 32px;
          background: #111827;
          border: 1px solid #111827;
          border-radius: 6px;
          position: relative;
          color: #fff;
        }

        .badge {
          display: inline-block;
          font-size: 11px;
          font-weight: 600;
          padding: 3px 10px;
          border-radius: 2px;
          letter-spacing: 0.04em;
          text-transform: uppercase;
        }

        .faq-item {
          border-bottom: 1px solid #E5E7EB;
          padding: 24px 0;
        }

        .faq-btn {
          width: 100%;
          display: flex;
          align-items: center;
          justify-content: space-between;
          background: none;
          border: none;
          cursor: pointer;
          text-align: left;
          gap: 16px;
        }

        .check { color: #2563EB; font-size: 14px; margin-right: 8px; }
        .check-white { color: #60A5FA; font-size: 14px; margin-right: 8px; }

        .tag {
          display: inline-block;
          font-size: 12px;
          font-weight: 500;
          padding: 4px 10px;
          border-radius: 3px;
          background: #F3F4F6;
          color: #374151;
          border: 1px solid #E5E7EB;
        }

        .integration-logo {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 12px 20px;
          background: #fff;
          border: 1px solid #E5E7EB;
          border-radius: 4px;
          font-size: 14px;
          font-weight: 500;
          color: #374151;
        }

        @media (max-width: 768px) {
          .hide-mobile { display: none !important; }
          .grid-2, .grid-3, .grid-4 { grid-template-columns: 1fr !important; }
          .container { padding: 0 20px; }
          .section { padding: 64px 0; }
        }
      `}</style>

      {/* ── NAV ── */}
      <nav style={{ position: 'sticky', top: 0, zIndex: 50, background: 'rgba(250,250,250,0.95)', backdropFilter: 'blur(8px)', borderBottom: '1px solid #E5E7EB' }}>
        <div className="container" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: 60 }}>
          <a href="/" style={{ display: 'flex', alignItems: 'center', gap: 8, textDecoration: 'none' }}>
            <img src="/icons/webpage_main_logo_white.svg" alt="FreightWizard" style={{ width: 24, height: 24, filter: 'brightness(0)' }} />
            <span style={{ fontSize: 16, fontWeight: 600, color: '#111827', letterSpacing: '-0.02em' }}>FreightWizard</span>
          </a>

          <div className="hide-mobile" style={{ display: 'flex', alignItems: 'center', gap: 32 }}>
            <a href="#features" className="nav-link">Features</a>
            <a href="#how-it-works" className="nav-link">How it works</a>
            <a href="#pricing" className="nav-link">Pricing</a>
            <a href="#faq" className="nav-link">FAQ</a>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <a href={`${API_URL}/auth/google`} className="btn-outline">Sign in</a>
            <a href={`${API_URL}/auth/google`} className="btn-primary">Start free trial</a>
          </div>
        </div>
      </nav>

      {/* ── HERO ── */}
      <section style={{ padding: '96px 0 80px', background: '#fff', borderBottom: '1px solid #E5E7EB' }}>
        <div className="container">
          <div style={{ maxWidth: 680 }}>
            <div className="label">AI-powered freight operations</div>
            <h1 className="heading-xl" style={{ marginBottom: 24 }}>
              Your freight inbox,<br />handled by AI.
            </h1>
            <p className="body-lg" style={{ maxWidth: 520, marginBottom: 40 }}>
              FreightWizard reads incoming freight emails, extracts shipment data, builds quotes, tracks shipments, and sends professional replies — so your team focuses on closing, not sorting.
            </p>
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
              <a href={`${API_URL}/auth/google`} className="btn-primary">
                Start 14-day free trial
              </a>
              <a href="#how-it-works" className="btn-outline">
                See how it works
              </a>
            </div>
            <p style={{ fontSize: 13, color: '#9CA3AF', marginTop: 16 }}>No credit card required. 30 email analyses included.</p>
          </div>

          {/* Hero stats */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 1, background: '#E5E7EB', border: '1px solid #E5E7EB', borderRadius: 6, overflow: 'hidden', marginTop: 64, maxWidth: 600 }}>
            {[
              { value: '< 2 min', label: 'Average quote response time' },
              { value: '8 hrs', label: 'Saved per forwarder per week' },
              { value: '3 countries', label: 'Compliance coverage' },
            ].map((stat, i) => (
              <div key={i} style={{ padding: '24px 28px', background: '#fff' }}>
                <div style={{ fontSize: 28, fontWeight: 600, letterSpacing: '-0.03em', color: '#111827', marginBottom: 4 }}>{stat.value}</div>
                <div style={{ fontSize: 13, color: '#6B7280', lineHeight: 1.4 }}>{stat.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── WHAT WE DO ── */}
      <section id="features" className="section">
        <div className="container">
          <div style={{ marginBottom: 56 }}>
            <div className="label">What FreightWizard does</div>
            <h2 className="heading-lg" style={{ maxWidth: 480 }}>Everything your freight ops team does manually — automated</h2>
          </div>

          <div className="grid-3" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 1, background: '#E5E7EB', border: '1px solid #E5E7EB', borderRadius: 6, overflow: 'hidden' }}>
            {[
              {
                icon: '📧',
                title: 'Email Analysis',
                desc: 'Reads incoming freight emails and extracts shipment details: ports, container types, cargo, incoterms, customer intent, and missing information.',
              },
              {
                icon: '💰',
                title: 'Quote Builder',
                desc: 'Pre-fills a professional quote from the email data. Add your rate, preview the document, and send it directly from FreightWizard — in under 2 minutes.',
              },
              {
                icon: '🚢',
                title: 'Shipment Tracker',
                desc: 'Kanban board that auto-detects shipments from emails. Moves cards when status-update emails arrive. Full audit trail per shipment.',
              },
              {
                icon: '🔗',
                title: 'Customer Portal',
                desc: 'Generate a shareable tracking link for your customer. They see live status, route, ETA, and milestones — no login required.',
              },
              {
                icon: '📋',
                title: 'Rate Card Storage',
                desc: 'Save your carrier rates per lane, carrier, and container type. FreightWizard auto-suggests the best rate when you open the quote builder.',
              },
              {
                icon: '🌍',
                title: 'Compliance Layer',
                desc: 'Country-specific checks for Brazil (MAPA, SERPRO), Netherlands (Portbase, EORI), and USA (ACE, EIN). Flags compliance issues directly in the email analysis.',
              },
              {
                icon: '📄',
                title: 'Document Intelligence',
                desc: 'Upload Bills of Lading, AWBs, invoices, or packing lists. AI extracts all fields, flags risks and missing data, and generates a structured report.',
              },
              {
                icon: '👥',
                title: 'Team Inbox',
                desc: 'Assign emails to team members, set owners and watchers, manage team queues, and track individual performance on a leaderboard.',
              },
              {
                icon: '📊',
                title: 'Analytics Dashboard',
                desc: 'Monitor email volume, response times, quote conversion, intent breakdown, and team productivity over time.',
              },
            ].map((f, i) => (
              <div key={i} style={{ padding: '32px', background: '#fff' }}>
                <div style={{ fontSize: 28, marginBottom: 16 }}>{f.icon}</div>
                <h3 className="heading-md" style={{ fontSize: 16, marginBottom: 10 }}>{f.title}</h3>
                <p className="body-md" style={{ fontSize: 14 }}>{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── HOW IT WORKS ── */}
      <section id="how-it-works" className="section" style={{ background: '#fff', borderTop: '1px solid #E5E7EB', borderBottom: '1px solid #E5E7EB' }}>
        <div className="container">
          <div style={{ marginBottom: 56 }}>
            <div className="label">How it works</div>
            <h2 className="heading-lg">From inbox to quote in under 2 minutes</h2>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 0, position: 'relative' }}>
            {/* connector line */}
            <div style={{ position: 'absolute', top: 20, left: '12.5%', right: '12.5%', height: 1, background: '#E5E7EB', zIndex: 0 }} className="hide-mobile" />

            {[
              { step: '01', title: 'Connect your inbox', desc: 'Link Gmail or Outlook via secure OAuth. Your existing email address — no changes for customers.' },
              { step: '02', title: 'AI reads the email', desc: 'Extracts ports, cargo, container type, incoterm, customer intent, and missing data within seconds.' },
              { step: '03', title: 'Build the quote', desc: 'Rate card auto-suggest fills your sell rate. Preview the formatted quote and adjust before sending.' },
              { step: '04', title: 'Send and track', desc: 'Send the reply directly. Shipment is auto-created in the tracker. Customer gets a portal link.' },
            ].map((s, i) => (
              <div key={i} style={{ padding: '0 24px 0 0', position: 'relative', zIndex: 1 }}>
                <div style={{ width: 40, height: 40, background: '#fff', border: '1px solid #E5E7EB', borderRadius: 4, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 20 }}>
                  <span style={{ fontSize: 12, fontWeight: 600, color: '#9CA3AF', letterSpacing: '0.05em' }}>{s.step}</span>
                </div>
                <h3 style={{ fontSize: 15, fontWeight: 600, color: '#111827', marginBottom: 8, letterSpacing: '-0.01em' }}>{s.title}</h3>
                <p style={{ fontSize: 14, color: '#6B7280', lineHeight: 1.6 }}>{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── USE CASES ── */}
      <section className="section">
        <div className="container">
          <div style={{ marginBottom: 56 }}>
            <div className="label">Who uses FreightWizard</div>
            <h2 className="heading-lg" style={{ maxWidth: 440 }}>Built for the teams that run on email</h2>
          </div>

          <div className="grid-2" style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 24 }}>
            {[
              {
                title: 'Independent freight forwarders',
                desc: 'Solo operators and small agencies handling 50–500 shipments per month. FreightWizard gives you the leverage of a larger team without the headcount.',
                tags: ['Quote builder', 'Rate cards', 'Shipment tracker'],
              },
              {
                title: 'Operations teams',
                desc: 'Forwarding companies with 5–30 people. Assign emails, track response times, measure team performance, and stop losing quotes to slow turnaround.',
                tags: ['Team inbox', 'Analytics', 'Leaderboard'],
              },
              {
                title: 'Brazil-focused forwarders',
                desc: 'Companies moving cargo through Santos, Paranaguá, or Itajaí. SERPRO integration, MAPA compliance alerts, and CE Mercante status built in.',
                tags: ['SERPRO', 'MAPA alerts', 'CE Mercante'],
              },
              {
                title: 'European forwarders',
                desc: 'Dutch and EU forwarders using Portbase for Rotterdam. EORI validation, DMS compliance checklists, and TARIC reference built into the workflow.',
                tags: ['Portbase', 'EORI', 'DMS compliance'],
              },
            ].map((u, i) => (
              <div key={i} className="feature-card">
                <h3 className="heading-md" style={{ fontSize: 17, marginBottom: 10 }}>{u.title}</h3>
                <p className="body-md" style={{ marginBottom: 20, fontSize: 14 }}>{u.desc}</p>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  {u.tags.map(t => <span key={t} className="tag">{t}</span>)}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── INTEGRATIONS ── */}
      <section className="section-sm" style={{ background: '#fff', borderTop: '1px solid #E5E7EB', borderBottom: '1px solid #E5E7EB' }}>
        <div className="container">
          <div style={{ marginBottom: 40 }}>
            <div className="label">Integrations</div>
            <h2 style={{ fontSize: 22, fontWeight: 600, letterSpacing: '-0.02em' }}>Works with the tools you already use</h2>
          </div>

          <div style={{ marginBottom: 32 }}>
            <p style={{ fontSize: 12, fontWeight: 600, color: '#9CA3AF', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 16 }}>Email</p>
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
              {['Gmail', 'Outlook', 'Microsoft 365', 'Google Workspace'].map(i => (
                <div key={i} className="integration-logo">{i}</div>
              ))}
            </div>
          </div>

          <div style={{ marginBottom: 32 }}>
            <p style={{ fontSize: 12, fontWeight: 600, color: '#9CA3AF', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 16 }}>Compliance & customs</p>
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
              {['SERPRO Integra Comex (BR)', 'Portbase (NL)', 'CE Mercante (BR)', 'ACE / CBP (US)'].map(i => (
                <div key={i} className="integration-logo">{i}</div>
              ))}
            </div>
          </div>

          <div>
            <p style={{ fontSize: 12, fontWeight: 600, color: '#9CA3AF', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 16 }}>Coming soon</p>
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
              {['CargoWise', 'Descartes', 'Terminal49 live tracking', 'SAP TM'].map(i => (
                <div key={i} style={{ ...{ display: 'flex', alignItems: 'center', gap: 8, padding: '12px 20px', background: '#F9FAFB', border: '1px dashed #D1D5DB', borderRadius: 4, fontSize: 14, fontWeight: 500, color: '#9CA3AF' } }}>{i}</div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── PRICING ── */}
      <section id="pricing" className="section">
        <div className="container">
          <div style={{ marginBottom: 48 }}>
            <div className="label">Pricing</div>
            <h2 className="heading-lg" style={{ marginBottom: 16 }}>Simple, transparent pricing</h2>
            <p className="body-lg" style={{ marginBottom: 32, maxWidth: 480 }}>Start with a 14-day free trial. No credit card required. Full Professional access from day one.</p>

            {/* Annual toggle */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <span style={{ fontSize: 14, color: annual ? '#6B7280' : '#111827', fontWeight: annual ? 400 : 500 }}>Monthly</span>
              <button
                onClick={() => setAnnual(!annual)}
                style={{ width: 44, height: 24, borderRadius: 12, background: annual ? '#111827' : '#D1D5DB', border: 'none', cursor: 'pointer', position: 'relative', transition: 'background 0.2s' }}>
                <span style={{ position: 'absolute', top: 3, left: annual ? 23 : 3, width: 18, height: 18, borderRadius: 9, background: '#fff', transition: 'left 0.2s' }} />
              </button>
              <span style={{ fontSize: 14, color: annual ? '#111827' : '#6B7280', fontWeight: annual ? 500 : 400 }}>Annual</span>
              {annual && <span style={{ fontSize: 12, fontWeight: 600, color: '#059669', background: '#ECFDF5', padding: '2px 8px', borderRadius: 2 }}>2 months free</span>}
            </div>
          </div>

          <div className="grid-4" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 1, background: '#E5E7EB', border: '1px solid #E5E7EB', borderRadius: 6, overflow: 'hidden', alignItems: 'stretch' }}>

            {/* Trial */}
            <div style={{ padding: 32, background: '#F9FAFB' }}>
              <div style={{ marginBottom: 24 }}>
                <p style={{ fontSize: 13, fontWeight: 600, color: '#6B7280', marginBottom: 8 }}>Trial</p>
                <div style={{ fontSize: 36, fontWeight: 600, letterSpacing: '-0.03em', color: '#111827' }}>Free</div>
                <div style={{ fontSize: 13, color: '#6B7280', marginTop: 4 }}>14 days · no card needed</div>
              </div>
              <a href={`${API_URL}/auth/google`} className="btn-outline" style={{ width: '100%', justifyContent: 'center', marginBottom: 28 }}>Start free trial</a>
              <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 10 }}>
                {['30 email analyses', 'Full Professional access', '5 active shipments', '5 quotes', '1 user'].map(f => (
                  <li key={f} style={{ fontSize: 14, color: '#374151' }}><span className="check">✓</span>{f}</li>
                ))}
              </ul>
            </div>

            {/* Starter */}
            <div style={{ padding: 32, background: '#fff' }}>
              <div style={{ marginBottom: 24 }}>
                <p style={{ fontSize: 13, fontWeight: 600, color: '#6B7280', marginBottom: 8 }}>Starter</p>
                <div style={{ fontSize: 36, fontWeight: 600, letterSpacing: '-0.03em', color: '#111827' }}>${prices.starter}</div>
                <div style={{ fontSize: 13, color: '#6B7280', marginTop: 4 }}>per month{annual ? ', billed annually' : ''}</div>
              </div>
              <a href={`${API_URL}/auth/google`} className="btn-outline" style={{ width: '100%', justifyContent: 'center', marginBottom: 28 }}>Get started</a>
              <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 10 }}>
                {['200 analyses/month', 'Quote builder', 'Shipment tracker (10)', '20 quotes/month', 'Rate card storage', 'Customer portal', '1 user', 'Email support'].map(f => (
                  <li key={f} style={{ fontSize: 14, color: '#374151' }}><span className="check">✓</span>{f}</li>
                ))}
              </ul>
            </div>

            {/* Professional */}
            <div style={{ padding: 32, background: '#111827', color: '#fff', position: 'relative' }}>
              <div style={{ position: 'absolute', top: 16, right: 16 }}>
                <span className="badge" style={{ background: '#2563EB', color: '#fff' }}>Most popular</span>
              </div>
              <div style={{ marginBottom: 24 }}>
                <p style={{ fontSize: 13, fontWeight: 600, color: '#9CA3AF', marginBottom: 8 }}>Professional</p>
                <div style={{ fontSize: 36, fontWeight: 600, letterSpacing: '-0.03em', color: '#fff' }}>${prices.professional}</div>
                <div style={{ fontSize: 13, color: '#9CA3AF', marginTop: 4 }}>per month{annual ? ', billed annually' : ''}</div>
              </div>
              <a href={`${API_URL}/auth/google`} className="btn-accent" style={{ width: '100%', justifyContent: 'center', marginBottom: 28 }}>Get started</a>
              <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 10 }}>
                {['Unlimited analyses', 'Everything in Starter', 'Unlimited shipments', 'Unlimited quotes', 'Document intelligence', 'Team leaderboard', 'Up to 5 users', 'Country compliance layer', 'Priority support'].map(f => (
                  <li key={f} style={{ fontSize: 14, color: '#D1D5DB' }}><span className="check-white">✓</span>{f}</li>
                ))}
              </ul>
            </div>

            {/* Enterprise */}
            <div style={{ padding: 32, background: '#fff' }}>
              <div style={{ marginBottom: 24 }}>
                <p style={{ fontSize: 13, fontWeight: 600, color: '#6B7280', marginBottom: 8 }}>Enterprise</p>
                <div style={{ fontSize: 36, fontWeight: 600, letterSpacing: '-0.03em', color: '#111827' }}>${prices.enterprise}</div>
                <div style={{ fontSize: 13, color: '#6B7280', marginTop: 4 }}>per month{annual ? ', billed annually' : ''}</div>
              </div>
              <a href={`${API_URL}/auth/google`} className="btn-primary" style={{ width: '100%', justifyContent: 'center', marginBottom: 28 }}>Get started</a>
              <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 10 }}>
                {['Everything in Professional', 'Unlimited users', 'Custom portal branding', 'Live container tracking', 'API access', 'Dedicated support', 'Custom onboarding'].map(f => (
                  <li key={f} style={{ fontSize: 14, color: '#374151' }}><span className="check">✓</span>{f}</li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* ── SECURITY ── */}
      <section className="section-sm" style={{ background: '#fff', borderTop: '1px solid #E5E7EB', borderBottom: '1px solid #E5E7EB' }}>
        <div className="container">
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 64, alignItems: 'center' }}>
            <div>
              <div className="label">Security</div>
              <h2 className="heading-lg" style={{ marginBottom: 16 }}>Your email data stays yours</h2>
              <p className="body-lg" style={{ marginBottom: 0 }}>FreightWizard is built with security as a constraint, not an afterthought. Your emails are processed to generate analysis and never used to train AI models or shared with third parties.</p>
            </div>
            <div>
              <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 16 }}>
                {[
                  'OAuth 2.0 — no passwords stored',
                  'End-to-end encrypted data storage',
                  'Zero AI training on your emails',
                  'GDPR compliant',
                  'Strict role-based access controls',
                  'Webhook signature verification',
                ].map(item => (
                  <li key={item} style={{ display: 'flex', alignItems: 'center', gap: 12, fontSize: 15, color: '#374151' }}>
                    <span style={{ color: '#2563EB', flexShrink: 0 }}>✓</span>
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* ── FAQ ── */}
      <section id="faq" className="section">
        <div className="container-narrow">
          <div style={{ marginBottom: 48 }}>
            <div className="label">FAQ</div>
            <h2 className="heading-lg">Common questions</h2>
          </div>

          <div>
            {faqs.map((faq, i) => (
              <div key={i} className="faq-item">
                <button className="faq-btn" onClick={() => setFaqOpen(faqOpen === i ? null : i)}>
                  <span style={{ fontSize: 16, fontWeight: 500, color: '#111827', letterSpacing: '-0.01em' }}>{faq.q}</span>
                  <span style={{ fontSize: 18, color: '#9CA3AF', flexShrink: 0, transform: faqOpen === i ? 'rotate(45deg)' : 'none', transition: 'transform 0.2s' }}>+</span>
                </button>
                {faqOpen === i && (
                  <p style={{ marginTop: 16, fontSize: 15, color: '#6B7280', lineHeight: 1.7 }}>{faq.a}</p>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA ── */}
      <section className="section-sm" style={{ background: '#111827', borderTop: '1px solid #1F2937' }}>
        <div className="container" style={{ textAlign: 'center' }}>
          <h2 className="heading-lg" style={{ color: '#fff', marginBottom: 16, maxWidth: 480, margin: '0 auto 16px' }}>Start responding to freight inquiries in minutes</h2>
          <p style={{ fontSize: 17, color: '#9CA3AF', marginBottom: 40, maxWidth: 400, margin: '0 auto 40px' }}>14-day free trial. No credit card. Cancel anytime.</p>
          <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
            <a href={`${API_URL}/auth/google`} className="btn-accent">Start free trial</a>
            <a href="#pricing" style={{ display: 'inline-flex', alignItems: 'center', padding: '11px 24px', color: '#9CA3AF', fontSize: 14, textDecoration: 'none', border: '1.5px solid #374151', borderRadius: 4, transition: 'color 0.15s, border-color 0.15s' }}>View pricing</a>
          </div>
        </div>
      </section>

      {/* ── FOOTER ── */}
      <footer style={{ background: '#111827', borderTop: '1px solid #1F2937', padding: '48px 0 32px' }}>
        <div className="container">
          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr', gap: 48, marginBottom: 48 }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
                <img src="/icons/webpage_main_logo_white.svg" alt="FreightWizard" style={{ width: 20, height: 20, filter: 'brightness(0) invert(1)' }} />
                <span style={{ fontSize: 15, fontWeight: 600, color: '#fff', letterSpacing: '-0.02em' }}>FreightWizard</span>
              </div>
              <p style={{ fontSize: 14, color: '#6B7280', lineHeight: 1.6, maxWidth: 280 }}>AI-powered email management for freight forwarding operations.</p>
            </div>

            {[
              { heading: 'Product', links: [{ label: 'Features', href: '#features' }, { label: 'Pricing', href: '#pricing' }, { label: 'Integrations', href: '#features' }] },
              { heading: 'Company', links: [{ label: 'About', href: '#' }, { label: 'Blog', href: '#' }, { label: 'Careers', href: '#' }] },
              { heading: 'Legal', links: [{ label: 'Privacy', href: '#' }, { label: 'Terms', href: '#' }, { label: 'Security', href: '#' }] },
            ].map(col => (
              <div key={col.heading}>
                <p style={{ fontSize: 12, fontWeight: 600, color: '#9CA3AF', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 16 }}>{col.heading}</p>
                <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {col.links.map(l => (
                    <li key={l.label}><a href={l.href} style={{ fontSize: 14, color: '#6B7280', textDecoration: 'none', transition: 'color 0.15s' }}>{l.label}</a></li>
                  ))}
                </ul>
              </div>
            ))}
          </div>

          <div style={{ borderTop: '1px solid #1F2937', paddingTop: 24, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
            <p style={{ fontSize: 13, color: '#4B5563' }}>© 2026 FreightWizard. All rights reserved.</p>
            <p style={{ fontSize: 13, color: '#4B5563' }}>Built for freight forwarders in 🇧🇷 🇳🇱 🇺🇸</p>
          </div>
        </div>
      </footer>
    </div>
  );
}