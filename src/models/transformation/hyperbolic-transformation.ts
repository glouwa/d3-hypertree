import { N }                                     from '../../models/n/n'
import { T }                                     from './hyperbolic-math'
import {C, CassignC, CktoCp, CptoCk }            from './hyperbolic-math'
import {CaddC, CsubC, CmulR, CdivR }             from './hyperbolic-math'
import {h2e, compose, shift, lengthDilledation } from './hyperbolic-math'
import {dfs, clone, πify, setR, maxR }           from './hyperbolic-math'

export interface Transformation<OT>
{    
    state:          T, // state: T,
    isMoving:       ()=> boolean,
    cache:          TransformationCache,

    transformPoint: (n:C)=> C,
    transformDist:  (p:C)=> number,

    onDragStart:    (m:C)=> void,
    onDragEnd:      (m:C)=> void
    onDragP:        (s:C, e:C)=> void,
    onDragθ:        (s:C, e:C)=> void,
    onDragλ:        (s:C, e:C)=> void,

    maxMouseR:      number
}

export class HyperbolicTransformation implements Transformation<N>
{
    cache: TransformationCache = new TransformationCache()
    state: T
    dST:   T    
    maxMouseR = .99
    
    constructor(tp)  { this.state = tp }

    transformPoint = (p:C)=> h2e(this.state, p)
    transformDist =  (p:C)=> lengthDilledation(p)

    onDragStart =    (m:C)=> this.dST = clone(this.state)
    onDragEnd =      (m:C)=> this.dST = undefined
    isMoving=        ()=>    this.dST !== undefined
    onDragP =        (s:C, e:C)=> CassignC(this.state.P,
                        compose(this.dST, shift(this.dST, s, maxR(e, this.maxMouseR))).P)
    onDragθ:         (s:C, e:C)=> {}
    onDragλ =        (s:C, e:C)=> CassignC(this.state.λ, 
                        setR(e, 1))    
}

export class PanTransformation implements Transformation<N>
{
    cache: TransformationCache = new TransformationCache()
    state: T
    dST:   T
    maxMouseR = 1000

    constructor(tp)  { this.state = tp }

    transformPoint = (p:C)=> {
                         var s = CktoCp(this.state.λ).θ / Math.PI
                         var w = CktoCp(this.state.θ).θ
                         var zp = CktoCp(p)
                         var rz = CptoCk({ θ:zp.θ+w, r:zp.r })
                         return CmulR(CaddC(rz, CdivR(this.state.P, s)), s)
                     }
    transformDist =  (p:C)=> 1

    onDragStart =    (m:C)=> this.dST = clone(this.state)
    onDragEnd =      (m:C)=> this.dST = undefined
    isMoving=        ()=>    this.dST !== undefined
    onDragP =        (s:C, e:C)=> CassignC(this.state.P, 
                        maxR(CaddC(this.dST.P, CsubC(e, s)), .999))
    onDragθ =        (s:C, e:C)=> CassignC(this.state.θ, 
                        setR(e, 1))
    onDragλ =        (s:C, e:C)=> CassignC(this.state.λ, 
                        setR(e, 1))    
}

export class NegTransformation implements Transformation<N>
{
    cache: TransformationCache = null
    state: T
    decorated: Transformation<N>
    maxMouseR = 0

    constructor(d: Transformation<N>) {
        this.decorated = d
        this.state = d.state
        this.maxMouseR = d.maxMouseR
        this.cache = d.cache
    }

    transformPoint = (p:C)=> this.decorated.transformPoint(CmulR(p,-1))
    transformDist =  (p:C)=> this.decorated.transformDist(CmulR(p,-1))

    onDragStart =    (m:C)=>      this.decorated.onDragStart(CmulR(m,-1))
    onDragEnd =      (m:C)=>      this.decorated.onDragEnd(CmulR(m,-1))
    isMoving=        ()=>         this.decorated.isMoving()
    onDragP =        (s:C, e:C)=> this.decorated.onDragP(CmulR(s,-1), CmulR(e,-1))
    onDragθ =        (s:C, e:C)=> this.decorated.onDragθ(CmulR(s,-1), CmulR(e,-1))
    onDragλ =        (s:C, e:C)=> this.decorated.onDragλ(CmulR(s,-1), CmulR(e,-1))
} 

export class TransformationCache
{
    N:              number    
    centerNode:     N
    unculledNodes:  N[]
    links:          N[]
    leafOrLazy:     N[]
    spezialNodes:   N[]
    paths:          N[]
    weights:        N[]
    labels:         N[]
    emojis:         N[]
    images:         N[]
    
    voronoiDiagram: d3.VoronoiDiagram<N>
    
    cells:          d3.VoronoiPolygon<N>[]
}

