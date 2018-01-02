import * as d3  from 'd3'
import { HTML } from 'ducd'
import { t }    from 'ducd'
import { IUnitDisk } from '../../unitdisk/unitdisk'

export class UnitdiskMeta 
{
    private view
    private model : IUnitDisk
    private ui    : HTMLElement & UnitdiskMeta_UI
 
    constructor({ view, model }) {
        this.view = view
        this.model = model
        this.updateParent()
    }

    update = {
        parent:             ()=> this.updateParent(),
        all:                ()=> { 
            // ... model & lang
        },
        model:              ()=> { 
            this.ui.updateModel()
            this.update.layout()
        },
        lang:              ()=> { 
            this.ui.updateLang()            
        },
        layout:             ()=> { 
            this.ui.updateLayout()
            this.update.transformation()
        },
        transformation:     ()=> { 
            this.ui.updateSvgInfo()
            this.ui.updateD3Info()
            this.ui.updateTransformationInfo()
        }
    }

    private updateParent() {
        this.ui = UnitdiskMeta_({
            parent: this.view.parent,            
            className: this.view.className,
            ud: this.model
        })
    }
}

interface UnitdiskMeta_UI {
    updateSvgInfo,
    updateD3Info
    updateModel, 
    updateLang,
    updateTransformationInfo
    updateLayout, 
    updateCachInfo 
}

var row = `
    <div class="label"></div> 
    <div class="nodes"></div> 
    <div class="q"></div> 
    <div class="qmax"></div> 
    <div class="info"></div>
    <div class="bar-bg"></div>`

var sliderrow = (id, classes='')=> `
    <div class="label"> </div> 
    <div class="nodes slider">
        <p class="range-field">
            <input type="range" min="2" max="500" value="160" class="slider" id="myRange">
        </p>
    </div> 
    <div class="q"></div> 
    <div class="qmax"></div> 
    <div class="info"></div>
    <div class="bar-bg"></div>`

var htmlinfo = 
    `<div class="render-info">
        ${row}
        ${row}
        ${sliderrow('')}
        ${sliderrow('')}
        ${row}
        ${row}
    </div>`
    
const colors         = ["#3366cc", "#dc3912", "#ff9900", "#109618", "#990099", "#0099c6", "#dd4477", "#66aa00", "#b82e2e", "#316395", "#994499", "#22aa99", "#aaaa11", "#6633cc", "#e67300", "#8b0707", "#651067", "#329262", "#5574a6", "#3b3eac"];
const typeColors     = colors
const mag_svg        = .1 // 1000#  ?
const mag_load       = 10 // 1000ms
const mag_time       = 4  // 25ms

function hypertreeMeta_({ parent, ud, className })
{

}

