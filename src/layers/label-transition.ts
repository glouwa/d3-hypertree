import { N } from '../data/n'

// Appearing, disappearing and moving labels, for the label layers that place labels
// away from their node (labels-force, labels-placed; layer option transition):
//   - every label has a growth g, 0..1: a label that is shown grows from 0, a label no
//     longer shown shrinks and is drawn until it reaches 0
//   - the drawn offset of a label from its node follows the computed one smoothly
//     (relative to the node: while dragging, labels still follow their node)
//   - while anything grows, shrinks or moves, the layer is redrawn on every animation
//     frame (also without interaction)

export const DEFAULT_TRANSITION = 250
const FOLLOW = 70          // ms: time constant of the drawn offset following the computed one
const MAX_SPEED = .001     // view units per ms: a label that changes its place glides there
const MAX_DT = 50          // ms: a longer pause (no updates) ...
const IDLE_DT = 16         // ms: ... counts as one frame

interface LabelState {
    g:    number,               // growth 0..1
    show: boolean,              // shown (grows) or not (shrinks)
    tx:   number, ty: number,   // offset from the node: computed by the layer
    dx:   number, dy: number,   // offset from the node: drawn
}

const ease = (g:number)=> g * g * (3 - 2 * g)

export class LabelTransitions
{
    private states = new Map<N, LabelState>()
    private last = 0            // time of the last advance
    private dt = 0
    private frame = 0           // pending animation frame
    private moving = false

    /**
     * duration: ms of growing and shrinking (0: none)
     * redraw:   draws the layer (called on animation frames while anything moves)
     * active:   false while the layer is invisible: no frames
     */
    constructor(private duration:()=> number, private redraw:()=> void, private active:()=> boolean) {}

    private get animated() { return this.duration() > 0 }

    /**
     * Starts a frame: the shown labels grow, the others shrink. A shrinking label is
     * dropped when it reaches 0 or its node is no longer visible (its position is no
     * longer updated). Returns the labels to draw: the shown ones (their order), then
     * the shrinking ones.
     */
    advance(shown:N[], visible:(n:N)=> boolean) : N[] {
        const now = performance.now()
        const gap = this.last ? now - this.last : 0
        this.dt = gap > MAX_DT ? IDLE_DT : gap
        this.last = now
        this.moving = false
        const step = this.animated ? this.dt / this.duration() : 1
        const isShown = new Set(shown)
        for (const n of shown) {
            const s = this.states.get(n)
            if (s) s.show = true
            else this.states.set(n, { g: this.animated ? 0 : 1, show: true, tx: NaN, ty: NaN, dx: NaN, dy: NaN })
        }
        const leaving:N[] = []
        for (const [n, s] of this.states) {
            if (!isShown.has(n)) s.show = false
            s.g = Math.max(0, Math.min(1, s.g + (s.show ? step : -step)))
            if (s.show ? s.g < 1 : s.g > 0) this.moving = true
            if (!s.show) {
                if (s.g <= 0 || !visible(n)) this.states.delete(n)
                else leaving.push(n)
            }
        }
        return leaving.length ? shown.concat(leaving) : shown
    }

    /** The growth of a label, eased: 0 (not visible) .. 1 (full size). */
    growth(n:N) : number {
        const s = this.states.get(n)
        return s ? ease(s.g) : 1
    }

    /** The offset computed in the last frame (undefined for a new label). */
    target(n:N) : { dx:number, dy:number } | undefined {
        const s = this.states.get(n)
        return s && !isNaN(s.tx) ? { dx: s.tx, dy: s.ty } : undefined
    }

    /**
     * Sets the computed offset of a label from its node (undefined: keep the last one,
     * e.g. for a shrinking label) and returns the offset to draw, which follows it
     * smoothly (a new label starts at its computed offset).
     */
    follow(n:N, tx?:number, ty?:number) : { dx:number, dy:number } {
        const s = this.states.get(n)
        if (!s) return { dx: tx || 0, dy: ty || 0 }
        if (tx !== undefined) { s.tx = tx; s.ty = ty }
        if (isNaN(s.dx) || !this.animated) { s.dx = s.tx; s.dy = s.ty }
        else {
            // exponentially toward the target, but not faster than MAX_SPEED (a far jump,
            // e.g. to another place, would otherwise start with a big step)
            const f = 1 - Math.exp(-this.dt / FOLLOW)
            let mx = (s.tx - s.dx) * f, my = (s.ty - s.dy) * f
            const len = Math.hypot(mx, my), max = MAX_SPEED * this.dt
            if (len > max) { mx *= max / len; my *= max / len }
            s.dx += mx
            s.dy += my
            if (Math.abs(s.tx - s.dx) + Math.abs(s.ty - s.dy) > 1e-4) this.moving = true
            else { s.dx = s.tx; s.dy = s.ty }
        }
        return { dx: s.dx, dy: s.dy }
    }

    /** Ends a frame: while anything moves, the layer is drawn again on the next frame. */
    finish() {
        if (!this.moving || this.frame || typeof requestAnimationFrame === 'undefined') return
        this.frame = requestAnimationFrame(()=> {
            this.frame = 0
            if (!this.active()) return
            // the hypertree updated the layer in this frame anyway
            if (performance.now() - this.last < 8) { this.moving = true; this.finish(); return }
            this.redraw()
        })
    }
}
