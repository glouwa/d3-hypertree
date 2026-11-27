// geometry.captionPx: the labels in screen pixels. In the units of the disk a label is
// as large as the disk: 4 px on a phone, much larger on a big screen. With captionPx
// the font of the labels (CSS, in em: the font size of the svg scales them) is set so
// a caption has captionPx on the screen, and geometry.captionHeight (the label boxes,
// the placement) captionRatio times that font. Kept when the tree's element changes its
// size (ResizeObserver) and when captionPx changes (configure, e.g. a language that
// needs larger text). Until v2 applications did this themselves.

/** What the sizing needs of the hypertree. */
export interface CaptionHost {
    view_:     { parent:HTMLElement, html?:HTMLElement }
    args:      { geometry: { captionPx:number | null, captionRatio:number, captionHeight:number } }
    configure: (overlay:any)=> any
}

/** Sizes the labels to geometry.captionPx (nothing without it, or without an SVG yet). */
export function sizeCaptions(ht:CaptionHost) : void {
    const html = ht.view_ && ht.view_.html
    const ud = html && <SVGGElement>html.querySelector('.unitDisc')
    const svg = ud && ud.ownerSVGElement
    if (!ud || !svg) return
    const want = ht.args.geometry.captionPx
    if (!want) {                                              // off: the CSS size again
        if (svg.style.fontSize) { svg.style.fontSize = ''; ht.configure({ geometry: { captionHeight: ht.args.geometry.captionHeight } }) }
        return
    }
    // the caption's font relative to the svg's (the CSS: e.g. .002em), measured with a
    // large svg font: a browser may clamp tiny computed sizes (Chromium's minimum
    // logical font size, 6 px), which made the measured size of .002em × 16 px wrong
    const before = svg.style.fontSize
    const BIG = 10000
    svg.style.fontSize = `${BIG}px`
    const probe = document.createElementNS('http://www.w3.org/2000/svg', 'text')
    probe.setAttribute('class', 'caption')
    probe.textContent = 'M'
    ud.appendChild(probe)
    const m = probe.getScreenCTM()
    const em = parseFloat(getComputedStyle(probe).fontSize) / BIG
    const scale = m ? Math.hypot(m.a, m.b) : 0                // screen pixels per unit of the disk
    ud.removeChild(probe)
    if (!(em > 0) || !(scale > 0)) { svg.style.fontSize = before; return }
    const font = want / scale                                 // the caption's font in the units of the disk
    svg.style.fontSize = `${font / em}px`
    const captionHeight = font * ht.args.geometry.captionRatio
    // unchanged (a resize that kept the scale): no measuring, no frame
    if (svg.style.fontSize === before && Math.abs(captionHeight - ht.args.geometry.captionHeight) < 1e-9) return
    // the label boxes follow (the labels are measured again, a frame)
    ht.configure({ geometry: { captionHeight } })
}

/** Sizes the labels again whenever the tree's element changes its size (one per frame). */
export function watchCaptionSize(ht:CaptionHost) : void {
    if (typeof ResizeObserver === 'undefined' || !ht.view_ || !ht.view_.parent) return
    let pending = false
    new ResizeObserver(()=> {
        if (pending || !ht.args.geometry.captionPx) return
        pending = true
        requestAnimationFrame(()=> { pending = false; sizeCaptions(ht) })
    }).observe(ht.view_.parent)
}
