import { useEffect, useCallback, useRef, useState } from 'react';
import type {
  GraphNode,
  MethodSignature,
  FieldInfo,
  EnumValue,
  MessageDef,
} from '@/types/graph';
import { useIsMobile } from '@/hooks/useIsMobile';
import { useSwipeToClose } from '@/hooks/useSwipeToClose';
import {
  MIN_PANEL_WIDTH,
  MAX_WIDTH_RATIO,
  DEFAULT_PANEL_WIDTH,
  SWIPE_THRESHOLD,
} from '@/constants/layout';

interface DetailPanelProps {
  node: GraphNode | null;
  onClose: () => void;
}

export function DetailPanel({ node, onClose }: DetailPanelProps) {
  const [panelWidth, setPanelWidth] = useState(DEFAULT_PANEL_WIDTH);
  const [isDragging, setIsDragging] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const dragHandleRef = useRef<HTMLDivElement>(null);
  const isMobile = useIsMobile();
  const { handleTouchStart, handleTouchEnd } = useSwipeToClose(onClose, SWIPE_THRESHOLD);

  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    e.preventDefault();
    setIsDragging(true);
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  }, []);

  useEffect(() => {
    if (!isDragging) return;

    const handlePointerMove = (e: PointerEvent) => {
      const maxWidth = window.innerWidth * MAX_WIDTH_RATIO;
      const newWidth = window.innerWidth - e.clientX;
      setPanelWidth(Math.max(MIN_PANEL_WIDTH, Math.min(maxWidth, newWidth)));
    };

    const handlePointerUp = (e: PointerEvent) => {
      if (dragHandleRef.current?.hasPointerCapture(e.pointerId)) {
        dragHandleRef.current.releasePointerCapture(e.pointerId);
      }
      setIsDragging(false);
    };

    document.addEventListener('pointermove', handlePointerMove);
    document.addEventListener('pointerup', handlePointerUp);
    document.addEventListener('pointercancel', handlePointerUp);

    return () => {
      document.removeEventListener('pointermove', handlePointerMove);
      document.removeEventListener('pointerup', handlePointerUp);
      document.removeEventListener('pointercancel', handlePointerUp);
    };
  }, [isDragging]);

  if (!node) return null;

  return (
    <div
      ref={panelRef}
      role="region"
      aria-label={`${node.label} details`}
      data-node-type={node.type}
      className={`
        detail-panel workbench-panel custom-scrollbar
        absolute z-[100] overflow-y-auto
        right-0 top-0 h-full min-w-[280px] max-w-[80vw]
        border-l animate-slide-in-right

        max-sm:fixed max-sm:inset-x-0 max-sm:top-auto max-sm:bottom-0
        max-sm:h-[70vh] max-sm:max-h-[70vh] max-sm:w-full max-sm:min-w-full max-sm:max-w-full
        max-sm:border-l-0 max-sm:border-t max-sm:rounded-t-2xl
        max-sm:animate-slide-in-up

        ${isDragging ? 'select-none' : ''}
      `}
      style={!isMobile ? { width: panelWidth } : undefined}
    >
      {/* Mobile drag handle indicator */}
      {isMobile && (
        <div className="flex justify-center pt-3 pb-1" onTouchStart={handleTouchStart} onTouchEnd={handleTouchEnd}>
          <div className="w-10 h-1 bg-white/30 rounded-full" />
        </div>
      )}

      {/* Desktop resize handle */}
      {!isMobile && (
        <div
          ref={dragHandleRef}
          className={`
            absolute left-0 top-0 w-1 h-full cursor-ew-resize
            bg-neon-cyan/30 hover:bg-neon-cyan/60
            transition-colors duration-200 touch-none
            ${isDragging ? 'bg-neon-cyan/80' : ''}
          `}
          onPointerDown={handlePointerDown}
        />
      )}

      {/* Header */}
      <div className="panel-header flex items-center justify-between p-3 sm:p-4 border-b sticky top-0 z-10">
        <div className="min-w-0 pr-2">
          <p className="panel-eyebrow">{node.type} details</p>
          <h2 className="text-base font-semibold break-all">{node.label}</h2>
        </div>
        <button
          className="panel-close min-h-[44px] min-w-[44px] flex items-center justify-center
                     text-xl sm:text-2xl text-text-secondary hover:text-white
                     bg-transparent hover:bg-white/10 rounded-lg
                     transition-colors duration-200 touch-manipulation"
          onClick={onClose}
          aria-label="Close details"
        >
          ×
        </button>
      </div>

      {/* Content */}
      <div className="p-3 sm:p-4 space-y-5 min-w-0">
        {/* Meta info */}
        <div className="flex flex-col gap-1 text-xs sm:text-sm">
          <span className="text-text-secondary break-all font-mono">{node.file}</span>
          <span className="text-text-secondary break-all font-mono">{node.package || 'default package'}</span>
        </div>

        {node.details.kind === 'Service' && (
          <ServiceDetails
            key={node.id}
            methods={node.details.methods}
            messages={node.details.messages}
          />
        )}

        {node.details.kind === 'Message' && (
          <MessageDetails fields={node.details.fields} />
        )}

        {node.details.kind === 'Enum' && (
          <EnumDetails values={node.details.values} />
        )}

        {node.details.kind === 'External' && (
          <div className="py-4">
            <p className="text-text-secondary text-sm italic">External library - no additional details</p>
          </div>
        )}
      </div>
    </div>
  );
}

