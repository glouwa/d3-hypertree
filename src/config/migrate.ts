// Options of v1 that were renamed, moved or removed: migrate() translates them
// before the model is resolved, with a deprecation warning once per option.

const warned = new Set<string>()
export function deprecated(old:string, now:string) {
    if (warned.has(old)) return
    warned.add(old)
    console.warn(`d3-hypertree: ${old} is deprecated, use ${now}`)
}

// removed in v2 (copies of the arc layers with straight lines, and slower)
const removedLineLayers:{ [name:string]: string } = { 'link-lines': 'link-arcs', 'path-lines': 'path-arcs' }
// the label layers (filter.maxlabels was their common limit)
const labelLayers = ['labels', 'labels-force', 'labels-placed']

/**
 * Returns a copy of the model (only the touched branches are copied) with:
 * - renamed options mapped to their current names:
 *   layerOptions[*].nodeColor -> fill, linkColor -> stroke,
 *   interaction.wheelSensitivity -> wheelFactor,
 *   geometry.animateUpRadius -> layout.initSize,
 *   geometry.halfPlane -> geometry.view 'halfplane',
 *   filter.cullingWeight -> filter.weightFilter.rangeNodes,
 *   filter.maxlabels -> layerOptions[label layers].maxLabels,
 *   filter.transformation.P -> geometry.startPosition
 * - geometry.addLayer / removeLayer (layer names) as layerOptions; the removed
 *   layers link-lines / path-lines become link-arcs / path-arcs with linkCurvature 'l'
 * - langmap as the language loader's result (unless a langloader is given)
 * - geometry.decorator and geometry.cacheUpdate (the unit disk class and the frame
 *   function were options until v1) dropped with a warning
 */
export function migrate(input:any) : any {
    const model = Object.assign({}, input || {})
    const branch = (k:string) => (model[k] = Object.assign({}, model[k] || {}))

    if (input && input.interaction && input.interaction.wheelSensitivity !== undefined) {
        deprecated('interaction.wheelSensitivity', 'interaction.wheelFactor')
        const i = branch('interaction')
        if (i.wheelFactor === undefined) i.wheelFactor = i.wheelSensitivity
        delete i.wheelSensitivity
    }

    // the v2 preview's hover strategy
    if (input && input.interaction && input.interaction.hover !== undefined) {
        deprecated('interaction.hover', 'interaction.highlightNode')
        const i = branch('interaction')
        if (i.highlightNode === undefined) i.highlightNode = i.hover === 'none' ? 'none' : 'mousehover'
        delete i.hover
    }

    const g = input && input.geometry
    if (g) {
        if (g.animateUpRadius !== undefined) {
            deprecated('geometry.animateUpRadius', 'layout.initSize')
            const l = branch('layout')
            if (l.initSize === undefined) l.initSize = g.animateUpRadius
            delete branch('geometry').animateUpRadius
        }
        if (g.halfPlane !== undefined) {
            deprecated('geometry.halfPlane', "geometry.view: 'halfplane'")
            const geometry = branch('geometry')
            if (geometry.view === undefined) geometry.view = g.halfPlane ? 'halfplane' : 'disk'
            delete geometry.halfPlane
        }
        if (g.decorator !== undefined) {
            deprecated('geometry.decorator', 'geometry.view (a Projection)')
            delete branch('geometry').decorator
        }
        if (g.cacheUpdate !== undefined) {
            deprecated('geometry.cacheUpdate', 'nothing (the frame is not an option)')
            delete branch('geometry').cacheUpdate
        }
        if (g.layerOptions || g.addLayer || g.removeLayer) {
            const geometry = branch('geometry')
            const layerOptions = geometry.layerOptions = Object.assign({}, g.layerOptions || {})
            const layer = (name:string) => (layerOptions[name] = Object.assign({}, layerOptions[name] || {}))
            for (const name of Object.keys(layerOptions)) {
                const o = layerOptions[name]
                if (o && o.nodeColor !== undefined) {
                    deprecated('layerOptions[...].nodeColor', 'fill')
                    const l = layer(name); if (l.fill === undefined) l.fill = l.nodeColor; delete l.nodeColor
                }
                if (o && o.linkColor !== undefined) {
                    deprecated('layerOptions[...].linkColor', 'stroke')
                    const l = layer(name); if (l.stroke === undefined) l.stroke = l.linkColor; delete l.linkColor
                }
            }
            for (const name of g.addLayer || []) {
                const arcs = removedLineLayers[name]
                if (arcs) {
                    // v1 layers link-lines / path-lines: the arc layers with straight lines
                    deprecated(`layer ${name}`, `${arcs} with geometry.linkCurvature: 'l'`)
                    if (geometry.linkCurvature === undefined) geometry.linkCurvature = 'l'
                    layer(arcs).invisible = false
                }
                else layer(name).invisible = false
            }
            for (const name of g.removeLayer || []) layer(name).removed = true
            delete geometry.addLayer
            delete geometry.removeLayer
        }
    }

    const f = input && input.filter
    if (f) {
        if (f.cullingWeight !== undefined) {
            deprecated('filter.cullingWeight', 'filter.weightFilter.rangeNodes')
            const filter = branch('filter')
            if (filter.weightFilter !== null) {
                filter.weightFilter = Object.assign({}, filter.weightFilter || {})
                if (filter.weightFilter.rangeNodes === undefined) filter.weightFilter.rangeNodes = f.cullingWeight
            }
            delete filter.cullingWeight
        }
        if (f.maxlabels !== undefined) {
            deprecated('filter.maxlabels', "geometry.layerOptions['labels'].maxLabels (per label layer)")
            const geometry = branch('geometry')
            const layerOptions = geometry.layerOptions = Object.assign({}, geometry.layerOptions || {})
            for (const name of labelLayers) {
                const o = layerOptions[name] = Object.assign({}, layerOptions[name] || {})
                if (o.maxLabels === undefined) o.maxLabels = f.maxlabels
            }
            delete branch('filter').maxlabels
        }
        if (f.transformation && f.transformation.P !== undefined) {
            deprecated('filter.transformation.P', 'geometry.startPosition')
            const geometry = branch('geometry')
            if (geometry.startPosition === undefined) geometry.startPosition = f.transformation.P
            const filter = branch('filter')
            delete filter.transformation
        }
        if (f.type !== undefined) delete branch('filter').type   // 'magic', the only one
    }

    if (input && input.langmap && !input.langloader)
        model.langloader = ok => ok(input.langmap)

    return model
}
