// Peer-fitted token launch valuation, token-odds estimation, held-out validation,
// and costed minimum-viable-capital (MVC) farm plans. Standard library only; zero hardcoded names.

export interface SnapshotProtocol {
  slug: string;
  name: string;
  category: string | null;
  chains: string[];
  tvl_usd: number;
  change_7d: number | null;
  mcap_usd: number | null;
  listed_at: string | null;
  gecko_id: string | null;
  symbol: string | null;
}

export interface Snapshot {
  as_of: string;
  source: string;
  floor_usd: number;
  protocols: SnapshotProtocol[];
  watchlist: string[];
}

export type Cohort = 'watchlist' | 'early' | 'derivative' | 'live';
export type FarmVerdict = 'FARM' | 'SELECTIVE' | 'PASS' | 'DERIVATIVE' | 'LIVE';

export interface ValuationParams {
  tvl_ref_usd: number;
  growth_floor_pct: number;
  growth_cap_pct: number;
  median_peer_age_days: number;
  huber_delta: number;
  ridge_lambdas: [number, number, number, number];
  beta: [number, number, number, number];
  anchor_usd: number;
  peer_count: number;
  dated_peer_count: number;
}

export interface OddsParams {
  tvl_ref_usd: number;
  growth_floor_pct: number;
  growth_cap_pct: number;
  median_cohort_age_days: number;
  ridge_lambdas: [number, number, number, number];
  weights: [number, number, number, number];
  cohort_count: number;
  token_count: number;
  base_rate: number;
}

export interface FoldMetrics {
  n: number;
  med_mult: number;
  rmse_mult: number;
  within_2x_pct: number;
  within_3x_pct: number;
  spearman_rho: number;
}

export interface TermValidation {
  id: string;
  label: string;
  terms: string;
  loo: FoldMetrics;
  walk_forward: FoldMetrics;
}

export interface OddsValidation {
  cv10_auc: number;
  cv10_brier: number;
  base_brier: number;
  cv10_skill_pct: number;
  wf_n: number;
  wf_auc: number;
  wf_brier: number;
}

export interface FarmEconomics {
  verdict: FarmVerdict;
  chain: string;
  gas_tier: 'low' | 'mid' | 'high';
  gas_per_tx_usd: number;
  tx_count: number;
  gas_cost_usd: number;
  hold_days: number;
  time_minutes: number;
  mvc_usd: number;
  raw_breakeven_usd: number;
  drop_bps: number;
  est_payout_usd: number;
  net_ev_usd: number;
  airdrop_pool_pct: number;
  reason: string;
}

export interface EquationBreakdown {
  anchor_usd: number;
  tvl_factor: number;
  growth_clamped_pct: number;
  growth_factor: number;
  age_used_days: number;
  age_imputed: boolean;
  age_factor: number;
  implied_value_usd: number;
  token_odds: number;
  expected_value_usd: number;
}

export interface BoardRow {
  rank: number;
  radar_rank: number | null;
  slug: string;
  name: string;
  category: string | null;
  chains: string[];
  tvl_usd: number;
  change_7d: number | null;
  mcap_usd: number | null;
  listed_at: string | null;
  gecko_id: string | null;
  symbol: string | null;
  cohort: Cohort;
  on_watchlist: boolean;
  token_status: 'no-token-recorded' | 'live-token';
  age_days: number | null;
  implied_value_usd: number;
  token_odds: number;
  expected_value_usd: number;
  peer_error_ratio: number | null;
  equation: EquationBreakdown;
  farm: FarmEconomics;
  farm_steps: string[];
}

export interface RadarSummary {
  total_protocols: number;
  watchlist_count: number;
  early_count: number;
  clean_pre_token_count: number;
  derivative_count: number;
  live_count: number;
  live_with_mcap_count: number;
  farm_verdict_count: number;
  selective_verdict_count: number;
  pass_verdict_count: number;
  total_pre_token_tvl_usd: number;
  total_pre_token_implied_usd: number;
}

export interface RadarPayload {
  as_of: string;
  source: string;
  floor_usd: number;
  model_name: string;
  valuation: ValuationParams;
  odds: OddsParams;
  validation: {
    terms: TermValidation[];
    odds: OddsValidation;
  };
  summary: RadarSummary;
  rows: BoardRow[];
}

const DAY_MS = 86_400_000;
const TVL_REF = 50_000_000;
const GROWTH_FLOOR = -60;
const GROWTH_CAP = 120;
const HUBER_DELTA = 1.0;
const VAL_LAMBDAS: [number, number, number, number] = [0, 0.5, 1.5, 3.0];
const ODDS_LAMBDAS: [number, number, number, number] = [0, 1.0, 2.0, 1.0];
// Conservative 5% FDV community airdrop at 25% initial float = 20% of launch circulating mcap.
const CIRC_DROP_SHARE = 0.20;

const VERSIONED_RE = /\s(V\d+(\.\d+)?|v\d+(\.\d+)?|\d+\.\d+)$/;
const EXCLUDED_CATS = new Set([
  'Bridge',
  'Canonical Bridge',
  'Liquid Staking',
  'Liquid Restaking',
  'Restaked BTC',
  'CEX',
]);
const EXCHANGE_PREFIX_RE = /^(Binance|Coinbase|Bybit|Kraken|Bitget|OKX|Bitfinex|Gemini)\b/i;
const WRAPPED_WORD_RE = /\b(wrapped|staked|staking)\b/i;

const LOW_GAS_CHAINS = new Set([
  'Solana', 'Base', 'Arbitrum', 'Optimism', 'Polygon', 'Avalanche', 'Sui', 'Sonic',
  'Hyperliquid L1', 'Monad', 'Linea', 'Scroll', 'Mantle', 'BSC', 'Binance', 'Plasma',
  'Gnosis', 'Fantom', 'Aptos', 'Near', 'Sei', 'Starknet', 'zkSync Era', 'Blast',
  'Mode', 'Berachain', 'Unichain', 'Abstract', 'Katana', 'World Chain', 'Ink',
  'Celestia', 'Celo', 'Immutable zkEVM', 'Manta', 'Metis', 'opBNB', 'Taiko', 'Zora',
]);

