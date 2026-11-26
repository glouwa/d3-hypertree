// DOM writes only when the value changes. d3's classed() and style() call classList and
// style.setProperty/removeProperty for every element every time, even with the same
// value; the layers' updateColor runs in the data join on every frame while dragging
// (the visible nodes change), and those writes and the style recalculation they cause
// took about a quarter of a frame on a phone. The value last written is kept on the
// element (an expando per class or property); a value set elsewhere (CSS, create) is
// not known, so the first call writes.

/** The class on or off, if it changed since the last call for this element. */
export function setClass(el:Element, name:string, on:any) : void {
    const key = '__class_' + name, v = Boolean(on)
    if ((el as any)[key] === v) return
    el.classList.toggle(name, v)
    ;(el as any)[key] = v
}

/** The inline style property (null, undefined or '' removes it), if it changed. */
export function setStyle(el:Element, prop:string, value:any) : void {
    const key = '__style_' + prop
    const v = value === null || value === undefined || value === '' ? null : String(value)
    if ((el as any)[key] === v) return
    const style = (el as HTMLElement | SVGElement as any).style as CSSStyleDeclaration
    if (v === null) style.removeProperty(prop); else style.setProperty(prop, v)
    ;(el as any)[key] = v
}
