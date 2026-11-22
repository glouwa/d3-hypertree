import * as d3            from 'd3'
import { HTML }           from '../../../ducd'
import { t }              from '../../../ducd'
import { stringhash }     from '../../../ducd'
import { googlePalette }  from '../../../ducd'
import { IUnitDisk }      from '../../unitdisk/unitdisk'
import { CptoCk, CktoCp } from '../../../models/transformation/hyperbolic-math'
import { πify }           from '../../../models/transformation/hyperbolic-math'

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
        lang:               ()=> { 
            this.ui.updateLang()            
        },
        layout:             ()=> { 
            this.ui.updateLayout()
            this.update.transformation()
            this.ui.updateλω()
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

var barrow = `
    <div class="label"></div> 
    <div class="nodes"></div> 
    <div class="q"></div> 
    <div class="qmax"></div> 
    <div class="info"></div>
    <div class="info2"></div>
    <div class="bar-bg"></div>`

var sliderrow = (id, min, max, val, classes='')=> `
    <div class="label"> </div> 
    <div class="sm"><sub>2</sub></div> 
    <div class="slider">
        <p class="range-field">
            <input type="range" min="${min}" max="${max}" value="${val}" class="slider" id="myRange" step="0.01">
        </p>
    </div>     
    <div class="q left-aligned"></div> 
    <div class="qmax"></div> 
    <div class="info-oneRowSpan"></div>
    <div class="info2-oneRowSpan"></div>`

var histrow = `
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
    <div class="q left-aligned"></div> 
    <div class="qmax"></div> 
    <div class="info-oneRowSpan"></div>
    <div class="info2-oneRowSpan"></div>`

var htmlinfo = 
    `<div class="render-info">
        ${barrow}        
        ${histrow}
        ${histrow}
        ${histrow}
        ${barrow}        
        ${sliderrow('', .4, .9, .5)}
        ${sliderrow('', 2, 500, 160)}        
        ${barrow}        
        ${barrow}                
        ${barrow}
        ${barrow}
    </div>`

interface UnitdiskMeta_UI {
    updateSvgInfo,
    updateD3Info
    updateModel, 
    updateLang,
    updateTransformationInfo
    updateTransformation?,
    updateLayout,
    updateCachInfo,
    updateλω
}

function hypertreeMeta_({ parent, ud, className })
{
    var ui = HTML.parse<HTMLElement & UnitdiskMeta_UI>(htmlinfo)()
    ui.classList.add(className)
    parent.appendChild(ui)

    ui.updateModel = ()=>{}
    ui.updateLang = ()=>{}
    ui.updateLayout = ()=>{}
    ui.updateTransformation = ()=>{}

    return ui
}
/*
function hypertreeMeta2_({ parent, ud, className })
{
    var ui = hypertreeMeta_({ parent, ud, className })
    
    areas = {
        d3svg
        transformationforAll // spezific
        transformationSelect // general (must have)
        modellang
    }  
    return ui
}

function hypertreeMeta2_({ parent, ud, className })
{
    var ui = hypertreeMeta_({ parent, ud, className })
    
    areas = {
        d3svg
        transformationforAll // spezific
        transformationSelect // general (must have)
        modellang
    }  
    return ui
}
*/

var π = Math.PI

function UnitdiskMeta_({ parent, ud, className })
{
    var ui = HTML.parse<HTMLElement & UnitdiskMeta_UI>(htmlinfo)()
    ui.classList.add(className)
    parent.appendChild(ui)

    const sliderBindingλ = {
        toView: (slider)=> {
            slider.value = 1-ud.args.transformation.state.λ
        },
        fromView: (slider)=> {            
            ud.args.transformation.state.λ = 1-slider.value
            ud.view.hypertree.updateLayoutPath_(ud.args.transformation.cache.centerNode)
            ud.view.hypertree.update.transformation()
        }
    }

    const sliderBindingω = {
        toView: (slider)=> {
            slider.value = ud.view.hypertree.args.filter.weightFilter.magic            
        },
        fromView: (slider)=> {
            ud.view.hypertree.args.filter.weightFilter.magic = slider.value
            ud.view.hypertree.update.transformation()
        }
    }

    function sliderInit(sliderHtml, binding) {        
        var slider = sliderHtml.querySelector('input')        
        binding.toView(slider)
        slider.oninput = e=> binding.fromView(slider)
        slider.onmousedown = e=> e.stopPropagation()
        slider.onmousemove = e=> e.stopPropagation()
        slider.onmouseup = e=> e.stopPropagation()
        slider.ontouchstart = e=> e.stopPropagation()
        slider.ontouchmove = e=> e.stopPropagation()
        slider.ontouchend = e=> e.stopPropagation()
        slider.ontouchcanel = e=> e.stopPropagation()
    }

    const λsliderInit = (sliderHtml)=> sliderInit(sliderHtml, sliderBindingλ)
    const ωsliderInit = (sliderHtml)=> sliderInit(sliderHtml, sliderBindingω)

    var e = 0
    var re = 7     
    var rows = {
        lang:      new BarRow   (ui, e+=0,  'Lang',                '<sub>s</sub>'),        
        heights:   new HistRow  (ui, e+=7,  'τ',                   '<sub>79</sub>'),
        weights:   new HistRow  (ui, e+=7,  'ω',                   '<sub>34k</sub>'),
        degree:    new HistRow  (ui, e+=re, 'δ<sup>+</sup>',       '<sub>97</sub>'), 
        data:      new BarRow   (ui, e+=7,  'Load',                '<sub>s</sub>'),        
        lambda:    new SliderRow(ui, e+=7,  'λ',                   '<sub>1</sub>', λsliderInit, v=> `<sub>.${v*10}</sub>`),
        cullmaxw:  new SliderRow(ui, e+=re, 'ω<sub>cull</sub>',    '<sub>.5k</sub>', ωsliderInit, v=> `<sub>${v}</sub>`),
        layout:    new BarRow   (ui, e+=7,  'Filter',              '<sub>ms</sub>'),        
        transform: new BarRow   (ui, e+=re, '∀<sub>visible</sub>', '<sub>ms</sub>'),     
        d3:        new BarRow   (ui, e+=re, 'D<sub>3</sub>',       '<sub>ms</sub>'),
        rendering: new BarRow   (ui, e+=re, 'Σ',                   '<sub>ms</sub>'),
    }
    
    ui.updateλω = ()=> {
        var π = Math.PI
        rows.lambda.slider.querySelector('input').value = 1-ud.args.transformation.state.λ
        rows.cullmaxw.slider.querySelector('input').value = ud.view.hypertree.args.filter.weightFilter.magic
    }

    ui.updateSvgInfo = ()=> {
        const layerStack = ud.layerStack
        const Δ = []
        const colors = []
        if (layerStack)
            for (var l in layerStack.layers) {            
                const d3updatePattern = layerStack.layers[l].d3updatePattern                
                const elemCount = d3updatePattern ? d3updatePattern.data.length : 1
                Δ.push(elemCount)
                colors.push(googlePalette(stringhash(layerStack.layers[l].name)))
            }
            const a = Δ.reduce((a,e)=> a+e, 0).toFixed(0)
                
        const v = rows.rendering
        v.q.innerHTML = `${a}` 
        
        updateBar(v.bar, Δ.map(e=> e*mag_svg), colors)                
        ping(v.useIndic)
        ping(v.overuseIndic, parseFloat(a) > maxSvg)        
    }
 
    ui.updateD3Info = ()=> { 
        const cache = ud.args.transformation.cache
        const Δ = ud.layerStack.d3meta.Δ 
        const layerlist = ud.layerStack.d3meta.names

        const t = Δ.reduce((a,e)=> a+e).toFixed(0)
        const colors = layerlist.map(e=> googlePalette(stringhash(e)))

        const v = rows.d3
        
        v.info.innerHTML = `${cache.unculledNodes.length}<sub>N</sub>`
        v.info.title     = Δ.map((e, i)=> `${layerlist[i]}: ${e.toFixed(1)}ms`).join('\n')
        v.q.innerHTML    = `${t}`

        updateBar(v.bar, Δ.map(e=> e*mag_time), colors)
        ping(v.useIndic)
        if (parseFloat(t) > maxTime) ping(v.overuseIndic)
    }

    ui.updateTransformationInfo = ()=> {        
        const cache = ud.args.transformation.cache
        const Δ = ud.cacheMeta.Δ  
        const minWeight = ud.cacheMeta.minWeight 
 
        const t = Δ.reduce((a,e)=> a+e).toFixed(0)
        const na = cache.unculledNodes.length
        const hwexits = minWeight.map(n=>n.toFixed(1)).join(' ⟶ ')
        const Δms = Δ.map(n=>n.toFixed(1))
        
        const v = rows.transform

        v.info.innerHTML  = `state, sets, voro`
        v.info.title      = `Visible node count: ${na}\n`        
        v.info.title     += `Min weigth: ${hwexits}\n` 
        v.info.title     += `${Δms[0]} init\n${Δms[1]} culling\n${Δms[2]} pathes+sets\n${Δms[3]} voronoi+labels`
        v.q.innerHTML     = `${t}`        

        updateBar(v.bar, Δ.map(e=> e*mag_time), ['#2196f3', '#ffc107', '#673ab7', '#4caf50'])        
        ping(v.useIndic)
        if (parseFloat(t) > maxTime) ping(v.overuseIndic)
    }

    const sep = '&nbsp; •&ensp;'
    ui.updateLayout = ()=> {        
        const Δ = ud.view.hypertree.layoutMeta.Δ
        
        const v = rows.layout

        v.info.innerHTML  = `32<sub>P</sub>${sep}77<sub>Sel</sub>${sep}4<sub>k visible</sub>`
        v.q.innerHTML     = `${Δ.toFixed()}`        

        updateBar(v.bar, [Δ].map(e=> e*mag_time), ['#2196f3'])                
        ping(v.useIndic)
        if (parseFloat(Δ) > maxTime) ping(v.overuseIndic)
    }

    const d3format = d3.format('.3s')
    ui.updateModel = ()=> {        
        const Δ = ud.view.hypertree.modelMeta.Δ
        const kb = (ud.view.hypertree.modelMeta.filesize/1024).toFixed(0)
        const model = ud.view.hypertree.data

        // do the hole DSIT STUFF!

        const n = model.descendants().length
        const t = Δ.reduce((a,e)=> a+e).toFixed(0)
        const l = model.leaves().length
        const lp = (l / n).toPrecision(1)
        const i = n - l
        const h = model.height
        let ø = 0; model.each(cn=> ø += (cn.children||[]).length/i)

        const v = rows.data

        v.info.innerHTML  = `${kb}<sub>kB</sub>${sep}${mysi(n)}<sub>N</sub>` 
        v.info.title      = `download: ${Δ[0].toFixed(0)}ms\n`
        v.info.title     += `parse: ${Δ[1].toFixed(0)}ms\n`
        v.info.title     += `hierarchy: ${Δ[2].toFixed(0)}ms\n`
        v.info.title     += `weights: ${Δ[3].toFixed(0)}ms\n`
        v.info.title     += `${lp} leaves\n`
        v.info.title     += `↕ max: ${h}\n`
        v.info.title     += `↕ μ: ?\n`
        v.info.title     += `↕ ⌀: ?\n`
        v.info.title     += `○ max: ?\n`
        v.info.title     += `○ μ: ${ø.toPrecision(2)}\n`
        v.info.title     += `○ ⌀: ?\n`
        v.q.innerHTML     = `${(t/1000).toFixed(1)}`        

        updateBar(v.bar, Δ.map(e=>e/mag_load), ['#ff9800', '#2196f3', 'green'])                
        ping(v.useIndic)
        if (parseFloat(t) > 1000) ping(v.overuseIndic)
        
        const countChildren = n=> (n.children ? n.children.length : 0)

        var δsum = 0; model.each(e=> δsum += countChildren(e))
        var ωsum = 0; model.each(e=> ωsum += e.value)
        var τsum = 0; model.each(e=> τsum += e.height)

        rows.degree.qMax.innerHTML  = `<sub>μ${p1(δsum/n)}</sub>`
        rows.weights.qMax.innerHTML = `<sub>μ${p1(ωsum/n)}</sub>`
        rows.heights.qMax.innerHTML = `<sub>μ${p1(τsum/n)}</sub>`

        var maxδ = 0; model.each(e=> maxδ = Math.max(maxδ, countChildren(e)))
        rows.degree.q.innerHTML  = `<sub>${mysi(maxδ)}</sub>`
        rows.weights.q.innerHTML = `<sub>${mysi(model.value)}</sub>`
        rows.heights.q.innerHTML = `<sub>${mysi(model.height)}</sub>`        
    }
    
    ui.updateLang = ()=> {        
        const Δ  = ud.view.hypertree.langMeta.Δ 
        const kb = ud.view.hypertree.langMeta.filesize
                 ? (ud.view.hypertree.langMeta.filesize/1024).toFixed(0)
                 : '-'
        const model = ud.view.hypertree.data
        const Δs = Δ/1000

        // do the hole DSIT STUFF!
        const v = rows.lang
        
        v.info.innerHTML  = `${kb}<sub>kB</sub>`
        v.q.innerHTML     = Δs.toFixed(1)

        updateBar(v.bar, Δ.map(e=>e/mag_load), ['#ff9800', '#2196f3', 'green'])        
        ping(v.useIndic)
        if (Δ > 1000) ping(v.overuseIndic)
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
    label; info; slider; q; qMax; w; bar
    constructor(ui, offset, desc, unit, sliderInit, format) {
        this.label =  <HTMLElement>ui.children[offset+0]
        this.info =   <HTMLElement>ui.children[offset+1]        
        this.slider = <HTMLElement>ui.children[offset+2]
        this.qMax =   <HTMLElement>ui.children[offset+3]
        this.w =      <HTMLElement>ui.children[offset+4]
        
        this.label.innerHTML = desc
        var sliderinput = this.slider.querySelector('input')    
        this.info.innerHTML = format(sliderinput.min)
        this.qMax.innerHTML = format(sliderinput.max)

        sliderInit(this.slider)
    }
}

class HistRow {                
    label; min; hist; q; qMax; 
    constructor(ui, offset, desc, unit) {
        this.label = <HTMLElement>ui.children[offset+0]
        this.min =   <HTMLElement>ui.children[offset+1]
        this.hist =  <HTMLElement>ui.children[offset+2]
        this.q =     <HTMLElement>ui.children[offset+3]
        this.qMax =  <HTMLElement>ui.children[offset+4]
                
        this.label.innerHTML = desc        
        this.q.innerHTML = '-'
        this.qMax.innerHTML = '-'
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

const maxTime        = 25     // 25ms
const maxSvg         = 1000
const maxD3          = maxTime  
const maxLoad        = 1000   // 1000ms

const mag_svg        = .1 // 1000#  ?
const mag_load       = 10 // 1000ms
const mag_time       = 4  // 25ms 

var updateBar = (view, vec, cvec)=> {
    var c=0
    var l = vec.map((e, i, v)=> { c+=e; return c-e; })
    var data = t([vec, cvec, l])
    var cursor = 0
    var diff = d3.select(view).selectAll<HTMLDivElement, any>('div').data(data)
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

function ping(v, cond = true) {   
    if (cond) {             
        v.style.opacity = 1
        v.style.animation = ""        
        requestAnimationFrame(()=> {             
            v.style.animation = "blink-out 2s cubic-bezier(0.145, 1.130, 0.725, 0.590)"            
            v.style.opacity = 0
        })
    }
}

const p1 = n=> n.toFixed(1)
const mysihelper = d3.format('.3s')
function mysi(n, p=0, u='') 
{
    const d3str = mysihelper(n)
    const lastChar = d3str.slice(-1)
    const hasSiEx = lastChar == 'k'    
    const pidx = d3str.indexOf('.')    
    const hasDot = pidx !== -1
    
    var nr = d3str    
    if (hasDot) 
        nr = nr.slice(0, pidx+(p>0?p+1:0))

    if (hasSiEx)
        nr = nr.slice(-1)

    var ex = ''
    if (hasSiEx)
        ex = lastChar
    
    return nr + `<sub>${ex}${u}</sub>`
    //return nr + ex
}