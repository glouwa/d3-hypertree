import * as d3             from 'd3'
import { N }               from '../../models/n/n'
import { ILayer }          from '../layerstack/layer'
import { ILayerView }      from '../layerstack/layer'
import { ILayerArgs }      from '../layerstack/layer'
import { D3UpdatePattern } from '../layerstack/d3updatePattern'
import { CptoCk, CktoCp }  from '../../models/transformation/hyperbolic-math'
import { CmulR, CaddC }    from '../../models/transformation/hyperbolic-math'
import { bboxCenter, setLabelText } from '../layers/label-layer';

export interface LabelForceLayerArgs extends ILayerArgs
{
    name:        string,
    className:   string,
    invisible?:  boolean,
    hideOnDrag?: boolean,
    data:        ()=> any,
    transform,
    text,
    clip?:       string,
    background?: any,          // falsy, or a function of the node: draw a background rect
    scale?:       number | ((n)=> number),   // size bound to the data (default 1), times geometry.shrinkAtRim
    sizeOf?:      (n)=> number,  // the resulting size (set by the preset); default 1
    maxLabels?:   number,      // at most this many labels (default filter.maxlabels; preset-layers.ts)
    hoverLabel?:      boolean, // always a label for the node under the mouse (on top of maxLabels)
    hoverPathLabels?: boolean, // always labels on the path from the node under the mouse to the root
}


var paddingLeftRight = .08
var paddingTopBottom = .02

export class LabelForceLayer implements ILayer
{    
    view:            ILayerView
    args:            LabelForceLayerArgs
    d3updatePattern: D3UpdatePattern
    d3updatePattern2: D3UpdatePattern
    name:            string   
    simulation 
    update = {
        parent:         ()=> this.attach(),    
        force:          ()=> { 
            if (this.args.invisible)
                return
            
            if (this.view.hypertree.isAnimationRunning() && this.args.hideOnDrag)
                return

            this.labelSetUpdate()
            for (let i=0; i<175; ++i)
                this.simulation.tick()
            
        },
        data:           ()=> {
            this.update.force()
            this.d3updatePattern.update.data()
            this.d3updatePattern2.update.data()

            if (this.args.background)
                this.d3updatePattern.addTextBackgroundRects(                
                    paddingLeftRight, 
                    paddingTopBottom,
                    .05,
                    this.args.name)
        },
        transformation: ()=> { 
            this.update.force()           
            this.d3updatePattern.update.transformation()
            this.d3updatePattern2.update.transformation()
        },
        style:          ()=> { 
            this.d3updatePattern.update.style()
            this.d3updatePattern2.update.style()
        }
    }

    constructor(view:ILayerView, args:LabelForceLayerArgs) {
        this.view = view
        this.args = args  
        this.name = args.name

        this.simulation = d3.forceSimulation()
            .alphaTarget(.001)
            .force("link",    d3.forceLink()
                //.distance(2)
                .strength(-.05))
            .force("charge",  d3.forceManyBody()
                .strength(-.05))
            .force("collide", d3.forceCollide()
                .strength(.0025)
                .radius(.18)) // .18
          //  .force('gravity', d3f(0,0)                
         //       .strength(-.001))
            /*.on("tick", ()=> {
                //console.log('sim tick')
                this.update.transformation() 
            })*/
            .stop()
    }

    labelSetUpdate() {         
        
        const labelpoints = []
        const labellinks = []
        this.args.data().forEach(n=>
        {
            n.forcepoints   = n.forcepoints || {}            
            n.forcepoints.index = n.mergeId
            const initxyp = CaddC(n.cache, CptoCk({ θ:n.cachep.θ, r:.001}))
            n.forcepoints.x = initxyp.re
            n.forcepoints.y = initxyp.im
            console.assert(typeof n.forcepoints.x === 'number')
            console.assert(typeof n.forcepoints.y === 'number')

            n.forcepoints2    = n.forcepoints2 || {}            
            n.forcepoints2.index = n.mergeId+2000
            n.forcepoints2.fx = n.cache.re
            n.forcepoints2.fy = n.cache.im
            console.assert(typeof n.forcepoints2.fx === 'number')
            console.assert(typeof n.forcepoints2.fy === 'number')

            labelpoints.push(n.forcepoints)
            labelpoints.push(n.forcepoints2)
            labellinks.push(({                 
                source: n.forcepoints, 
                target: n.forcepoints2,
            }))
        })
        
        this.simulation
            .nodes(labelpoints) // labels aka this.args.data
           
        this.simulation.force("link")
            .links(labellinks)

        //console.log('labelSetUpdate')
    }

    simulationTick() {
    }

    private labellen(d)
    {
        return d.precalc[this.args.name+'len']||0
    }

    private attach() {
        const T = this
        function calctransform(d, i, v) {
            if (!d.forcepoints)
                return ` translate(${d.cache.re} ${d.cache.im})` 
            console.assert(d.forcepoints.x || d.depth === 0)
            // size of the label (sizeOf, from the preset: layer option scale times
            // geometry.shrinkAtRim), centered on its force point
            const k = T.args.sizeOf ? T.args.sizeOf(d) : 1
            return ` translate(${(d.forcepoints.x||0)-T.labellen(d)/2*k} ${d.forcepoints.y||0}) scale(${k})`
        }

        this.d3updatePattern = new D3UpdatePattern({
            parent:            this.view.parent,
            layer:             this,
            clip:              this.args.clip,
            data:              this.args.data,
            name:              this.name,
            className:         this.args.className,
            elementType:       'text', 
            create:            s=> s.classed("P",            d=> d.name == 'P')
                                    .classed("caption-icon", d=> d.precalc.icon && navigator.platform.includes('inux'))
                                    //.style("fill",           d=> d.pathes.finalcolor)
                                    .style("fill",         d=> d.pathes && d.pathes.labelcolor)
                                    .call(s=> setLabelText(s, this.args.text))
                                    .attr("transform",       calctransform),
            updateColor:       s=> s.style("fill",         d=> d.pathes && d.pathes.labelcolor),
            updateTransform:   s=> s.attr("transform",       calctransform)
                                    .call(s=> setLabelText(s, this.args.text))
        })

        function calcXY(d, xy, fp) {
            
        }
        this.d3updatePattern2 = new D3UpdatePattern({
            parent:            this.view.parent,
            layer:             this,
            clip:              this.args.clip,
            data:              this.args.data,
            name:              'label-link',
            className:         'label-link',
            elementType:       'line',
            create:            s=> {},
            updateColor:       s=> {},
            updateTransform:   s=> s.attr('x1',             d=> (d.forcepoints && d.forcepoints.x)||0)
                                    .attr('y1',             d=> (d.forcepoints && d.forcepoints.y)||0)
                                    .attr('x2',             d=> (d.forcepoints2 && d.forcepoints2.x)||0)
                                    .attr('y2',             d=> (d.forcepoints2 && d.forcepoints2.y)||0)                                    
                //.text(                   this.args.text)
        })        
    }
}