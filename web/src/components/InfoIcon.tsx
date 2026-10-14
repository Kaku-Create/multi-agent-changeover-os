import React from 'react';
import { createPortal } from 'react-dom';
import { glossary, type HelpKey } from '../lib/dataGlossary';
import { useHelpLevel, useDynamicHelp } from '../lib/helpContext';

const POP_WIDTH = 320;
const POP_MAX_HEIGHT = 360;
const GAP = 8;
const VIEWPORT_MARGIN = 8;

type AnchorRect = { top: number; bottom: number; left: number; right: number; width: number };

export function InfoIcon({
  helpKey,
  inline = false,
}: {
  helpKey: HelpKey;
  inline?: boolean;
}) {
  const level = useHelpLevel();
  const entry = glossary[helpKey];
  const text = level === 'brief' ? entry.brief : entry.detailed;
  const getDynamic = useDynamicHelp();
  const dynamic = getDynamic(helpKey);

  const triggerRef = React.useRef<HTMLSpanElement>(null);
  const popRef = React.useRef<HTMLDivElement>(null);
  const [anchor, setAnchor] = React.useState<AnchorRect | null>(null);
  const [pinned, setPinned] = React.useState(false);
  const closeTimer = React.useRef<number | null>(null);

  const open = pinned || anchor !== null;

  const measure = React.useCallback(() => {
    const el = triggerRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    setAnchor((a) =>
      a &&
      Math.abs(a.top - r.top) < 1 &&
      Math.abs(a.left - r.left) < 1 &&
      Math.abs(a.width - r.width) < 1
        ? a
        : {
            top: r.top,
            bottom: r.bottom,
            left: r.left,
            right: r.right,
            width: r.width,
          }
    );
  }, []);

  const cancelClose = React.useCallback(() => {
    if (closeTimer.current !== null) {
      window.clearTimeout(closeTimer.current);
      closeTimer.current = null;
    }
  }, []);

  const scheduleClose = React.useCallback(() => {
    cancelClose();
    closeTimer.current = window.setTimeout(() => {
      setAnchor(null);
      closeTimer.current = null;
    }, 120);
  }, [cancelClose]);

  React.useEffect(() => {
    if (!open) return;
    measure();
    const onResize = () => measure();
    const onScroll = () => measure();
    window.addEventListener('resize', onResize);
    window.addEventListener('scroll', onScroll, true);
    return () => {
      window.removeEventListener('resize', onResize);
      window.removeEventListener('scroll', onScroll, true);
    };
  }, [open, measure]);

  React.useEffect(() => {
    if (!pinned) return;
    const onDocDown = (e: MouseEvent) => {
      const t = e.target as Node;
      if (triggerRef.current?.contains(t)) return;
      if (popRef.current?.contains(t)) return;
      setPinned(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setPinned(false);
    };
    document.addEventListener('mousedown', onDocDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDocDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [pinned]);

  React.useEffect(() => {
    return () => {
      if (closeTimer.current !== null) {
        window.clearTimeout(closeTimer.current);
      }
    };
  }, []);

  const place = React.useMemo(() => {
    if (!anchor) return null;
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    let top = anchor.bottom + GAP;
    let left = anchor.left + anchor.width / 2 - POP_WIDTH / 2;
    if (left < VIEWPORT_MARGIN) left = VIEWPORT_MARGIN;
    if (left + POP_WIDTH > vw - VIEWPORT_MARGIN) left = vw - VIEWPORT_MARGIN - POP_WIDTH;
    const flip = top + POP_MAX_HEIGHT > vh - VIEWPORT_MARGIN;
    if (flip) top = Math.max(VIEWPORT_MARGIN, anchor.top - POP_MAX_HEIGHT - GAP);
    const placement = flip ? 'top' : 'bottom';
    const arrowLeft = Math.max(
      VIEWPORT_MARGIN + 12,
      Math.min(anchor.left + anchor.width / 2 - left, POP_WIDTH - 12)
    );
    return { top, left, placement, arrowLeft };
  }, [anchor]);

  const onTriggerEnter = () => {
    cancelClose();
    measure();
  };
  const onTriggerLeave = () => {
    if (!pinned) scheduleClose();
  };
  const onPopEnter = () => {
    cancelClose();
  };
  const onPopLeave = () => {
    if (!pinned) scheduleClose();
  };

  return (
    <span
      ref={triggerRef}
      className="info-wrap"
      style={inline ? { display: 'inline-flex', verticalAlign: 'middle' } : undefined}
      onMouseEnter={onTriggerEnter}
      onMouseLeave={onTriggerLeave}
    >
      <button
        type="button"
        className="info-btn"
        aria-label={`${helpKey} 说明`}
        aria-expanded={open}
        onClick={(e) => {
          e.stopPropagation();
          setPinned((p) => !p);
          if (!pinned) measure();
        }}
      >
        ⓘ
      </button>

      {open && place && createPortal(
        <div
          ref={popRef}
          data-info-popover={helpKey}
          className={`info-pop info-pop--${place.placement}`}
          style={{
            position: 'fixed',
            top: place.top,
            left: place.left,
            width: POP_WIDTH,
            maxHeight: POP_MAX_HEIGHT,
            zIndex: 2147483600,
            pointerEvents: 'auto',
          }}
          onMouseEnter={onPopEnter}
          onMouseLeave={onPopLeave}
        >
          <span className="info-pop-arrow" style={{ left: place.arrowLeft }} />
          <div className="info-pop-head">
            <span className="info-pop-key">{helpKey}</span>
            <span className={`info-pop-level info-pop-level--${level}`}>
              {level === 'brief' ? '简略' : '详细'}
            </span>
          </div>
          <div className="info-pop-body">{text}</div>
          {dynamic && (
            <div className="info-pop-live">
              <span className="info-pop-live-dot" />
              <span className="info-pop-live-label">实时</span>
              <span className="info-pop-live-text">{dynamic}</span>
            </div>
          )}
          {entry.related && entry.related.length > 0 && (
            <div className="info-pop-related">
              <span className="info-pop-related-label">相关：</span>
              {entry.related.map((k) => (
                <span className="info-pop-related-tag" key={k}>{k}</span>
              ))}
            </div>
          )}
        </div>,
        document.body
      )}
    </span>
  );
}

