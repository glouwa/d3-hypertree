import { N } from './n'

// layout.fanWeight: how much angle a node with many leaf children (a fan) gets.
//
// The layout gives each child a part of its parent's wedge in proportion to its
// weight. The leaf children of a node are drawn as a staircase: each leaf a step
// further out than the one before, after a run of fanRun(k) leaves back to the
// start (layoutBergé). Leaves at the same step of different runs lie at the same
// distance from their parent, a whole run apart: the fan needs the angle of its
// number of runs (columns), not of its number of leaves.
//
// 'leaves' (until v1): the weight is the number of leaves of the subtree. A fan of
// 7577 leaves (Polyphaga in the Coleoptera of the Open Tree of Life: a polytomy the
// synthesis did not resolve) took 30 % of the angle and squeezed the resolved
// branches next to it.
// 'columns' (default): the leaf children of a node weigh together as many as the
// runs of their staircase; inner children weigh what their own subtree needs.
// precalc.layoutWeight (and the culling and label weights) still count the leaves.

/** Leaves per run of the staircase of k leaf children (one or two leaves: no
 *  compression, each its own angle; the layout as until v1). */
export function fanRun(k:number) : number {
    return k < 3 ? 1 : Math.ceil(k / Math.log(k) / 2)
}

/** The number of runs (columns) of the staircase of k leaf children. */
export function fanColumns(k:number) : number {
    return k ? Math.ceil(k / fanRun(k)) : 0
}

/**
 * precalc.angleWeight of every node, bottom-up: its own weight (layout.weight), the
 * weights of its inner children and the weight of its leaf children compressed to
 * the columns of their staircase. precalc.fanRun: the leaves per run (layoutBergé).
 */
export function angleWeights(root:N, ownWeight:(n:N)=> number) {
    ;(root as any).eachAfter((n:N)=> {      // d3 hierarchy: children before their parent
        const own = +ownWeight(n) || 0
        const children = n.children
        if (!children || !children.length) {
            n.precalc.angleWeight = own
            return
        }
        let inner = 0, leaves = 0, k = 0
        for (const c of children) {
            if (c.children && c.children.length) inner += c.precalc.angleWeight
            else { leaves += c.precalc.angleWeight; k++ }
        }
        // fewer than 3 leaves: no fan, the layout as until v1 (fanRun undefined)
        n.precalc.fanRun = k >= 3 ? fanRun(k) : undefined
        n.precalc.angleWeight = own + inner + (k ? leaves * fanColumns(k) / k : 0)
    })
}
