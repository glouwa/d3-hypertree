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

const colors         = ["#3366cc", "#dc3912", "#ff9900", "#109618", "#990099", "#0099c6", "#dd4477", "#66aa00", "#b82e2e", "#316395", "#994499", "#22aa99", "#aaaa11", "#6633cc", "#e67300", "#8b0707", "#651067", "#329262", "#5574a6", "#3b3eac"];
const typeColors     = colors

const maxTime = 25     // 25ms
const maxSvg = 1000
const maxD3 = maxTime  
const maxLoad = 1000   // 1000ms


const mag_svg        = .1 // 1000#  ?
const mag_load       = 10 // 1000ms
const mag_time       = 4  // 25ms 

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

var colorScale = d3.scaleLinear<d3.ColorCommonInstance>()
        .domain([1, 10])
        .range([d3.rgb('#a5d6a7'), d3.rgb('#e53935')])
        .interpolate(d3.interpolateHcl)
        .clamp(true)

var row = `
    <div class="label"></div> 
    <div class="nodes"></div> 
    <div class="q"></div> 
    <div class="qmax"></div> 
    <div class="info"></div>
    <div class="info2"></div>
    <div class="bar-bg"></div>`

var sliderrow = (id, classes='')=> `
    <div class="label"> </div> 
    <div class="sm"><sub>2</sub></div> 
    <div class="slider">
        <p class="range-field">
            <input type="range" min="2" max="500" value="160" class="slider" id="myRange">
        </p>
    </div>     
    <div class="qmax"></div> 
    <div class="info-oneRowSpan"></div>
    <div class="info2-oneRowSpan"></div>`

var work = `
    <div class="label"></div> 
    <div class="min"><sub>1</sub></div> 
    <div class="hist">
        <div style="height:100%"></div>
        <div style="height:70%"></div>
        <div style="height:30%"></div>
        <div style="height:45%"></div>

        <div style="height:70%"></div>
        <div style="height:60%"></div>
        <div style="height:80%"></div>
        <div style="height:65%"></div>

        <div style="height:30%"></div>
        <div style="height:20%"></div>
        <div style="height:25%"></div>
        <div style="height:15%"></div>

    </div> 
    <div class="qmax"></div> 
    <div class="info-oneRowSpan"></div>
    <div class="info2-oneRowSpan"></div>`

var htmlinfo = 
    `<div class="render-info">
        ${row}
        ${row}
        ${row}        
        ${sliderrow('')}
        ${sliderrow('')}
        ${row}        
        ${work}
        ${work}
        ${work}
        ${row}
        ${row}
    </div>`

function hypertreeMeta_({ parent, ud, className })
{
}

