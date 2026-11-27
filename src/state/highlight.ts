// The highlighted node: what the node under the mouse or the center node shows (the
// node state n.hovered, the hover path, the hover label, the highlight marker,
// onNodeHover / onHoverNodeChange). The options of model.interaction:
//
//   highlightNode           'mousehover' | 'center' | 'none'   where it comes from
//   highlightUpdate         'live' | 'settled'                 when it is set
//   highlightDelay          ms                                 rest before 'settled' sets it
//   highlightLabelFallback  'none' | 'ancestor'                a node without a label
//
// The sources offer a node: the mouse on every move (interaction-layer.ts), the center
// node on every change, from inside the frame that found it (Hypertree.update.centernode).
// 'live' sets it at once; 'settled' when the view stands still (no drag, pinch, wheel or
// animation) and the offers have rested for highlightDelay ms.

import { N }              from '../data/n'
import { HypertreeArgs }  from '../config/schema'
import * as selection     from './selection'

/** What the highlight needs of the hypertree. */
export interface HighlightHost {
    args:            HypertreeArgs
    data:            N
    update:          { pathes: ()=> void }
    isInitializing:  boolean
    isAnimationRunning() : boolean
}

export class Highlight
{
    /** the highlighted node (undefined: none) */
    node : N | undefined = undefined
    /** a style frame is waiting (offer from inside a frame); every frame clears it (view/unitdisk.ts) */
    framePending = false

    private candidate : N | undefined = undefined
    private candidateAt = 0
    private settling = false
    // the node that shows its ancestor's label (highlightLabelFallback) and its own values
    private lent : { n:N, saved:{ [key:string]: any } } | null = null

    constructor(private ht:HighlightHost) {}

    /**
     * A source offers n. inFrame: called from inside a frame (after the filter): the
     * frame's layers draw the new state, no redraw here.
     */
    offer(n:N | undefined, inFrame = false) {
        if (this.ht.args.interaction.highlightUpdate === 'settled') {
            this.candidate = n
            this.candidateAt = performance.now()
            this.settle()
            return
        }
        this.set(n, !inFrame)
        if (inFrame) this.requestFrame()
    }

    /** No node (the mouse left the tree): at once, also with 'settled'. */
    clear() {
        this.candidate = undefined
        this.set(undefined)
    }

    /**
     * Highlights n: when it changes the label fallback and the callbacks onNodeHover /
     * onHoverNodeChange, then the hover path (n.hovered). redraw: a style frame.
     */
    set(n:N | undefined, redraw = true) {
        const i = this.ht.args.interaction
        if (n !== this.node) {
            this.node = n
            this.lendLabel(n)
            if (i.onNodeHover)       i.onNodeHover(n)
            if (i.onHoverNodeChange) i.onHoverNodeChange(n)
        }
        // unchanged: only if the hover path went away (selectQuery clears the paths)
        else if (!n || this.ht.args.objects.pathes.some(p=> p.type === 'HoverPath' && p.head === n))
            return
        selection.setPathHead(this.ht, undefined, n)
        if (redraw) this.ht.update.pathes()
    }

    // after a change from inside a frame: while the view moves the next frame comes
    // anyway; when it stands still a style frame, if no other frame comes first (the
    // filter keeps the new path)
    private requestFrame() {
        if (this.framePending || this.ht.isAnimationRunning()) return
        this.framePending = true
        requestAnimationFrame(()=> {
            if (!this.framePending) return
            this.framePending = false
            this.ht.update.pathes()
        })
    }

    // 'settled': checks on every animation frame until the view stands still and the
    // offers rested highlightDelay ms (counted from the later of both)
    private settle() {
        if (this.settling) return
        this.settling = true
        let busyAt = 0
        const tick = ()=> {
            const now = performance.now()
            if (this.ht.isInitializing || this.ht.isAnimationRunning()) busyAt = now
            const rest = this.ht.args.interaction.highlightDelay || 0
            if (busyAt === now || now - Math.max(this.candidateAt, busyAt) < rest) {
                requestAnimationFrame(tick)
                return
            }
            this.settling = false
            this.set(this.candidate)
        }
        requestAnimationFrame(tick)
    }

    // highlightLabelFallback 'ancestor': a highlighted node without a label shows the
    // label of its nearest ancestor with one, with its measured widths (precalc.*len:
    // the same text), and gives it back when the highlight moves on. It counts as a
    // labelOnHover label: never a permanent one, only as the hover label.
    private lendLabel(n:N | undefined) {
        if (this.lent) {
            Object.assign(this.lent.n.precalc, this.lent.saved)
            this.lent = null
        }
        if (!n || !n.precalc || n.precalc.label || this.ht.args.interaction.highlightLabelFallback !== 'ancestor') return
        let a = n.parent
        while (a && !(a.precalc && a.precalc.label)) a = a.parent
        if (!a) return
        const widths = Object.keys(a.precalc).filter(k=> k.endsWith('len') && k !== 'emojislen')
        const saved:{ [key:string]: any } = {}
        for (const k of ['label', 'labelOnHover', ...widths]) saved[k] = n.precalc[k]
        n.precalc.label = a.precalc.label
        n.precalc.labelOnHover = true
        for (const k of widths) n.precalc[k] = a.precalc[k]
        this.lent = { n, saved }
    }
}