const clamp = (v: number, lo: number, hi: number): number => Math.max(lo, Math.min(hi, v));
const round2 = (n: number): number => Math.round(n * 100) / 100;
const round4 = (n: number): number => Math.round(n * 1e4) / 1e4;
const cmpSlug = (a: string, b: string): number => (a < b ? -1 : a > b ? 1 : 0);

function median(values: readonly number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1 ? sorted[mid]! : (sorted[mid - 1]! + sorted[mid]!) / 2;
}

export function ageDays(asOf: string, listedAt: string | null): number | null {
  if (listedAt === null) return null;
  const a = Date.parse(`${asOf}T00:00:00Z`);
  const b = Date.parse(`${listedAt}T00:00:00Z`);
  if (!Number.isFinite(a) || !Number.isFinite(b)) return null;
  return Math.max(0, Math.floor((a - b) / DAY_MS));
}

export function recordsToken(p: SnapshotProtocol): boolean {
  return p.mcap_usd !== null || p.gecko_id !== null || p.symbol !== null;
}

export function isCleanCohort(p: SnapshotProtocol): boolean {
  if (p.category !== null && EXCLUDED_CATS.has(p.category)) return false;
  if (VERSIONED_RE.test(p.name)) return false;
  if (EXCHANGE_PREFIX_RE.test(p.name)) return false;
  if (WRAPPED_WORD_RE.test(p.name)) return false;
  return true;
}

function solveLinear(matrix: number[][], rhs: number[]): number[] {
  const n = matrix.length;
  const A = matrix.map((row, i) => [...row, rhs[i]!]);
  for (let i = 0; i < n; i++) {
    let pivotRow = i;
    for (let r = i + 1; r < n; r++) {
      if (Math.abs(A[r]![i]!) > Math.abs(A[pivotRow]![i]!)) pivotRow = r;
    }
    const tmp = A[i]!;
    A[i] = A[pivotRow]!;
    A[pivotRow] = tmp;
    const pivot = A[i]![i]!;
    const safePivot = Math.abs(pivot) < 1e-12 ? 1e-12 : pivot;
    for (let j = i; j <= n; j++) A[i]![j] = A[i]![j]! / safePivot;
    for (let r = 0; r < n; r++) {
      if (r === i) continue;
      const f = A[r]![i]!;
      for (let j = i; j <= n; j++) A[r]![j] = A[r]![j]! - f * A[i]![j]!;
    }
  }
  return A.map((row) => row[n]!);
}

function fitHuberRidge(X: number[][], y: number[], lambdas: readonly number[], delta = HUBER_DELTA, iters = 40): number[] {
  const n = X.length;
  const p = X[0]!.length;
  const w = new Array<number>(n).fill(1);
  let beta = new Array<number>(p).fill(0);
  for (let it = 0; it < iters; it++) {
    const XtWX = Array.from({ length: p }, () => new Array<number>(p).fill(0));
    const XtWy = new Array<number>(p).fill(0);
    for (let i = 0; i < n; i++) {
      const wi = w[i]!;
      const xi = X[i]!;
      const yi = y[i]!;
      for (let j = 0; j < p; j++) {
        XtWy[j] = XtWy[j]! + wi * xi[j]! * yi;
        for (let k = 0; k < p; k++) XtWX[j]![k] = XtWX[j]![k]! + wi * xi[j]! * xi[k]!;
      }
    }
    for (let j = 0; j < p; j++) XtWX[j]![j] = XtWX[j]![j]! + lambdas[j]! + 1e-10;
    beta = solveLinear(XtWX, XtWy);
    for (let i = 0; i < n; i++) {
      let pred = 0;
      for (let j = 0; j < p; j++) pred += X[i]![j]! * beta[j]!;
      const resid = Math.abs(y[i]! - pred);
      w[i] = resid <= delta ? 1 : delta / resid;
    }
  }
  return beta;
}

function sigmoid(z: number): number {
  return 1 / (1 + Math.exp(-clamp(z, -20, 20)));
}

function fitLogisticRidge(X: number[][], y: number[], lambdas: readonly number[], iters = 24): number[] {
  const p = X[0]!.length;
  const w = new Array<number>(p).fill(0);
  for (let it = 0; it < iters; it++) {
    const grad = new Array<number>(p).fill(0);
    const hess = Array.from({ length: p }, () => new Array<number>(p).fill(0));
    for (let i = 0; i < X.length; i++) {
      const xi = X[i]!;
      let z = 0;
      for (let j = 0; j < p; j++) z += xi[j]! * w[j]!;
      const pr = sigmoid(z);
      const wt = Math.max(1e-6, pr * (1 - pr));
      const diff = pr - y[i]!;
      for (let j = 0; j < p; j++) {
        grad[j] = grad[j]! + diff * xi[j]!;
        for (let k = 0; k < p; k++) hess[j]![k] = hess[j]![k]! + wt * xi[j]! * xi[k]!;
      }
    }
    for (let j = 0; j < p; j++) {
      grad[j] = grad[j]! + lambdas[j]! * w[j]!;
      hess[j]![j] = hess[j]![j]! + lambdas[j]! + 1e-8;
    }
    const step = solveLinear(hess, grad);
    for (let j = 0; j < p; j++) w[j] = w[j]! - step[j]!;
  }
  return w;
}

function rankVector(values: readonly number[]): number[] {
  const indexed = values.map((v, i) => ({ v, i })).sort((a, b) => a.v - b.v || a.i - b.i);
  const ranks = new Array<number>(values.length);
  let i = 0;
  while (i < indexed.length) {
    let j = i;
    while (j + 1 < indexed.length && indexed[j + 1]!.v === indexed[i]!.v) j++;
    const avgRank = (i + j) / 2 + 1;
    for (let k = i; k <= j; k++) ranks[indexed[k]!.i] = avgRank;
    i = j + 1;
  }
  return ranks;
}

function spearman(xs: readonly number[], ys: readonly number[]): number {
  if (xs.length < 3) return 0;
  const rx = rankVector(xs);
  const ry = rankVector(ys);
  const mean = (xs.length + 1) / 2;
  let num = 0;
  let dx = 0;
  let dy = 0;
  for (let i = 0; i < xs.length; i++) {
    const a = rx[i]! - mean;
    const b = ry[i]! - mean;
    num += a * b;
    dx += a * a;
    dy += b * b;
  }
  const denom = Math.sqrt(dx * dy);
  return denom > 0 ? num / denom : 0;
}

