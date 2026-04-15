'use client';

import { useState, useMemo } from 'react';
import { getMarginTargetsForCustomer } from '@/lib/config';
import styles from './Page2Vertragsanalyse.module.css';

interface Contract {
  contract_id: string;
  contract_name: string;
  revenue: number;
  cost: number;
  profit: number;
  margin_pct: number;
  risk_score: number;
  rank_priority?: boolean;
  status_color?: string;
  margin_status_color?: string;
  ebit_potential_eur?: number;
  contract_type?: string;
  diagnose?: string;
  action_label?: string;
}

interface Page2Props {
  data: any;
  industrySegment?: string;
}

const formatCurrency = (value: number | undefined): string => {
  if (value === undefined || value === null) return '0 €';
  return new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(value);
};

const formatPct = (value: number | undefined): string => {
  if (value === undefined || value === null) return '0,0 %';
  return (value * 100).toFixed(1).replace('.', ',') + ' %';
};

const getMarginStatus = (c: Contract): 'ROT' | 'GELB' | 'GRUEN' => {
  const raw = (c.margin_status_color || c.status_color || '').toUpperCase();
  if (raw === 'ROT' || raw === 'RED' || raw === 'CRITICAL') return 'ROT';
  if (raw === 'GELB' || raw === 'YELLOW' || raw === 'WARNING') return 'GELB';
  if (raw === 'GRUEN' || raw === 'GREEN' || raw === 'OK') return 'GRUEN';
  if (c.margin_pct < 0 || c.profit < 0) return 'ROT';
  if (c.margin_pct < 0.07) return 'GELB';
  return 'GRUEN';
};

const statusColors: Record<string, string> = { ROT: '#E53935', GELB: '#F9A825', GRUEN: '#43A047' };

const getDiagnose = (c: Contract): string => {
  if (c.diagnose) return c.diagnose;
  if (c.action_label) return c.action_label;
  const s = getMarginStatus(c);
  if (s === 'ROT') return c.profit < 0 ? 'Verlustvertrag — sofortiger Handlungsbedarf' : 'Kritische Marge — Nachverhandlung empfohlen';
  if (s === 'GELB') return 'Marge unter Zielwert — Optimierungspotenzial';
  return 'Vertrag im Zielbereich';
};

type FilterTab = 'kritisch' | 'beobachten' | 'gut';