function UnitdiskMeta_({ parent, ud, className })
{
    var ui = HTML.parse<HTMLElement & UnitdiskMeta_UI>(htmlinfo)()
    ui.classList.add(className)
    parent.appendChild(ui)

    class Row {                
        label; info; q; qMax; w; bar
        constructor(ui, offset) {
            this.label = <HTMLElement>ui.children[offset+0]
            this.info =  <HTMLElement>ui.children[offset+1]
            this.q =     <HTMLElement>ui.children[offset+2]
            this.qMax =  <HTMLElement>ui.children[offset+3]
            this.w =     <HTMLElement>ui.children[offset+4]
            this.bar =   <HTMLElement>ui.children[offset+5]
        }
    }

    class SliderRow {                
        label; info; q; qMax; w; bar
        constructor(ui, offset) {
            this.label = <HTMLElement>ui.children[offset+0]
            this.info =  <HTMLElement>ui.children[offset+1]
            this.q =     <HTMLElement>ui.children[offset+2]
            this.qMax =  <HTMLElement>ui.children[offset+3]
            this.w =     <HTMLElement>ui.children[offset+4]            
        }
    }

    var rows = {        
        rendering: new Row(ui, 0),
        d3:        new Row(ui, 6),
        transform: new Row(ui, 12),
        layout:    new Row(ui, 18),
        data:      new Row(ui, 24),
    }
    
    var slider = ui.querySelector('.range-field > input')
    ud.args.hypertree.magic = 1/slider.value
    slider.oninput = function (e) { 
        ud.args.hypertree.magic = 1/slider.value
        ud.args.hypertree.updateTransformation()
    }

    var colorScale = d3.scaleLinear<d3.ColorCommonInstance>()
        .domain([1, 10])
        .range([d3.rgb('#a5d6a7'), d3.rgb('#e53935')])
        .interpolate(d3.interpolateHcl)
        .clamp(true)

    var updateBar = (view, vec, cvec)=> {
        var c=0
        var l = vec.map((e, i, v)=> { c+=e; return c-e; })
        var data = t([vec, cvec, l])
        var cursor = 0
        var diff = d3.select(view).selectAll('div').data(data)
        diff.enter().append('div')
            .attr('class', 'bar')
            .merge(diff)
            .style('left', d=> d[2]+'%')
            .style('width', d=> d[0]+'%')
            .style('background-color', d=> d[1])
        diff.exit().remove()
    }

    ui.updateSvgInfo = ()=> {        

        var layerStack = ud.layerStack
        var Δ = []
        if (layerStack)
            for (var l in layerStack.layers) {            
                var d3updatePattern = layerStack.layers[l].d3updatePattern                
                var elemCount = d3updatePattern ? d3updatePattern.data.length : 1
                Δ.push(elemCount)
            }
        var a = Δ.reduce((a,e)=> a+e, 0).toFixed(0)
        
        updateBar(rows.rendering.bar, Δ.map(e=> e*mag_svg), typeColors)
        rows.rendering.label.innerHTML = `SVG`                
        rows.rendering.q.innerHTML     = `${a}` 
        rows.rendering.qMax.innerHTML  = `<sub>#</sub>`
    }
 
    ui.updateD3Info = ()=> {
 
        var cache = ud.args.transformation.cache
        var Δ = ud.layerStack.d3meta.Δ 
        var layerlist = ud.layerStack.d3meta.names

        var t = Δ.reduce((a,e)=> a+e).toFixed(0)

        rows.d3.label.innerHTML = `D<sub>3</sub>`
        rows.d3.info.innerHTML  = `${cache.unculledNodes.length} unc. nodes`
        rows.d3.info.title      = Δ.map((e, i)=> `${layerlist[i]}: ${e.toFixed(1)}ms`).join('\n')
        rows.d3.q.innerHTML     = `${t}`
        rows.d3.qMax.innerHTML  = `<sub>ms</sub>`

        updateBar(rows.d3.bar, Δ.map(e=> e*mag_time), typeColors)
    }

    ui.updateTransformationInfo = ()=> {
        
        var cache = ud.args.transformation.cache
        var Δ = ud.cacheMeta.Δ  
        var minWeight = ud.cacheMeta.minWeight 
 
        var t = Δ.reduce((a,e)=> a+e).toFixed(0)
        var na = cache.unculledNodes.length
        var hwexits = minWeight.map(n=>n.toFixed(1)).join(' ⟶ ')
        var Δms = Δ.map(n=>n.toFixed(1))
         
        updateBar(rows.transform.bar, Δ.map(e=> e*mag_time), ['#2196f3', '#ffc107', '#673ab7', '#4caf50'])
        rows.transform.label.innerHTML = `Transf.`
        //transformInfo.innerHTML  = `${na} nodes<sub>w > ${'...'}</sub>`
        rows.transform.info.title      = `Visible node count: ${na}\n`        
        rows.transform.info.title     += `Min weigth: ${hwexits}\n`
        rows.transform.info.title     += `${Δms[0]} culling\n${Δms[1]} lazysearch\n${Δms[2]} voronoi\n${Δms[3]} labels`
        rows.transform.q.innerHTML     = `${t}`
        rows.transform.qMax.innerHTML  = `<sub>ms</sub>`
    }

    ui.updateLayout = ()=> {
        
        var Δ = ud.args.hypertree.layoutMeta.Δ
              
        updateBar(rows.layout.bar, [Δ].map(e=> e*mag_time), ['#2196f3'])
        rows.layout.label.innerHTML = `Layout`        
        rows.layout.q.innerHTML     = `${Δ.toFixed()}`
        rows.layout.qMax.innerHTML  = `<sub>ms</sub>`
    }

    ui.updateModel = ()=> {
        
        var Δ = ud.args.hypertree.modelMeta.Δ
        var model = ud.args.hypertree.data

        // do the hole DSIT STUFF!

        var n = model.descendants().length
        var t = Δ.reduce((a,e)=> a+e).toFixed(0)
        var l = model.leaves().length
        var lp = (l / n).toPrecision(1)
        var i = n - l
        var h = model.height
        var ø = 0; model.each(cn=> ø += (cn.children||[]).length/i)

        updateBar(rows.data.bar, Δ.map(e=>e/mag_load), ['#ff9800', '#2196f3', 'green'])
        rows.data.label.innerHTML = `Load`
        rows.data.info.innerHTML  = `${n} raw nodes`
        rows.data.info.title      = `download: ${Δ[0].toFixed(0)}ms\n`
        rows.data.info.title     += `parse: ${Δ[1].toFixed(0)}ms\n`
        rows.data.info.title     += `hierarchy and weights: ${Δ[2].toFixed(0)}ms\n`
        rows.data.info.title     += `${lp} leaves\n`
        rows.data.info.title     += `↕ max: ${h}\n`
        rows.data.info.title     += `↕ μ: ?\n`
        rows.data.info.title     += `↕ ⌀: ?\n`
        rows.data.info.title     += `○ max: ?\n`
        rows.data.info.title     += `○ μ: ${ø.toPrecision(2)}\n`
        rows.data.info.title     += `○ ⌀: ?\n`
        rows.data.q.innerHTML     = `${(t/1000).toFixed(1)}`
        rows.data.qMax.innerHTML  = `<sub>s</sub>`
    }
    ui.updateLang = ()=> {
        
        var Δ = ud.args.hypertree.modelMeta.Δ
        var model = ud.args.hypertree.data

        // do the hole DSIT STUFF!

        var n = model.descendants().length
        var t = Δ.reduce((a,e)=> a+e).toFixed(0)
        var l = model.leaves().length
        var lp = (l / n).toPrecision(1)
        var i = n - l
        var h = model.height
        var ø = 0; model.each(cn=> ø += (cn.children||[]).length/i)

        updateBar(rows.data.bar, Δ.map(e=>e/mag_load), ['#ff9800', '#2196f3', 'green'])
        rows.data.label.innerHTML = `Load`
        rows.data.info.innerHTML  = `${n} raw nodes`
        rows.data.info.title      = `download: ${Δ[0].toFixed(0)}ms\n`
        rows.data.info.title     += `parse: ${Δ[1].toFixed(0)}ms\n`
        rows.data.info.title     += `hierarchy and weights: ${Δ[2].toFixed(0)}ms\n`
        rows.data.info.title     += `${lp} leaves\n`
        rows.data.info.title     += `↕ max: ${h}\n`
        rows.data.info.title     += `↕ μ: ?\n`
        rows.data.info.title     += `↕ ⌀: ?\n`
        rows.data.info.title     += `○ max: ?\n`
        rows.data.info.title     += `○ μ: ${ø.toPrecision(2)}\n`
        rows.data.info.title     += `○ ⌀: ?\n`
        rows.data.q.innerHTML     = `${(t/1000).toFixed(1)}`
        rows.data.qMax.innerHTML  = `<sub>s</sub>`
    }

    return ui
}
