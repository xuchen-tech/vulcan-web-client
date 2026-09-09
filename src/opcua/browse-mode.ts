/** 纯函数：NodeId 规范化与浏览模式（便于 Vitest） */

export type BrowseMode = 'hierarchical' | 'all'

export const ROOT_FOLDER_NODE_ID = 'i=84'
export const OBJECTS_FOLDER_NODE_ID = 'i=85'

export function normalizeNodeId(id: string): string {
  const trimmed = id.trim()
  const numeric = /^(?:ns=(\d+);)?i=(\d+)$/i.exec(trimmed)
  if (numeric) {
    const ns = numeric[1] ?? '0'
    const ident = numeric[2]
    return ns === '0' ? `i=${ident}` : `ns=${ns};i=${ident}`
  }
  return trimmed
}

export function nodeIdsEqual(a: string, b: string): boolean {
  return normalizeNodeId(a) === normalizeNodeId(b)
}

export function pickPreferredParentNodeId(parentIds: string[]): string | null {
  if (parentIds.length === 0) {
    return null
  }
  const objects = parentIds.find((id) => nodeIdsEqual(id, OBJECTS_FOLDER_NODE_ID))
  if (objects) {
    return objects
  }
  const root = parentIds.find((id) => nodeIdsEqual(id, ROOT_FOLDER_NODE_ID))
  if (root) {
    return root
  }
  return parentIds[0]
}
