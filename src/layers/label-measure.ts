// The widths of the labels (precalc.<layer>len): measured on a canvas in the font the
// labels are drawn with, for the label layers' boxes and placement.

import { N } from '../data/n'

/** What the measuring needs of the hypertree. */
export interface MeasureHost {
    data:  N
    view_: { html?: HTMLElement }
    args:  { geometry: { captionFont: string } }
    update: { data: ()=> void }
}

const canvases = new WeakMap<object, CanvasRenderingContext2D>()
const waiting = new WeakSet<object>()

/**
 * The canvas font and the factor from canvas pixels to the units of the SVG labels,
 * from a caption measured in this tree's SVG: the font the labels are drawn with
 * (family, weight and size from the CSS, e.g. the larger :lang(zh) size), so the
 * widths fit for every language and screen scaling. Until v1 the widths came from
 * geometry.captionFont divided by devicePixelRatio: too narrow on scaled screens
 * (125 %, 150 %) and with the CSS weight 300 vs 400, so label backgrounds were too
 * small for their text.
 */
function captionMetrics(ht:MeasureHost, context:CanvasRenderingContext2D) : { font:string, factor:number, probe:string } | null {
    const html = ht.view_ && ht.view_.html
    const svg = html && (html.querySelector('.unitdisk-nav svg') || html.querySelector('svg'))
    if (!svg) return null
    const sample = 'Hyperbolic Tree of Life 0123456789'
    const text = document.createElementNS('http://www.w3.org/2000/svg', 'text')
    text.setAttribute('class', 'caption')
    text.textContent = sample
    const parent = svg.querySelector('.unitDisc') || svg
    parent.appendChild(text)
    let width = 0, cs:CSSStyleDeclaration
    try { width = text.getBBox().width; cs = getComputedStyle(text) } catch (e) { width = 0 }
    parent.removeChild(text)
    if (!width || !cs) return null
    const font = `${cs.fontStyle} ${cs.fontWeight} 100px ${cs.fontFamily}`
    context.font = font
    const canvasWidth = context.measureText(sample).width
    return canvasWidth ? { font, factor: width / canvasWidth, probe: `${cs.fontStyle} ${cs.fontWeight} 16px ${cs.fontFamily}` } : null
}

/**
 * Measures every label and emoji of the tree (precalc.labelslen, labels-forcelen,
 * labels-placedlen, emojislen). When the web font is not loaded yet, it is loaded and
 * the labels are measured again and redrawn when it is there.
 */
export function measureLabels(ht:MeasureHost) : void {
    let context = canvases.get(ht)
    if (!context) canvases.set(ht, context = document.createElement("canvas").getContext("2d"))
    const metrics = captionMetrics(ht, context)
    // no SVG yet: the geometry font, calibrated by hand for a screen without scaling
    const font = metrics ? metrics.font : ht.args.geometry.captionFont
    const factor = metrics ? metrics.factor : 1/200
    context.font = font
    // the web font (e.g. Roboto) not loaded yet: measured with a fallback; loaded now
    // (the canvas does not request it, the SVG text may not have yet) and measured
    // again when it is there. Before, a page measured with Roboto or the fallback,
    // depending on the cache, and the labels sat a few pixels apart.
    const fonts = document.fonts
    if (metrics && fonts && !waiting.has(ht)) {
        let missing = false
        try { missing = !fonts.check(metrics.probe) } catch (e) { missing = false }
        if (missing) {
            waiting.add(ht)
            fonts.load(metrics.probe).catch(()=> {}).then(()=> {
                waiting.delete(ht)
                if (!ht.data) return
                let still = false
                try { still = !fonts.check(metrics.probe) } catch (e) {}
                if (still) return                  // not available: the fallback stays
                measureLabels(ht)
                ht.update.data()
            })
        }
    }

    const measure = (txtprop:string, lenprop:string)=> {
        ht.data.each(n=> {
            if (n.precalc[txtprop]) {
                // multi-line labels ('\n'): the width of the longest line
                const lines = String(n.precalc[txtprop]).split('\n')
                const width = Math.max(...lines.map(l=> context.measureText(l).width))
                n.precalc[lenprop] = width * factor
                console.assert(typeof n.precalc[lenprop] === 'number')
            }
            else
                n.precalc[lenprop] = undefined
        })
    }
    measure('label', 'labels-forcelen')
    measure('label', 'labelslen')
    measure('label', 'labels-placedlen')
    measure('icon', 'emojislen')
}
