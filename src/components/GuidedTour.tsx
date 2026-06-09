import { useState, useEffect, useCallback, useRef } from 'react';
import ReactDOM from 'react-dom';
import { type Page } from '../lib/data';
import { useToast } from '../lib/ToastContext';

// ─── Tour Step Definitions ──────────────────────────────────────────────────

interface TourStep {
  page: Page;
  target: string;
  title: string;
  body: string;
  position?: 'top' | 'bottom' | 'left' | 'right';
}

const PAGE_LABELS: Record<Page, string> = {
  dashboard: 'Dashboard',
  vendors: 'Vendors',
  'purchase-orders': 'Purchase Orders',
  delivery: 'Delivery',
  scorecard: 'Scorecard',
  'ai-risk': 'AI Risk',
  catalog: 'Catalog',
};

const ALL_STEPS: TourStep[] = [
  // ── Dashboard ──
  {
    page: 'dashboard',
    target: 'dashboard-header',
    title: 'Welcome to ProcureAI 👋',
    body: 'Your command center for supply chain operations. Every number here is live — pulled straight from your vendors, orders, and deliveries.',
    position: 'bottom',
  },
  {
    page: 'dashboard',
    target: 'kpi-cards',
    title: 'Live KPI Cards',
    body: 'Four key metrics update in real time: total vendors, open purchase orders, overdue deliveries, and average vendor score. Watch them animate when data changes.',
    position: 'bottom',
  },
  {
    page: 'dashboard',
    target: 'chart-panel',
    title: 'Monthly PO Activity',
    body: 'The blue bars show how many orders were placed each month. The orange line tracks total spend. Use the 3M / 6M / 12M toggle to zoom in or out.',
    position: 'top',
  },
  {
    page: 'dashboard',
    target: 'chart-range',
    title: 'Time-Range Toggle',
    body: 'Switch between 3, 6 or 12 months at a glance. The chart re-renders instantly — no page reload.',
    position: 'bottom',
  },
  {
    page: 'dashboard',
    target: 'recent-orders',
    title: 'Recent Purchase Orders',
    body: 'The 10 most recent POs sorted by date. Click any row to jump straight to that order in the Purchase Orders page.',
    position: 'top',
  },
  // ── Vendors ──
  {
    page: 'vendors',
    target: 'vendors-header',
    title: 'Vendor Directory 🏢',
    body: 'All your suppliers in one place. Search, filter by category or status, compare two vendors head-to-head, or export the full list to CSV.',
    position: 'bottom',
  },
  {
    page: 'vendors',
    target: 'add-vendor-btn',
    title: 'Add a New Vendor',
    body: 'Opens a modal to register a new supplier — company name, contact, category, payment terms, lead time and more. The vendor code (VND-NNN) is auto-generated.',
    position: 'bottom',
  },
  {
    page: 'vendors',
    target: 'vendor-list',
    title: 'Vendor Cards',
    body: "Each card shows the vendor's category, status, and a blue badge with the count of open POs. Click any card to open the detail panel. Tick two cards to compare them.",
    position: 'top',
  },
  // ── Purchase Orders ──
  {
    page: 'purchase-orders',
    target: 'po-header',
    title: 'Purchase Orders 📋',
    body: 'Create, edit, duplicate and track every purchase order. The stats bar above the table shows total value and active filter counts.',
    position: 'bottom',
  },
  {
    page: 'purchase-orders',
    target: 'create-po-btn',
    title: 'Create a New PO',
    body: 'Opens the PO builder: pick a vendor, set a delivery date, add line items from the catalog, and watch the subtotal, tax and grand total update live as you type.',
    position: 'bottom',
  },
  {
    page: 'purchase-orders',
    target: 'po-status-filter',
    title: 'Filter & Sort',
    body: 'Filter by status (ordered, confirmed, in-transit, delivered, invoiced) or by vendor, then sort by date, total, or status. Combine filters for precise views.',
    position: 'bottom',
  },
  {
    page: 'purchase-orders',
    target: 'po-list',
    title: 'PO Table',
    body: 'Tick the checkbox on the left to select multiple POs for bulk delete. Use 👁 to print a PO, ✏ to edit, 📋 to duplicate, or 🗑 to delete.',
    position: 'top',
  },
  // ── Delivery ──
  {
    page: 'delivery',
    target: 'delivery-header',
    title: 'Delivery Tracker 🚚',
    body: 'Track every shipment from ordered to invoiced. The summary badges at the top filter cards instantly — click "Overdue" to see what needs attention right now.',
    position: 'bottom',
  },
  {
    page: 'delivery',
    target: 'delivery-list',
    title: 'Delivery Cards',
    body: 'Each card shows a 5-step progress bar (Ordered → Confirmed → In Transit → Delivered → Invoiced). Use "Advance" or "Revert" to move a shipment — the chart updates immediately.',
    position: 'top',
  },
  // ── Scorecard ──
  {
    page: 'scorecard',
    target: 'scorecard-header',
    title: 'Vendor Performance Scorecard 📊',
    body: 'Ranks every supplier by on-time delivery rate, average lead time, rating and total spend. Red alerts surface vendors that need attention before problems escalate.',
    position: 'bottom',
  },
  {
    page: 'scorecard',
    target: 'scorecard-list',
    title: 'Leaderboard',
    body: 'Click any row to open a detail drawer with performance history charts, benchmark comparisons and trend arrows (↑ Improving / ↓ Declining / → Stable).',
    position: 'top',
  },
  // ── AI Risk ──
  {
    page: 'ai-risk',
    target: 'ai-risk-header',
    title: 'AI Risk Analyzer 🤖',
    body: 'Select a vendor and click Analyze. The app computes delivery, financial and operational risk scores from your live data, then sends them to an AI for plain-language recommendations.',
    position: 'bottom',
  },
];

