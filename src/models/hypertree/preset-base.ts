import { tosub }                    from 'ducd'
import { N }                        from '../n/n'

import { loaders }                  from '../../d3-hypertree'
import { layoutBergé }              from '../n/n-layouts'
import { layoutBuchheim }           from '../n/n-layouts'
import { layoutSpiral }             from '../n/n-layouts'

import { HyperbolicTransformation } from '../../d3-hypertree'
import { PanTransformation }        from '../../d3-hypertree'

import { HypertreeArgs }            from './model'
import { UnitDisk }                 from '../../components/unitdisk/unitdisk'
import { UnitDiskNav }              from '../../components/unitdisk/unitdisk'

import { Hypertree }                from '../../components/hypertree/hypertree'

import { layerSrc, labeloffsets }   from './preset-layers'
import { cacheUpdate }              from './magic-filter'

const π =              Math.PI
const hasLazy =        n=> (n.hasOutChildren && n.isOutλ)
const isLeaf =         n=> !n.children || !n.children.length
const isRoot =         n=> !n.parent 
const hasCircle =      n=> hasLazy(n) || isRoot(n) || isLeaf(n)

var nodeInitR =        (c:number)=> (ud:UnitDisk, d:N)=> c * ((d.children && d.parent) ? innerNodeScale(d) : 1)     
var nodeInitRNoInner = (c:number)=> (ud:UnitDisk, d:N)=> c
var nodeScale =        d=> d.distScale * (hasLazy(d) ? .8 : 1)    
var nodeScaleNoInner = d=> d.distScale    
var innerNodeScale =   d=> d.precalc.weightScale
var arcWidth =         d=> .025 * d.distScale * d.precalc.weightScale

const modelBase : ()=> HypertreeArgs = ()=>
({
    iconmap:                null,
    dataloader:             null,
    langloader:             null,
    data:                   null,
    langmap:                null,
    caption:                (ht:Hypertree, n:N)=> undefined,    
    captionBackground:      'all',
    captionFont:            '6.5px Roboto',

    objects: {  
        selections:         [],
        pathes:             [],
        traces:             [],
    },  
    layout: {
        type:               layoutBergé,
        weight:             (n:N)=> (isLeaf(n)?1:0),
        initMaxλ:           .97,
        rootWedge: {    
            orientation:     3*π/2,
            angle:           3*π/2
        }   
    },      
    filter: {           
        type:               'magic',
        cullingRadius:      .99,
        magic:              160,
        alpha:              1.05,
        weight:             (n)=> (isLeaf(n)?1:0),
        rangeCullingWeight: { min:4,   max:500 },                    
        rangeNodes:         { min:300, max:700 },                    
        focusExtension:     1.6,
        maxFocusRadius:     .85,
        maxlabels:          25,
        wikiRadius:         .85,
    },          
    geometry: { 
        decorator:          UnitDisk,
        cacheUpdate:        cacheUpdate,        
        layers:             layerSrc,
        layerMask: {
            stem:           [0, 0], 
            centerNode:     0,
            cells:          1,
        },
        clipRadius:         1,
        nodeRadius:         nodeInitR(.01),
        nodeScale:          nodeScale,
        nodeFilter:         hasCircle,
        offsetEmoji:        labeloffsets['labeloffset'], //outwards,
        offsetLabels:       labeloffsets['labeloffset'], //outwardsPlusNodeRadius,
        linkWidth:          arcWidth,        
        linkCurvature:      '+',
        transformation:     new HyperbolicTransformation({
            P:              { re: 0, im:.5 },
            θ:              { re: 1, im:0 },
            λ:              .1
        })  
    },  
    interaction: {  
        mouseRadius:        .9,
        onNodeSelect:       ()=> {},
        onNodeHold:         ()=> {},                    
        onNodeHover:        ()=> {},
        λbounds:            [1/40, .4],
        wheelFactor:        1.175,
    }
})

export const presets : { [key: string]:()=> HypertreeArgs } = 
{
    otolModel: ()=> 
    {
        const model = modelBase()
        model.geometry.nodeRadius = nodeInitR(.0075)
        model.caption = (ht:Hypertree, n:N)=> {
            // better: set of initial node actions [label, imghref, scalef, ...]
            const w  = (!n.value || n.value==1) ? '' : n.value + ' '
            const id = ( n.data && n.data.name) ? n.data.name : ''
            
            const l = ht.langMap && ht.langMap[id] ? '𝐖 ' + ht.langMap[id] : ''                        
            const i  = ht.args.iconmap ? ht.args.iconmap.emojimap[id] : ''

            n.precalc.icon = i
            n.precalc.wiki = l
            n.precalc.txt = i || l || id
            n.precalc.txt2 = l || id
            
            n.precalc.clickable = Boolean(l)

            if (n.precalc.txt) 
                return n.precalc.txt + tosub(w) 
            else 
                return undefined
        }        
        return model
    },
    generatorModel: ()=> 
    {
        const model = modelBase()    
        model.layout.rootWedge = {
            orientation: π/4,
            angle:       1.99999*π,
        }   
        return model
    },    
    generatorSpiralModel: ()=> 
    {
        const model = modelBase()     
        model.layout.type = layoutSpiral  
        return model
    },
    fsModel: ()=> 
    {
        const model = modelBase()   
        model.geometry.nodeRadius = nodeInitRNoInner(.038)
        model.geometry.nodeScale = nodeScaleNoInner
        model.geometry.nodeFilter = n=> true
        model.caption = (ht:Hypertree, n:N)=> {            
            const w  = (!n.value || n.value==1) ? '' : n.value + ' '
            n.precalc.txt = ( n.data && n.data.name) ? n.data.name : ''
            n.precalc.clickable = true
            return n.precalc.txt + tosub(w) 
        }        
        return model
    },
    mainModel: ()=> 
    {
        const model = presets.otolModel()   
        model.geometry.nodeRadius = nodeInitRNoInner(.0001)
        model.geometry.nodeScale = nodeScaleNoInner
        model.filter.focusExtension = 2.5
        model.geometry.nodeFilter = n=> true
        model.layout.initMaxλ = .6
        model.interaction.onNodeSelect = s=> { console.log('###########', s) }        
        model.caption = (ht:Hypertree, n:N)=> {
            const id = ( n.data && n.data.name) ? n.data.name : ''            
            n.precalc.clickable = n.parent
                && id !== 'Open-Tree-of-Life'
                && id !== 'Generators'
                && id !== 'Example-files'

            if (!n.precalc.clickable)
                return undefined

            const i  = ht.args.iconmap.emojimap[id]
            n.precalc.icon = i            
            n.precalc.txt = i || id       
            n.precalc.txt2 = id
            
            if (n.precalc.txt) 
                return n.precalc.txt 
            else 
                return undefined
        }  
        return model
    }    
}