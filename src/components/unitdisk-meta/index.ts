import * as d3  from 'd3'
import { HTML } from 'ducd'
import { t }    from 'ducd'

var htmlinfo = `<div class="render-info">
    <div class="label"> </div> <div class="nodes"></div> <div class="q"></div> <div class="qmax"></div> <div class="info i1"></div>
    <div class="bar-bg"></div>
    <div class="label"> </div> <div class="nodes"></div> <div class="q"></div> <div class="qmax"></div> <div class="info i2"></div>
    <div class="bar-bg"></div>
    <div class="label"> </div> <div class="nodes"></div> <div class="q"></div> <div class="qmax"></div> <div class="info i3"></div>
    <div class="bar-bg"></div>
    <div class="label"> </div> <div class="nodes"></div> <div class="q"></div> <div class="qmax"></div> <div class="info i4"></div>
    <div class="bar-bg"></div>
    <div class="label"> </div> <div class="nodes"></div> <div class="q"></div> <div class="qmax"></div> <div class="info i5"></div>
    <div class="bar-bg"></div>
</div>`

export function InfoArea(args)
{
    var ui = HTML.parse<HTMLElement & { updateModel, updateLayout, updateCachInfo }>(htmlinfo)()
    args.parent.appendChild(ui)

    //var rendering      = {}
    var renderingLabel = <HTMLElement>ui.children[0]
    var renderingInfo  = <HTMLElement>ui.children[1]
    var renderingQ     = <HTMLElement>ui.children[2]
    var renderingQmax  = <HTMLElement>ui.children[3]
    var renderingW     = <HTMLElement>ui.children[4]
    var renderingBar   = <HTMLElement>ui.children[5]

    //var D3             = {}
    var D3Label        = <HTMLElement>ui.children[6]
    var D3Info         = <HTMLElement>ui.children[7]
    var D3Q            = <HTMLElement>ui.children[8]
    var D3Qmax         = <HTMLElement>ui.children[9]
    var D3W            = <HTMLElement>ui.children[10]
    var D3Bar          = <HTMLElement>ui.children[11]

    //var transform      = {}
    var transformLabel = <HTMLElement>ui.children[12]
    var transformInfo  = <HTMLElement>ui.children[13]
    var transformQ     = <HTMLElement>ui.children[14]
    var transformQmax  = <HTMLElement>ui.children[15]
    var transformW     = <HTMLElement>ui.children[16]
    var transformBar   = <HTMLElement>ui.children[17]

    //var layout         = {}
    var layoutLabel    = <HTMLElement>ui.children[18]
    var layoutInfo     = <HTMLElement>ui.children[19]
    var layoutQ        = <HTMLElement>ui.children[20]
    var layoutQmax     = <HTMLElement>ui.children[21]
    var layoutW        = <HTMLElement>ui.children[22]
    var layoutBar      = <HTMLElement>ui.children[23]

    //var data           = {}
    var dataLabel      = <HTMLElement>ui.children[24]
    var dataInfo       = <HTMLElement>ui.children[25]
    var dataQ          = <HTMLElement>ui.children[26]
    var dataQmax       = <HTMLElement>ui.children[27]
    var dataW          = <HTMLElement>ui.children[28]
    var dataBar        = <HTMLElement>ui.children[29]

    var typeColors     = ['#a5d6a7', '#b77d68', '#a5d6a7', '#666', '#a5d6a7', '#b77d68', '#a5d6a7', '#666']
    var mag_svg        = .1
    var mag_load       = 10
    var mag            = 2
    var ms             = 50

    var colorScale = d3.scaleLinear<d3.ColorCommonInstance>()
        .domain([1, 10])
        .range([d3.rgb('#a5d6a7'), d3.rgb('#e53935')])
        .interpolate(d3.interpolateHcl)
        .clamp(true)

    var updateBar = (view, vec, cvec)=> {
        var c=0
        var l = vec.map((e, i, v)=> { c+=e; return c-e; })
        var data = t([vec, cvec, l])
        var diff = d3.select(view).selectAll('div').data(data)
        var cursor = 0
        diff.enter().append('div')
            .attr('class', 'bar')
            .merge(diff)
            .style('left', d=> d[2]+'%')
            .style('width', d=> d[0]+'%')
            .style('background-color', d=> d[1])
        diff.exit().remove()
    }

    ui.updateSvgInfo = (cache, Δ)=> {        
        var n = cache.leafOrLazy.length
        var l = cache.unculledNodes.length        
        var t = cache.labels.length
        var a = n+l+t // n * 2 if cells
        Δ = [0, l, n, t]
        
        updateBar(renderingBar, Δ.map(e=> e*mag_svg), typeColors)
        renderingLabel.innerHTML = `SVG`
        renderingInfo.innerHTML  = Δ.join(' / ')
        renderingInfo.title      = `${n} nodes \n${l} links \n${t} labels`
        renderingQ.innerHTML     = `${a}`
        renderingQmax.innerHTML  = `<sub>1000#</sub>`
    }

    ui.updateTransformationInfo = (cache, minWeigth, Δ)=> {
        var t = Δ.reduce((a,e)=> a+e).toFixed(0)
        var na = cache.unculledNodes.length
        var hwexits = minWeigth.map(n=>n.toFixed(1)).join(' ⟶ ')
        var Δms = Δ.map(n=>n.toFixed(1))
        
        updateBar(transformBar, Δ.map(e=> e*mag), ['#2196f3', '#ffc107', '#673ab7', '#4caf50'])
        transformLabel.innerHTML = `Transf.`
        transformInfo.innerHTML  = `${na} nodes<sub>w > ${'...'}</sub>`
        transformInfo.title      = `Visible node count: ${na}\n`        
        transformInfo.title     += `Min weigth: ${hwexits}\n`
        transformInfo.title     += `${Δms[0]} culling\n${Δms[1]} lazysearch\n${Δms[2]} voronoi\n${Δms[3]} labels`
        transformQ.innerHTML     = `${t}`
        transformQmax.innerHTML  = `<sub>${ms}ms</sub>`
    }
    
    ui.updateD3Info = (max, Δ, cache, layerlist)=> {
        var t = Δ.reduce((a,e)=> a+e).toFixed(1)

        D3Label.innerHTML = `D<sub>3</sub>`
        D3Info.innerHTML  = `${cache.unculledNodes.length} nodes`
        D3Info.title      = Δ.map((e, i)=> `${layerlist[i]}: ${e.toFixed()}ms`).join('\n')
        D3Q.innerHTML     = `${t}`
        D3Qmax.innerHTML  = `<sub>${ms}ms</sub>`

        updateBar(D3Bar, Δ.map(e=> e*mag), typeColors)
    }

    ui.updateLayout = (cache, Δ)=> {
        updateBar(layoutBar, [Δ].map(e=> e*mag), ['#2196f3'])
        layoutLabel.innerHTML = `Layout`
        layoutInfo.innerHTML  = `${cache.N} nodes`
        layoutQ.innerHTML     = `${Δ.toFixed()}`
        layoutQmax.innerHTML  = `<sub>${ms}ms</sub>`
    }

    ui.updateModel = (model, Δ)=> {

        // do the hole DSIT STUFF!

        var n = model.descendants().length
        var t = Δ.reduce((a,e)=> a+e).toFixed(0)
        var l = model.leaves().length
        var lp = (l / n).toPrecision(1)
        var i = n - l
        var h = model.height
        var ø = 0; model.each(cn=> ø += (cn.children||[]).length/i)

        updateBar(dataBar, Δ.map(e=>e/mag_load), ['#ff9800', '#2196f3', 'green'])
        dataLabel.innerHTML = `Load`
        dataInfo.innerHTML  = `${n} nodes`
        dataInfo.title   = `download: ${Δ[0].toFixed(0)}ms\n`
        dataInfo.title  += `parse: ${Δ[1].toFixed(0)}ms\n`
        dataInfo.title  += `hierarchy and weights: ${Δ[2].toFixed(0)}ms\n`
        dataInfo.title  += `${lp} leaves\n`
        dataInfo.title  += `↕ max: ${h}\n`
        dataInfo.title  += `↕ μ: ?\n`
        dataInfo.title  += `↕ ⌀: ?\n`
        dataInfo.title  += `○ max: ?\n`
        dataInfo.title  += `○ μ: ${ø.toPrecision(2)}\n`
        dataInfo.title  += `○ ⌀: ?\n`
        dataQ.innerHTML     = `${t}`
        dataQmax.innerHTML  = `<sub>1000ms</sub>`
    }

    ui.update = ()=> {}
    return ui
}
