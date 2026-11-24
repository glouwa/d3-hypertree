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
//   - on equal weights the first goes left on even depths, right on odd depths (the
//     branches alternate from level to level).

/** Orders the children of every node of the tree (weights: precalc.angleWeight, the
 *  part of the wedge; precalc.layoutWeight without it). */
export function balanceChildren(root:N) {
    const todo:N[] = [root]
    while (todo.length) {
        const n = todo.pop()
        if (!n.children || !n.children.length) continue
        if (n.children.length > 1) n.children = balanced(n.children, n.depth % 2 === 0)
        for (const c of n.children) todo.push(c)
    }
}

/** The balanced order of a list of children (exported for the tests). */
export function balanced(children:N[], firstLeft:boolean) : N[] {
    const w = (c:N)=> (c.precalc.angleWeight !== undefined ? c.precalc.angleWeight : c.precalc.layoutWeight) || 0
    // heaviest first; equal weights keep their order
    const sorted = children.map((c, i)=> ({ c, i })).sort((a, b)=> (w(b.c) - w(a.c)) || (a.i - b.i)).map(x=> x.c)
    const left:N[] = [], right:N[] = []
    let wl = 0, wr = 0
    for (const c of sorted.slice(1)) {
        if (wl < wr || (wl === wr && firstLeft)) { left.push(c); wl += w(c) }
        else { right.push(c); wr += w(c) }
    }
    // left: the first placed next to the middle
    return [...left.reverse(), sorted[0], ...right]
}
