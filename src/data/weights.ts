// The weights of the nodes, computed once per tree (precalc.*): the layout weight
// (layout.weight, summed over the subtree), the angle weight (fan-weight.ts), the
// link lengths (layout.rootLinkLength), the culling weight (filter.weightFilter.weight)
// and the weight scale of the drawing.

import { N }               from './n'
import { HypertreeArgs }   from '../config/schema'
import { angleWeights }    from './fan-weight'

function sumUp(root:N, value:(n:N)=> number, target:string) {
    (<any>root).eachAfter((node:N)=> {
        let sum = +value(node) || 0
        const children = node.children
        var i = children && children.length
        while (--i >= 0) sum += children[i].precalc[target]
        node.precalc[target] = sum
    })
}

export function computeWeights(root:N, model:HypertreeArgs) : void {
    sumUp(root, model.layout.weight, 'layoutWeight')
    // the angle per node and the rows of the leaf children
    // (layout.multirowHighDegreeNodes; fan-weight.ts)
    angleWeights(root, model.layout.weight, model.layout.multirowHighDegreeNodes !== false)
    // the link lengths (layout.rootLinkLength): from that part at the root's children
    // to 1 at the leaves
    const f0 = model.layout.rootLinkLength
    root.each((n:N)=> {
        if (f0 === undefined || f0 === null || !n.parent) { n.precalc.linkFactor = undefined; return }
        const t = n.depth - 1 + n.height > 0 ? (n.depth - 1) / (n.depth - 1 + n.height) : 1
        n.precalc.linkFactor = f0 + (1 - f0) * t
    })
    // without a weight filter every node weighs 1 (used for label sizes, not culling)
    sumUp(root, model.filter.weightFilter ? model.filter.weightFilter.weight : (n=> 1), 'cullingWeight')
    sumUp(root, model.layout.weight, 'visWeight')

    // for arc width and node radius in some cases, not flexible enough
    root.each((n:N)=> n.precalc.weightScale = (Math.log2(n.precalc.visWeight) || 1)
        / (Math.log2(root.precalc.visWeight || root.children.length) || 1))
}
