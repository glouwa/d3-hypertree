import * as d3                           from 'd3'
import { HTML }                          from 'duct'
import { N }                             from '../../models/n'
import { obj2data }                      from '../../models/n-loaders'
import { C, CktoCp, CmulR, CsubC }       from '../../hyperbolic-math'
import { dfsFlat, πify, CassignC }       from '../../hyperbolic-math'
import { ArrAddR }                       from '../../hyperbolic-math'
import { lengthDilledation }             from '../../hyperbolic-math'

import { Transformation }                from '../../hyperbolic-transformation'
import { PanTransformation }             from '../../hyperbolic-transformation'
import { NegTransformation }             from '../../hyperbolic-transformation'
import { TransformationCache }           from '../../hyperbolic-transformation'
import { Layer }                         from '../layers'
import { UnitDiskUi }                    from './dataAndInteraction'
import { Interaction, InteractionArgs }  from './mouseAndCache'
import { Layers }                        from './layerStack'

var bubblehtml =
    `<defs>
        <radialGradient id="exampleGradient">
            <stop offset="50%"   stop-color="white"/>
            <stop offset="92%"   stop-color="#f5fbfe"/>
            <stop offset="99.8%" stop-color="#ddeffd"/>
            <stop offset="100%"  stop-color="#90caf9"/>
        </radialGradient>
    </defs>`

var html =
    `<div class="unitdisk-nav">
        <svg width="100%" height="100%" preserveAspectRatio="xMidYMid meet" viewBox="-0 0 1000 1000">
            ${bubblehtml}
            <g class="unitDisc" transform="translate(520,500) scale(470)"></g>
        </svg>
        <div class="preloader"></div>
    </div>`

var htmlnav =
    `<div class="unitdisk-nav">
        <svg width="100%" height="100%" preserveAspectRatio="xMidYMid meet" viewBox="-0 0 1000 1000">
            ${bubblehtml}
            <g class="unitDisc"            transform="translate(520,500) scale(470)"></g>
            <g class="nav-background-disc" transform="translate(105,105) scale(70)"></g>
            <g class="nav-parameter-disc"  transform="translate(105,105) scale(70)"></g>
        </svg>
        <div class="preloader"></div>
    </div>`

export function DecoratorNon(args : InteractionArgs)
{
    var ui = HTML.parse<HTMLElement & UnitDiskUi>(html)()
    args.parent.appendChild(ui)

    ui.args = args
    ui.updatePositions = ()=>  layerstack.updatePositions()
    ui.updateSelection = ()=>  layerstack.updateSelection()
    ui.updateData = ()=> {
        layerstack.args.data = ui.args.data
        layerstack.updatePositions()
    }

    args.parent = ui.querySelector('.unitDisc')
    var layerstack = new Interaction(args)
    return ui
}

export function DecoratorNav(args : InteractionArgs)
{
    var ui = HTML.parse<HTMLElement & UnitDiskUi>(htmlnav)()
    args.parent.appendChild(ui)

    ui.args = args
    ui.updateData = ()=> {
        navBackground.args.data = ui.args.data
        navBackground.updatePositions()
        view.args.data = ui.args.data
        view.updatePositions()
        navParameter.updatePositions()
    }
    ui.updatePositions = ()=> { view.updatePositions(); navParameter.updatePositions();  }
    ui.updateSelection = ()=> { view.updateSelection(); navBackground.updateSelection(); }

    args.parent = ui.querySelector('.unitDisc')
    var view = new Interaction(args)

    var navBackground = new Interaction({
        parent:             ui.querySelector('.nav-background-disc'),
        unitdisk:           args.unitdisk,
        data:               args.data,
        layers:             args.layers.filter((l, idx)=> idx!==3), // no labels here

        cacheUpdate:        args.cacheUpdate,
        transformation:     args.transformation,
        transform:          (n:N)=> n.z,

        onClick:            (n:N, m:C)=> {},

        caption:            (n:N)=> undefined,
        nodeRadius:         .012,
        clipRadius:         1,
        mouseRadius:        0,
    })

    var navTransformation =
        new NegTransformation(
            new PanTransformation(args.transformation.state))

    var rotate = d=>
        (d.name === 'λ' ? ' rotate(-30)' : ' rotate(0)')
    var Pscale =  ls=> d=>
        lengthDilledation(d)
        * (1 - πify(CktoCp(ls.args.transformation.state.λ).θ) / 2 / Math.PI)
        / ls.args.nodeRadius
    var navParameter = new Interaction({
        parent:             ui.querySelector('.nav-parameter-disc'),
        unitdisk:           args.unitdisk,
        data:               obj2data(args.transformation.state),        
        layers:             [
                                (ls:Interaction, par)=> new Layers.NodeLayer({
                                    parent:      par,
                                    data:        l=> ls.cache.filteredNodes,
                                    r:           l=> d=> ls.args.nodeRadius
                                                       * (d.name==='P' ? Pscale(ls)(d) : 1),
                                    transform:   l=> d=> d.transformStrCache,
                                }),
                                (ls:Interaction, par)=> new Layers.LabelLayer({
                                    parent:      par,
                                    data:        l=> ls.cache.filteredNodes,
                                    text:        l=> d=> ({P:'+', θ:'🗘', λ:'⚲' })[d.name],
                                    delta:       l=> d=> ({ re:.0025, im:.025 }),
                                    transform:   l=> d=> d.transformStrCache + rotate(d)
                                })
                            ],
        cacheUpdate:        (interaction:Interaction, cache:TransformationCache)=> {
                                cache.filteredNodes = dfsFlat(interaction.args.data)
                                for (var n of cache.filteredNodes) {
                                    n.cache = n.cache || { re:0, im:0 }
                                    CassignC(n.cache, interaction.args.transform(n))

                                    n.cachep            = CktoCp(n.cache)
                                    n.strCache          = n.cache.re + ' ' + n.cache.im
                                    n.scaleStrText      = ` scale(1)`
                                    n.transformStrCache = ` translate(${n.strCache})`
                                }
                                try { cache.voronoiDiagram = interaction.voronoiLayout(cache.filteredNodes) } catch(e) {}
                            },
        transformation:     navTransformation,
        transform:          (n:N)=> CmulR(n,-1),

        onClick:            (n:N, m:C)=> {}, //args.onAnimateTo(navTransformation, n, CsubC(m, navTransformation.state.P)),

        caption:            (n:N)=> undefined,
        nodeRadius:         .21,
        clipRadius:         1.4,
        mouseRadius:        1.4,
    })

    return ui
}