function UnitdiskMeta_({ parent, ud, className })
{
    var ui = HTML.parse<HTMLElement & UnitdiskMeta_UI>(htmlinfo)()
    ui.classList.add(className)
    parent.appendChild(ui)

    var e = 0
    var re = 7
    var rows = {                
        rendering: new BarRow   (ui, e+=0,  'SVG',                 '<sub>#</sub>'),
        d3:        new BarRow   (ui, e+=re, 'D<sub>3</sub>',       '<sub>ms</sub>'),
        transform: new BarRow   (ui, e+=re, '∀<sub>visible</sub>', '<sub>ms</sub>'),     
        cullmaxw:  new SliderRow(ui, e+=re, 'ω<sub>cull</sub>',    '<sub>.5k</sub>'),
        lambda:    new SliderRow(ui, e+=6,  'λ',                   '<sub>1</sub>'),
        layout:    new BarRow   (ui, e+=6,  'Select',              '<sub>ms</sub>'),        
        degree:    new TextRow  (ui, e+=re, 'δ',                   '<sub>97</sub>'), 
        weights:   new TextRow  (ui, e+=6,  'ω',                   '<sub>34k</sub>'),
        heights:   new TextRow  (ui, e+=6,  'τ',                   '<sub>79</sub>'),
        data:      new BarRow   (ui, e+=6,  'Load',                '<sub>s</sub>'),
        lang:      new BarRow   (ui, e+=re, 'Lang',                '<sub>s</sub>'),
    }
    
    function ping(v) {                
        v.style.opacity = 1
        v.style.animation = ""        
        requestAnimationFrame(()=> {             
            //v.style.animation = "blink-out 750ms cubic-bezier(0.070, 0.065, 0.765, -0.135)"
            //v.style.animation = "blink-out 2ms cubic-bezier(0.070, 0.455, 0.850, 0.420)"
            v.style.animation = "blink-out 2s cubic-bezier(0.145, 1.130, 0.725, 0.590)"            
            v.style.opacity = 0
        })
    }

    // zu slider row
    var slider = ui.querySelector('.range-field > input')
    ud.args.hypertree.magic = 1/slider.value
    slider.oninput = function (e) { 
        ud.args.hypertree.magic = 1/slider.value
        ud.args.hypertree.updateTransformation()
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
                
        const v = rows.rendering
        v.q.innerHTML = `${a}` 
        
        updateBar(v.bar, Δ.map(e=> e*mag_svg), typeColors)                
        ping(v.useIndic)
        if (parseFloat(a) > maxSvg)
            ping(v.overuseIndic)        
    }
 
    ui.updateD3Info = ()=> { 
        var cache = ud.args.transformation.cache
        var Δ = ud.layerStack.d3meta.Δ 
        var layerlist = ud.layerStack.d3meta.names

        var t = Δ.reduce((a,e)=> a+e).toFixed(0)

        const v = rows.d3
        
        v.info.innerHTML = `${cache.unculledNodes.length} nodes`
        v.info.title     = Δ.map((e, i)=> `${layerlist[i]}: ${e.toFixed(1)}ms`).join('\n')
        v.q.innerHTML    = `${t}`

        updateBar(v.bar, Δ.map(e=> e*mag_time), typeColors)
        //v.useIndic.style.backgroundColor = true ? '#666' : 'none'
        //v.overuseIndic.style.backgroundColor = (parseFloat(t) > maxTime) ? 'red' : 'transparent'
        ping(v.useIndic)
        if (parseFloat(t) > maxTime)
            ping(v.overuseIndic)
    }

    ui.updateTransformationInfo = ()=> {        
        var cache = ud.args.transformation.cache
        var Δ = ud.cacheMeta.Δ  
        var minWeight = ud.cacheMeta.minWeight 
 
        var t = Δ.reduce((a,e)=> a+e).toFixed(0)
        var na = cache.unculledNodes.length
        var hwexits = minWeight.map(n=>n.toFixed(1)).join(' ⟶ ')
        var Δms = Δ.map(n=>n.toFixed(1))
        
        const v = rows.transform

        v.info.innerHTML  = `state, sets, voro`
        v.info.title      = `Visible node count: ${na}\n`        
        v.info.title     += `Min weigth: ${hwexits}\n` 
        v.info.title     += `${Δms[0]} culling\n${Δms[1]} lazysearch\n${Δms[2]} voronoi\n${Δms[3]} labels`
        v.q.innerHTML     = `${t}`        

        updateBar(v.bar, Δ.map(e=> e*mag_time), ['#2196f3', '#ffc107', '#673ab7', '#4caf50'])        
        //v.useIndic.style.backgroundColor = true ? '#666' : 'none'
        //v.overuseIndic.style.backgroundColor = (parseFloat(t) > maxTime) ? 'red' : 'transparent'
        ping(v.useIndic)
        if (parseFloat(t) > maxTime)
            ping(v.overuseIndic)
    }

    ui.updateLayout = ()=> {        
        var Δ = ud.args.hypertree.layoutMeta.Δ
        
        const v = rows.layout

        v.info.innerHTML  = `32 • 77 • 4k`
        v.q.innerHTML     = `${Δ.toFixed()}`        

        updateBar(v.bar, [Δ].map(e=> e*mag_time), ['#2196f3'])        
        //v.useIndic.style.backgroundColor = true ? '#666' : 'none'
        //v.overuseIndic.style.backgroundColor = (parseFloat(Δ) > maxTime) ? 'red' : 'transparent'
        ping(v.useIndic)
        if (parseFloat(Δ) > maxTime)
            ping(v.overuseIndic)
    }

    const d3format = d3.format('.3s')
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

        const v = rows.data

        v.info.innerHTML  = `${d3format(n)} nodes • 3kB` 
        v.info.title      = `download: ${Δ[0].toFixed(0)}ms\n`
        v.info.title     += `parse: ${Δ[1].toFixed(0)}ms\n`
        v.info.title     += `hierarchy and weights: ${Δ[2].toFixed(0)}ms\n`
        v.info.title     += `${lp} leaves\n`
        v.info.title     += `↕ max: ${h}\n`
        v.info.title     += `↕ μ: ?\n`
        v.info.title     += `↕ ⌀: ?\n`
        v.info.title     += `○ max: ?\n`
        v.info.title     += `○ μ: ${ø.toPrecision(2)}\n`
        v.info.title     += `○ ⌀: ?\n`
        v.q.innerHTML     = `${(t/1000).toFixed(1)}`        

        updateBar(v.bar, Δ.map(e=>e/mag_load), ['#ff9800', '#2196f3', 'green'])        
        //v.useIndic.style.backgroundColor = true ? '#666' : 'none'
        //v.overuseIndic.style.backgroundColor = (parseFloat(t) > 1000) ? 'red' : 'transparent'
        ping(v.useIndic)
        if (parseFloat(t) > 1000)
            ping(v.overuseIndic)
    }
    
    ui.updateLang = ()=> {        
        var Δ = ud.args.hypertree.langMeta.Δ 
        var model = ud.args.hypertree.data
        const Δs = Δ/1000

        // do the hole DSIT STUFF!
        const v = rows.lang

        v.info.innerHTML  = `34k • 7k • 1k • 34`
        v.q.innerHTML     = Δs.toFixed(1)

        updateBar(v.bar, Δ.map(e=>e/mag_load), ['#ff9800', '#2196f3', 'green'])        
//        v.useIndic.style.backgroundColor = true ? '#666' : 'none'
  //      v.overuseIndic.style.backgroundColor = (Δ > 1000) ? 'red' : 'transparent'
        ping(v.useIndic)
        if (Δ > 1000)
            ping(v.overuseIndic)
    }

    return ui
}