// ─── Props ───────────────────────────────────────────────────────────────────

interface GuidedTourProps {
  isRunning: boolean;
  currentPage: Page;
  onNavigate: (page: Page) => void;
  onClose: () => void;
}

// ─── Highlight Rect ───────────────────────────────────────────────────────────

interface HighlightRect {
  top: number;
  left: number;
  width: number;
  height: number;
}

// ─── positionTooltip ─────────────────────────────────────────────────────────

const TOOLTIP_WIDTH = 340;
const TOOLTIP_HEIGHT_ESTIMATE = 280;
const GAP = 16;
const VIEWPORT_MARGIN = 12;

function getTooltipWidth() {
  // On narrow mobile screens, use viewport width minus margins
  const vw = window.innerWidth;
  if (vw < 420) return vw - VIEWPORT_MARGIN * 2;
  return TOOLTIP_WIDTH;
}

function positionTooltip(
  rect: HighlightRect,
  position: TourStep['position'],
): { top: number; left: number } {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const tooltipW = getTooltipWidth();

  const sides: NonNullable<TourStep['position']>[] = ['bottom', 'top', 'right', 'left'];
  const preferred = position ?? 'bottom';
  const ordered = [preferred, ...sides.filter(s => s !== preferred)];

  for (const side of ordered) {
    let top = 0;
    let left = 0;

    if (side === 'bottom') {
      top = rect.top + rect.height + GAP;
      left = rect.left + rect.width / 2 - tooltipW / 2;
    } else if (side === 'top') {
      top = rect.top - TOOLTIP_HEIGHT_ESTIMATE - GAP;
      left = rect.left + rect.width / 2 - tooltipW / 2;
    } else if (side === 'right') {
      top = rect.top + rect.height / 2 - TOOLTIP_HEIGHT_ESTIMATE / 2;
      left = rect.left + rect.width + GAP;
    } else {
      top = rect.top + rect.height / 2 - TOOLTIP_HEIGHT_ESTIMATE / 2;
      left = rect.left - tooltipW - GAP;
    }

    // Check if it fits in viewport
    const fitsH = top >= VIEWPORT_MARGIN && top + TOOLTIP_HEIGHT_ESTIMATE <= vh - VIEWPORT_MARGIN;
    const fitsW = left >= VIEWPORT_MARGIN && left + tooltipW <= vw - VIEWPORT_MARGIN;

    if (fitsH && fitsW) {
      return { top, left };
    }
  }

  // Fallback: just clamp to viewport
  let top = rect.top + rect.height + GAP;
  let left = rect.left + rect.width / 2 - tooltipW / 2;
  top = Math.max(VIEWPORT_MARGIN, Math.min(top, vh - TOOLTIP_HEIGHT_ESTIMATE - VIEWPORT_MARGIN));
  left = Math.max(VIEWPORT_MARGIN, Math.min(left, vw - tooltipW - VIEWPORT_MARGIN));
  return { top, left };
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function GuidedTour({ isRunning, currentPage, onNavigate, onClose }: GuidedTourProps) {
  const [stepIndex, setStepIndex] = useState(0);
  const [highlightRect, setHighlightRect] = useState<HighlightRect | null>(null);
  const [tooltipVisible, setTooltipVisible] = useState(false);
  const [overlayVisible, setOverlayVisible] = useState(false);
  const { showToast } = useToast();

  const step = ALL_STEPS[stepIndex];
  const isLastStep = stepIndex === ALL_STEPS.length - 1;

  // ── Recalculate highlight position ───────────────────────────────────────

  const recalcHighlight = useCallback(() => {
    if (!step) return;
    const el = document.querySelector<HTMLElement>(`[data-tour="${step.target}"]`);
    if (!el) {
      setHighlightRect(null);
      return;
    }
    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    // Let scroll and any layout reflow settle before measuring
    // 80ms is not enough for elements far down the page — use 200ms
    setTimeout(() => {
      const r = el.getBoundingClientRect();
      setHighlightRect({
        top: r.top - 8,
        left: r.left - 8,
        width: r.width + 16,
        height: r.height + 16,
      });
    }, 200);
    // Re-measure once more in case layout settled later (e.g. dynamic content)
    setTimeout(() => {
      const el2 = document.querySelector<HTMLElement>(`[data-tour="${step.target}"]`);
      if (!el2) return;
      const r = el2.getBoundingClientRect();
      setHighlightRect({
        top: r.top - 8,
        left: r.left - 8,
        width: r.width + 16,
        height: r.height + 16,
      });
    }, 450);
  }, [step]);

  // ── On tour start ─────────────────────────────────────────────────────────

  useEffect(() => {
    if (isRunning) {
      setStepIndex(0);
      setOverlayVisible(false);
      setTooltipVisible(false);
      // Navigate to dashboard first
      if (currentPage !== 'dashboard') {
        onNavigate('dashboard');
      }
      // Fade in overlay
      const t = setTimeout(() => {
        setOverlayVisible(true);
        setTooltipVisible(true);
      }, 50);
      return () => clearTimeout(t);
    } else {
      setOverlayVisible(false);
      setTooltipVisible(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isRunning]);

  // ── On step change: navigate page if needed, then recalc ─────────────────

  useEffect(() => {
    if (!isRunning) return;

    setTooltipVisible(false);

    if (step.page !== currentPage) {
      onNavigate(step.page);
      const t = setTimeout(() => {
        recalcHighlight();
        setTooltipVisible(true);
      }, 550);
      return () => clearTimeout(t);
    } else {
      const t = setTimeout(() => {
        recalcHighlight();
        setTooltipVisible(true);
      }, 150);
      return () => clearTimeout(t);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stepIndex, isRunning]);

  // ── Recalc on page change (after navigation completes) ───────────────────

  useEffect(() => {
    if (!isRunning) return;
    const t = setTimeout(() => recalcHighlight(), 500);
    return () => clearTimeout(t);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentPage]);

  // ── Window resize ─────────────────────────────────────────────────────────

  useEffect(() => {
    if (!isRunning) return;
    const handleResize = () => recalcHighlight();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [isRunning, recalcHighlight]);

  // ── Keyboard support ──────────────────────────────────────────────────────

  useEffect(() => {
    if (!isRunning) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight' || e.key === ' ') {
        e.preventDefault();
        handleNext();
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        handleBack();
      } else if (e.key === 'Escape') {
        handleClose();
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isRunning, stepIndex]);

  // ── Navigation handlers ───────────────────────────────────────────────────

  const handleNext = useCallback(() => {
    if (stepIndex < ALL_STEPS.length - 1) {
      setStepIndex(i => i + 1);
    } else {
      handleFinish();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stepIndex]);

  const handleBack = useCallback(() => {
    if (stepIndex > 0) {
      setStepIndex(i => i - 1);
    }
  }, [stepIndex]);

  const handleClose = useCallback(() => {
    setOverlayVisible(false);
    setTooltipVisible(false);
    setTimeout(() => onClose(), 200);
  }, [onClose]);

  const handleFinish = useCallback(() => {
    setOverlayVisible(false);
    setTooltipVisible(false);
    setTimeout(() => {
      onClose();
      showToast("Tour complete! You're ready to go 🚀", 'success');
    }, 200);
  }, [onClose, showToast]);

  // ── Don't render if not running ───────────────────────────────────────────

  if (!isRunning) return null;

  // ── Compute tooltip position ──────────────────────────────────────────────

  const hasHighlight = highlightRect !== null;
  const tooltipW = getTooltipWidth();
  const tooltipPos = hasHighlight
    ? positionTooltip(highlightRect, step.position)
    : {
        top: window.innerHeight / 2 - TOOLTIP_HEIGHT_ESTIMATE / 2,
        left: window.innerWidth / 2 - tooltipW / 2,
      };

  // Clamp tooltip to viewport
  const clampedLeft = Math.max(
    VIEWPORT_MARGIN,
    Math.min(tooltipPos.left, window.innerWidth - tooltipW - VIEWPORT_MARGIN),
  );
  const clampedTop = Math.max(VIEWPORT_MARGIN, tooltipPos.top);

  const showPageBadge = step.page !== currentPage;
  const progressPct = ((stepIndex + 1) / ALL_STEPS.length) * 100;

  // ── Portal content ────────────────────────────────────────────────────────

  return ReactDOM.createPortal(
    <>
      {/* Layer 1: Dark backdrop */}
      <div
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: 8000,
          background: 'rgba(0,0,0,0)',
          opacity: overlayVisible ? 1 : 0,
          transition: 'opacity 300ms ease',
          pointerEvents: 'none',
        }}
      />

      {/* Layer 2: Spotlight highlight box */}
      {hasHighlight ? (
        <div
          style={{
            position: 'fixed',
            top: highlightRect.top,
            left: highlightRect.left,
            width: highlightRect.width,
            height: highlightRect.height,
            zIndex: 8001,
            borderRadius: 16,
            border: '2px solid var(--blue)',
            boxShadow: [
              '0 0 0 9999px rgba(0,0,0,0.68)',
              '0 0 32px 8px rgba(96,165,250,0.35)',
              'inset 0 0 16px rgba(96,165,250,0.12)',
            ].join(', '),
            transition: [
              'top 350ms cubic-bezier(.22,1,.36,1)',
              'left 350ms cubic-bezier(.22,1,.36,1)',
              'width 350ms cubic-bezier(.22,1,.36,1)',
              'height 350ms cubic-bezier(.22,1,.36,1)',
            ].join(', '),
            pointerEvents: 'none',
          }}
        />
      ) : (
        /* Hidden spotlight (no target found) — still blocks backdrop */
        <div
          style={{
            position: 'fixed',
            top: '50%',
            left: '50%',
            width: 0,
            height: 0,
            zIndex: 8001,
            boxShadow: '0 0 0 9999px rgba(0,0,0,0.68)',
            pointerEvents: 'none',
          }}
        />
      )}

      {/* Layer 3: Tooltip card */}
      <div
        className="glass-panel"
        style={{
          position: 'fixed',
          top: clampedTop,
          left: clampedLeft,
          width: tooltipW,
          padding: window.innerWidth < 420 ? 16 : 24,
          borderRadius: 20,
          zIndex: 8002,
          opacity: tooltipVisible ? 1 : 0,
          transform: tooltipVisible ? 'translateY(0)' : 'translateY(8px)',
          transition: 'opacity 200ms cubic-bezier(.22,1,.36,1), transform 200ms cubic-bezier(.22,1,.36,1)',
          pointerEvents: 'auto',
        }}
      >
        {/* Step counter pill */}
        <div
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            background: 'rgba(96,165,250,0.15)',
            border: '1px solid rgba(96,165,250,0.3)',
            borderRadius: 20,
            padding: '4px 12px',
            fontSize: 11,
            color: 'var(--blue)',
            fontWeight: 600,
            marginBottom: 12,
          }}
        >
          Step {stepIndex + 1} of {ALL_STEPS.length}
        </div>

        {/* Page badge (shown when step is on a different page) */}
        {showPageBadge && (
          <div
            style={{
              fontSize: 10,
              color: 'var(--text-muted)',
              marginBottom: 6,
              textTransform: 'uppercase',
              letterSpacing: '0.08em',
            }}
          >
            {PAGE_LABELS[step.page]}
          </div>
        )}

        {/* Title */}
        <div
          style={{
            fontSize: window.innerWidth < 420 ? 15 : 18,
            fontWeight: 700,
            color: 'var(--text)',
            marginBottom: 10,
            lineHeight: 1.3,
          }}
        >
          {step.title}
        </div>

        {/* Body */}
        <div
          style={{
            fontSize: window.innerWidth < 420 ? 12 : 14,
            color: 'var(--text-secondary)',
            lineHeight: 1.6,
            marginBottom: 20,
          }}
        >
          {step.body}
        </div>

        {/* Progress bar */}
        <div
          style={{
            width: '100%',
            height: 3,
            borderRadius: 2,
            background: 'var(--glass-border)',
            marginBottom: 20,
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              height: '100%',
              width: `${progressPct}%`,
              background: 'linear-gradient(90deg, var(--blue), var(--cyan))',
              borderRadius: 2,
              transition: 'width 350ms cubic-bezier(.22,1,.36,1)',
            }}
          />
        </div>

        {/* Button row */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          {/* Skip */}
          <button
            onClick={handleClose}
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--text-muted)',
              fontSize: 13,
              cursor: 'pointer',
              padding: '4px 0',
            }}
          >
            Skip Tour
          </button>

          {/* Back + Next/Finish */}
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              onClick={handleBack}
              disabled={stepIndex === 0}
              style={{
                background: 'rgba(255,255,255,0.06)',
                border: '1px solid var(--glass-border)',
                color: 'var(--text-secondary)',
                borderRadius: 10,
                padding: '10px 16px',
                fontSize: 14,
                fontWeight: 500,
                cursor: stepIndex === 0 ? 'default' : 'pointer',
                opacity: stepIndex === 0 ? 0.4 : 1,
                transition: 'opacity 150ms',
              }}
            >
              ← Back
            </button>

            <button
              onClick={isLastStep ? handleFinish : handleNext}
              style={{
                background: 'linear-gradient(135deg, var(--blue), var(--cyan))',
                border: 'none',
                color: '#fff',
                borderRadius: 10,
                padding: '10px 20px',
                fontSize: 14,
                fontWeight: 600,
                cursor: 'pointer',
                boxShadow: '0 4px 16px rgba(96,165,250,0.35)',
                transition: 'transform 100ms',
              }}
              onMouseDown={e => (e.currentTarget.style.transform = 'scale(0.97)')}
              onMouseUp={e => (e.currentTarget.style.transform = 'scale(1)')}
              onMouseLeave={e => (e.currentTarget.style.transform = 'scale(1)')}
            >
              {isLastStep ? 'Finish 🎉' : 'Next →'}
            </button>
          </div>
        </div>
      </div>
    </>,
    document.body,
  );
}
