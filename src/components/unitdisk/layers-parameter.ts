import { N }                   from '../../models/n/n'
import { C, CktoCp, CptoCk }   from '../../models/transformation/hyperbolic-math'
import { CmulR, CsubC, CaddC } from '../../models/transformation/hyperbolic-math'
import { πify }                from '../../models/transformation/hyperbolic-math'
import { CtoStr }              from '../../models/transformation/hyperbolic-math'
import { lengthDilledation }   from '../../models/transformation/hyperbolic-math'
import { bboxOffset }          from '../layerstack/d3updatePattern'
import { ILayer }              from '../layerstack/layer'
import { NodeLayer }           from '../layers/node-layer'
import { CellLayer }           from '../layers/cell-layer'
import { BackgroundLayer }     from '../layers/background-layer'
import { SymbolLayer }         from '../layers/symbol-layer'
import { ArcLayer }            from '../layers/link-layer'
import { LabelLayer }          from '../layers/label-layer'
import { InteractionLayer }    from '../layers/interaction-layer'
import { UnitDisk }            from './unitdisk'

var rotate = (d:N)=> // label rotation (font correction)
    (d.name === 'λ' ? ' rotate(-25)' : ' rotate(0)')

var deltaMap = { // label offsets (font correction)
    P:{ re:.0025, im:.05 }, 
    θ:{ re:.0025, im:.019 }, 
    λ:{ re:.0025, im:.013 }
}

var Pscale =  (ud:UnitDisk)=> (d:any)=>
    lengthDilledation(d)
    * (1 - ud.args.transformation.state.λ)
    / ud.args.nodeRadius(ud, d)

export const navParameterLayers = [
    (v, ud:UnitDisk)=> new CellLayer(v, {
        invisible:   true,
        hideOnDrag:  true,
        clip:        '#circle-clip' + ud.args.clipRadius,
        data:        ()=> ud.cache.cells,                                        
    }), 
    (v, ud:UnitDisk)=> new NodeLayer(v, {
        name:        'nodes',
        className:   'node',
        data:        ()=> ud.cache.unculledNodes,
        r:           (d:N)=> ud.args.nodeRadius(ud, d) 
                           * (d.name==='P' ? Pscale(ud)(d) : 1),
        transform:   (d:N)=> d.transformStrCache,
    }),
    (v, ud:UnitDisk)=> new LabelLayer(v, {
        invisible:   true,
        hideOnDrag:  true,   
        name:        'labels',
        className:   'caption',
        data:        ()=> ud.cache.unculledNodes,
        text:        (d:N)=> ({ P:'+', θ:'🠆', λ:'⚲' })[d.name],
        delta:       (d:N)=> deltaMap[d.name],
        transform:   (d:N, delta:C)=> 
            ` translate(${d.cache.re + delta.re} ${d.cache.im + delta.im})` 
            + rotate(d)
    }),
    (v, ud:UnitDisk)=> new InteractionLayer(v, {        
        nohover:     true,
        mouseRadius: 1.5,
        onClick:     (n:N, m:C)=> {}
    })
]