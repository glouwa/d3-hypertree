import * as d3 from 'd3'

import { tosub }                    from 'ducd'
import { N }                        from '../n/n'

import { C, CptoCk, CktoCp, πify }  from '../../models/transformation/hyperbolic-math'
import { lengthDilledation }        from '../../models/transformation/hyperbolic-math'
import { loaders }                  from '../../index'
import { layoutBergé }              from '../n/n-layouts'
import { layoutBuchheim }           from '../n/n-layouts'
import { layoutSpiral }             from '../n/n-layouts'

import { HyperbolicTransformation } from '../../index'
import { PanTransformation }        from '../../index'

import { HypertreeArgs }            from '../../models/hypertree/model'
import { UnitDisk }                 from '../../components/unitdisk/unitdisk'
import { UnitDiskNav }              from '../../components/unitdisk/unitdisk'

import { Hypertree }                from '../../components/hypertree/hypertree'

import { NodeLayer }                from '../../components/layers/node-layer'
import { CellLayer }                from '../../components/layers/cell-layer'
import { BackgroundLayer }          from '../../components/layers/background-layer'
import { SymbolLayer }              from '../../components/layers/symbol-layer'
import { ArcLayer }                 from '../../components/layers/link-layer'
import { LabelLayer }               from '../../components/layers/label-layer'
import { InteractionLayer }         from '../../components/layers/interaction-layer'
import { ImageLayer }               from '../../components/layers/image-layer'
import { FocusLayer }               from '../../components/layers/focus-layer'

import { layerSrc }                 from './preset-layers'
import { cacheUpdate }              from './preset-filter'

var hasLazy =   n=> (n.hasOutChildren && n.isOutλ)
var isLeaf =    n=> !n.children || !n.children.length
var isRoot =    n=> !n.parent 
var hasCircle = n=> hasLazy(n) || isRoot(n) || isLeaf(n)

var nodeInitR = (c:number)=> (ud:UnitDisk, d:N)=>
    c
    * ((d.children && d.parent) ? innerNodeScale(d) : 1)
     
var nodeInitRNoInner = (c:number)=> (ud:UnitDisk, d:N)=>
    c

var nodeScale = d=>
    d.distScale
    * (hasLazy(d) ? .8 : 1)    

var nodeScaleNoInner = d=>
    d.distScale
    
var innerNodeScale = d=>
    d.precalc.weightScale

var arcWidth = d=>
    .022
    * d.distScale
    * d.precalc.weightScale

const modelBase : ()=> HypertreeArgs = ()=>
({
    iconmap:      null,
    dataloader:   null,
    langloader:   null,
    data:         null,
    langmap:      null,
    weight:       (n:N)=> ((!n.children || !n.children.length)?1:0),
    caption:      (ht:Hypertree, n:N)=> undefined,
    onNodeSelect: ()=> {},
    layout:       layoutBergé, // [0, π/2]
    magic:        160,
    objects: {                      // oder indizes?
        selections: [],
        pathes: [],
        traces: []
    },    
    decorator:   UnitDiskNav,
    geometry: {
        clipRadius:     1,
        nodeRadius:     nodeInitR(.01),   
        nodeScale:      nodeScale,
        nodeFilter:     hasCircle,
        linkWidth:      arcWidth,
        transformation: new HyperbolicTransformation({
            P:{ re: 0, im:.5 },
            θ:{ re: 1, im:0 },
            λ:.1
        }),
        cacheUpdate:    cacheUpdate,
        layers:         layerSrc
    }
})

export const presets : { [key: string]:()=> HypertreeArgs } = 
{
    otolModel: ()=> 
    {
        const model = modelBase()
        model.caption = (ht:Hypertree, n:N)=> {
            // better: set of initial node actions [label, imghref, scalef, ...]
            const w  = (!n.value || n.value==1) ? '' : n.value + ' '
            const id = ( n.data && n.data.name) ? n.data.name : ''
            const l  = ht.langMap && ht.langMap[id] ? '𝐖 ' + ht.langMap[id] : ''
            
            const i  = ht.args.iconmap.emojimap[id]
            n.precalc.icon = i                        
            n.precalc.txt = i || l || id

            if (n.precalc.txt) return n.precalc.txt + tosub(w) 
            else return undefined
        }        
        return model
    },
    generatorModel: ()=> 
    {
        const model = modelBase()        
        return model
    },    
    generatorSpiralModel: ()=> 
    {
        const model = modelBase()     
        model.layout = layoutSpiral  
        return model
    },
    fsModel: ()=> 
    {
        const model = modelBase()   
        model.geometry.nodeRadius = nodeInitRNoInner(.035)
        model.geometry.nodeScale = nodeScaleNoInner
        model.geometry.nodeFilter = n=> true
        model.caption = (ht:Hypertree, n:N)=> {            
            const w  = (!n.value || n.value==1) ? '' : n.value + ' '
            n.precalc.txt = ( n.data && n.data.name) ? n.data.name : ''
            return n.precalc.txt + tosub(w) 
        }        
        return model
    },
    mainModel: ()=> 
    {
        const model = presets.otolModel()   
        model.geometry.nodeRadius = nodeInitRNoInner(.0001)
        model.geometry.nodeScale = nodeScaleNoInner
        model.initMaxL = .75
        model.geometry.nodeFilter = n=> true                
        return model
    }    
    
}