import { useState } from 'react';
import type {
  GraphNode,
  MethodSignature,
  FieldInfo,
  EnumInfo,
  MessageDef,
} from '@/types/graph';

interface DetailPanelProps {
  node: GraphNode | null;
  onClose: () => void;
}

export function DetailPanel({ node, onClose }: DetailPanelProps) {
  if (!node) return null;

  return (
    <div className="detail-panel">
      <div className="panel-header">
        <h2>{node.label}</h2>
        <button className="close-button" onClick={onClose} aria-label="Close">
          ×
        </button>
      </div>
      <div className="panel-content">
        <div className="panel-meta">
          <span className="file-path">{node.file}</span>
          <span className="package-name">{node.package}</span>
        </div>

        {node.details.kind === 'Service' && (
          <ServiceDetails
            methods={node.details.methods}
            messages={node.details.messages}
          />
        )}

        {node.details.kind === 'Message' && (
          <MessageDetails
            fields={node.details.fields}
            enums={node.details.enums}
          />
        )}

        {node.details.kind === 'External' && (
          <div className="detail-section">
            <p className="external-note">External library - no additional details</p>
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

  const renderTypeLink = (typeName: string) => {
    const messageDef = findMessage(typeName);
    const isExpanded = expandedTypes.has(typeName);

    if (messageDef) {
      return (
        <button
          type="button"
          className={`type-link ${isExpanded ? 'expanded' : ''}`}
          onClick={() => toggleType(typeName)}
        >
          {typeName}
          <span className="expand-icon">{isExpanded ? '▼' : '▶'}</span>
        </button>
      );
    }
    return <span className="type-name-external">{typeName}</span>;
  };

  const renderExpandedFields = (typeName: string) => {
    if (!expandedTypes.has(typeName)) return null;
    const messageDef = findMessage(typeName);
    if (!messageDef) return null;

    return (
      <div className="expanded-fields">
        <table className="field-table compact">
          <thead>
            <tr>
              <th>#</th>
              <th>Name</th>
              <th>Type</th>
            </tr>
          </thead>
          <tbody>
            {messageDef.fields.map((f) => (
              <tr key={`${f.number}-${f.name}`}>
                <td className="field-number">{f.number}</td>
                <td className="field-name">{f.name}</td>
                <td className="field-type">{f.typeName}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  };

  return (
    <div className="detail-section">
      <h3>⚡ RPC Methods ({methods.length})</h3>
      {methods.length === 0 ? (
        <p className="empty-note">No methods defined</p>
      ) : (
        <ul className="method-list">
          {methods.map((m) => (
            <li key={m.name} className="method-item">
              <div className="method-header">
                <span className="method-name">{m.name}</span>
                <span className="method-sig">
                  ({renderTypeLink(m.inputType)}) → {renderTypeLink(m.outputType)}
                </span>
              </div>
              {renderExpandedFields(m.inputType)}
              {renderExpandedFields(m.outputType)}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function MessageDetails({
  fields,
  enums,
}: {
  fields: FieldInfo[];
  enums: EnumInfo[];
}) {
  return (
    <>
      <div className="detail-section">
        <h3>📦 Fields ({fields.length})</h3>
        {fields.length === 0 ? (
          <p className="empty-note">No fields defined</p>
        ) : (
          <table className="field-table">
            <thead>
              <tr>
                <th>#</th>
                <th>Name</th>
                <th>Type</th>
              </tr>
            </thead>
            <tbody>
              {fields.map((f) => (
                <tr key={`${f.number}-${f.name}`}>
                  <td className="field-number">{f.number}</td>
                  <td className="field-name">{f.name}</td>
                  <td className={`field-type ${f.label}`}>{f.typeName}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {enums.length > 0 && (
        <div className="detail-section">
          <h3>📋 Enums ({enums.length})</h3>
          {enums.map((e) => (
            <div key={e.name} className="enum-block">
              <h4>{e.name}</h4>
              <ul className="enum-values">
                {e.values.map((v) => (
                  <li key={v.number}>
                    <span className="enum-value-name">{v.name}</span>
                    <span className="enum-value-number"> = {v.number}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}
    </>
  );
}
