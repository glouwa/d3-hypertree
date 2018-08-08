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
import { mergeDeep }                from 'ducd'

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
    iconmap: {
                            fileName2IconUrl: ()=>null,
                            emojimap: {}
    },    
    nodeDataInitBFS:        (ht:Hypertree, n:N)=> {        
        n.precalc.imageHref = undefined        
        n.precalc.icon = undefined        
        n.precalc.clickable = true
        n.precalc.cell = true        
    },    
    nodeLangInitBFS:        (ht:Hypertree, n:N)=> {
        n.precalc.label = undefined
        n.precalc.wiki = undefined
    },    

    objects: {  
        selections:         [],
        pathes:             [],
        traces:             [],
    },  
    layout: {
        type:               layoutBergé,
        weight:             (n:N)=> (isLeaf(n)?1:0),
        initSize:           .97,
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
        weight:             n=> (isLeaf(n)?1:0),
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
        captionBackground:  'all',
        captionFont:        '6.5px Roboto',
        transformation:     new HyperbolicTransformation({
            P:              { re: 0, im:0 },
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
    modelBase: ()=> modelBase(),

    otolModel: ()=> ({
        //model: {
            nodeLangInitBFS: (ht:Hypertree, n:N)=> {                
                const id = n.data && n.data.name
                const l  = ht.langMap && ht.langMap[id] && '𝐖 ' + ht.langMap[id] 
                const i  = ht.args.iconmap && ht.args.iconmap.emojimap[id] 
                n.precalc.icon = i
                n.precalc.wiki = l                
                n.precalc.label = l || id                
                n.precalc.clickable = Boolean(l)
            },
        //},            
        geometry: {
            nodeRadius: nodeInitR(.0075)
        }        
    }),

    generatorModel: ()=> ({                        
        interaction: {
            λbounds: [1/10, .6],
        },
        layout: {
            rootWedge: {
                orientation: π/4,
                angle:       1.99999*π,
            }
        }        
    }),    

    generatorSpiralModel: ()=> ({          
        layout: {
            type: layoutSpiral  
        }        
    }),

    acmflareModel: ()=> ({
        nodeLangInitBFS: (ht:Hypertree, n:N)=> {            
            n.precalc.label = n.data && n.data.name          
            n.precalc.clickable = true
        },
        geometry: {
            nodeRadius: nodeInitR(.0075)
        },                  
        interaction: {
            λbounds: [1/7, .8]
        }
    }),
    
    fsModel: ()=> ({                        
        geometry: {
            nodeRadius: ()=> 0, //nodeInitRNoInner(.038)
            nodeScale: nodeScaleNoInner,
            nodeFilter: n=> true,
        },
        interaction: {
            λbounds: [1/7, .7]
        },
        nodeLangInitBFS: (ht:Hypertree, n:N)=> {
            n.precalc.label = n.data && n.data.name
            n.precalc.clickable = true
        }        
    }),

    mainModel: ()=> 
    {
        const model = presets.otolModel()
        const diff = {
            filter: {
                focusExtension: 2.5,
                maxlabels: 25,
            },
            layout: {
                initSize: .85
            },
            geometry: {
                nodeRadius: nodeInitRNoInner(.0001),
                nodeScale:  nodeScaleNoInner,
                nodeFilter: n=> true,
            },            
            interaction: {
                //onNodeSelect: s=> { console.log('###########', s) },
                λbounds: [1/5, .5],
            },
            nodeLangInitBFS: (ht:Hypertree, n:N)=> {                
                const id = n.data && n.data.name
                n.precalc.clickable = n.parent
                    && id !== 'Open-Tree-of-Life'
                    && id !== 'Generators'
                    && id !== 'Example-files'
                    && id !== 'stackoverflow'

                if (n.precalc.clickable) {                
                    n.precalc.icon = ht.args.iconmap.emojimap[id]
                    n.precalc.label = id
                }         
            }
        }
        console.log('merging otol to main model')
        return mergeDeep(model, diff)
    }    
}