function computeAuc(probs: readonly number[], labels: readonly number[]): number {
  const pos: number[] = [];
  const neg: number[] = [];
  for (let i = 0; i < labels.length; i++) {
    if (labels[i] === 1) pos.push(probs[i]!);
    else neg.push(probs[i]!);
  }
  if (pos.length === 0 || neg.length === 0) return 0.5;
  let wins = 0;
  for (const a of pos) {
    for (const b of neg) {
      if (a > b) wins += 1;
      else if (a === b) wins += 0.5;
    }
  }
  return wins / (pos.length * neg.length);
}

interface TermMask {
  id: string;
  label: string;
  terms: string;
  tvl: boolean;
  growth: boolean;
  age: boolean;
  naive?: boolean;
}

const TERM_SPECS: readonly TermMask[] = [
  { id: 'naive', label: 'Naive 0.25x TVL', terms: 'Fixed heuristic (no fit)', tvl: false, growth: false, age: false, naive: true },
  { id: 'intercept', label: 'Peer Median Only', terms: 'b0', tvl: false, growth: false, age: false },
  { id: 'tvl', label: '+ TVL Elasticity', terms: 'b0 + b_tvl', tvl: true, growth: false, age: false },
  { id: 'tvl_g', label: '+ TVL + 7d Growth', terms: 'b0 + b_tvl + b_g', tvl: true, growth: true, age: false },
  { id: 'tvl_age', label: '+ TVL + Age', terms: 'b0 + b_tvl + b_age', tvl: true, growth: false, age: true },
  { id: 'full', label: 'Full Peer Model', terms: 'b0 + b_tvl + b_g + b_age', tvl: true, growth: true, age: true },
];

function valuationFeatures(p: SnapshotProtocol, asOf: string, medAge: number, mask: { tvl: boolean; growth: boolean; age: boolean }): number[] {
  const f = [1];
  if (mask.tvl) f.push(Math.log(Math.max(1, p.tvl_usd) / TVL_REF));
  if (mask.growth) {
    const g = clamp(p.change_7d ?? 0, GROWTH_FLOOR, GROWTH_CAP) / 100;
    f.push(Math.log1p(g));
  }
  if (mask.age) {
    const age = ageDays(asOf, p.listed_at) ?? medAge;
    f.push(Math.log1p(Math.max(0, age) / 365));
  }
  return f;
}

function naiveLogPred(p: SnapshotProtocol, asOf: string): number {
  const g = clamp(p.change_7d ?? 0, GROWTH_FLOOR, GROWTH_CAP);
  const age = ageDays(asOf, p.listed_at) ?? 365;
  const v = Math.max(1, p.tvl_usd * 0.25 * (1 + (g / 100) * 0.5) * (0.6 + (Math.min(age, 1095) / 1095) * 0.4));
  return Math.log(v);
}

function summarizeFold(rows: readonly SnapshotProtocol[], logPreds: readonly number[]): FoldMetrics {
  const actual = rows.map((r) => Math.log(r.mcap_usd!));
  const abs = actual.map((a, i) => Math.abs(a - logPreds[i]!));
  const sq = actual.map((a, i) => (a - logPreds[i]!) ** 2);
  const within2 = abs.filter((e) => e <= Math.log(2)).length;
  const within3 = abs.filter((e) => e <= Math.log(3)).length;
  return {
    n: rows.length,
    med_mult: round2(Math.exp(median(abs))),
    rmse_mult: round2(Math.exp(Math.sqrt(sq.reduce((acc, v) => acc + v, 0) / Math.max(1, sq.length)))),
    within_2x_pct: round2((within2 / Math.max(1, rows.length)) * 100),
    within_3x_pct: round2((within3 / Math.max(1, rows.length)) * 100),
    spearman_rho: round2(spearman(actual, logPreds)),
  };
}

function fitAndPredictLog(train: readonly SnapshotProtocol[], target: SnapshotProtocol, asOf: string, mask: TermMask): number {
  if (mask.naive) return naiveLogPred(target, asOf);
  const trainAges = train.map((p) => ageDays(asOf, p.listed_at)).filter((a): a is number => a !== null);
  const medAge = trainAges.length > 0 ? median(trainAges) : 365;
  const lambdas = [VAL_LAMBDAS[0]];
  if (mask.tvl) lambdas.push(VAL_LAMBDAS[1]);
  if (mask.growth) lambdas.push(VAL_LAMBDAS[2]);
  if (mask.age) lambdas.push(VAL_LAMBDAS[3]);
  const X = train.map((p) => valuationFeatures(p, asOf, medAge, mask));
  const y = train.map((p) => Math.log(p.mcap_usd!));
  const beta = fitHuberRidge(X, y, lambdas);
  const xt = valuationFeatures(target, asOf, medAge, mask);
  let pred = 0;
  for (let j = 0; j < beta.length; j++) pred += xt[j]! * beta[j]!;
  return pred;
}