export default function Page2Vertragsanalyse({ data, industrySegment }: Page2Props) {
  const [activeTab, setActiveTab] = useState<FilterTab>('kritisch');
  const { total_contracts = 0, contracts = [] } = data || {};

  // Industry-based margin thresholds
  const marginThresholds = useMemo(() => {
    if (!industrySegment) return { warn: 0.07, good: 0.12 };
    const targets = getMarginTargetsForCustomer(industrySegment);
    if (!targets) return { warn: 0.07, good: 0.12 };
    // [low, mid, high] — warn = low, good = mid
    return { warn: targets[0], good: targets[1] };
  }, [industrySegment]);

  const allContracts: Contract[] = useMemo(() => Array.isArray(contracts) ? contracts : [], [contracts]);

  const counts = useMemo(() => {
    const r = { ROT: 0, GELB: 0, GRUEN: 0 };
    allContracts.forEach((c) => { r[getMarginStatus(c)]++; });
    return r;
  }, [allContracts]);

  const totalCount = allContracts.length || total_contracts || 0;

  const kpis = useMemo(() => {
    const critical = allContracts.filter((c) => getMarginStatus(c) === 'ROT');
    return {
      criticalRevenue: critical.reduce((s, c) => s + (c.revenue || 0), 0),
      criticalEbit: critical.reduce((s, c) => s + (c.profit || 0), 0),
      avgMargin: allContracts.length > 0 ? allContracts.reduce((s, c) => s + (c.margin_pct || 0), 0) / allContracts.length : 0,
    };
  }, [allContracts]);

  const filteredContracts = useMemo(() => {
    const map: Record<FilterTab, 'ROT' | 'GELB' | 'GRUEN'> = { kritisch: 'ROT', beobachten: 'GELB', gut: 'GRUEN' };
    return allContracts.filter((c) => getMarginStatus(c) === map[activeTab]);
  }, [allContracts, activeTab]);

  const sortedContracts = useMemo(() => [...filteredContracts].sort((a, b) => {
    const al = a.profit < 0 ? 1 : 0, bl = b.profit < 0 ? 1 : 0;
    if (al !== bl) return bl - al;
    if ((b.risk_score || 0) !== (a.risk_score || 0)) return (b.risk_score || 0) - (a.risk_score || 0);
    return (b.revenue || 0) - (a.revenue || 0);
  }), [filteredContracts]);

  const healthPcts = useMemo(() => {
    const t = totalCount || 1;
    return { gruen: (counts.GRUEN / t) * 100, gelb: (counts.GELB / t) * 100, rot: (counts.ROT / t) * 100 };
  }, [counts, totalCount]);

  const negativeCount = useMemo(() => allContracts.filter((c) => c.margin_pct < 0 || c.profit < 0).length, [allContracts]);

  const avgMarginColor = kpis.avgMargin < marginThresholds.warn ? '#E53935' : kpis.avgMargin < marginThresholds.good ? '#F9A825' : '#43A047';

  return (
    <div className={styles.page2Container}>

      {/* ── Page Title ── */}
      <div className={styles.pageHeader}>
        <h2 className={styles.pageTitle}>Vertragsanalyse</h2>
        <p className={styles.pageSubtitle}>Margen-Diagnose, Risikobewertung und Handlungsempfehlungen je Vertrag</p>
      </div>

      {/* ── Hero Section ── */}
      <section className={styles.heroSection}>
        <div className={styles.heroTop}>
          <span className={styles.heroLabel}>VERTRAGSPORTFOLIO</span>
          {counts.ROT > 0 && <span className={styles.heroBadge}>HANDLUNGSBEDARF</span>}
        </div>
        <div className={styles.heroMain}>
          <span className={styles.heroCount}>{counts.ROT}</span>
          <span className={styles.heroTotal}>&nbsp;/ {totalCount} Verträge</span>
        </div>
        <div className={styles.heroStatus}>
          {counts.ROT > 0 && (
            <span className={styles.heroStatusRot}>{counts.ROT} Kritisch (Marge &lt;7%)</span>
          )}
          {counts.ROT > 0 && counts.GELB > 0 && <span className={styles.heroStatusDot}>·</span>}
          {counts.GELB > 0 && (
            <span className={styles.heroStatusGelb}>{counts.GELB} Beobachten (7–12%)</span>
          )}
        </div>
      </section>

      {/* ── KPI Cards ── */}
      <section className={styles.kpiSection}>
        <div className={styles.kpiGrid}>
          <div className={styles.kpiCard}>
            <div className={styles.kpiLabel}>Umsatz — Kritische Verträge</div>
            <div className={styles.kpiValue} style={{ color: counts.ROT > 0 ? '#E53935' : 'var(--primary, #192231)' }}>{formatCurrency(kpis.criticalRevenue)}</div>
            <div className={styles.kpiSub}>{counts.ROT} Verträge</div>
          </div>
          <div className={styles.kpiCard}>
            <div className={styles.kpiLabel}>Ø Vertragsmarge</div>
            <div className={styles.kpiValue} style={{ color: avgMarginColor }}>{formatPct(kpis.avgMargin)}</div>
            <div className={styles.kpiSub}>{totalCount} Verträge gesamt</div>
          </div>
          <div className={styles.kpiCard}>
            <div className={styles.kpiLabel}>EBIT — Kritische Verträge</div>
            <div className={styles.kpiValue} style={{ color: kpis.criticalEbit < 0 ? '#E53935' : '#F9A825' }}>{formatCurrency(kpis.criticalEbit)}</div>
            <div className={styles.kpiSub}>Verlustpotenzial</div>
          </div>
        </div>
      </section>

      {/* ── Portfolio-Gesundheit ── */}
      <section className={styles.healthSection}>
        <div className={styles.healthHeader}>
          <h3 className={styles.healthTitle}>Portfolio-Gesundheit</h3>
          <div className={styles.healthLegend}>
            <span className={styles.legendItem}><span className={styles.legendDot} style={{ background: '#43A047' }} />Gut ({counts.GRUEN})</span>
            <span className={styles.legendItem}><span className={styles.legendDot} style={{ background: '#F9A825' }} />Beobachten ({counts.GELB})</span>
            <span className={styles.legendItem}><span className={styles.legendDot} style={{ background: '#E53935' }} />Kritisch ({counts.ROT})</span>
          </div>
        </div>
        <div className={styles.healthBar}>
          {healthPcts.gruen > 0 && <div className={styles.healthSegment} style={{ width: `${healthPcts.gruen}%`, background: '#43A047' }}>{healthPcts.gruen >= 10 && `${Math.round(healthPcts.gruen)}%`}</div>}
          {healthPcts.gelb > 0 && <div className={styles.healthSegment} style={{ width: `${healthPcts.gelb}%`, background: '#F9A825' }}>{healthPcts.gelb >= 10 && `${Math.round(healthPcts.gelb)}%`}</div>}
          {healthPcts.rot > 0 && <div className={styles.healthSegment} style={{ width: `${healthPcts.rot}%`, background: '#E53935' }}>{healthPcts.rot >= 10 && `${Math.round(healthPcts.rot)}%`}</div>}
        </div>
      </section>

      {/* ── Warning ── */}
      {negativeCount > 0 && (
        <section className={styles.warningSection}>
          <div className={styles.warningBox}>
            <span className={styles.warningIcon}>&#9888;</span>
            <span><strong>{negativeCount} Verträge</strong> mit negativer Marge — sofortiger Handlungsbedarf</span>
          </div>
        </section>
      )}

      {/* ── Tabs ── */}
      <section className={styles.filterSection}>
        <div className={styles.tabBar}>
          <button className={`${styles.tab} ${styles.tabRot} ${activeTab === 'kritisch' ? styles.active : ''}`} onClick={() => setActiveTab('kritisch')}>Kritisch ({counts.ROT})</button>
          <button className={`${styles.tab} ${styles.tabGelb} ${activeTab === 'beobachten' ? styles.active : ''}`} onClick={() => setActiveTab('beobachten')}>Beobachten ({counts.GELB})</button>
          <button className={`${styles.tab} ${styles.tabGruen} ${activeTab === 'gut' ? styles.active : ''}`} onClick={() => setActiveTab('gut')}>Gut ({counts.GRUEN})</button>
        </div>
      </section>

      {/* ── Table ── */}
      <section className={styles.tableSection}>
        {sortedContracts.length > 0 ? (
          <div className={styles.tableWrapper}>
            <table className={styles.contractsTable}>
              <thead>
                <tr className={styles.headerRow}>
                  <th className={styles.cellPrio}>PRIO</th>
                  <th className={styles.cellVertrag}>VERTRAG</th>
                  <th className={styles.cellNumeric}>UMSATZ</th>
                  <th className={styles.cellNumeric}>EBIT</th>
                  <th className={styles.cellMarge}>MARGE</th>
                  <th className={styles.cellDiagnose}>DIAGNOSE</th>
                </tr>
              </thead>
              <tbody>
                {sortedContracts.map((contract, idx) => {
                  const status = getMarginStatus(contract);
                  const barWidth = Math.min(100, Math.max(0, Math.abs((contract.margin_pct || 0) * 100) * 2.5));
                  const barColor = statusColors[status];
                  const isNeg = contract.profit < 0;
                  return (
                    <tr key={contract.contract_id || idx} className={`${styles.dataRow} ${isNeg ? styles.rowLoss : ''}`}>
                      <td className={styles.cellPrio}>
                        {contract.rank_priority ? <span className={styles.prioBadge}>!</span> : <span className={styles.prioNormal}>{idx + 1}</span>}
                      </td>
                      <td className={styles.cellVertrag}>
                        <div className={styles.contractName}>{contract.contract_name || contract.contract_id}</div>
                        <div className={styles.contractMeta}>
                          <span className={styles.contractId}>{contract.contract_id}</span>
                          {contract.contract_type && <span className={styles.contractType}>{contract.contract_type}</span>}
                        </div>
                      </td>
                      <td className={styles.cellNumeric}>{formatCurrency(contract.revenue)}</td>
                      <td className={`${styles.cellNumeric} ${isNeg ? styles.textRed : ''}`}><strong>{formatCurrency(contract.profit)}</strong></td>
                      <td className={styles.cellMarge}>
                        <div className={styles.margeBarContainer}><div className={styles.margeBarFill} style={{ width: `${barWidth}%`, backgroundColor: barColor }} /></div>
                        <span className={styles.margeValue} style={{ color: barColor }}>{formatPct(contract.margin_pct)}</span>
                      </td>
                      <td className={styles.cellDiagnose}>
                        <span className={styles.diagnoseBadge} style={{ backgroundColor: `${barColor}18`, color: barColor, borderColor: `${barColor}40` }}>{getDiagnose(contract)}</span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className={styles.emptyState}><p>Keine Verträge in dieser Kategorie</p></div>
        )}
      </section>
    </div>
  );
}
