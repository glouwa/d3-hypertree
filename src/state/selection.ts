// The selection and the paths (objects.selections, objects.pathes): the node state
// n.selected / n.hovered and the path flags the layers show (n.pathes.*).
//
// Selection goes through the strategy interaction.selection ('none', 'single',
// 'multi' with interaction.maxSelections); it keeps objects.selections and the node
// state n.selected in sync and fires onNodeSelect for every change.

import { N }                      from '../data/n'
import { Path }                   from './path'
import { HypertreeArgs }          from '../config/schema'
import { stringhash, googlePalette } from '../util/ducd'

/** What the selection needs of the hypertree. */
export interface SelectionHost {
    args: HypertreeArgs
    data: N
    update: { pathes: ()=> void }
}

const pathId = (pathType:string, n:N)=> `btn-path-${pathType}` + (pathType === 'SelectionPath' ? `-${n.mergeId}` : '')

function addIfNotIn<T>(arr:T[], newE:T, side:'unshift' | 'push') : T[] {
    if (!arr) return [newE]
    if (!arr.includes(newE)) arr[side](newE)
    return arr
}

/** Selects or deselects n according to interaction.selection, then redraws. */
export function select(ht:SelectionHost, n:N, selected:boolean) {
    const mode = ht.args.interaction.selection
    if (!n || mode === 'none') return
    if (selected === ht.args.objects.selections.includes(n)) return
    if (selected) {
        if (mode === 'single')
            for (const s of [...ht.args.objects.selections]) setSelected(ht, s, false)
        setSelected(ht, n, true)
        const max = ht.args.interaction.maxSelections
        while (mode === 'multi' && ht.args.objects.selections.length > max)
            setSelected(ht, ht.args.objects.selections[0], false)   // the oldest
    }
    else
        setSelected(ht, n, false)
    ht.update.pathes()
}

/** The single place that changes the selection state of a node. */
export function setSelected(ht:SelectionHost, n:N, selected:boolean) {
    const selections = ht.args.objects.selections
    if (selected === selections.includes(n)) return
    if (selected) {
        selections.push(n)
        addPath(ht, 'SelectionPath', n)
    }
    else {
        ht.args.objects.selections = selections.filter(e=> e !== n)
        removePath(ht, 'SelectionPath', n)
    }
    n.selected = selected
    if (ht.args.interaction.onNodeSelect)
        ht.args.interaction.onNodeSelect(n, selected)
}

/** Deselects every node and redraws. */
export function clearSelection(ht:SelectionHost) {
    for (const s of [...ht.args.objects.selections]) setSelected(ht, s, false)
    ht.update.pathes()
}

/**
 * The head of a path type (one per type: an existing one is removed first; the
 * hover path has the hovered node as its head, n.hovered follows).
 */
export function setPathHead(ht:SelectionHost, path:Path, n:N) {
    const pt = path ? path.type : 'HoverPath'

    const oldPathId = pathId(pt, n)
    const oldPath = ht.args.objects.pathes.find(e=> e.id === oldPathId)

    if (oldPath) {
        removePath(ht, pt, oldPath.head)
        if (pt === 'HoverPath') oldPath.head.hovered = false
    }
    if (n) {
        addPath(ht, pt, n)
        if (pt === 'HoverPath') n.hovered = true
    }
}

/** Marks the nodes whose name or label contains the query with a Query path (all others are cleared). */
export function selectQuery(ht:SelectionHost, query:string) {
    const lq = query ? query.toLowerCase() : null
    ht.data.each(n=> {
        n.pathes.partof = []
        n.pathes.headof = undefined
        n.pathes.labelcolor = undefined
        n.pathes.finalcolor = undefined
        n.pathes.isPartOfAnyQuery = false
    })
    ht.args.objects.pathes = []
    ht.data.each(n=> {
        if (n.data) {
            if (n.data.name.toLowerCase().includes(lq))
                addPath(ht, 'Query', n)
            if (n.precalc && n.precalc.label)
                if (n.precalc.label.toLowerCase().includes(lq))
                addPath(ht, 'Query', n)
        }
    })
    ht.update.pathes()
}

export function addPath(ht:SelectionHost, pathType:string, n:N) : Path {
    const plidx = stringhash(n.precalc.label)
    const color = ({
        'HoverPath': 'none',
        'Query': googlePalette(15)
    })[pathType] || googlePalette(plidx) || googlePalette(1)

    const newpath:Path = {
        type:      pathType,
        id:        pathId(pathType, n),
        icon:      ({ 'HoverPath':'mouse' })[pathType] || 'place',
        head:      n,
        headName:  n.precalc.label,
        ancestors: n.ancestors(),
        color:     color,
    }

    ht.args.objects.pathes.push(newpath)
    n.pathes.headof = newpath
    if (pathType !== 'HoverPath')
        n.pathes.finalcolor = n.pathes.labelcolor = newpath.color

    // the node context of every node on the path
    n.ancestors().forEach((pn:N)=> {
        pn.pathes.partof = addIfNotIn(pn.pathes.partof, newpath, pathType === 'HoverPath' ? 'push' : 'unshift')
        if (pathType !== 'HoverPath')
            pn.pathes.finalcolor = newpath.color
        pn.pathes[`isPartOfAny${pathType}`] = true
    })
    return newpath
}

export function removePath(ht:SelectionHost, pathType:string, n:N) {
    const id = pathId(pathType, n)

    ht.args.objects.pathes = ht.args.objects.pathes.filter(e=> e.id !== id)
    n.pathes.headof = undefined
    if (pathType !== 'HoverPath')
        n.pathes.labelcolor = undefined
    n.ancestors().forEach((pn:N)=> {
        pn.pathes.partof = pn.pathes.partof.filter(e=> e.id !== id)
        pn.pathes.finalcolor = pn.pathes.partof.length > 0
            ? pn.pathes.partof[0].color
            : undefined

        if (pn.pathes.finalcolor === 'none')
            pn.pathes.finalcolor = undefined

        const nodeFlagName = `isPartOfAny${pathType}`
        pn.pathes[nodeFlagName] = pn.pathes.partof.some(e=> e.type === pathType)
    })
}