function fitValuationAndValidate(snapshot: Snapshot): { params: ValuationParams; terms: TermValidation[] } {
  const peers = snapshot.protocols
    .filter((p) => p.mcap_usd !== null && p.mcap_usd > 0 && p.tvl_usd > 0 && isCleanCohort(p))
    .sort((a, b) => cmpSlug(a.slug, b.slug));
  const datedPeers = peers
    .filter((p) => p.listed_at !== null)
    .sort((a, b) => (a.listed_at! < b.listed_at! ? -1 : a.listed_at! > b.listed_at! ? 1 : cmpSlug(a.slug, b.slug)));

  const peerAges = peers.map((p) => ageDays(snapshot.as_of, p.listed_at)).filter((a): a is number => a !== null);
  const medAge = Math.round(peerAges.length > 0 ? median(peerAges) : 365);

  const fullMask = TERM_SPECS[TERM_SPECS.length - 1]!;
  const Xfull = peers.map((p) => valuationFeatures(p, snapshot.as_of, medAge, fullMask));
  const yfull = peers.map((p) => Math.log(p.mcap_usd!));
  const rawBeta = fitHuberRidge(Xfull, yfull, VAL_LAMBDAS);
  const beta: [number, number, number, number] = [
    round4(rawBeta[0]!),
    round4(rawBeta[1]!),
    round4(rawBeta[2]!),
    round4(rawBeta[3]!),
  ];

  const wfStart = Math.max(25, Math.floor(datedPeers.length * 0.4));
  const wfTargets = datedPeers.slice(wfStart);

  const terms: TermValidation[] = TERM_SPECS.map((spec) => {
    const looPreds = peers.map((target, idx) => {
      const train = peers.filter((_, j) => j !== idx);
      return fitAndPredictLog(train, target, snapshot.as_of, spec);
    });
    const wfPreds = wfTargets.map((target, offset) => {
      const train = datedPeers.slice(0, wfStart + offset);
      return fitAndPredictLog(train, target, snapshot.as_of, spec);
    });
    return {
      id: spec.id,
      label: spec.label,
      terms: spec.terms,
      loo: summarizeFold(peers, looPreds),
      walk_forward: summarizeFold(wfTargets, wfPreds),
    };
  });

  return {
    params: {
      tvl_ref_usd: TVL_REF,
      growth_floor_pct: GROWTH_FLOOR,
      growth_cap_pct: GROWTH_CAP,
      median_peer_age_days: medAge,
      huber_delta: HUBER_DELTA,
      ridge_lambdas: [...VAL_LAMBDAS],
      beta,
      anchor_usd: Math.round(Math.exp(beta[0])),
      peer_count: peers.length,
      dated_peer_count: datedPeers.length,
    },
    terms,
  };
}

function oddsFeatures(p: SnapshotProtocol, asOf: string, medAge: number): number[] {
  const g = clamp(p.change_7d ?? 0, GROWTH_FLOOR, GROWTH_CAP) / 100;
  const age = ageDays(asOf, p.listed_at) ?? medAge;
  return [1, Math.log(Math.max(1, p.tvl_usd) / TVL_REF), g, Math.log1p(Math.max(0, age) / 365)];
}

function fitOddsAndValidate(snapshot: Snapshot): { params: OddsParams; validation: OddsValidation } {
  const cohort = snapshot.protocols.filter(isCleanCohort).sort((a, b) => cmpSlug(a.slug, b.slug));
  const labels = cohort.map((p) => (recordsToken(p) ? 1 : 0));
  const ages = cohort.map((p) => ageDays(snapshot.as_of, p.listed_at)).filter((a): a is number => a !== null);
  const medAge = Math.round(ages.length > 0 ? median(ages) : 365);

  const Xfull = cohort.map((p) => oddsFeatures(p, snapshot.as_of, medAge));
  const rawW = fitLogisticRidge(Xfull, labels, ODDS_LAMBDAS);
  const weights: [number, number, number, number] = [
    round4(rawW[0]!),
    round4(rawW[1]!),
    round4(rawW[2]!),
    round4(rawW[3]!),
  ];

  // Deterministic 10-fold CV (interleaved after sorting by slug)
  const cvProbs = new Array<number>(cohort.length).fill(0);
  for (let fold = 0; fold < 10; fold++) {
    const train: SnapshotProtocol[] = [];
    const trainY: number[] = [];
    const testIdx: number[] = [];
    for (let i = 0; i < cohort.length; i++) {
      if (i % 10 === fold) testIdx.push(i);
      else {
        train.push(cohort[i]!);
        trainY.push(labels[i]!);
      }
    }
    const fAges = train.map((p) => ageDays(snapshot.as_of, p.listed_at)).filter((a): a is number => a !== null);
    const fMedAge = fAges.length > 0 ? median(fAges) : 365;
    const fw = fitLogisticRidge(train.map((p) => oddsFeatures(p, snapshot.as_of, fMedAge)), trainY, ODDS_LAMBDAS);
    for (const idx of testIdx) {
      const x = oddsFeatures(cohort[idx]!, snapshot.as_of, fMedAge);
      cvProbs[idx] = sigmoid(x[0]! * fw[0]! + x[1]! * fw[1]! + x[2]! * fw[2]! + x[3]! * fw[3]!);
    }
  }

  const tokenCount = labels.reduce((a, b) => a + b, 0);
  const baseRate = tokenCount / Math.max(1, cohort.length);
  let cvBrier = 0;
  let baseBrier = 0;
  for (let i = 0; i < cohort.length; i++) {
    cvBrier += (cvProbs[i]! - labels[i]!) ** 2;
    baseBrier += (baseRate - labels[i]!) ** 2;
  }
  cvBrier /= Math.max(1, cohort.length);
  baseBrier /= Math.max(1, cohort.length);
  const cvAuc = computeAuc(cvProbs, labels);

  // Walk-forward on dated clean cohort protocols (older -> newer by listed_at, refitted in 5 chronological blocks for speed)
  const dated = cohort
    .filter((p) => p.listed_at !== null)
    .sort((a, b) => (a.listed_at! < b.listed_at! ? -1 : a.listed_at! > b.listed_at! ? 1 : cmpSlug(a.slug, b.slug)));
  const wfStart = Math.max(80, Math.floor(dated.length * 0.5));
  const wfProbs: number[] = [];
  const wfLabels: number[] = [];
  const stepSize = 15;
  for (let blockStart = wfStart; blockStart < dated.length; blockStart += stepSize) {
    const train = dated.slice(0, blockStart);
    const trainY = train.map((p) => (recordsToken(p) ? 1 : 0));
    const fAges = train.map((p) => ageDays(snapshot.as_of, p.listed_at)).filter((a): a is number => a !== null);
    const fMedAge = fAges.length > 0 ? median(fAges) : 365;
    const fw = fitLogisticRidge(train.map((p) => oddsFeatures(p, snapshot.as_of, fMedAge)), trainY, ODDS_LAMBDAS);
    const blockEnd = Math.min(dated.length, blockStart + stepSize);
    for (let i = blockStart; i < blockEnd; i++) {
      const p = dated[i]!;
      const x = oddsFeatures(p, snapshot.as_of, fMedAge);
      wfProbs.push(sigmoid(x[0]! * fw[0]! + x[1]! * fw[1]! + x[2]! * fw[2]! + x[3]! * fw[3]!));
      wfLabels.push(recordsToken(p) ? 1 : 0);
    }
  }
  let wfBrier = 0;
  for (let i = 0; i < wfProbs.length; i++) wfBrier += (wfProbs[i]! - wfLabels[i]!) ** 2;
  wfBrier /= Math.max(1, wfProbs.length);

  return {
    params: {
      tvl_ref_usd: TVL_REF,
      growth_floor_pct: GROWTH_FLOOR,
      growth_cap_pct: GROWTH_CAP,
      median_cohort_age_days: medAge,
      ridge_lambdas: [...ODDS_LAMBDAS],
      weights,
      cohort_count: cohort.length,
      token_count: tokenCount,
      base_rate: round4(baseRate),
    },
    validation: {
      cv10_auc: round4(cvAuc),
      cv10_brier: round4(cvBrier),
      base_brier: round4(baseBrier),
      cv10_skill_pct: round2((1 - cvBrier / Math.max(1e-9, baseBrier)) * 100),
      wf_n: wfLabels.length,
      wf_auc: round4(computeAuc(wfProbs, wfLabels)),
      wf_brier: round4(wfBrier),
    },
  };
}

