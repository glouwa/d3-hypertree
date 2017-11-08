import * as d3  from 'd3'
import { HTML } from 'duct'
import { t }    from 'duct'

var htmlinfo = `<div class="render-info">
        <div></div>
        <div class="bar-bg"></div>
        <div></div>
        <div class="bar-bg"></div>
        <div></div>        
        <div class="bar-bg"></div>
        <div></div>
        <div class="bar-bg"></div>
        <div></div>
        <div class="bar-bg"></div>
    </div>`

/*
draw      2ms:    543 nodes
transform 7ms:    543 nodes,   ..links, ..cells, ..caps |w>16.5
layout    11ms:   12345 nodes  kh
weights   32ms:   12345 nodes                      mu_w   234, med_w   555, min_w,   max_w,
data      5335ms: 12345 nodes, 53434kb, .7 leafes, mu_°   4.3, med_°   3.6, min_°,   max_°,
                                                   mu_h   8.4, med_h     8, min_h,   max_h,
*/

//IA = HTMLElement & { updateModel, updateLayout, updateCachInfo }
//export function InfoArea(args) : IA


export function InfoArea(args)
{
    var ui = HTML.parse<HTMLElement & { updateModel, updateLayout, updateCachInfo }>(htmlinfo)()
    args.parent.appendChild(ui)
    var rendering    = <HTMLElement>ui.children[0]
    var renderingBar = <HTMLElement>ui.children[1]
    var D3           = <HTMLElement>ui.children[2]
    var D3Bar        = <HTMLElement>ui.children[3]
    var transform    = <HTMLElement>ui.children[4]
    var transformBar = <HTMLElement>ui.children[5]
    var layout       = <HTMLElement>ui.children[6]
    var layoutBar    = <HTMLElement>ui.children[7]
    var data         = <HTMLElement>ui.children[8]
    var dataBar      = <HTMLElement>ui.children[9]
    var typeColors   = ['#a5d6a7', '#b77d68', '#a5d6a7', '#666']

    var mag = 1

    var colorScale = d3.scaleLinear<d3.ColorCommonInstance>()
        .domain([1, 10])
        .range([d3.rgb('#a5d6a7'), d3.rgb('#e53935')])
        .interpolate(d3.interpolateHcl)
        .clamp(true)

    var updateBar = (view, vec, cvec)=> {
        var diff = d3.select(view).selectAll('div').data(t([vec, cvec]))
        diff.enter().append('div')
            .attr('class', 'bar')
            .merge(diff)
            .style('width', d=> d[0]+'%')
            .style('background-color', d=> d[1])
        diff.exit().remove()
    }


    ui.updateD3Info = (max, Δ, cache)=> {
        var t = Δ.reduce((a,e)=> a+e).toFixed(0)

        D3.innerHTML = `D<sub>3</sub>: ${t}ms ${cache.filteredNodes.length}nodes`
        updateBar(D3Bar, Δ.map(e=> e*mag), typeColors)
    }

    ui.updateTransformationInfo = (na, cache, max, mw, Δ)=> { // updatTransformationInfo
        var n = cache.leafNodes.length
        var l = cache.filteredNodes.length
        var c = cache.cells.length
        var t = cache.labels.length
        var a = n+l+c+t
        var mag_ = .1

        rendering.innerHTML = `Draw: ${a}/1000 - ${n}/${l}/${c}/${t} | <sub>w>${mw.toPrecision(2)}</sub>`
        updateBar(transformBar, [Δ].map(e=> e*mag), [colorScale(Δ)])

        transform.innerHTML = `Transf.: ${Δ.toPrecision(3)}ms, ${na} nodes | <sub>r<.995</sub>`
        updateBar(renderingBar, [n, l, c, t].map(e=> e*mag_), typeColors)
    }

    ui.updateLayout = (x, Δ)=> {
        layout.innerHTML = `Layout: ${Δ.toFixed(1)}ms, ?nodes. max r = .?`
        updateBar(layoutBar, [Δ].map(e=> e*mag), ['#2196f3'])
    }

    ui.updateModel = (model, Δ)=> {
        var n = model.descendants().length
        var t = Δ.reduce((a,e)=> a+e).toFixed(0)
        var l = model.leaves().length
        var lp = (l / n).toPrecision(1)
        var i = n - l
        var h = model.height
        var ø = 0; model.each(cn=> ø += (cn.children||[]).length/i)

        data.innerHTML = `Load: ${t}ms, ${n}n, ${lp}l, ↕<sub>max</sub>=${h}, ○<sub>μ</sub>=${ø.toPrecision(2)}, ○<sub>ø</sub>=?`
        updateBar(dataBar, Δ.map(e=>e/20), ['#ff9800', '#2196f3'])
    }

    ui.update = ()=> {}
    return ui
}