class TextRow 
{
    label; info; q; qMax; w;
    constructor(ui, offset, desc, unit) {
        this.label = <HTMLElement>ui.children[offset+0]
        this.info =  <HTMLElement>ui.children[offset+1]
        this.q =     <HTMLElement>ui.children[offset+2]
        this.qMax =  <HTMLElement>ui.children[offset+3]
        this.w =     <HTMLElement>ui.children[offset+4]
        
        this.label.innerHTML = desc
        // this.info.innerHTML = '0'
        this.qMax.innerHTML = unit
    }
}

class BarRow extends TextRow
{
    bar; useIndic; overuseIndic;
    constructor(ui, offset, desc, unit) {
        super(ui, offset, desc, unit)        
        this.bar          = <HTMLElement>ui.children[offset+6]
        this.useIndic     = <HTMLElement>ui.children[offset+4]
        this.overuseIndic = <HTMLElement>ui.children[offset+5]        
    }
}

class SliderRow 
{
    label; info; q; qMax; w; bar
    constructor(ui, offset, desc, unit) {
        this.label = <HTMLElement>ui.children[offset+0]
        this.info =  <HTMLElement>ui.children[offset+1]        
        this.qMax =  <HTMLElement>ui.children[offset+3]
        this.w =     <HTMLElement>ui.children[offset+4]
        
        this.label.innerHTML = desc
        // this.info.innerHTML = '0'
        this.qMax.innerHTML = unit
    }
}

class BoxplotRow {                
    label; info; q; qMax; w; bar
    constructor(ui, offset) {
        this.label = <HTMLElement>ui.children[offset+0]
        this.info =  <HTMLElement>ui.children[offset+1]
        this.q =     <HTMLElement>ui.children[offset+2]
        this.qMax =  <HTMLElement>ui.children[offset+3]
        this.w =     <HTMLElement>ui.children[offset+4]
        
        this.label.innerText = 'hallo'
    }
}

class HistRow {                
    label; info; q; qMax; w; bar
    constructor(ui, offset) {
        this.label = <HTMLElement>ui.children[offset+0]
        this.info =  <HTMLElement>ui.children[offset+1]
        this.q =     <HTMLElement>ui.children[offset+2]
        this.qMax =  <HTMLElement>ui.children[offset+3]
        this.w =     <HTMLElement>ui.children[offset+4]
        
        this.label.innerText = 'hallo' 
    }
}