export function evaluateEquation(p: SnapshotProtocol, asOf: string, val: ValuationParams, odds: OddsParams): EquationBreakdown {
  const rawAge = ageDays(asOf, p.listed_at);
  const ageUsed = rawAge ?? val.median_peer_age_days;
  const gClamped = clamp(p.change_7d ?? 0, val.growth_floor_pct, val.growth_cap_pct);
  const tvlRatio = Math.max(1, p.tvl_usd) / val.tvl_ref_usd;
  const tvlFactor = Math.pow(tvlRatio, val.beta[1]);
  const growthFactor = Math.pow(1 + gClamped / 100, val.beta[2]);
  const ageFactor = Math.pow(1 + Math.max(0, ageUsed) / 365, val.beta[3]);
  const anchor = Math.exp(val.beta[0]);
  const implied = Math.max(1, Math.round(anchor * tvlFactor * growthFactor * ageFactor));

  const ageOdds = rawAge ?? odds.median_cohort_age_days;
  const z =
    odds.weights[0] +
    odds.weights[1] * Math.log(Math.max(1, p.tvl_usd) / odds.tvl_ref_usd) +
    odds.weights[2] * (gClamped / 100) +
    odds.weights[3] * Math.log1p(Math.max(0, ageOdds) / 365);
  const tokOdds = round4(sigmoid(z));

  return {
    anchor_usd: Math.round(anchor),
    tvl_factor: round4(tvlFactor),
    growth_clamped_pct: round2(gClamped),
    growth_factor: round4(growthFactor),
    age_used_days: ageUsed,
    age_imputed: rawAge === null,
    age_factor: round4(ageFactor),
    implied_value_usd: implied,
    token_odds: tokOdds,
    expected_value_usd: Math.max(1, Math.round(implied * tokOdds)),
  };
}

function pickOptimalChain(chains: readonly string[]): { chain: string; gasTx: number; tier: 'low' | 'mid' | 'high' } {
  if (chains.length === 0) return { chain: 'primary network', gasTx: 0.6, tier: 'mid' };
  for (const c of chains) {
    if (LOW_GAS_CHAINS.has(c)) return { chain: c, gasTx: 0.15, tier: 'low' };
  }
  if (chains.length === 1 && chains[0] === 'Ethereum') return { chain: 'Ethereum', gasTx: 4.5, tier: 'high' };
  if (chains.includes('Ethereum') && chains.every((c) => c === 'Ethereum' || c === 'Bitcoin')) {
    return { chain: 'Ethereum', gasTx: 4.5, tier: 'high' };
  }
  const nonEth = chains.find((c) => c !== 'Ethereum');
  if (nonEth !== undefined) return { chain: nonEth, gasTx: 0.6, tier: 'mid' };
  return { chain: chains[0]!, gasTx: 0.6, tier: 'mid' };
}

function fmtGas(n: number): string {
  return n < 1 ? `$${n.toFixed(2)}` : n < 10 ? `$${n.toFixed(2)}` : `$${Math.round(n)}`;
}

