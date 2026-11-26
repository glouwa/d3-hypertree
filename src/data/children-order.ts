import { N } from './n'

// layout.childOrder 'balanced': the children of every node ordered so that the tree
// looks like a spruce.
//
// The layouts give each child a part of its parent's wedge in proportion to its
// weight, in the order of n.children. A child points in its parent's direction when
// the children left of it weigh as much as the ones right of it. So:
//   - the heaviest child (most leaves) goes in the middle: the heaviest path runs
//     straight on, from the root to the rim;
//   - the others, heaviest first, each go to the side that weighs less so far:
//     similar children alternate left and right, after a heavy one several lighter
//     ones follow on the other side;
//   - heavier children next to the middle one, lighter ones outside;
//   - the sides rarely weigh the same (two big children: the lighter one on one side,
//     nothing on the other), so the heaviest child turns a little to the lighter side.
//     The turns along a trunk (the path of the heaviest children) are summed up (the
//     lean: the weight left minus right of the heaviest child, in parts of the
//     children's weight); where the next turn would lean the trunk further, the sides
//     are swapped, so it turns back: the trunk stays near its first direction instead
//     of bending away (a beetle tree leaned 15-30° to one side). The lean is never
//     larger than the largest single turn on the way. A side branch starts its own
//     trunk (lean 0: it keeps its direction, it is not bent towards the parent's);
//   - without a lean (the start of a trunk, or sides of equal weight) the first goes
//     left on even depths, right on odd depths (the branches alternate from level to
//     level).

const weight = (c:N)=> (c.precalc.angleWeight !== undefined ? c.precalc.angleWeight : c.precalc.layoutWeight) || 0

/** Orders the children of every node of the tree (weights: precalc.angleWeight, the
 *  part of the wedge; precalc.layoutWeight without it). */
export function balanceChildren(root:N) {
    const lean = new Map<N, number>()
    const todo:N[] = [root]
    while (todo.length) {
        const n = todo.pop()
        if (!n.children || !n.children.length) continue
        if (n.children.length > 1) {
            const s = balancedSides(n.children, n.depth % 2 === 0)
            const before = lean.get(n) || 0
            const turn = (l:N[], r:N[])=> (l.reduce((a, c)=> a + weight(c), 0) - r.reduce((a, c)=> a + weight(c), 0)) / s.total
            // this order would lean the trunk further: the sides swapped
            const t = turn(s.left, s.right)
            const swap = before * t > 0
            const left = swap ? s.right : s.left, right = swap ? s.left : s.right
            n.children = [...[...left].reverse(), s.heaviest, ...right]
            if (s.total) lean.set(s.heaviest, before + (swap ? -t : t))
        }
        else lean.set(n.children[0], lean.get(n) || 0)       // one child: the trunk goes on
        for (const c of n.children) todo.push(c)
    }
}

/** The balanced order of a list of children (exported for the tests). */
export function balanced(children:N[], firstLeft:boolean) : N[] {
    const s = balancedSides(children, firstLeft)
    return [...[...s.left].reverse(), s.heaviest, ...s.right]
}

/** The heaviest child and the others on its sides, each side from the middle out. */
function balancedSides(children:N[], firstLeft:boolean) {
    // heaviest first; equal weights keep their order
    const sorted = children.map((c, i)=> ({ c, i })).sort((a, b)=> (weight(b.c) - weight(a.c)) || (a.i - b.i)).map(x=> x.c)
    const left:N[] = [], right:N[] = []
    let wl = 0, wr = 0
    for (const c of sorted.slice(1)) {
        if (wl < wr || (wl === wr && firstLeft)) { left.push(c); wl += weight(c) }
        else { right.push(c); wr += weight(c) }
    }
    return { heaviest: sorted[0], left, right, total: wl + wr + weight(sorted[0]) }
}
