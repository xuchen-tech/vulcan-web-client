import { NodeClass } from '@wsopcua/wsopcua/data-model'

import type { OpcNodeClass } from '@/opcua/types'

const NODE_CLASS_LABEL: Record<number, string> = {
  [NodeClass.Object]: 'Object',
  [NodeClass.Variable]: 'Variable',
  [NodeClass.Method]: 'Method',
  [NodeClass.ObjectType]: 'ObjectType',
  [NodeClass.VariableType]: 'VariableType',
  [NodeClass.ReferenceType]: 'ReferenceType',
  [NodeClass.DataType]: 'DataType',
  [NodeClass.View]: 'View',
}

/** 树节点左侧符号（无需外部图标库） */
const NODE_CLASS_ICON: Record<number, string> = {
  [NodeClass.Object]: '◆',
  [NodeClass.Variable]: '●',
  [NodeClass.Method]: 'ƒ',
  [NodeClass.ObjectType]: '◇',
  [NodeClass.VariableType]: '○',
  [NodeClass.ReferenceType]: '↔',
  [NodeClass.DataType]: 'T',
  [NodeClass.View]: '▣',
}

export function nodeClassLabel(nodeClass: OpcNodeClass): string {
  return NODE_CLASS_LABEL[nodeClass] ?? `Class(${nodeClass})`
}

export function nodeClassIcon(nodeClass: OpcNodeClass): string {
  return NODE_CLASS_ICON[nodeClass] ?? '·'
}
