'use client';

import { useState, useEffect } from 'react';
import { api } from '@/lib/api';
import { AuthData } from '@/types';

type PageNum = 1 | 2 | 3 | 4;

const PAGE_TITLES: Record<PageNum, string> = {
  1: 'Gesamtlage',
  2: 'Vertragsanalyse',
  3: 'Liquiditätsstabilität',
  4: 'Maßnahmen & Benchmarks',
};

// ─── Helpers ────────────────────────────────────────────────────────────────

function fmt(val: any, decimals = 0): string {
  const n = parseFloat(val);
  if (isNaN(n)) return '–';
  return n.toLocaleString('de-DE', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
}
function fmtEur(val: any, decimals = 0): string {
  const n = parseFloat(val);
  if (isNaN(n)) return '–';
  return n.toLocaleString('de-DE', { minimumFractionDigits: decimals, maximumFractionDigits: decimals }) + ' €';
}
function fmtPct(val: any, decimals = 1): string {
  const n = parseFloat(val);
  if (isNaN(n)) return '–';
  return (n * 100).toFixed(decimals) + ' %';
}
function statusColor(s: string | undefined): string {
  if (s === 'GREEN' || s === 'green') return '#22c55e';
  if (s === 'YELLOW' || s === 'yellow') return '#eab308';
  if (s === 'RED' || s === 'red') return '#ef4444';
  return '#94a3b8';
}
function statusLabel(s: string | undefined): string {
  if (s === 'GREEN') return 'Gut';
  if (s === 'YELLOW') return 'Warnung';
  if (s === 'RED') return 'Kritisch';
  return '–';
}
function trendIcon(val: number | undefined): string {
  if (val === undefined || isNaN(val)) return '';
  if (val > 0.02) return '▲';
  if (val < -0.02) return '▼';
  return '→';
}
function trendColorStyle(val: number | undefined, invertPositive = false): React.CSSProperties {
  if (val === undefined || isNaN(val)) return {};
  const isGood = invertPositive ? val < 0 : val > 0;
  return { color: isGood ? '#22c55e' : val === 0 ? '#94a3b8' : '#ef4444' };
};