function categoryDepositAction(p: SnapshotProtocol, mvc: number, chain: string): { setup: string; weekly: string } {
  const c = (p.category ?? '').toLowerCase();
  const n = p.name;
  if (c.includes('lending') || c.includes('cdp') || c.includes('collateral')) {
    return {
      setup: `Supply $${mvc} of USDC or blue-chip collateral on ${n} (${chain}) and borrow 20% to qualify for both supply and borrow points without liquidation risk.`,
      weekly: `Check health factor (>2.5x) and claim/repay $10 of interest biweekly on ${n} (${chain}) to refresh on-chain activity timestamps.`,
    };
  }
  if (c.includes('dex') || c.includes('liquidity manager')) {
    return {
      setup: `Deploy $${mvc} into a correlated stable/LST liquidity range on ${n} (${chain}) to earn swap fees while minimizing impermanent loss.`,
      weekly: `Execute one $25 spot swap or fee-collection transaction biweekly on ${n} (${chain}) to maintain active-trader streak counts.`,
    };
  }
  if (c.includes('derivative') || c.includes('perpetual') || c.includes('options')) {
    return {
      setup: `Deposit $${mvc} of USDC margin into ${n} (${chain}) and open a delta-neutral or low-leverage (1.5x) position to register trading volume.`,
      weekly: `Cycle one small hedged trade ($50-$100 notional) biweekly on ${n} (${chain}) while capping slippage and funding drag under 0.15%.`,
    };
  }
  if (c.includes('basis') || c.includes('yield') || c.includes('curator') || c.includes('allocator')) {
    return {
      setup: `Deposit $${mvc} of USDC into ${n}'s flagship audited vault on ${chain} and hold the receipt share token directly in your farming wallet.`,
      weekly: `Verify vault APY, utilization, and points accrual biweekly on ${n} (${chain}); compound or top up $25 if an active epoch resets.`,
    };
  }
  if (c.includes('rwa') || c.includes('stable')) {
    return {
      setup: `Mint or acquire $${mvc} of ${n}'s yield-bearing stable/RWA token on ${chain} and hold it in a non-custodial wallet or approved DeFi pool.`,
      weekly: `Confirm yield rebase and check eligible LP integrations biweekly on ${n} (${chain}) so holdings stay inside snapshot-tracked contracts.`,
    };
  }
  if (c.includes('prediction')) {
    return {
      setup: `Fund $${mvc} of USDC on ${n} (${chain}) and split across two high-liquidity, near-certain markets to generate verified resolution volume.`,
      weekly: `Settle matured shares and rotate into one fresh liquid market biweekly on ${n} (${chain}) to build multi-week user retention.`,
    };
  }
  if (c.includes('insurance')) {
    return {
      setup: `Provide $${mvc} to an underwriting pool or purchase a short-duration cover policy on ${n} (${chain}) using a dedicated wallet.`,
      weekly: `Track pool claim exposure and renew or top up cover biweekly on ${n} (${chain}) to keep continuous participation across snapshots.`,
    };
  }
  if (c.includes('restak') || c.includes('staking')) {
    return {
      setup: `Stake $${mvc} of the native asset via ${n} on ${chain} and retain the liquid receipt token without transferring it to a CEX.`,
      weekly: `Verify validator uptime and epoch points balances biweekly on ${n} (${chain}) without triggering unnecessary unbonding delays.`,
    };
  }
  if (c.includes('bridge')) {
    return {
      setup: `Route $${mvc} across ${chain} via ${n} during low-congestion hours and leave funds in a destination-chain app for at least 7 days.`,
      weekly: `Perform one reverse or cross-chain transfer biweekly through ${n} (${chain}) to establish multi-month bridge volume rather than a single hop.`,
    };
  }
  if (c.includes('privacy') || c.includes('payment')) {
    return {
      setup: `Deposit $${mvc} into ${n} on ${chain} and complete two genuine self-custody transfers with a 48-hour dwell window between actions.`,
      weekly: `Complete one small routine transfer biweekly on ${n} (${chain}) to keep the address active across consecutive protocol snapshots.`,
    };
  }
  if (c.includes('cex') || c.includes('cedefi')) {
    return {
      setup: `Allocate $${mvc} to ${n}'s on-chain vault or transparent proof-of-reserves product on ${chain} rather than leaving idle custody balances.`,
      weekly: `Confirm withdrawal liquidity and epoch reward credit biweekly on ${n} (${chain}); keep self-custody keys for any on-chain receipt.`,
    };
  }
  return {
    setup: `Deposit $${mvc} of USDC or native collateral into ${n}'s primary contract on ${chain} and keep the receipt token in your farming wallet.`,
    weekly: `Execute one qualifying interaction (deposit, rebalance, or governance check) biweekly on ${n} (${chain}) to span multiple snapshots.`,
  };
}

function clampStep(s: string): string {
  const trimmed = s.trim();
  if (trimmed.length > 600) return `${trimmed.slice(0, 596)}...`;
  if (trimmed.length < 20) return `${trimmed} Verify on-chain receipt before exiting.`;
  return trimmed;
}

