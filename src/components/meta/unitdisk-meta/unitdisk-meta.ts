import * as d3  from 'd3'
import { HTML } from 'ducd'
import { t }    from 'ducd'

var htmlinfo = `<div class="render-info">
    <div class="label"> </div> <div class="nodes"></div> <div class="q"></div> <div class="qmax"></div> <div class="info i1"></div>
    <div class="bar-bg"></div>
    <div class="label"> </div> <div class="nodes"></div> <div class="q"></div> <div class="qmax"></div> <div class="info i2"></div>
    <div class="bar-bg"></div>
    <div class="label"> </div>  <div class="nodes slider">
                                    <p class="range-field">
                                        <input type="range" min="2" max="500" value="160" class="slider" id="myRange">
                                    </p>
                                </div> <div class="q"></div> <div class="qmax"></div> <div class="info i3"></div>
    <div class="bar-bg"></div>
    <div class="label"> </div> <div class="nodes slider">
                                    <p class="range-field">
                                        <input type="range" min="2" max="500" value="160" class="slider" id="myRange">
                                    </p>
                                </div> <div class="q"></div> <div class="qmax"></div> <div class="info i4"></div>
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

    var colors = ["#3366cc", "#dc3912", "#ff9900", "#109618", "#990099", "#0099c6", "#dd4477", "#66aa00", "#b82e2e", "#316395", "#994499", "#22aa99", "#aaaa11", "#6633cc", "#e67300", "#8b0707", "#651067", "#329262", "#5574a6", "#3b3eac"];
    var shift = 5    
    var typeColors     = colors.slice(shift).concat(colors.slice(0, shift)) 
    //['#a5d6a7', '#b77d68', '#a5d6a7', '#666', '#a5d6a7', '#b77d68', '#a5d6a7', '#666']
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
        var cursor = 0
        var diff = d3.select(view).selectAll('div').data(data)        
        diff.enter().append('div')
            .attr('class', 'bar')
            .merge(diff)
            .style('left', d=> d[2]+'%')
            .style('width', d=> Math.max(d[0], 2)+'%')
            .style('background-color', d=> d[1])
        diff.exit().remove()
    }

    ui.updateSvgInfo = (cache, Δ, layerStack)=> {        
        Δ = []
        if (layerStack)
            for (var l in layerStack.layers) {            
                var layer = layerStack.layers[l].layer                
                var elemCount = layer ? layer.data.length : 1
                Δ.push(elemCount)
            }
        var a = Δ.reduce((a,e)=> a+e, 0).toFixed(0)
        
        updateBar(renderingBar, Δ.map(e=> e*mag_svg), typeColors)
        renderingLabel.innerHTML = `SVG`                
        renderingQ.innerHTML     = `${a}`
        renderingQmax.innerHTML  = `<sub>#</sub>`
    }
 
    ui.updateD3Info = (max, Δ, cache, layerlist)=> {
        var t = Δ.reduce((a,e)=> a+e).toFixed(0)

        D3Label.innerHTML = `D<sub>3</sub>`
        D3Info.innerHTML  = `${cache.unculledNodes.length} unc. nodes`
        D3Info.title      = Δ.map((e, i)=> `${layerlist[i]}: ${e.toFixed(1)}ms`).join('\n')
        D3Q.innerHTML     = `${t}`
        D3Qmax.innerHTML  = `<sub>ms</sub>`

        updateBar(D3Bar, Δ.map(e=> e*mag), typeColors)
    }

    ui.updateTransformationInfo = (cache, minWeigth, Δ)=> {
        var t = Δ.reduce((a,e)=> a+e).toFixed(0)
        var na = cache.unculledNodes.length
        var hwexits = minWeigth.map(n=>n.toFixed(1)).join(' ⟶ ')
        var Δms = Δ.map(n=>n.toFixed(1))
        
        updateBar(transformBar, Δ.map(e=> e*mag), ['#2196f3', '#ffc107', '#673ab7', '#4caf50'])
        transformLabel.innerHTML = `Transf.`
        //transformInfo.innerHTML  = `${na} nodes<sub>w > ${'...'}</sub>`
        transformInfo.title      = `Visible node count: ${na}\n`        
        transformInfo.title     += `Min weigth: ${hwexits}\n`
        transformInfo.title     += `${Δms[0]} culling\n${Δms[1]} lazysearch\n${Δms[2]} voronoi\n${Δms[3]} labels`
        transformQ.innerHTML     = `${t}`
        transformQmax.innerHTML  = `<sub>ms</sub>`
    }

    ui.updateLayout = (cache, Δ)=> {
        updateBar(layoutBar, [Δ].map(e=> e*mag), ['#2196f3'])
        layoutLabel.innerHTML = `Layout`        
        layoutQ.innerHTML     = `${Δ.toFixed()}`
        layoutQmax.innerHTML  = `<sub>ms</sub>`
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
        dataInfo.innerHTML  = `${n} raw nodes`
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
        dataQ.innerHTML     = `${(t/1000).toFixed(1)}`
        dataQmax.innerHTML  = `<sub>s</sub>`
    }

    ui.update = ()=> {}
    return ui
}