function ServiceDetails({
  methods,
  messages,
}: {
  methods: MethodSignature[];
  messages: MessageDef[];
}) {
  const [expandedTypes, setExpandedTypes] = useState<Set<string>>(new Set());

  const toggleType = (typeName: string) => {
    setExpandedTypes((prev) => {
      const next = new Set(prev);
      if (next.has(typeName)) {
        next.delete(typeName);
      } else {
        next.add(typeName);
      }
      return next;
    });
  };

  const findMessage = (typeName: string): MessageDef | undefined => {
    return messages.find((m) => m.name === typeName);
  };

  return (
    <div className="space-y-3">
      <h3 className="text-sm sm:text-base font-semibold text-neon-magenta flex items-center gap-2">
        <span>RPC Methods ({methods.length})</span>
      </h3>
      {methods.length === 0 ? (
        <p className="text-text-secondary text-sm italic">No methods defined</p>
      ) : (
        <ul className="space-y-3">
          {methods.map((m) => (
            <MethodItem
              key={m.name}
              method={m}
              expandedTypes={expandedTypes}
              onToggleType={toggleType}
              findMessage={findMessage}
            />
          ))}
        </ul>
      )}
    </div>
  );
}

interface MethodItemProps {
  method: MethodSignature;
  expandedTypes: Set<string>;
  onToggleType: (typeName: string) => void;
  findMessage: (typeName: string) => MessageDef | undefined;
}

function MethodItem({ method, expandedTypes, onToggleType, findMessage }: MethodItemProps) {
  const renderTypeLink = (typeName: string) => {
    const messageDef = findMessage(typeName);
    const isExpanded = expandedTypes.has(typeName);

    if (messageDef) {
      return (
        <button
          type="button"
          className={`
            type-link inline-flex items-center gap-1 px-1.5 py-0.5 rounded
            text-neon-cyan hover:text-white hover:bg-neon-cyan/20
            transition-colors duration-200 text-xs sm:text-sm
            min-h-[32px] sm:min-h-0 touch-manipulation
            ${isExpanded ? 'bg-neon-cyan/10' : ''}
          `}
          aria-expanded={isExpanded}
          onClick={() => onToggleType(typeName)}
        >
          {typeName}
          <span className="text-[0.65rem] sm:text-xs opacity-70">{isExpanded ? '▼' : '▶'}</span>
        </button>
      );
    }
    return <span className="text-text-secondary text-xs sm:text-sm break-all">{typeName}</span>;
  };

  return (
    <li className="rpc-method p-2 sm:p-3 bg-bg-dark rounded-lg border border-border-subtle min-w-0">
      <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-2">
        <span className="font-semibold text-white text-sm break-all">{method.name}</span>
        <span className="text-xs sm:text-sm text-text-secondary flex items-center flex-wrap gap-1 min-w-0 break-all">
          <span>(</span>
          {renderTypeLink(method.inputType)}
          <span>)</span>
          <span className="mx-1">→</span>
          {renderTypeLink(method.outputType)}
        </span>
      </div>
      <ExpandedFieldsTable typeName={method.inputType} expandedTypes={expandedTypes} findMessage={findMessage} />
      {method.outputType !== method.inputType && (
        <ExpandedFieldsTable typeName={method.outputType} expandedTypes={expandedTypes} findMessage={findMessage} />
      )}
    </li>
  );
}

