import { useState, useMemo, useCallback, useEffect } from 'react';
import {
  ShieldAlert, AlertTriangle, AlertCircle, Info,
  TrendingDown, Clock, DollarSign, Truck, Package,
  Search, Play, History, Key, X, ChevronDown, ChevronUp,
  Trash2, RefreshCw, Loader2, Zap, BarChart3, FileText,
} from 'lucide-react';
import { Doughnut } from 'react-chartjs-2';
import '../lib/chartSetup';
import {
  fetchVendors,
  fetchPurchaseOrders,
  fetchVendorRatings,
  fetchDeliveryPerformance,
  getVendors,
  getPurchaseOrders,
  getVendorRatings,
  getDeliveryPerformance,
  type Vendor,
  type PurchaseOrder,
  type VendorRating,
  type DeliveryPerformance,
} from '../lib/data';
import {
  getSupplierRisk,
  type SupplierRisk,
  type RiskCategory,
} from '../lib/supplierRisk';
import { useRefresh } from '../lib/RefreshContext';

// ─── Types ───

interface HistoricalMetrics {
  totalOrders: number;
  deliveredOrders: number;
  lateOrders: number;
  onTimeOrders: number;
  currentOverdueOrders: number;
  onTimeRate: number;
  avgLeadTime: number;
  declaredLeadTime: number;
  totalSpend: number;
  spendConcentration: number;
  overallRating: number;
  qualityRating: number;
  deliveryRating: number;
  costRating: number;
  responsivenessRating: number;
}

interface RiskAnalysisResult {
  supplyChain: {
    level: 'High' | 'Medium' | 'Low';
    summary: string;
    factors: string[];
    mitigations: string[];
  };
  financial: {
    level: 'High' | 'Medium' | 'Low';
    summary: string;
    factors: string[];
    mitigations: string[];
  };
  operational: {
    level: 'High' | 'Medium' | 'Low';
    summary: string;
    factors: string[];
    mitigations: string[];
  };
}

interface AnalysisHistory {
  id: string;
  timestamp: string;
  vendorId: string | null;
  vendorName: string;
  demoMode: boolean;
  result: RiskAnalysisResult;
  metrics: HistoricalMetrics;
  riskScore: number;
  riskLevel: string;
  detectedRisks: RiskCategory[];
}

// ─── Constants ───

const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions';
const GROQ_MODEL = 'llama-3.3-70b-versatile';

const LEVEL_COLORS: Record<string, string> = {
  High: 'red',
  Medium: 'orange',
  Low: 'green',
};

const SEVERITY_COLORS: Record<string, string> = {
  high: 'red',
  medium: 'orange',
  low: 'cyan',
};

// ─── Helper Functions ───

function daysBetween(date1: Date, date2: Date): number {
  const d1 = new Date(date1);
  const d2 = new Date(date2);
  d1.setHours(0, 0, 0, 0);
  d2.setHours(0, 0, 0, 0);
  return Math.floor((d2.getTime() - d1.getTime()) / (1000 * 60 * 60 * 24));
}

function isDelivered(po: PurchaseOrder): boolean {
  return po.deliveryStatus === 'delivered' || po.deliveryStatus === 'invoiced';
}

function isLateDelivery(po: PurchaseOrder): boolean {
  if (!po.actualDeliveryDate) return false;
  const actual = new Date(po.actualDeliveryDate);
  const expected = new Date(po.deliveryDate);
  return actual > expected;
}

function isCurrentlyOverdue(po: PurchaseOrder): boolean {
  if (isDelivered(po)) return false;
  const expected = new Date(po.deliveryDate);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  expected.setHours(0, 0, 0, 0);
  return expected < today;
}

function getApiKey(): string | null {
  return sessionStorage.getItem('groq_api_key');
}

function setApiKey(key: string): void {
  sessionStorage.setItem('groq_api_key', key);
}

function clearApiKey(): void {
  sessionStorage.removeItem('groq_api_key');
}

