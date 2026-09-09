import { computed, onMounted, onUnmounted, ref, type Ref } from 'vue'

const STORAGE_KEY = 'vulcan.layout.panels'
export const SPLITTER_PX = 6
export const MIN_LEFT = 160
export const MIN_MID = 320
export const MIN_RIGHT = 200
export const MIN_ATTR = 120
export const MIN_REF = 120
export const MIN_LOG = 80
export const MIN_MAIN = 180
const DEFAULT_LEFT = 260
const DEFAULT_RIGHT = 280
const DEFAULT_ATTR = 260
const DEFAULT_LOG = 148

export type DragKind = 'left' | 'right' | 'attr' | 'log'

interface StoredLayout {
  leftPx: number
  rightPx: number
  attrPx: number
  logPx: number
}

function asNumber(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback
}

function loadStored(): StoredLayout {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) {
      return {
        leftPx: DEFAULT_LEFT,
        rightPx: DEFAULT_RIGHT,
        attrPx: DEFAULT_ATTR,
        logPx: DEFAULT_LOG,
      }
    }
    const parsed = JSON.parse(raw) as Record<string, unknown>
    return {
      leftPx: asNumber(parsed.leftPx, DEFAULT_LEFT),
      rightPx: asNumber(parsed.rightPx, DEFAULT_RIGHT),
      attrPx: asNumber(parsed.attrPx, DEFAULT_ATTR),
      logPx: asNumber(parsed.logPx, DEFAULT_LOG),
    }
  } catch {
    return {
      leftPx: DEFAULT_LEFT,
      rightPx: DEFAULT_RIGHT,
      attrPx: DEFAULT_ATTR,
      logPx: DEFAULT_LOG,
    }
  }
}

export function clampColumns(
  leftPx: number,
  rightPx: number,
  totalWidth: number,
): { leftPx: number; rightPx: number } {
  const usable = Math.max(totalWidth - SPLITTER_PX * 2, MIN_LEFT + MIN_MID + MIN_RIGHT)
  let left = leftPx
  let right = rightPx
  const maxLeft = usable - MIN_MID - MIN_RIGHT
  const maxRight = usable - MIN_MID - MIN_LEFT
  left = Math.min(Math.max(left, MIN_LEFT), Math.max(MIN_LEFT, maxLeft))
  right = Math.min(Math.max(right, MIN_RIGHT), Math.max(MIN_RIGHT, maxRight))
  if (left + right + MIN_MID > usable) {
    right = Math.max(MIN_RIGHT, usable - left - MIN_MID)
  }
  if (left + right + MIN_MID > usable) {
    left = Math.max(MIN_LEFT, usable - right - MIN_MID)
  }
  return { leftPx: left, rightPx: right }
}

/** 把 first 限制在 [minFirst, total - splitter - minSecond] */
export function clampFirstPane(
  firstPx: number,
  total: number,
  minFirst: number,
  minSecond: number,
): number {
  const usable = Math.max(total - SPLITTER_PX, minFirst + minSecond)
  const maxFirst = usable - minSecond
  return Math.min(Math.max(firstPx, minFirst), Math.max(minFirst, maxFirst))
}

function isColumnDrag(kind: DragKind): boolean {
  return kind === 'left' || kind === 'right'
}

function bodyClassFor(kind: DragKind): string {
  return isColumnDrag(kind) ? 'is-col-resizing' : 'is-row-resizing'
}

