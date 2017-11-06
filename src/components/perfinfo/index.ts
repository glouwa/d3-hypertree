import * as d3  from 'd3'
import { HTML } from 'duct'

var htmlinfo = `<div class="render-info">
        <div class="bar"></div>
        <div class="bar"></div>
        <div class="bar"></div>
        <div></div>
        <div></div>
        <div class="bar"></div>
        <div class="bar"></div>
        <div></div>
        <div></div>      
        <div></div>
    </div>`

/*
draw      2ms:    543 nodes
transform 7ms:    543 nodes,   ..links, ..cells, ..caps |w>16.5
layout    11ms:   12345 nodes  kh
weights   32ms:   12345 nodes                      mu_w   234, med_w   555, min_w,   max_w,
data      5335ms: 12345 nodes, 53434kb, .7 leafes, mu_°   4.3, med_°   3.6, min_°,   max_°,
                                                   mu_h   8.4, med_h     8, min_h,   max_h,
*/

export function InfoArea(args)
{
    var ui = HTML.parse<HTMLElement & { msg, colorScale, updateModel, updateCacheBar, updateCachInfo }>(htmlinfo)()
    args.parent.appendChild(ui)

    ui.colorScale = d3.scaleLinear<d3.ColorCommonInstance>()
        .domain([1, 10])
        .range([d3.rgb('#a5d6a7'), d3.rgb('#e53935')])
        .interpolate(d3.interpolateHcl)
        .clamp(true)

    ui.updateModel = (model)=> {
        var n = model.descendants().length
        var l = model.leaves().length
        var lp = l / n
        var i = n - l
        var h = model.height
        var ø = 0
        model.each(cn=> ø += (cn.children||[]).length/i)

        ui.msg(0,
            `Loaded: ${lp.toPrecision(1)} leaves,
            ↕<sub>max</sub>=${h},
            ○ ∊ [1…?], ○<sub>μ</sub>=${ø.toPrecision(2)}, ○<sub>ø</sub>=?.?`)
    }


    ui.updateCachInfo = (na, cache, max, mw, Δ)=> {
        var n = cache.leafNodes.length
        var l = cache.filteredNodes.length
        var c = cache.cells.length

        var ct = Δ / 20 * 100;
        (<HTMLElement>ui.children[5]).style.width = ct + '%';
        (<HTMLElement>ui.children[5]).style.backgroundColor = ui.colorScale(Δ);

        (<HTMLElement>ui.children[6]).style.width = (100 - ct) + '%';
        (<HTMLElement>ui.children[6]).style.backgroundColor = '#f8f8f8';

        ui.msg(1, `Transform: ${Δ.toPrecision(3)}ms, ${na} nodes | <sub>r<.995</sub>`)
        ui.msg(5, `Draw: ${n} circles, ${l} links, ${c} cells | <sub>w>${mw.toPrecision(2)}</sub>`)
        ui.updateCacheBar(n, l, max)
    }

    //child = [0, 1, 2]
    ui.updateCacheBar = (n, l, max)=> {
        var a = n / max * 50
        var b = l / max * 50;

        (<HTMLElement>ui.children[0]).style.width = b + '%';
        (<HTMLElement>ui.children[0]).style.backgroundColor = '#a5d6a7';

        (<HTMLElement>ui.children[1]).style.width = a + '%';
        (<HTMLElement>ui.children[1]).style.backgroundColor = '#b77d68';

        (<HTMLElement>ui.children[2]).style.width = (100 - a - b) + '%';
        (<HTMLElement>ui.children[2]).style.backgroundColor = '#f8f8f8';
    }

    //line [0, 1, 5] => []
    ui.msg = (line, msg)=> {
        ui.children[ui.children.length - 1 - line].innerHTML = msg
    }

    return ui
}