interface ExpandedFieldsTableProps {
  typeName: string;
  expandedTypes: Set<string>;
  findMessage: (typeName: string) => MessageDef | undefined;
}

function ExpandedFieldsTable({ typeName, expandedTypes, findMessage }: ExpandedFieldsTableProps) {
  if (!expandedTypes.has(typeName)) return null;
  const messageDef = findMessage(typeName);
  if (!messageDef) return null;

  return (
    <div className="mt-2 ml-2 sm:ml-4 p-2 bg-white/5 rounded-lg border border-white/10 animate-slide-down overflow-x-auto">
      <table className="w-full text-xs sm:text-sm">
        <caption className="text-left text-neon-cyan mb-2 break-all">{typeName}</caption>
        <thead>
          <tr className="text-text-secondary text-left">
            <th className="p-1 sm:p-1.5 w-8">#</th>
            <th className="p-1 sm:p-1.5">Name</th>
            <th className="p-1 sm:p-1.5">Type</th>
          </tr>
        </thead>
        <tbody>
          {messageDef.fields.map((f) => (
            <tr key={`${f.number}-${f.name}`} className="border-t border-white/5">
              <td className="p-1 sm:p-1.5 text-text-secondary font-mono">{f.number}</td>
              <td className="p-1 sm:p-1.5 text-white font-medium">{f.name}</td>
              <td className="p-1 sm:p-1.5 text-neon-cyan/80 font-mono">{f.label === 'repeated' ? 'repeated ' : ''}{f.typeName}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function MessageDetails({ fields }: { fields: FieldInfo[] }) {
  return (
    <div className="space-y-3">
      <h3 className="text-sm sm:text-base font-semibold text-neon-cyan flex items-center gap-2">
        <span>Fields ({fields.length})</span>
      </h3>
      {fields.length === 0 ? (
        <p className="text-text-secondary text-sm italic">No fields defined</p>
      ) : (
        <div className="table-scroll overflow-x-auto max-w-full">
          <table className="w-full text-xs sm:text-sm min-w-[250px]">
            <thead>
              <tr className="text-text-secondary text-left border-b border-white/20">
                <th className="p-2 w-10">#</th>
                <th className="p-2">Name</th>
                <th className="p-2">Type</th>
              </tr>
            </thead>
            <tbody>
              {fields.map((f) => (
                <tr key={`${f.number}-${f.name}`} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                  <td className="p-2 text-text-secondary font-mono">{f.number}</td>
                  <td className="p-2 text-white font-medium">{f.name}</td>
                  <td className={`p-2 font-mono ${f.label === 'repeated' ? 'text-neon-yellow' : 'text-neon-cyan/80'}`}>
                    {f.label === 'repeated' ? 'repeated ' : ''}{f.typeName}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function EnumDetails({ values }: { values: EnumValue[] }) {
  return (
    <div className="space-y-3">
      <h3 className="text-sm sm:text-base font-semibold text-neon-yellow flex items-center gap-2">
        <span>Values ({values.length})</span>
      </h3>
      {values.length === 0 ? (
        <p className="text-text-secondary text-sm italic">No values defined</p>
      ) : (
        <ul className="space-y-1">
          {values.map((v) => (
            <li key={v.name} className="flex items-start justify-between gap-3 p-2 hover:bg-white/5 rounded transition-colors">
              <span className="text-white text-sm font-mono break-all min-w-0">{v.name}</span>
              <span className="text-text-secondary text-xs sm:text-sm font-mono shrink-0">= {v.number}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