export function usePanelLayout(
  mainEl: Ref<HTMLElement | null>,
  rightEl: Ref<HTMLElement | null>,
  shellEl: Ref<HTMLElement | null>,
) {
  const stored = loadStored()
  const leftPx = ref(stored.leftPx)
  const rightPx = ref(stored.rightPx)
  const attrPx = ref(stored.attrPx)
  const logPx = ref(stored.logPx)
  const dragging = ref<DragKind | null>(null)

  const columnTemplate = computed(
    () =>
      `${leftPx.value}px ${SPLITTER_PX}px minmax(${MIN_MID}px, 1fr) ${SPLITTER_PX}px ${rightPx.value}px`,
  )

  const attrTemplate = computed(
    () => `${attrPx.value}px ${SPLITTER_PX}px minmax(${MIN_REF}px, 1fr)`,
  )

  const shellTemplate = computed(
    () => `auto minmax(${MIN_MAIN}px, 1fr) ${SPLITTER_PX}px ${logPx.value}px`,
  )

  function applyColumns(nextLeft: number, nextRight: number): void {
    const total = mainEl.value?.clientWidth ?? 960
    const clamped = clampColumns(nextLeft, nextRight, total)
    leftPx.value = clamped.leftPx
    rightPx.value = clamped.rightPx
  }

  function applyAttr(nextAttr: number): void {
    const total = rightEl.value?.clientHeight ?? 480
    attrPx.value = clampFirstPane(nextAttr, total, MIN_ATTR, MIN_REF)
  }

  function applyLog(nextLog: number): void {
    const shell = shellEl.value
    const header = shell?.firstElementChild as HTMLElement | null
    const headerH = header?.offsetHeight ?? 48
    const total = (shell?.clientHeight ?? 720) - headerH
    logPx.value = clampFirstPane(nextLog, total, MIN_LOG, MIN_MAIN)
  }

  function persist(): void {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        leftPx: leftPx.value,
        rightPx: rightPx.value,
        attrPx: attrPx.value,
        logPx: logPx.value,
      }),
    )
  }

  function startDrag(which: DragKind, event: PointerEvent): void {
    if (event.button !== 0) {
      return
    }
    dragging.value = which
    const target = event.currentTarget as HTMLElement
    target.setPointerCapture(event.pointerId)
    document.body.classList.add(bodyClassFor(which))
  }

  function onPointerMove(event: PointerEvent): void {
    const kind = dragging.value
    if (!kind) {
      return
    }

    if (kind === 'left' || kind === 'right') {
      if (!mainEl.value) {
        return
      }
      const rect = mainEl.value.getBoundingClientRect()
      if (kind === 'left') {
        applyColumns(event.clientX - rect.left, rightPx.value)
      } else {
        applyColumns(leftPx.value, rect.right - event.clientX)
      }
      return
    }

    if (kind === 'attr') {
      if (!rightEl.value) {
        return
      }
      const rect = rightEl.value.getBoundingClientRect()
      applyAttr(event.clientY - rect.top)
      return
    }

    if (!shellEl.value) {
      return
    }
    const rect = shellEl.value.getBoundingClientRect()
    applyLog(rect.bottom - event.clientY)
  }

  function onPointerUp(): void {
    if (!dragging.value) {
      return
    }
    document.body.classList.remove('is-col-resizing', 'is-row-resizing')
    dragging.value = null
    persist()
  }

  function onWindowResize(): void {
    applyColumns(leftPx.value, rightPx.value)
    applyAttr(attrPx.value)
    applyLog(logPx.value)
  }

  onMounted(() => {
    applyColumns(leftPx.value, rightPx.value)
    applyAttr(attrPx.value)
    applyLog(logPx.value)
    window.addEventListener('pointermove', onPointerMove)
    window.addEventListener('pointerup', onPointerUp)
    window.addEventListener('pointercancel', onPointerUp)
    window.addEventListener('resize', onWindowResize)
  })

  onUnmounted(() => {
    window.removeEventListener('pointermove', onPointerMove)
    window.removeEventListener('pointerup', onPointerUp)
    window.removeEventListener('pointercancel', onPointerUp)
    window.removeEventListener('resize', onWindowResize)
    document.body.classList.remove('is-col-resizing', 'is-row-resizing')
  })

  return {
    dragging,
    columnTemplate,
    attrTemplate,
    shellTemplate,
    startDrag,
  }
}
