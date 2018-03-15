import { tree }                from 'd3-hierarchy'
import { N }                   from './n'
import { T, makeT, one }       from '../../models/transformation/hyperbolic-math'
import { C, CktoCp, CptoCk }   from '../../models/transformation/hyperbolic-math'
import { Cneg, CmulR }         from '../../models/transformation/hyperbolic-math'
import { Clog, Cpow }          from '../../models/transformation/hyperbolic-math'
import { h2e }                 from '../../models/transformation/hyperbolic-math'
import { πify, dfs, dfsFlat}   from '../../models/transformation/hyperbolic-math' 
import { Z_VERSION_ERROR } from 'zlib';

export type LayoutFunction = (root:N, t?:number, noRecursion?:boolean) => N

const π = Math.PI    
const unitVectors = [{ re:1, im:0 }, { re:0, im:1 }, { re:-1, im:0 }, { re:0, im:-1 }]

export function setZ(container, z) {
    console.assert(z, "set Z to null!")
    if (!z) return 
    container.layout = container.layout || {}    
    container.layout.z = z
    container.layout.zStrCache = `${z.re} ${z.im}`
    container.layout.zp = CktoCp(z)    
}

export function layoutUnitVectors(root) {
    const some = [{ re:0, im:0 }].concat(unitVectors)
    let i=0
    dfs(root, n=> {
        const a = i%some.length
        setZ(n, { 
            re:some[a].re*.99, 
            im:some[a].im*.99 
        })
        i++
    })
    return root
}

export function layoutUnitLines(root) {
    //root.z = { re:0, im:0 }
    setZ(root, { re:0, im:0 })
    for (let i=0; i<4; i++)
        layoutPath(root.children[i], unitVectors[i], root.children[i].height)

    function layoutPath(pathBegin, target, depth=30)
    {
        let i = 0
        const pa = 1/depth
        const rt = r=> pa + r * (1-pa)
        dfs(pathBegin, n=> {
            const r = i/depth
            setZ(n, { 
                re:rt(r) * target.re, 
                im:rt(r) * target.im 
            })
            i++
        })
    }
    return root
}

export function layoutSpiral(root) {
    const flatNodes = dfsFlat(root)
    const nrN = flatNodes.length
    const nrRounds = Math.floor(nrN/24)
    for (let i=0; i < nrN; i++) {
        const a = i/nrN * 2*Math.PI * (nrRounds+1)
        const r = Math.pow(2, i/nrN)-1
        setZ(flatNodes[i], { 
            re:r*Math.cos(a), 
            im:r*Math.sin(a) 
        })
    }
    return root
}

export function layoutBuchheim(root) {
    root = tree().size([2 * Math.PI, 0.9])(root)
    dfs(root, n=> {
        const a = n.x - Math.PI/2
        setZ(n, { 
            re:n.y * Math.cos(a), 
            im:n.y * Math.sin(a) 
        })
    })
    return root
}

export function layoutLamping(n, wedge = { p:{ re:0, im:0 }, m:{ re:0, im:1 }, α:Math.PI }) {

    console.log('--------------------------------------------------------', n.depth)
    console.log(wedge.p, wedge.m, wedge.α)

    setZ(n, wedge.p)

    if (n.children) {
        for (let i=0; i < n.children.length; i++) {

            const cα = wedge.α / n.children.length * (i+1)
            console.assert(isFinite(cα))
            console.log('cα', cα)

            const s = .1
            const it = ((1-s*s) * Math.sin(cα)) / (2*s);              console.log('it',it)
            const d = (Math.sqrt(Math.pow(it,2)+1) - it) * .5
            
            console.assert(isFinite(d))
            console.log('d',d)

            const p1 = makeT(wedge.p, one)
            const np = h2e(p1, CmulR(wedge.m, d));                    console.log('np',np)

            const npp1 = makeT(Cneg(np), one)
            const nd1 = makeT({ re:-d, im:0 }, one)
            const nm = h2e(npp1, h2e(p1, wedge.m));                   console.log('nm',nm)
            const nα = Clog(h2e(nd1, Cpow(cα))).im;                   console.assert(isFinite(nα))

            layoutLamping(n.children[i], { p:np, m:nm, α:nα })
        }
    }
    return n
}

function wedgeTranslate(w, P)
{
    const t = makeT(P, one)
    const pα = { re:Math.cos(w.α), im:Math.sin(w.α) }    
    const pΩ = { re:Math.cos(w.Ω), im:Math.sin(w.Ω) }
    w.α = CktoCp(h2e(t, pα)).θ
    w.Ω = CktoCp(h2e(t, pΩ)).θ
}

function r2g(r) {
    return r/π * 360
}

export function layoutBergé(n:N, λ:number, noRecursion=false)
{
    function layoutNode(n:N)
    { 
        const wedge = { Ω:n.layout.wedge.Ω, α:n.layout.wedge.α }
        const L = n.layout.wedge.L
        //if (L !== 1)
        //    console.log(L)
        if (n.parent)
        {
            const angleWidth = πify(wedge.Ω - wedge.α)
            const bisectionAngle = wedge.α + (angleWidth / 2.0)
            
            const nz1 = CptoCk({ θ:bisectionAngle, r:λ*(1+L||1) })
            setZ(n, h2e(makeT(n.parent.layout.z, one), nz1))
            
            wedgeTranslate(wedge, n.parent.layout.z)
            wedgeTranslate(wedge, Cneg(n.layout.z))
        }

        let angleWidth = πify(wedge.Ω - wedge.α)
        /*
        if (angleWidth > 2*π)
        {
            const anglediff = angleWidth - 2 * π            
            wedge.α = πify(wedge.α + anglediff / 2.0)            
            wedge.Ω = πify(wedge.Ω - anglediff / 2.0)
            angleWidth = 2 * π
            console.assert('angleWidth > 2*π')
        }*/

        let currentAngle = wedge.α
        const cl = n.children || []        
        const cllen = cl.length
        let linecount = 0
        let liner = 0
        let resetCount = 0
        cl.forEach((cn,i)=> 
        {          
            const cnlen = (cn.children || []).length
            const angleWeight = (cn.value||1) / (n.value||cllen||1) 
            //const angleWeight = 1 / cllen
            const angleOffset = angleWidth * angleWeight
            const α  = currentAngle             
            currentAngle += angleOffset
            const Ω  = πify(currentAngle)            
            
            const cL = liner
            const w = { α, Ω, L:cL }
            cn.layout = cn.layout || { wedge:w }
            cn.layout.wedge = w

            linecount++
            if (cn.height === 0)
                liner += .2
 
            const rowcount = cllen / Math.log(cllen) / 2
            if (n.data.name === 'isr')
                console.log(n.data.name, rowcount)
            if (linecount >= rowcount /*|| cnlen === 0*/)
            {
                linecount = 0
                liner = 0    
                resetCount++                            
            }
        })

        if (!noRecursion)
            for (let cn of n.children || [])        
                layoutNode(cn)
    }
    
    layoutNode(n)    
}
