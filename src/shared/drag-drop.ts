export const OPCUA_NODE_DRAG_TYPE = 'application/x-vulcan-opcua-node'

export interface DraggedOpcNode {
  nodeId: string
  displayName: string
}

export function encodeDraggedNode(node: DraggedOpcNode): string {
  return JSON.stringify(node)
}

export function decodeDraggedNode(raw: string): DraggedOpcNode | null {
  if (!raw) {
    return null
  }

  try {
    const parsed = JSON.parse(raw) as DraggedOpcNode
    if (typeof parsed.nodeId === 'string' && parsed.nodeId.length > 0) {
      return {
        nodeId: parsed.nodeId,
        displayName:
          typeof parsed.displayName === 'string' ? parsed.displayName : parsed.nodeId,
      }
    }
  } catch {
    /* ignore malformed payload */
  }

  return null
}