function buildFarmPlan(p: SnapshotProtocol, cohort: Cohort, eq: EquationBreakdown, age: number | null): { farm: FarmEconomics; steps: string[] } {
  const { chain, gasTx, tier } = pickOptimalChain(p.chains);
  const holdDays = age === null ? 45 : age < 180 ? 60 : age < 365 ? 45 : 30;
  const checkins = Math.ceil(holdDays / 14);
  const txCount = 3 + checkins + 2; // 1 fund + 2 approve/deposit + checkins + 2 claim/exit
  const gasCost = round2(txCount * gasTx);
  const timeMinutes = 10 + 15 + checkins * 6 + 15;

  const dropRate = (eq.implied_value_usd * eq.token_odds * CIRC_DROP_SHARE) / Math.max(1, p.tvl_usd);
  const dropBps = Math.round(dropRate * 10_000);
  const rawBreakeven = dropRate > 1e-9 ? Math.round((2.5 * gasCost) / dropRate) : 999_999;
  const floorMvc = tier === 'high' ? 1000 : tier === 'mid' ? 250 : 100;
  const mvc = Math.min(25_000, Math.max(floorMvc, Math.ceil(rawBreakeven / 50) * 50));
  const estPayout = round2(mvc * dropRate);
  const netEv = round2(estPayout - gasCost);

  let verdict: FarmVerdict;
  let reason: string;
  if (cohort === 'live') {
    verdict = 'LIVE';
    reason = `Token already recorded (${p.symbol ?? p.gecko_id ?? 'live'}); evaluate secondary yield or staking instead of pre-TGE airdrop farming.`;
  } else if (cohort === 'derivative') {
    verdict = 'DERIVATIVE';
    reason = `Wrapped, staked, bridged, versioned, or exchange product (${p.category ?? 'infra'}); standalone token launch odds are discounted.`;
  } else if (rawBreakeven <= 1500 && dropRate >= 0.01) {
    verdict = 'FARM';
    reason = `Positive EV at $${mvc} MVC on ${chain}: ${dropBps} bps odds-adjusted yield (~$${estPayout.toFixed(2)}) vs ${fmtGas(gasCost)} gas (${txCount} txs).`;
  } else if (rawBreakeven <= 5000 && dropRate >= 0.0025) {
    verdict = 'SELECTIVE';
    reason = `Modest ${dropBps} bps drop yield at $${Math.round(p.tvl_usd / 1e6)}M TVL; worthwhile at $${mvc}+ MVC only if already earning base yield on ${chain}.`;
  } else {
    verdict = 'PASS';
    reason =
      tier === 'high'
        ? `Ethereum mainnet gas (${fmtGas(gasCost)} over ${txCount} txs) requires $${rawBreakeven.toLocaleString('en-US')} break-even capital; skip for small wallets.`
        : `High TVL dilution ($${Math.round(p.tvl_usd / 1e6)}M TVL, ${dropBps} bps expected drop); break-even requires $${rawBreakeven.toLocaleString('en-US')} MVC.`;
  }

  const farm: FarmEconomics = {
    verdict,
    chain,
    gas_tier: tier,
    gas_per_tx_usd: gasTx,
    tx_count: txCount,
    gas_cost_usd: gasCost,
    hold_days: holdDays,
    time_minutes: timeMinutes,
    mvc_usd: mvc,
    raw_breakeven_usd: rawBreakeven,
    drop_bps: dropBps,
    est_payout_usd: estPayout,
    net_ev_usd: netEv,
    airdrop_pool_pct: Math.round(CIRC_DROP_SHARE * 100),
    reason,
  };

  const actions = categoryDepositAction(p, mvc, chain);
  const setupGas = round2(gasTx * 2);
  const checkinGas = round2(gasTx * checkins);
  const exitGas = round2(gasTx * 2);

  let steps: string[];
  if (cohort === 'live') {
    const ticker = p.symbol ? `$${p.symbol}` : 'its existing token';
    steps = [
      `Confirm ${p.name}'s live token (${ticker}) market cap and active emissions schedule before committing fresh capital; do not farm expecting an initial TGE. Cost: $0 (research only). Time: 10 minutes.`,
      `If base APY justifies deployment, allocate $${floorMvc} on ${chain} using an isolated wallet to capture ongoing liquidity-mining or season-2 incentives. Cost: $${floorMvc} capital + ${fmtGas(setupGas)} gas. Time: 15 minutes.`,
      `Check governance staking or ve-token lockups on ${p.name} (${chain}) only if fee share exceeds passive stablecoin yield by at least 3% APR. Cost: ${fmtGas(gasTx)} gas per stake. Time: 10 minutes.`,
      `Review emissions decay and token unlock cliffs every 14 days over a 30-day cycle before compounding rewards. Cost: ${fmtGas(round2(gasTx * 2))} gas across 2 check-ins. Time: 15 minutes over 30 days.`,
      `Harvest liquid incentives and unwind principal back to base stables if net yield drops below opportunity cost. Cost: ${fmtGas(exitGas)} exit gas. Time: 10 minutes.`,
    ];
  } else if (cohort === 'derivative') {
    steps = [
      `Verify whether ${p.name} (${p.category ?? 'infrastructure'}) accrues points for an unlaunched parent protocol rather than issuing a separate wrapper token. Cost: $0 (documentation audit). Time: 10 minutes.`,
      `If an upstream points program is confirmed, bridge or fund a dedicated wallet on ${chain} with $${mvc} (avoiding unnecessary L1 fees). Cost: ${fmtGas(gasTx)} funding gas. Time: 10 minutes.`,
      `${actions.setup} Cost: $${mvc} principal + ${fmtGas(setupGas)} setup gas. Time: 15 minutes.`,
      `Hold for ${holdDays} days while monitoring peg stability and parent-protocol snapshot announcements biweekly (${checkins} checks). Cost: ${fmtGas(checkinGas)} maintenance gas. Time: ${checkins * 6} minutes over ${holdDays} days.`,
      `Redeem through official ${p.name} contracts on ${chain} once snapshots conclude and record exact gas and slippage in your ledger. Cost: ${fmtGas(exitGas)} exit gas. Time: 10 minutes.`,
    ];
  } else {
    const verdictPrefix =
      verdict === 'PASS'
        ? `Sizing gate (PASS for small wallets): ${reason} Proceed only if deploying >=$${mvc} on ${chain} for base yield.`
        : `Fund a dedicated farming wallet on ${chain} with $${mvc} MVC plus ${fmtGas(round2(gasCost * 1.5))} gas buffer (expected drop ${dropBps} bps = ~$${estPayout.toFixed(2)} vs ${fmtGas(gasCost)} gas).`;
    steps = [
      `${verdictPrefix} Cost: ${fmtGas(gasTx)} wallet funding gas. Time: 10 minutes.`,
      `${actions.setup} Cost: $${mvc} locked capital + ${fmtGas(setupGas)} approval and deposit gas. Time: 15 minutes.`,
      `${actions.weekly} Cost: ${fmtGas(checkinGas)} gas (${checkins} biweekly txs at ${fmtGas(gasTx)}/tx). Time: ${checkins * 6} minutes across ${holdDays} days.`,
      `Maintain the $${mvc} position uninterrupted for ${holdDays} days across multiple epochs so time-weighted TVL snapshots capture your full balance. Cost: $0 direct fee (capital remains withdrawable). Time: ${holdDays} days passive hold.`,
      `Audit official ${p.name} claim contracts on ${chain}, claim any earned allocation, and unwind principal cleanly while logging tx hashes for tax basis. Cost: ${fmtGas(exitGas)} claim and exit gas. Time: 15 minutes.`,
    ];
  }

  return { farm, steps: steps.map(clampStep) };
}