function generateId(): string {
  return `analysis_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
}

function formatTimestamp(ts: string): string {
  const d = new Date(ts);
  return d.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

// ─── Compute Historical Metrics ───

function computeHistoricalMetrics(
  vendorId: string,
  vendor: Vendor,
  pos: PurchaseOrder[],
  ratings: VendorRating[],
  deliveryPerf: DeliveryPerformance[]
): HistoricalMetrics {
  const vendorPOs = pos.filter(po => po.vendorId === vendorId);
  const rating = ratings.find(r => r.vendorId === vendorId);
  const vendorDelPerf = deliveryPerf.filter(dp => dp.vendorId === vendorId);

  const totalOrders = vendorPOs.length;
  const deliveredOrders = vendorPOs.filter(po => isDelivered(po)).length;
  const lateOrders = vendorPOs.filter(po => isDelivered(po) && isLateDelivery(po)).length;
  const onTimeOrders = vendorPOs.filter(po => isDelivered(po) && !isLateDelivery(po)).length;
  const currentOverdueOrders = vendorPOs.filter(po => isCurrentlyOverdue(po)).length;

  // On-time rate
  const denominator = deliveredOrders + currentOverdueOrders;
  const onTimeRate = denominator > 0 ? (onTimeOrders / denominator) * 100 : 0;

  // Average lead time from actual deliveries
  const deliveredPOs = vendorPOs.filter(po => isDelivered(po) && po.actualDeliveryDate);
  let avgLeadTime = vendor.leadTime;
  if (deliveredPOs.length > 0) {
    const totalLeadDays = deliveredPOs.reduce((sum, po) => {
      const created = new Date(po.createdAt);
      const delivered = new Date(po.actualDeliveryDate!);
      return sum + daysBetween(created, delivered);
    }, 0);
    avgLeadTime = Math.round(totalLeadDays / deliveredPOs.length);
  }

  // Spend concentration
  const totalSpend = vendorPOs.reduce((sum, po) => sum + po.total, 0);
  const allSpend = pos.reduce((sum, po) => sum + po.total, 0);
  const spendConcentration = allSpend > 0 ? (totalSpend / allSpend) * 100 : 0;

  // Ratings
  const overallRating = rating ? rating.overall : vendor.rating;
  const qualityRating = rating ? rating.quality : vendor.rating;
  const deliveryRating = rating ? rating.delivery : vendor.rating;
  const costRating = rating ? rating.cost : vendor.rating;
  const responsivenessRating = rating ? rating.responsiveness : vendor.rating;

  return {
    totalOrders,
    deliveredOrders,
    lateOrders,
    onTimeOrders,
    currentOverdueOrders,
    onTimeRate,
    avgLeadTime,
    declaredLeadTime: vendor.leadTime,
    totalSpend,
    spendConcentration,
    overallRating,
    qualityRating,
    deliveryRating,
    costRating,
    responsivenessRating,
  };
}

// ─── Demo Mode Result ───

const DEMO_RESULT: RiskAnalysisResult = {
  supplyChain: {
    level: 'High',
    summary: 'Critical supply chain vulnerabilities detected due to delivery performance degradation and excessive lead times.',
    factors: [
      'On-time delivery rate of 68% is significantly below target (95%)',
      'Average lead time of 21 days exceeds declared 14 days by 50%',
      'Current overdue orders: 2 POs representing $45,000 in value',
    ],
    mitigations: [
      'Immediate: Escalate to vendor management - contact within 24 hours regarding overdue PO-1003 ($15,000) and PO-1005 ($30,000)',
      'Short-term (14 days): Implement weekly delivery status calls until on-time rate reaches 85%',
      'Medium-term (30 days): Add secondary supplier for critical items to reduce dependency',
      'Long-term (60 days): Negotiate lead time reduction to 14 days with performance incentives',
    ],
  },
  financial: {
    level: 'Medium',
    summary: 'Moderate financial exposure due to supplier dependency and elevated spend concentration risk.',
    factors: [
      'Spend concentration of 28% represents single-supplier dependency',
      'Open purchase orders totaling $86,000 create financial exposure',
      'No financial stability data available - credit monitoring recommended',
    ],
    mitigations: [
      'Short-term (7 days): Request current financial statements and credit report',
      'Medium-term (21 days): Negotiate payment milestone structure for orders > $50,000',
      'Long-term (60 days): Develop alternate sourcing to reduce spend concentration below 20%',
    ],
  },
  operational: {
    level: 'High',
    summary: 'Operational risks elevated due to contract expiration and performance score decline trending downward.',
    factors: [
      'Contract expires in 45 days with no renewal initiated',
      'Overall performance score of 68/100 (below 75 threshold)',
      'Responsiveness rating of 3.9/5.0 indicates communication gaps',
    ],
    mitigations: [
      'Immediate: Initiate contract renewal discussion - schedule meeting within 5 business days',
      'Short-term (14 days): Establish dedicated account manager contact',
      'Medium-term (30 days): Implement quarterly business reviews with performance scorecards',
      'Long-term (90 days): Define service level agreements with penalties for non-compliance',
    ],
  },
};

// ─── Build AI Prompt ───

function buildAnalysisPrompt(
  vendorName: string,
  metrics: HistoricalMetrics,
  supplierRisk: SupplierRisk | null
): string {
  const detectedRisks = supplierRisk?.detectedRisks ?? [];
  const riskScore = supplierRisk?.overallRiskScore ?? 0;
  const riskLevel = supplierRisk?.riskLevel ?? 'low';

  return `You are a procurement risk analyst. Analyze the following supplier using ONLY the provided data. Do NOT calculate, estimate, or invent any metrics. Use the exact numbers given.

SUPPLIER: ${vendorName}

COMPUTED HISTORICAL METRICS (use these numbers exactly):
- Total Orders: ${metrics.totalOrders}
- Delivered Orders: ${metrics.deliveredOrders}
- Late Orders: ${metrics.lateOrders}
- On-Time Orders: ${metrics.onTimeOrders}
- Currently Overdue Orders: ${metrics.currentOverdueOrders}
- On-Time Rate: ${metrics.onTimeRate.toFixed(1)}%
- Average Lead Time: ${metrics.avgLeadTime} days (declared: ${metrics.declaredLeadTime} days)
- Total Spend: $${metrics.totalSpend.toLocaleString()}
- Spend Concentration: ${metrics.spendConcentration.toFixed(1)}%
- Overall Rating: ${metrics.overallRating.toFixed(1)}/5.0
- Quality Rating: ${metrics.qualityRating.toFixed(1)}/5.0
- Delivery Rating: ${metrics.deliveryRating.toFixed(1)}/5.0
- Cost Rating: ${metrics.costRating.toFixed(1)}/5.0
- Responsiveness Rating: ${metrics.responsivenessRating.toFixed(1)}/5.0

SYSTEM-COMPUTED RISK SCORE:
- Overall Risk Score: ${riskScore}/100
- Risk Level: ${riskLevel}

SYSTEM-DETECTED RISKS (evidence):
${detectedRisks.length > 0
  ? detectedRisks.map((r, i) => `${i + 1}. [${r.severity.toUpperCase()}] ${r.message} (impact: +${r.scoreImpact} points)`).join('\n')
  : 'No risks detected by system analysis.'}

TASK:
Generate a JSON object with three keys: "supplyChain", "financial", "operational".

Each key must have this structure:
{
  "level": "High" or "Medium" or "Low",
  "summary": "string (2-3 sentences summarizing risk posture)",
  "factors": ["specific factor 1", "specific factor 2", ...],
  "mitigations": ["numbered actionable step 1", "numbered actionable step 2", ...]
}

RULES:
1. Use ONLY the provided metrics. If data is insufficient for a category, write "Insufficient supporting procurement data available." in the summary.
2. For mitigations, cite the real numbers and include metric targets and timeframes.
3. If currentOverdueOrders > 0, the supplyChain mitigations MUST include an immediate escalation action within the first mitigation step.
4. Do NOT give generic advice like "monitor closely" - be specific and actionable.
5. Respond ONLY with valid JSON (no markdown, no code blocks).`;
}

// ─── Main Component ───

export default function AIRisk() {
  // ─── State ───
  const [isLoadingData, setIsLoadingData] = useState(true);
  const { refreshKey } = useRefresh();

  useEffect(() => {
    setIsLoadingData(true);
    Promise.all([
      fetchVendors(),
      fetchPurchaseOrders(),
      fetchVendorRatings(),
      fetchDeliveryPerformance(),
    ]).finally(() => setIsLoadingData(false));
  }, [refreshKey]);

  const vendors = getVendors();
  const pos = getPurchaseOrders();
  const ratings = getVendorRatings();
  const deliveryPerf = getDeliveryPerformance();

  const [selectedVendorId, setSelectedVendorId] = useState<string>('');
  const [manualMode, setManualMode] = useState(false);
  const [manualVendorName, setManualVendorName] = useState('');
  const [manualParams, setManualParams] = useState<Partial<HistoricalMetrics>>({});

  const [analysisResult, setAnalysisResult] = useState<RiskAnalysisResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [showApiKeyModal, setShowApiKeyModal] = useState(false);
  const [apiKeyInput, setApiKeyInput] = useState('');
  const [hasApiKey, setHasApiKey] = useState(false);

  const [showHistory, setShowHistory] = useState(false);
  const [history, setHistory] = useState<AnalysisHistory[]>([]);

  const [expandedDataPreview, setExpandedDataPreview] = useState(true);

  // ─── Check API key on mount ───
  useEffect(() => {
    setHasApiKey(!!getApiKey());
    // Load history from localStorage
    try {
      const saved = localStorage.getItem('ai_risk_history');
      if (saved) {
        setHistory(JSON.parse(saved));
      }
    } catch {}
  }, []);

  // ─── Selected vendor data ───
  const selectedVendor = useMemo(() => {
    return vendors.find(v => v.id === selectedVendorId) || null;
  }, [vendors, selectedVendorId]);

  const supplierRisk = useMemo(() => {
    if (!selectedVendorId) return null;
    return getSupplierRisk(selectedVendorId);
  }, [selectedVendorId]);

  const historicalMetrics = useMemo(() => {
    if (manualMode) {
      return {
        totalOrders: manualParams.totalOrders ?? 0,
        deliveredOrders: manualParams.deliveredOrders ?? 0,
        lateOrders: manualParams.lateOrders ?? 0,
        onTimeOrders: manualParams.onTimeOrders ?? 0,
        currentOverdueOrders: manualParams.currentOverdueOrders ?? 0,
        onTimeRate: manualParams.onTimeRate ?? 0,
        avgLeadTime: manualParams.avgLeadTime ?? 0,
        declaredLeadTime: manualParams.declaredLeadTime ?? 0,
        totalSpend: manualParams.totalSpend ?? 0,
        spendConcentration: manualParams.spendConcentration ?? 0,
        overallRating: manualParams.overallRating ?? 0,
        qualityRating: manualParams.qualityRating ?? 0,
        deliveryRating: manualParams.deliveryRating ?? 0,
        costRating: manualParams.costRating ?? 0,
        responsivenessRating: manualParams.responsivenessRating ?? 0,
      };
    }
    if (!selectedVendor) return null;
    return computeHistoricalMetrics(selectedVendorId, selectedVendor, pos, ratings, deliveryPerf);
  }, [manualMode, selectedVendor, selectedVendorId, pos, ratings, deliveryPerf, manualParams]);

  // ─── Save to history ───
  const saveToHistory = useCallback((
    vendorName: string,
    vendorId: string | null,
    demoMode: boolean,
    result: RiskAnalysisResult,
    metrics: HistoricalMetrics,
    risk: SupplierRisk | null
  ) => {
    const entry: AnalysisHistory = {
      id: generateId(),
      timestamp: new Date().toISOString(),
      vendorId,
      vendorName,
      demoMode,
      result,
      metrics,
      riskScore: risk?.overallRiskScore ?? 0,
      riskLevel: risk?.riskLevel ?? 'low',
      detectedRisks: risk?.detectedRisks ?? [],
    };
    const updated = [entry, ...history].slice(0, 20);
    setHistory(updated);
    try {
      localStorage.setItem('ai_risk_history', JSON.stringify(updated));
    } catch {}
  }, [history]);

  // ─── Run Analysis ───
  const runAnalysis = useCallback(async () => {
    setError(null);
    setAnalysisResult(null);

    const vendorName = manualMode ? manualVendorName : selectedVendor?.name;
    if (!vendorName?.trim()) {
      setError('Please select a vendor or enter a vendor name.');
      return;
    }

    if (!historicalMetrics) {
      setError('Please provide historical metrics data.');
      return;
    }

    const apiKey = getApiKey();
    const demoMode = !apiKey;

    if (demoMode) {
      // Demo mode - use deterministic result
      setAnalysisResult(DEMO_RESULT);
      saveToHistory(vendorName, manualMode ? null : selectedVendorId, true, DEMO_RESULT, historicalMetrics, supplierRisk);
      return;
    }

    setIsLoading(true);

    try {
      const prompt = buildAnalysisPrompt(
        vendorName,
        historicalMetrics,
        supplierRisk
      );

      const response = await fetch(GROQ_API_URL, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: GROQ_MODEL,
          messages: [
            {
              role: 'user',
              content: prompt,
            },
          ],
          temperature: 0.2,
          response_format: { type: 'json_object' },
        }),
      });

      if (response.status === 401) {
        throw new Error('Invalid API key. Please check your Groq API key and try again.');
      }

      if (!response.ok) {
        throw new Error(`API request failed: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      const content = data.choices?.[0]?.message?.content;

      if (!content) {
        throw new Error('AI response was empty. Try again.');
      }

      let parsed: RiskAnalysisResult;
      try {
        parsed = JSON.parse(content);
      } catch {
        throw new Error('AI response was unreadable. Try again.');
      }

      // Validate structure
      if (!parsed.supplyChain || !parsed.financial || !parsed.operational) {
        throw new Error('AI response was incomplete. Try again.');
      }

      setAnalysisResult(parsed);
      saveToHistory(vendorName, manualMode ? null : selectedVendorId, false, parsed, historicalMetrics, supplierRisk);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'An unexpected error occurred.';
      setError(message);
    } finally {
      setIsLoading(false);
    }
  }, [manualMode, manualVendorName, selectedVendor, selectedVendorId, historicalMetrics, supplierRisk, saveToHistory]);

  // ─── API Key Handlers ───
  const handleSaveApiKey = useCallback(() => {
    if (apiKeyInput.trim()) {
      setApiKey(apiKeyInput.trim());
      setHasApiKey(true);
      setShowApiKeyModal(false);
      setApiKeyInput('');
    }
  }, [apiKeyInput]);

  const handleClearApiKey = useCallback(() => {
    clearApiKey();
    setHasApiKey(false);
    setShowApiKeyModal(false);
  }, []);

  // ─── History Handlers ───
  const loadFromHistory = useCallback((entry: AnalysisHistory) => {
    if (entry.vendorId && !manualMode) {
      setSelectedVendorId(entry.vendorId);
    }
    setAnalysisResult(entry.result);
    setShowHistory(false);
  }, [manualMode]);

  const deleteFromHistory = useCallback((id: string) => {
    const updated = history.filter(h => h.id !== id);
    setHistory(updated);
    try {
      localStorage.setItem('ai_risk_history', JSON.stringify(updated));
    } catch {}
  }, [history]);

  // ─── Chart Data ───
  const levelCounts = useMemo(() => {
    if (!analysisResult) return { High: 0, Medium: 0, Low: 0 };
    const counts = { High: 0, Medium: 0, Low: 0 };
    counts[analysisResult.supplyChain.level]++;
    counts[analysisResult.financial.level]++;
    counts[analysisResult.operational.level]++;
    return counts;
  }, [analysisResult]);

  const doughnutData = {
    labels: ['High', 'Medium', 'Low'],
    datasets: [{
      data: [levelCounts.High, levelCounts.Medium, levelCounts.Low],
      backgroundColor: ['#FB7185', '#FB923C', '#34D399'],
      borderWidth: 0,
      hoverOffset: 6,
    }],
  };

  // ─── Render ───

  if (isLoadingData) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-sm" style={{ color: 'var(--text-muted)' }}>Loading data...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2" style={{ color: 'var(--text)' }}>
            <ShieldAlert size={24} style={{ color: 'var(--red)' }} /> AI Risk Intelligence
          </h1>
          <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>
            AI-powered risk analysis with procurement data context
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            className="glass-button text-xs flex items-center gap-1"
            onClick={() => setShowHistory(true)}
          >
            <History size={12} /> History ({history.length})
          </button>
          <button
            className={`glass-button text-xs flex items-center gap-1 ${hasApiKey ? '' : 'glass-button-primary'}`}
            onClick={() => setShowApiKeyModal(true)}
          >
            <Key size={12} /> {hasApiKey ? 'API Key Set' : 'Add API Key'}
          </button>
        </div>
      </div>

      {/* Demo Mode Banner */}
      {!hasApiKey && (
        <div className="glass-card kpi-accent-orange p-4 flex items-start gap-3">
          <Zap size={18} style={{ color: 'var(--orange)', flexShrink: 0, marginTop: 2 }} />
          <div>
            <div className="text-sm font-semibold" style={{ color: 'var(--text)' }}>Demo Mode Active</div>
            <div className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
              No Groq API key configured. Running with deterministic demo results. Add your API key for live analysis.
            </div>
          </div>
        </div>
      )}

      {/* Vendor Selection */}
      <div className="glass-card-solid p-5 space-y-4">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <h3 className="text-sm font-semibold" style={{ color: 'var(--text-secondary)' }}>
            Vendor Selection
          </h3>
          <button
            className={`glass-button text-xs ${manualMode ? 'glass-button-primary' : ''}`}
            onClick={() => setManualMode(!manualMode)}
          >
            {manualMode ? 'Switch to Live Mode' : 'Manual Mode'}
          </button>
        </div>

        {!manualMode ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-semibold uppercase block mb-1" style={{ color: 'var(--text-muted)' }}>
                Select Vendor
              </label>
              <select
                className="glass-input w-full"
                value={selectedVendorId}
                onChange={e => setSelectedVendorId(e.target.value)}
              >
                <option value="">Choose a vendor...</option>
                {vendors.map(v => (
                  <option key={v.id} value={v.id}>{v.name}</option>
                ))}
              </select>
            </div>
            <div className="flex items-end">
              <button
                className="glass-button glass-button-primary flex items-center gap-2"
                disabled={!selectedVendorId || isLoading}
                onClick={runAnalysis}
              >
                {isLoading ? <Loader2 size={14} className="animate-spin" /> : <Play size={14} />}
                Run Analysis
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div>
              <label className="text-xs font-semibold uppercase block mb-1" style={{ color: 'var(--text-muted)' }}>
                Vendor Name *
              </label>
              <input
                className="glass-input w-full"
                value={manualVendorName}
                onChange={e => setManualVendorName(e.target.value)}
                placeholder="Enter vendor name..."
              />
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <ManualInput
                label="Total Orders"
                value={manualParams.totalOrders}
                onChange={v => setManualParams(p => ({ ...p, totalOrders: v }))}
                type="number"
              />
              <ManualInput
                label="On-Time Rate (%)"
                value={manualParams.onTimeRate}
                onChange={v => setManualParams(p => ({ ...p, onTimeRate: v }))}
                type="number"
              />
              <ManualInput
                label="Avg Lead Time (d)"
                value={manualParams.avgLeadTime}
                onChange={v => setManualParams(p => ({ ...p, avgLeadTime: v }))}
                type="number"
              />
              <ManualInput
                label="Overdue Orders"
                value={manualParams.currentOverdueOrders}
                onChange={v => setManualParams(p => ({ ...p, currentOverdueOrders: v }))}
                type="number"
              />
              <ManualInput
                label="Total Spend ($)"
                value={manualParams.totalSpend}
                onChange={v => setManualParams(p => ({ ...p, totalSpend: v }))}
                type="number"
              />
              <ManualInput
                label="Spend Conc. (%)"
                value={manualParams.spendConcentration}
                onChange={v => setManualParams(p => ({ ...p, spendConcentration: v }))}
                type="number"
              />
              <ManualInput
                label="Rating (1-5)"
                value={manualParams.overallRating}
                onChange={v => setManualParams(p => ({ ...p, overallRating: v }))}
                type="number"
              />
            </div>
            <button
              className="glass-button glass-button-primary flex items-center gap-2"
              disabled={!manualVendorName.trim() || isLoading}
              onClick={runAnalysis}
            >
              {isLoading ? <Loader2 size={14} className="animate-spin" /> : <Play size={14} />}
              Run Analysis
            </button>
          </div>
        )}

        {/* Data Preview */}
        {historicalMetrics && !manualMode && (
          <div className="mt-4">
            <button
              className="text-xs font-semibold uppercase flex items-center gap-1 w-full text-left"
              style={{ color: 'var(--text-muted)' }}
              onClick={() => setExpandedDataPreview(!expandedDataPreview)}
            >
              {expandedDataPreview ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
              Loaded Data Preview
            </button>
            {expandedDataPreview && (
              <div className="mt-3 glass-card p-4">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
                  <MetricPreview label="Total Orders" value={historicalMetrics.totalOrders} />
                  <MetricPreview label="Delivered" value={historicalMetrics.deliveredOrders} />
                  <MetricPreview label="Late Orders" value={historicalMetrics.lateOrders} color={historicalMetrics.lateOrders > 0 ? 'red' : undefined} />
                  <MetricPreview label="Overdue Now" value={historicalMetrics.currentOverdueOrders} color={historicalMetrics.currentOverdueOrders > 0 ? 'red' : undefined} />
                  <MetricPreview label="On-Time Rate" value={`${historicalMetrics.onTimeRate.toFixed(0)}%`} color={historicalMetrics.onTimeRate >= 85 ? 'green' : 'orange'} />
                  <MetricPreview label="Avg Lead Time" value={`${historicalMetrics.avgLeadTime}d`} />
                  <MetricPreview label="Total Spend" value={`$${historicalMetrics.totalSpend.toLocaleString()}`} />
                  <MetricPreview label="Spend Conc." value={`${historicalMetrics.spendConcentration.toFixed(0)}%`} color={historicalMetrics.spendConcentration > 25 ? 'orange' : undefined} />
                </div>
                {supplierRisk && supplierRisk.detectedRisks.length > 0 && (
                  <div className="mt-3 pt-3" style={{ borderTop: '1px solid var(--glass-border)' }}>
                    <div className="text-xs font-semibold uppercase mb-2" style={{ color: 'var(--text-muted)' }}>
                      System-Detected Risks ({supplierRisk.detectedRisks.length})
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {supplierRisk.detectedRisks.map((r, i) => (
                        <span
                          key={i}
                          className={`glass-badge glass-badge-${SEVERITY_COLORS[r.severity]}`}
                        >
                          {r.message}
                        </span>
                      ))}
                    </div>
                    <div className="mt-2 text-xs" style={{ color: 'var(--text-muted)' }}>
                      Overall Risk Score: <span style={{ color: supplierRisk.riskLevel === 'high' ? 'var(--red)' : supplierRisk.riskLevel === 'medium' ? 'var(--orange)' : 'var(--green)' }}>{supplierRisk.overallRiskScore}/100</span> ({supplierRisk.riskLevel})
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Error Message */}
      {error && (
        <div className="glass-card kpi-accent-red p-4 flex items-start gap-3">
          <AlertCircle size={18} style={{ color: 'var(--red)', flexShrink: 0 }} />
          <div className="flex-1">
            <div className="text-sm font-semibold" style={{ color: 'var(--text)' }}>Analysis Error</div>
            <div className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>{error}</div>
          </div>
          <button
            className="glass-button text-xs flex items-center gap-1"
            onClick={runAnalysis}
          >
            <RefreshCw size={12} /> Retry
          </button>
        </div>
      )}

      {/* Loading State */}
      {isLoading && (
        <div className="glass-card p-8 flex flex-col items-center justify-center gap-4">
          <Loader2 size={32} className="animate-spin" style={{ color: 'var(--blue)' }} />
          <div className="text-sm font-semibold" style={{ color: 'var(--text)' }}>Analyzing supplier risk...</div>
          <div className="text-xs" style={{ color: 'var(--text-muted)' }}>This may take a few seconds</div>
        </div>
      )}

      {/* Results */}
      {analysisResult && !isLoading && (
        <div className="space-y-5">
          {/* Summary Chart */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
            <div className="glass-card-solid p-5" style={{ height: 240 }}>
              <h3 className="text-sm font-semibold mb-3" style={{ color: 'var(--text-secondary)' }}>Risk Distribution</h3>
              <div style={{ height: 160 }}>
                <Doughnut
                  data={doughnutData}
                  options={{
                    responsive: true,
                    maintainAspectRatio: false,
                    cutout: '65%',
                    plugins: {
                      legend: {
                        position: 'bottom',
                        labels: { color: '#94A3B8', padding: 12, usePointStyle: true, pointStyleWidth: 8 },
                      },
                      tooltip: { backgroundColor: 'rgba(6,17,32,0.9)', cornerRadius: 12 },
                    },
                  }}
                />
              </div>
            </div>
            <div className="lg:col-span-2 glass-card-solid p-5">
              <h3 className="text-sm font-semibold mb-3" style={{ color: 'var(--text-secondary)' }}>Risk Summary</h3>
              <div className="grid grid-cols-3 gap-3">
                {(['supplyChain', 'financial', 'operational'] as const).map(key => (
                  <div key={key} className={`glass-card p-3 kpi-accent-${LEVEL_COLORS[analysisResult[key].level]}`}>
                    <div className="text-xs font-semibold uppercase mb-1" style={{ color: 'var(--text-muted)' }}>
                      {key === 'supplyChain' ? 'Supply Chain' : key === 'financial' ? 'Financial' : 'Operational'}
                    </div>
                    <div className="text-lg font-bold" style={{ color: `var(--${LEVEL_COLORS[analysisResult[key].level]})` }}>
                      {analysisResult[key].level}
                    </div>
                    <div className="text-xs mt-1 truncate" style={{ color: 'var(--text-muted)' }}>
                      {analysisResult[key].factors.length} factors
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Detail Cards */}
          {(['supplyChain', 'financial', 'operational'] as const).map(key => {
            const section = analysisResult[key];
            const title = key === 'supplyChain' ? 'Supply Chain Risk' : key === 'financial' ? 'Financial Risk' : 'Operational Risk';
            const Icon = key === 'supplyChain' ? Truck : key === 'financial' ? DollarSign : BarChart3;
            const color = LEVEL_COLORS[section.level];

            return (
              <div key={key} className={`glass-card kpi-accent-${color} p-5`}>
                <div className="flex items-start gap-3">
                  <div
                    className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                    style={{ background: `var(--${color})`, opacity: 0.15, color: `var(--${color})` }}
                  >
                    <Icon size={18} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-2">
                      <span className="text-lg font-semibold" style={{ color: 'var(--text)' }}>{title}</span>
                      <span className={`glass-badge glass-badge-${color}`}>{section.level}</span>
                    </div>
                    <div className="text-sm mb-3" style={{ color: 'var(--text-secondary)' }}>
                      {section.summary}
                    </div>

                    {section.factors.length > 0 && (
                      <div className="mb-3">
                        <div className="text-xs font-semibold uppercase mb-1.5" style={{ color: 'var(--text-muted)' }}>
                          Risk Factors
                        </div>
                        <ul className="text-xs space-y-1" style={{ color: 'var(--text-secondary)' }}>
                          {section.factors.map((f, i) => (
                            <li key={i} className="flex items-start gap-2">
                              <AlertTriangle size={12} style={{ color: `var(--${color})`, marginTop: 3, flexShrink: 0 }} />
                              {f}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {section.mitigations.length > 0 && (
                      <div>
                        <div className="text-xs font-semibold uppercase mb-1.5" style={{ color: 'var(--text-muted)' }}>
                          Mitigation Steps
                        </div>
                        <ol className="text-xs space-y-2" style={{ color: 'var(--text-secondary)' }}>
                          {section.mitigations.map((m, i) => (
                            <li key={i} className="flex items-start gap-2">
                              <span
                                className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold flex-shrink-0"
                                style={{ background: `var(--${color})`, opacity: 0.15, color: `var(--${color})` }}
                              >
                                {i + 1}
                              </span>
                              {m}
                            </li>
                          ))}
                        </ol>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ─── API Key Modal ─── */}
      {showApiKeyModal && (
        <div
          className="fixed inset-0 z-40 flex items-center justify-center p-4"
          style={{ background: 'rgba(0,0,0,0.4)' }}
          onClick={e => { if (e.target === e.currentTarget) setShowApiKeyModal(false); }}
        >
          <div className="glass-panel p-6 w-full max-w-md" style={{ borderRadius: 24 }}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold" style={{ color: 'var(--text)' }}>Groq API Key</h2>
              <button onClick={() => setShowApiKeyModal(false)} style={{ color: 'var(--text-muted)' }}>
                <X size={18} />
              </button>
            </div>
            <div className="text-xs mb-3" style={{ color: 'var(--text-muted)' }}>
              Your API key is stored only in browser session storage and cleared when you close this tab.
            </div>
            <input
              type="password"
              className="glass-input w-full mb-3"
              placeholder="gsk_..."
              value={apiKeyInput}
              onChange={e => setApiKeyInput(e.target.value)}
            />
            <div className="flex items-center gap-2">
              <button
                className="glass-button glass-button-primary flex-1"
                onClick={handleSaveApiKey}
                disabled={!apiKeyInput.trim()}
              >
                Save Key
              </button>
              {hasApiKey && (
                <button className="glass-button text-xs" onClick={handleClearApiKey}>
                  Clear
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ─── History Panel ─── */}
      {showHistory && (
        <div
          className="fixed inset-0 z-40 flex items-center justify-center p-4"
          style={{ background: 'rgba(0,0,0,0.4)' }}
          onClick={e => { if (e.target === e.currentTarget) setShowHistory(false); }}
        >
          <div className="glass-panel p-6 w-full max-w-2xl max-h-[80vh] overflow-y-auto" style={{ borderRadius: 24 }}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold" style={{ color: 'var(--text)' }}>Analysis History</h2>
              <button onClick={() => setShowHistory(false)} style={{ color: 'var(--text-muted)' }}>
                <X size={18} />
              </button>
            </div>
            {history.length === 0 ? (
              <div className="text-center py-8" style={{ color: 'var(--text-muted)' }}>
                No analysis history yet
              </div>
            ) : (
              <div className="space-y-3">
                {history.map(entry => (
                  <div key={entry.id} className="glass-card p-4 flex items-start gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <span className="font-semibold" style={{ color: 'var(--text)' }}>{entry.vendorName}</span>
                        {entry.demoMode && (
                          <span className="glass-badge glass-badge-orange">Demo</span>
                        )}
                        <span className={`glass-badge glass-badge-${entry.riskLevel === 'high' ? 'red' : entry.riskLevel === 'medium' ? 'orange' : 'green'}`}>
                          {entry.riskScore}/100
                        </span>
                      </div>
                      <div className="text-xs" style={{ color: 'var(--text-muted)' }}>
                        {formatTimestamp(entry.timestamp)} • {entry.detectedRisks.length} risks detected
                      </div>
                    </div>
                    <button
                      className="glass-button text-xs"
                      onClick={() => loadFromHistory(entry)}
                    >
                      Load
                    </button>
                    <button
                      className="p-1.5 rounded-lg transition-colors hover:bg-[rgba(251,113,133,0.1)]"
                      style={{ color: 'var(--red)' }}
                      onClick={() => deleteFromHistory(entry.id)}
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Sub-Components ───

function MetricPreview({ label, value, color }: { label: string; value: string | number; color?: string }) {
  return (
    <div>
      <div className="text-[10px] uppercase" style={{ color: 'var(--text-muted)' }}>{label}</div>
      <div className="text-sm font-semibold" style={{ color: color ? `var(--${color})` : 'var(--text)' }}>
        {value}
      </div>
    </div>
  );
}

function ManualInput({
  label,
  value,
  onChange,
  type,
}: {
  label: string;
  value: number | undefined;
  onChange: (v: number) => void;
  type: 'number';
}) {
  return (
    <div>
      <label className="text-[10px] uppercase block mb-0.5" style={{ color: 'var(--text-muted)' }}>
        {label}
      </label>
      <input
        type="number"
        className="glass-input w-full text-xs py-1 px-2"
        value={value ?? ''}
        onChange={e => onChange(parseFloat(e.target.value) || 0)}
      />
    </div>
  );
}
