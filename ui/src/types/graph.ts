export type NodeType = 'service' | 'message' | 'external';

export interface MethodSignature {
  name: string;
  inputType: string;
  outputType: string;
}

export interface FieldInfo {
  name: string;
  number: number;
  typeName: string;
  label: string;
}

export interface EnumValue {
  name: string;
  number: number;
}

export interface EnumInfo {
  name: string;
  values: EnumValue[];
}

export interface MessageDef {
  name: string;
  fields: FieldInfo[];
}

export type NodeDetails =
  | { kind: 'Service'; methods: MethodSignature[]; messages: MessageDef[] }
  | { kind: 'Message'; fields: FieldInfo[]; enums: EnumInfo[] }
  | { kind: 'External' };

export interface GraphNode {
  id: string;
  type: NodeType;
  package: string;
  label: string;
  file: string;
  details: NodeDetails;
}

export interface GraphEdge {
  source: string;
  target: string;
}

export interface Package {
  id: string;
  label: string;
  nodeIds: string[];
}

export interface GraphData {
  nodes: GraphNode[];
  edges: GraphEdge[];
  packages: Package[];
}

export interface NodeData extends Record<string, unknown> {
  label: string;
  file: string;
  package: string;
  nodeType: NodeType;
  details: NodeDetails;
}