export function buildRadar(snapshot: Snapshot): { board: BoardRow[]; payload: RadarPayload } {
  const wlSet = new Set(snapshot.watchlist);
  const { params: valParams, terms: termValidations } = fitValuationAndValidate(snapshot);
  const { params: oddsParams, validation: oddsValidation } = fitOddsAndValidate(snapshot);

  const scored = snapshot.protocols.map((p) => {
    const hasTok = recordsToken(p);
    const cohort: Cohort = hasTok
      ? 'live'
      : wlSet.has(p.slug)
        ? 'watchlist'
        : isCleanCohort(p)
          ? 'early'
          : 'derivative';
    const age = ageDays(snapshot.as_of, p.listed_at);
    const eq = evaluateEquation(p, snapshot.as_of, valParams, oddsParams);
    const { farm, steps } = buildFarmPlan(p, cohort, eq, age);
    const peerErrorRatio =
      p.mcap_usd !== null && p.mcap_usd > 0 ? round2(p.mcap_usd / eq.implied_value_usd) : null;
    return { p, cohort, age, eq, farm, steps, peerErrorRatio };
  });

  // Global rank 1..758 strictly non-increasing by implied_value_usd (tie-broken deterministically by slug)
  scored.sort((a, b) => b.eq.implied_value_usd - a.eq.implied_value_usd || cmpSlug(a.p.slug, b.p.slug));

  let radarCursor = 0;
  const board: BoardRow[] = scored.map((s, idx) => {
    const isCleanPre = s.cohort === 'watchlist' || s.cohort === 'early';
    const radarRank = isCleanPre ? ++radarCursor : null;
    return {
      rank: idx + 1,
      radar_rank: radarRank,
      slug: s.p.slug,
      name: s.p.name,
      category: s.p.category,
      chains: s.p.chains,
      tvl_usd: s.p.tvl_usd,
      change_7d: s.p.change_7d,
      mcap_usd: s.p.mcap_usd,
      listed_at: s.p.listed_at,
      gecko_id: s.p.gecko_id,
      symbol: s.p.symbol,
      cohort: s.cohort,
      on_watchlist: wlSet.has(s.p.slug),
      token_status: s.cohort === 'live' ? 'live-token' : 'no-token-recorded',
      age_days: s.age,
      implied_value_usd: s.eq.implied_value_usd,
      token_odds: s.eq.token_odds,
      expected_value_usd: s.eq.expected_value_usd,
      peer_error_ratio: s.peerErrorRatio,
      equation: s.eq,
      farm: s.farm,
      farm_steps: s.steps,
    };
  });

  const cleanPre = board.filter((r) => r.cohort === 'watchlist' || r.cohort === 'early');
  const summary: RadarSummary = {
    total_protocols: board.length,
    watchlist_count: board.filter((r) => r.cohort === 'watchlist').length,
    early_count: board.filter((r) => r.cohort === 'early').length,
    clean_pre_token_count: cleanPre.length,
    derivative_count: board.filter((r) => r.cohort === 'derivative').length,
    live_count: board.filter((r) => r.cohort === 'live').length,
    live_with_mcap_count: board.filter((r) => r.cohort === 'live' && r.mcap_usd !== null && r.mcap_usd > 0).length,
    farm_verdict_count: cleanPre.filter((r) => r.farm.verdict === 'FARM').length,
    selective_verdict_count: cleanPre.filter((r) => r.farm.verdict === 'SELECTIVE').length,
    pass_verdict_count: cleanPre.filter((r) => r.farm.verdict === 'PASS').length,
    total_pre_token_tvl_usd: cleanPre.reduce((acc, r) => acc + r.tvl_usd, 0),
    total_pre_token_implied_usd: cleanPre.reduce((acc, r) => acc + r.implied_value_usd, 0),
  };

  const payload: RadarPayload = {
    as_of: snapshot.as_of,
    source: snapshot.source,
    floor_usd: snapshot.floor_usd,
    model_name: 'Meridian Peer-Fit v2',
    valuation: valParams,
    odds: oddsParams,
    validation: {
      terms: termValidations,
      odds: oddsValidation,
    },
    summary,
    rows: board,
  };

  return { board, payload };
}

export function parseSnapshot(text: string): Snapshot {
  const raw = JSON.parse(text) as Record<string, unknown>;
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) throw new Error('snapshot.json must be an object');
  if (typeof raw.as_of !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(raw.as_of)) throw new Error('invalid as_of');
  if (typeof raw.source !== 'string') throw new Error('invalid source');
  if (typeof raw.floor_usd !== 'number' || !Number.isSafeInteger(raw.floor_usd) || raw.floor_usd <= 0) throw new Error('invalid floor_usd');
  if (!Array.isArray(raw.protocols)) throw new Error('missing protocols array');
  if (!Array.isArray(raw.watchlist) || raw.watchlist.some((s) => typeof s !== 'string')) throw new Error('missing watchlist array');

  const protocols: SnapshotProtocol[] = raw.protocols.map((entry, i) => {
    const p = entry as Record<string, unknown>;
    if (typeof p.slug !== 'string' || typeof p.name !== 'string' || typeof p.tvl_usd !== 'number' || !Number.isFinite(p.tvl_usd)) {
      throw new Error(`protocol ${i} missing required fields`);
    }
    return {
      slug: p.slug,
      name: p.name,
      category: typeof p.category === 'string' ? p.category : null,
      chains: Array.isArray(p.chains) ? p.chains.filter((c): c is string => typeof c === 'string') : [],
      tvl_usd: p.tvl_usd,
      change_7d: typeof p.change_7d === 'number' && Number.isFinite(p.change_7d) ? p.change_7d : null,
      mcap_usd: typeof p.mcap_usd === 'number' && Number.isFinite(p.mcap_usd) ? p.mcap_usd : null,
      listed_at: typeof p.listed_at === 'string' ? p.listed_at : null,
      gecko_id: typeof p.gecko_id === 'string' ? p.gecko_id : null,
      symbol: typeof p.symbol === 'string' ? p.symbol : null,
    };
  });

  return {
    as_of: raw.as_of,
    source: raw.source,
    floor_usd: raw.floor_usd,
    protocols,
    watchlist: raw.watchlist as string[],
  };
}

export function boardIssue(board: readonly BoardRow[], snapshot: Snapshot): string | null {
  if (board.length < 100 || board.length > 4000) return `row count ${board.length} outside [100, 4000]`;
  const allowed = new Set(snapshot.protocols.map((p) => p.slug));
  const seen = new Set<string>();
  for (let i = 0; i < board.length; i++) {
    const r = board[i]!;
    if (!allowed.has(r.slug)) return `unknown slug ${r.slug}`;
    if (seen.has(r.slug)) return `duplicate slug ${r.slug}`;
    seen.add(r.slug);
    if (r.rank !== i + 1) return `expected rank ${i + 1}, got ${r.rank}`;
    if (!Number.isSafeInteger(r.implied_value_usd) || r.implied_value_usd <= 0 || r.implied_value_usd > 100_000_000_000_000) {
      return `invalid implied_value_usd for ${r.slug}: ${r.implied_value_usd}`;
    }
    if (i > 0 && r.implied_value_usd > board[i - 1]!.implied_value_usd) {
      return `rank ${r.rank} (${r.implied_value_usd}) exceeds rank ${i} (${board[i - 1]!.implied_value_usd})`;
    }
    if (r.farm_steps.length < 3 || r.farm_steps.length > 12) return `${r.slug} has ${r.farm_steps.length} farm_steps`;
    for (const s of r.farm_steps) {
      const len = s.trim().length;
      if (len < 20 || len > 600) return `${r.slug} step length ${len} outside [20, 600]`;
    }
  }
  if (board.length >= 2 && board[0]!.implied_value_usd === board[board.length - 1]!.implied_value_usd) {
    return 'all rows share identical implied_value_usd';
  }
  const missing = snapshot.watchlist.filter((s) => !seen.has(s));
  if (missing.length > 0) return `missing watchlist slugs: ${missing.slice(0, 5).join(', ')}`;
  return null;
}

export function dataScript(payload: RadarPayload): string {
  return `window.RADAR=${JSON.stringify(payload)};\n`;
}
