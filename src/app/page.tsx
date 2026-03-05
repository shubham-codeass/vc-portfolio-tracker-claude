// src/app/page.tsx
'use client';

import { useState, useCallback } from 'react';
import type { VCFundData, PortfolioCompany } from '@/lib/scraper';
import type { KnownVCFund } from '@/lib/indian-vcs';

type ViewMode = 'grid' | 'list' | 'table';
type FilterStage = 'all' | string;

export default function Home() {
  const [urlInput, setUrlInput] = useState('');
  const [urlList, setUrlList] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<VCFundData[]>([]);
  const [error, setError] = useState('');
  const [viewMode, setViewMode] = useState<ViewMode>('grid');
  const [selectedFund, setSelectedFund] = useState<number | null>(null);
  const [expandedCompany, setExpandedCompany] = useState<string | null>(null);
  const [enrichingCompany, setEnrichingCompany] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [showKnownFunds, setShowKnownFunds] = useState(false);
  const [knownFunds, setKnownFunds] = useState<KnownVCFund[]>([]);
  const [activeTab, setActiveTab] = useState<'scraper' | 'database'>('scraper');
  const [exportFormat] = useState<'json' | 'csv'>('csv');

  const addUrl = () => {
    const trimmed = urlInput.trim();
    if (!trimmed) return;
    const normalized = trimmed.startsWith('http') ? trimmed : `https://${trimmed}`;
    if (!urlList.includes(normalized)) {
      setUrlList(prev => [...prev, normalized]);
    }
    setUrlInput('');
  };

  const removeUrl = (url: string) => {
    setUrlList(prev => prev.filter(u => u !== url));
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') addUrl();
  };

  const loadKnownFunds = async () => {
    try {
      const res = await fetch('/api/known-funds');
      const data = await res.json();
      setKnownFunds(data.funds || []);
      setShowKnownFunds(true);
    } catch {
      // ignore
    }
  };

  const addKnownFundUrl = (fund: KnownVCFund) => {
    const url = fund.portfolioPage || fund.website;
    if (!urlList.includes(url)) {
      setUrlList(prev => [...prev, url]);
    }
  };

  const handleScrape = async () => {
    if (urlList.length === 0) {
      setError('Please add at least one VC fund URL');
      return;
    }
    setLoading(true);
    setError('');
    setResults([]);

    try {
      const res = await fetch('/api/scrape', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ urls: urlList }),
      });
      const data = await res.json();
      if (data.error) {
        setError(data.error);
      } else {
        setResults(data.results || []);
        setSelectedFund(0);
        setActiveTab('database');
      }
    } catch (err) {
      setError('Failed to fetch data. Please check your connection.');
    } finally {
      setLoading(false);
    }
  };

  const enrichCompanyData = async (company: PortfolioCompany, fundIndex: number, companyIndex: number) => {
    const key = `${fundIndex}-${companyIndex}`;
    setEnrichingCompany(key);
    try {
      const res = await fetch('/api/company-details', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ company }),
      });
      const data = await res.json();
      if (data.company) {
        setResults(prev => {
          const next = [...prev];
          next[fundIndex] = {
            ...next[fundIndex],
            portfolio: next[fundIndex].portfolio.map((c, i) =>
              i === companyIndex ? data.company : c
            ),
          };
          return next;
        });
      }
    } catch {
      // ignore
    } finally {
      setEnrichingCompany(null);
    }
  };

  const exportData = () => {
    const allCompanies: any[] = [];
    results.forEach(fund => {
      fund.portfolio.forEach(company => {
        allCompanies.push({
          Fund: fund.fundName,
          Company: company.name,
          Website: company.website || '',
          Description: company.description || '',
          Sector: company.sector || '',
          Stage: company.stage || '',
          Status: company.status || '',
          'Total Funding': company.totalFunding || '',
          LinkedIn: company.linkedinUrl || '',
          Crunchbase: company.crunchbaseUrl || '',
        });
      });
    });

    const headers = Object.keys(allCompanies[0] || {});
    const csv = [
      headers.join(','),
      ...allCompanies.map(row =>
        headers.map(h => `"${(row[h] || '').replace(/"/g, '""')}"`).join(',')
      ),
    ].join('\n');

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `vc-portfolio-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const currentFund = selectedFund !== null ? results[selectedFund] : null;
  const filteredCompanies = currentFund?.portfolio.filter(c =>
    !searchTerm || c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    c.description?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    c.sector?.toLowerCase().includes(searchTerm.toLowerCase())
  ) || [];

  const totalCompanies = results.reduce((acc, f) => acc + f.portfolio.length, 0);

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#0a0a0f', color: '#e8e8e8', fontFamily: "'DM Sans', 'Inter', sans-serif" }}>
      {/* Header */}
      <header style={{ borderBottom: '1px solid #1e1e2e', padding: '0 2rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: '64px', position: 'sticky', top: 0, zIndex: 100, backgroundColor: '#0a0a0f', backdropFilter: 'blur(10px)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{ width: '32px', height: '32px', background: 'linear-gradient(135deg, #7c3aed, #2563eb)', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '16px' }}>⚡</div>
          <span style={{ fontWeight: 700, fontSize: '1.1rem', letterSpacing: '-0.02em' }}>VC Intel</span>
          <span style={{ fontSize: '0.7rem', padding: '2px 8px', background: '#1e1e2e', borderRadius: '99px', color: '#7c3aed', fontWeight: 600, letterSpacing: '0.05em' }}>INDIA</span>
        </div>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          {results.length > 0 && (
            <>
              <span style={{ fontSize: '0.8rem', color: '#888' }}>{results.length} fund{results.length > 1 ? 's' : ''} · {totalCompanies} companies</span>
              <button onClick={exportData} style={{ padding: '6px 14px', background: '#1e1e2e', border: '1px solid #2e2e3e', borderRadius: '6px', color: '#e8e8e8', fontSize: '0.8rem', cursor: 'pointer' }}>
                ↓ Export CSV
              </button>
            </>
          )}
        </div>
      </header>

      <div style={{ display: 'flex', height: 'calc(100vh - 64px)' }}>
        {/* Sidebar */}
        <aside style={{ width: '300px', flexShrink: 0, borderRight: '1px solid #1e1e2e', overflowY: 'auto', padding: '1.5rem', backgroundColor: '#0d0d15' }}>
          {/* Tabs */}
          <div style={{ display: 'flex', gap: '4px', marginBottom: '1.5rem', background: '#1e1e2e', borderRadius: '8px', padding: '4px' }}>
            {(['scraper', 'database'] as const).map(tab => (
              <button key={tab} onClick={() => setActiveTab(tab)} style={{ flex: 1, padding: '6px', borderRadius: '6px', border: 'none', cursor: 'pointer', fontSize: '0.78rem', fontWeight: 600, background: activeTab === tab ? '#7c3aed' : 'transparent', color: activeTab === tab ? '#fff' : '#888', textTransform: 'capitalize' }}>
                {tab === 'scraper' ? '🔍 Scraper' : '📊 Results'}
              </button>
            ))}
          </div>

          {activeTab === 'scraper' && (
            <div>
              <h3 style={{ fontSize: '0.8rem', fontWeight: 700, color: '#888', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '1rem' }}>Add Fund URLs</h3>
              
              {/* URL Input */}
              <div style={{ display: 'flex', gap: '6px', marginBottom: '8px' }}>
                <input
                  type="text"
                  value={urlInput}
                  onChange={e => setUrlInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="blume.vc or https://..."
                  style={{ flex: 1, padding: '8px 10px', background: '#1e1e2e', border: '1px solid #2e2e3e', borderRadius: '6px', color: '#e8e8e8', fontSize: '0.82rem', outline: 'none' }}
                />
                <button onClick={addUrl} style={{ padding: '8px 12px', background: '#7c3aed', border: 'none', borderRadius: '6px', color: '#fff', cursor: 'pointer', fontWeight: 700, fontSize: '1rem' }}>+</button>
              </div>

              {/* URL List */}
              {urlList.length > 0 && (
                <div style={{ marginBottom: '1rem' }}>
                  {urlList.map(url => (
                    <div key={url} style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '6px 8px', background: '#1a1a25', borderRadius: '6px', marginBottom: '4px', border: '1px solid #2e2e3e' }}>
                      <span style={{ flex: 1, fontSize: '0.75rem', color: '#aaa', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{url.replace('https://', '')}</span>
                      <button onClick={() => removeUrl(url)} style={{ background: 'none', border: 'none', color: '#666', cursor: 'pointer', padding: '0 2px', fontSize: '0.9rem' }}>✕</button>
                    </div>
                  ))}
                </div>
              )}

              {/* Known Funds Button */}
              <button onClick={loadKnownFunds} style={{ width: '100%', padding: '8px', background: 'transparent', border: '1px dashed #2e2e3e', borderRadius: '6px', color: '#7c3aed', cursor: 'pointer', fontSize: '0.8rem', marginBottom: '12px' }}>
                + Browse 20 known Indian VC funds
              </button>

              {/* Known Funds Dropdown */}
              {showKnownFunds && (
                <div style={{ marginBottom: '1rem', maxHeight: '300px', overflowY: 'auto' }}>
                  {knownFunds.map(fund => (
                    <div key={fund.name} onClick={() => addKnownFundUrl(fund)} style={{ padding: '8px', background: '#1e1e2e', borderRadius: '6px', marginBottom: '4px', cursor: 'pointer', border: '1px solid #2e2e3e' }}>
                      <div style={{ fontSize: '0.8rem', fontWeight: 600, color: '#e8e8e8' }}>{fund.name}</div>
                      <div style={{ fontSize: '0.7rem', color: '#666', marginTop: '2px' }}>{fund.aum} · {fund.stage.join(', ')}</div>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '3px', marginTop: '4px' }}>
                        {fund.focus.slice(0, 3).map(f => (
                          <span key={f} style={{ fontSize: '0.65rem', padding: '1px 5px', background: '#2e1e5e', color: '#9c72f0', borderRadius: '3px' }}>{f}</span>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Scrape Button */}
              <button
                onClick={handleScrape}
                disabled={loading || urlList.length === 0}
                style={{ width: '100%', padding: '10px', background: loading ? '#3a3a5a' : 'linear-gradient(135deg, #7c3aed, #2563eb)', border: 'none', borderRadius: '8px', color: '#fff', cursor: loading ? 'not-allowed' : 'pointer', fontWeight: 700, fontSize: '0.9rem', marginBottom: '8px' }}
              >
                {loading ? '⏳ Scraping...' : `🚀 Scrape ${urlList.length} Fund${urlList.length !== 1 ? 's' : ''}`}
              </button>

              {error && (
                <div style={{ padding: '8px', background: '#2e1e1e', border: '1px solid #5e2e2e', borderRadius: '6px', color: '#f87171', fontSize: '0.78rem' }}>
                  {error}
                </div>
              )}

              {/* Tips */}
              <div style={{ marginTop: '1.5rem', padding: '10px', background: '#1a1a25', borderRadius: '6px', border: '1px solid #2e2e3e' }}>
                <div style={{ fontSize: '0.72rem', color: '#666', fontWeight: 700, marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>💡 Tips</div>
                <ul style={{ fontSize: '0.72rem', color: '#888', paddingLeft: '12px', lineHeight: 1.8, margin: 0 }}>
                  <li>Use portfolio/companies page URLs for best results</li>
                  <li>Add multiple funds to compare portfolios</li>
                  <li>Click "Enrich" on companies to fetch news</li>
                  <li>Export to CSV for your deal flow tracker</li>
                </ul>
              </div>
            </div>
          )}

          {activeTab === 'database' && results.length > 0 && (
            <div>
              <h3 style={{ fontSize: '0.8rem', fontWeight: 700, color: '#888', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '1rem' }}>Scraped Funds</h3>
              {results.map((fund, i) => (
                <div
                  key={i}
                  onClick={() => setSelectedFund(i)}
                  style={{
                    padding: '10px 12px',
                    background: selectedFund === i ? '#2e1e5e' : '#1e1e2e',
                    borderRadius: '8px',
                    marginBottom: '6px',
                    cursor: 'pointer',
                    border: selectedFund === i ? '1px solid #7c3aed' : '1px solid transparent',
                    transition: 'all 0.15s',
                  }}
                >
                  <div style={{ fontWeight: 600, fontSize: '0.85rem', marginBottom: '2px' }}>{fund.fundName}</div>
                  <div style={{ fontSize: '0.72rem', color: '#888' }}>
                    {fund.portfolio.length} companies
                    {fund.error && <span style={{ color: '#f87171' }}> · Error</span>}
                  </div>
                  {fund.focus && (
                    <div style={{ display: 'flex', gap: '3px', flexWrap: 'wrap', marginTop: '4px' }}>
                      {fund.focus.slice(0, 2).map(f => (
                        <span key={f} style={{ fontSize: '0.6rem', padding: '1px 5px', background: '#2e1e5e', color: '#9c72f0', borderRadius: '3px' }}>{f}</span>
                      ))}
                    </div>
                  )}
                </div>
              ))}

              <button onClick={() => { setActiveTab('scraper'); }} style={{ width: '100%', marginTop: '8px', padding: '8px', background: 'transparent', border: '1px dashed #2e2e3e', borderRadius: '6px', color: '#888', cursor: 'pointer', fontSize: '0.78rem' }}>
                + Add more funds
              </button>
            </div>
          )}
        </aside>

        {/* Main Content */}
        <main style={{ flex: 1, overflowY: 'auto', padding: '2rem' }}>
          {!currentFund && results.length === 0 && (
            <LandingState onLoadFunds={loadKnownFunds} />
          )}

          {currentFund && (
            <>
              {/* Fund Header */}
              <div style={{ marginBottom: '2rem' }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem' }}>
                  <div>
                    <h1 style={{ fontSize: '1.8rem', fontWeight: 800, letterSpacing: '-0.03em', marginBottom: '6px', background: 'linear-gradient(135deg, #e8e8e8, #aaa)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
                      {currentFund.fundName}
                    </h1>
                    <div style={{ display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap' }}>
                      <a href={currentFund.fundWebsite} target="_blank" rel="noopener noreferrer" style={{ fontSize: '0.8rem', color: '#7c3aed', textDecoration: 'none' }}>
                        🌐 {currentFund.fundWebsite.replace('https://', '')}
                      </a>
                      {currentFund.aum && <span style={{ fontSize: '0.8rem', color: '#888' }}>💰 AUM: {currentFund.aum}</span>}
                      <span style={{ fontSize: '0.8rem', color: '#888' }}>📅 Scraped {new Date(currentFund.scrapedAt).toLocaleDateString('en-IN')}</span>
                    </div>
                    {currentFund.fundDescription && (
                      <p style={{ fontSize: '0.85rem', color: '#888', marginTop: '8px', maxWidth: '600px', lineHeight: 1.6 }}>{currentFund.fundDescription}</p>
                    )}
                    {currentFund.focus && (
                      <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginTop: '8px' }}>
                        {currentFund.focus.map(f => (
                          <span key={f} style={{ fontSize: '0.72rem', padding: '3px 10px', background: '#1e1e3e', color: '#9c72f0', borderRadius: '99px', border: '1px solid #3e2e6e' }}>{f}</span>
                        ))}
                      </div>
                    )}
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '8px' }}>
                    <div style={{ fontSize: '2.5rem', fontWeight: 800, color: '#7c3aed', lineHeight: 1 }}>{currentFund.portfolio.length}</div>
                    <div style={{ fontSize: '0.75rem', color: '#666', textAlign: 'right' }}>portfolio companies</div>
                  </div>
                </div>
                {currentFund.error && (
                  <div style={{ marginTop: '10px', padding: '8px 12px', background: '#2e1e1e', border: '1px solid #5e2e2e', borderRadius: '6px', color: '#f87171', fontSize: '0.8rem' }}>
                    ⚠️ Partial data: {currentFund.error}. Showing available data only.
                  </div>
                )}
              </div>

              {/* Controls */}
              <div style={{ display: 'flex', gap: '10px', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
                <input
                  type="text"
                  placeholder="Search companies..."
                  value={searchTerm}
                  onChange={e => setSearchTerm(e.target.value)}
                  style={{ padding: '8px 14px', background: '#1e1e2e', border: '1px solid #2e2e3e', borderRadius: '6px', color: '#e8e8e8', fontSize: '0.85rem', outline: 'none', flex: 1, minWidth: '200px' }}
                />
                <div style={{ display: 'flex', gap: '4px', background: '#1e1e2e', borderRadius: '6px', padding: '4px', border: '1px solid #2e2e3e' }}>
                  {(['grid', 'list', 'table'] as ViewMode[]).map(mode => (
                    <button key={mode} onClick={() => setViewMode(mode)} style={{ padding: '4px 10px', borderRadius: '4px', border: 'none', cursor: 'pointer', background: viewMode === mode ? '#7c3aed' : 'transparent', color: viewMode === mode ? '#fff' : '#888', fontSize: '0.75rem', fontWeight: 600 }}>
                      {mode === 'grid' ? '⊞' : mode === 'list' ? '☰' : '⊟'} {mode}
                    </button>
                  ))}
                </div>
                <span style={{ fontSize: '0.8rem', color: '#666' }}>{filteredCompanies.length} shown</span>
              </div>

              {/* Company Grid */}
              {viewMode === 'grid' && (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '1rem' }}>
                  {filteredCompanies.map((company, i) => (
                    <CompanyCard
                      key={company.name + i}
                      company={company}
                      isExpanded={expandedCompany === `${selectedFund}-${i}`}
                      isEnriching={enrichingCompany === `${selectedFund}-${i}`}
                      onExpand={() => setExpandedCompany(
                        expandedCompany === `${selectedFund}-${i}` ? null : `${selectedFund}-${i}`
                      )}
                      onEnrich={() => enrichCompanyData(company, selectedFund!, i)}
                    />
                  ))}
                </div>
              )}

              {viewMode === 'list' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  {filteredCompanies.map((company, i) => (
                    <CompanyListItem
                      key={company.name + i}
                      company={company}
                      isEnriching={enrichingCompany === `${selectedFund}-${i}`}
                      onEnrich={() => enrichCompanyData(company, selectedFund!, i)}
                    />
                  ))}
                </div>
              )}

              {viewMode === 'table' && (
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
                    <thead>
                      <tr style={{ borderBottom: '1px solid #2e2e3e' }}>
                        {['Company', 'Sector', 'Stage', 'Funding', 'Status', 'Links'].map(h => (
                          <th key={h} style={{ padding: '10px 12px', textAlign: 'left', color: '#666', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', fontSize: '0.7rem', whiteSpace: 'nowrap' }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {filteredCompanies.map((company, i) => (
                        <tr key={company.name + i} style={{ borderBottom: '1px solid #1e1e2e' }}>
                          <td style={{ padding: '10px 12px', fontWeight: 600 }}>
                            {company.website ? (
                              <a href={company.website} target="_blank" rel="noopener noreferrer" style={{ color: '#e8e8e8', textDecoration: 'none' }}>{company.name}</a>
                            ) : company.name}
                            {company.description && <div style={{ fontSize: '0.72rem', color: '#666', marginTop: '2px', maxWidth: '250px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{company.description}</div>}
                          </td>
                          <td style={{ padding: '10px 12px', color: '#888' }}>{company.sector || '—'}</td>
                          <td style={{ padding: '10px 12px', color: '#888' }}>{company.stage || '—'}</td>
                          <td style={{ padding: '10px 12px', color: '#888' }}>{company.totalFunding || '—'}</td>
                          <td style={{ padding: '10px 12px' }}>
                            <StatusBadge status={company.status || 'unknown'} />
                          </td>
                          <td style={{ padding: '10px 12px' }}>
                            <div style={{ display: 'flex', gap: '6px' }}>
                              {company.website && <a href={company.website} target="_blank" rel="noopener noreferrer" style={{ color: '#7c3aed', textDecoration: 'none', fontSize: '0.75rem' }}>🌐</a>}
                              {company.linkedinUrl && <a href={company.linkedinUrl} target="_blank" rel="noopener noreferrer" style={{ color: '#0a66c2', textDecoration: 'none', fontSize: '0.75rem' }}>in</a>}
                              {company.crunchbaseUrl && <a href={company.crunchbaseUrl} target="_blank" rel="noopener noreferrer" style={{ color: '#f06d06', textDecoration: 'none', fontSize: '0.75rem' }}>CB</a>}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          )}
        </main>
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, { bg: string, color: string }> = {
    active: { bg: '#0d2e1a', color: '#4ade80' },
    acquired: { bg: '#1a1e2e', color: '#60a5fa' },
    ipo: { bg: '#1e2a0d', color: '#a3e635' },
    shutdown: { bg: '#2e1a1a', color: '#f87171' },
    unknown: { bg: '#1e1e2e', color: '#888' },
  };
  const c = colors[status] || colors.unknown;
  return (
    <span style={{ fontSize: '0.7rem', padding: '2px 8px', background: c.bg, color: c.color, borderRadius: '99px', fontWeight: 600 }}>
      {status}
    </span>
  );
}

function CompanyCard({ company, isExpanded, isEnriching, onExpand, onEnrich }: {
  company: PortfolioCompany;
  isExpanded: boolean;
  isEnriching: boolean;
  onExpand: () => void;
  onEnrich: () => void;
}) {
  return (
    <div style={{ background: '#0d0d15', border: '1px solid #1e1e2e', borderRadius: '12px', padding: '1.2rem', transition: 'border-color 0.2s', cursor: 'default' }}
      onMouseEnter={e => (e.currentTarget.style.borderColor = '#3e2e6e')}
      onMouseLeave={e => (e.currentTarget.style.borderColor = '#1e1e2e')}>
      
      {/* Company Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
        <div>
          <h3 style={{ fontWeight: 700, fontSize: '1rem', marginBottom: '2px', letterSpacing: '-0.01em' }}>
            {company.website ? (
              <a href={company.website} target="_blank" rel="noopener noreferrer" style={{ color: '#e8e8e8', textDecoration: 'none' }}>{company.name}</a>
            ) : company.name}
          </h3>
          {company.sector && (
            <span style={{ fontSize: '0.7rem', padding: '1px 6px', background: '#1e1e2e', color: '#9c72f0', borderRadius: '4px' }}>{company.sector}</span>
          )}
        </div>
        <StatusBadge status={company.status || 'unknown'} />
      </div>

      {company.description && (
        <p style={{ fontSize: '0.8rem', color: '#888', lineHeight: 1.5, marginBottom: '10px', display: '-webkit-box', WebkitLineClamp: isExpanded ? 100 : 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
          {company.description}
        </p>
      )}

      {/* Metadata row */}
      <div style={{ display: 'flex', gap: '12px', marginBottom: '10px', flexWrap: 'wrap' }}>
        {company.stage && <span style={{ fontSize: '0.72rem', color: '#666' }}>📊 {company.stage}</span>}
        {company.totalFunding && <span style={{ fontSize: '0.72rem', color: '#4ade80' }}>💰 {company.totalFunding}</span>}
        {company.hq && <span style={{ fontSize: '0.72rem', color: '#666' }}>📍 {company.hq}</span>}
        {company.foundedYear && <span style={{ fontSize: '0.72rem', color: '#666' }}>📅 {company.foundedYear}</span>}
      </div>

      {/* Expanded content */}
      {isExpanded && company.newsArticles && company.newsArticles.length > 0 && (
        <div style={{ marginBottom: '10px', padding: '10px', background: '#1e1e2e', borderRadius: '8px' }}>
          <div style={{ fontSize: '0.72rem', fontWeight: 700, color: '#666', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>📰 Recent News</div>
          {company.newsArticles.slice(0, 3).map((article, i) => (
            <div key={i} style={{ marginBottom: '6px' }}>
              <a href={article.url} target="_blank" rel="noopener noreferrer" style={{ fontSize: '0.78rem', color: '#9c72f0', textDecoration: 'none', display: 'block', lineHeight: 1.4 }}>{article.title}</a>
              <span style={{ fontSize: '0.68rem', color: '#666' }}>{article.source}{article.date ? ` · ${article.date}` : ''}</span>
            </div>
          ))}
        </div>
      )}

      {/* Links & Actions */}
      <div style={{ display: 'flex', gap: '6px', alignItems: 'center', flexWrap: 'wrap' }}>
        {company.website && (
          <a href={company.website} target="_blank" rel="noopener noreferrer" style={{ fontSize: '0.72rem', padding: '3px 8px', background: '#1e1e2e', border: '1px solid #2e2e3e', borderRadius: '4px', color: '#aaa', textDecoration: 'none' }}>🌐 Website</a>
        )}
        {company.linkedinUrl && (
          <a href={company.linkedinUrl} target="_blank" rel="noopener noreferrer" style={{ fontSize: '0.72rem', padding: '3px 8px', background: '#1e1e2e', border: '1px solid #2e2e3e', borderRadius: '4px', color: '#0a66c2', textDecoration: 'none' }}>LinkedIn</a>
        )}
        {company.crunchbaseUrl && (
          <a href={company.crunchbaseUrl} target="_blank" rel="noopener noreferrer" style={{ fontSize: '0.72rem', padding: '3px 8px', background: '#1e1e2e', border: '1px solid #2e2e3e', borderRadius: '4px', color: '#f06d06', textDecoration: 'none' }}>Crunchbase</a>
        )}
        <div style={{ flex: 1 }} />
        <button onClick={onEnrich} disabled={isEnriching} style={{ fontSize: '0.7rem', padding: '3px 8px', background: 'transparent', border: '1px solid #3e2e6e', borderRadius: '4px', color: '#9c72f0', cursor: 'pointer' }}>
          {isEnriching ? '⏳' : '✨ Enrich'}
        </button>
        <button onClick={onExpand} style={{ fontSize: '0.7rem', padding: '3px 8px', background: 'transparent', border: '1px solid #2e2e3e', borderRadius: '4px', color: '#666', cursor: 'pointer' }}>
          {isExpanded ? '▲' : '▼'}
        </button>
      </div>
    </div>
  );
}

function CompanyListItem({ company, isEnriching, onEnrich }: {
  company: PortfolioCompany;
  isEnriching: boolean;
  onEnrich: () => void;
}) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', padding: '10px 14px', background: '#0d0d15', border: '1px solid #1e1e2e', borderRadius: '8px', flexWrap: 'wrap' }}>
      <div style={{ flex: '1 1 200px' }}>
        <span style={{ fontWeight: 600, fontSize: '0.9rem' }}>
          {company.website ? (
            <a href={company.website} target="_blank" rel="noopener noreferrer" style={{ color: '#e8e8e8', textDecoration: 'none' }}>{company.name}</a>
          ) : company.name}
        </span>
        {company.description && <span style={{ fontSize: '0.75rem', color: '#666', marginLeft: '10px' }}>{company.description.slice(0, 80)}...</span>}
      </div>
      <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
        {company.sector && <span style={{ fontSize: '0.72rem', color: '#9c72f0' }}>{company.sector}</span>}
        {company.totalFunding && <span style={{ fontSize: '0.72rem', color: '#4ade80' }}>{company.totalFunding}</span>}
        <StatusBadge status={company.status || 'unknown'} />
        {company.website && <a href={company.website} target="_blank" rel="noopener noreferrer" style={{ fontSize: '0.72rem', color: '#7c3aed' }}>🌐</a>}
        {company.crunchbaseUrl && <a href={company.crunchbaseUrl} target="_blank" rel="noopener noreferrer" style={{ fontSize: '0.72rem', color: '#f06d06' }}>CB</a>}
        <button onClick={onEnrich} disabled={isEnriching} style={{ fontSize: '0.7rem', padding: '2px 8px', background: 'transparent', border: '1px solid #3e2e6e', borderRadius: '4px', color: '#9c72f0', cursor: 'pointer' }}>
          {isEnriching ? '⏳' : '✨'}
        </button>
      </div>
    </div>
  );
}

function LandingState({ onLoadFunds }: { onLoadFunds: () => void }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '70vh', textAlign: 'center', gap: '1.5rem' }}>
      <div style={{ fontSize: '4rem' }}>⚡</div>
      <h2 style={{ fontSize: '2rem', fontWeight: 800, letterSpacing: '-0.03em', background: 'linear-gradient(135deg, #e8e8e8, #7c3aed)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
        Indian VC Portfolio Intelligence
      </h2>
      <p style={{ color: '#666', maxWidth: '500px', lineHeight: 1.7, fontSize: '0.95rem' }}>
        Scrape any Indian VC fund's portfolio page, enrich company data from public sources, and track deal flow — completely free, no API keys needed.
      </p>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1rem', maxWidth: '600px', marginTop: '0.5rem' }}>
        {[
          { icon: '🔍', label: 'Scrape Portfolio Pages', desc: 'Paste any fund URL' },
          { icon: '📰', label: 'Fetch Public News', desc: 'Google News RSS, free' },
          { icon: '📊', label: 'Export Deal Flow CSV', desc: 'One-click export' },
        ].map(item => (
          <div key={item.label} style={{ padding: '1rem', background: '#0d0d15', border: '1px solid #1e1e2e', borderRadius: '10px' }}>
            <div style={{ fontSize: '1.5rem', marginBottom: '6px' }}>{item.icon}</div>
            <div style={{ fontWeight: 600, fontSize: '0.82rem', marginBottom: '2px' }}>{item.label}</div>
            <div style={{ fontSize: '0.72rem', color: '#666' }}>{item.desc}</div>
          </div>
        ))}
      </div>
      <button onClick={onLoadFunds} style={{ marginTop: '1rem', padding: '10px 24px', background: 'linear-gradient(135deg, #7c3aed, #2563eb)', border: 'none', borderRadius: '8px', color: '#fff', cursor: 'pointer', fontWeight: 700, fontSize: '0.9rem' }}>
        Browse 20 Known Indian VC Funds →
      </button>
    </div>
  );
}
