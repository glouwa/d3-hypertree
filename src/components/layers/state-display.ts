// How a layer shows the interaction state of a node (phase 2 step 8). The state
// itself (n.hovered, n.selected and the paths to them) is set by the interaction;
// a layer option 'hover' / 'selection' only decides what is highlighted:
//   'path'  the node and all its ancestors (the path to the root)
//   'node'  the node itself
//   false   nothing (also 'none')
// true counts as the layer's default.

export type StateDisplay = 'path' | 'node' | 'none' | boolean

export function showsState(mode:StateDisplay, d, kind:'hover' | 'selection', defaultMode:'path' | 'node' = 'path') : boolean {
    if (mode === false || mode === 'none' || !d) return false
    const m = (mode === undefined || mode === true) ? defaultMode : mode
    if (m === 'node')
        return !!(kind === 'hover' ? d.hovered : d.selected)
    return !!(d.pathes && (kind === 'hover' ? d.pathes.isPartOfAnyHoverPath : d.pathes.isPartOfAnySelectionPath))
}
