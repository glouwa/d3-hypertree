import { N } from './n'

// layout.multirowHighDegreeNodes: the leaf children of a node with many of them (a
// high-degree node, a fan) in several rows, and the angle the fan needs.
//
// The layout gives each child a part of its parent's wedge in proportion to its
// weight. The leaf children of a node are drawn as a staircase: each leaf a step
// further out than the one before, after a run of fanRun(k) leaves back to the
// first row (layoutBergé). Leaves in the same row of different runs lie at the
// same distance from their parent, a whole run apart: the fan needs the angle of
// its number of runs (columns), not of its number of leaves.
//
// true (default): the leaf children of a node weigh together as many as the runs
// of their staircase; inner children weigh what their own subtree needs. Nodes
// with one or two leaf children are laid out as until v1. Until v1 a fan of 7577
// leaves (Polyphaga in the Coleoptera of the Open Tree of Life: a polytomy the
// synthesis did not resolve) took 30 % of the angle and squeezed the resolved
// branches next to it.
// false: one row, every leaf its own angle (the weight: the leaves of the subtree).
// precalc.layoutWeight (and the culling and label weights) always count the leaves.

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
 * precalc.angleWeight and precalc.fanRun of every node, bottom-up.
 * multirow: the weight of the leaf children compressed to the columns of their
 * staircase, fanRun the leaves per run (undefined below 3 leaves: the layout as until
 * v1). Otherwise the subtree's layout weight and fanRun 1: one row.
 */
export function angleWeights(root:N, ownWeight:(n:N)=> number, multirow = true) {
    ;(root as any).eachAfter((n:N)=> {      // d3 hierarchy: children before their parent
        const children = n.children
        if (!multirow) {
            n.precalc.angleWeight = n.precalc.layoutWeight
            n.precalc.fanRun = children && children.length ? 1 : undefined
            return
        }
        const own = +ownWeight(n) || 0
        if (!children || !children.length) {
            n.precalc.angleWeight = own
            n.precalc.fanRun = undefined
            return
        }
        let inner = 0, leaves = 0, k = 0
        for (const c of children) {
            if (c.children && c.children.length) inner += c.precalc.angleWeight
            else { leaves += c.precalc.angleWeight; k++ }
        }
        n.precalc.fanRun = k >= 3 ? fanRun(k) : undefined
        n.precalc.angleWeight = own + inner + (k ? leaves * fanColumns(k) / k : 0)
    })
}
