// Descriptors of the d3-hypertree options, the named function values and the scale
// specs: what kind of value an option takes, its bounds and a short documentation
// (docs/dev/PLAYGROUND.md, section 3). The playground builds its controls from them;
// test/config.js resolves the modes of function options with them (resolveNamed).
//
// They live here and not in the library because no application needs them at
// runtime. A test (tests/options.spec.mjs) keeps them complete: every default of the
// library has a descriptor, every descriptor describes an existing option.
//
// Needs the globals hyt (../dist/d3-hypertree.js) and d3 (the interpolators of the
// scale specs; ../node_modules/d3/dist/d3.min.js), loaded before.
(function () {
    'use strict'
    const π = Math.PI
    const stateDisplay = { kind: 'enum', values: ['path', 'node', 'none'] }
    const curvature = { kind: 'enum', values: ['-', '+', '0', 'l'] }

    // ---------------------------------------------------------------------------------
    // the core options, by path (the longest described prefix of a path describes it)

    const options = {
        'langmap':                  { kind: 'object',   doc: 'node name → label text, applied once at initialization (a langloader replaces it)' },
        'iconmap':                  { kind: 'object',   doc: 'node name (or id) → emoji, applied once at initialization' },
        'dataloader':               { kind: 'callback', doc: 'loads the data and calls back with a d3 hierarchy (loaders: fromData, fromFile, generators)' },
        'langloader':               { kind: 'callback', doc: 'loads the language map (node name → text), used by langInitBFS' },
        'dataInitBFS':              { kind: 'callback', doc: 'called for every node after loading: icon, imageHref, clickable, cell' },
        'langInitBFS':              { kind: 'callback', doc: 'called for every node after both loaders (and on a language change): label, wiki' },
        'objects.selections':       { kind: 'state',    doc: 'the selected nodes' },
        'objects.pathes':           { kind: 'state',    doc: 'the hover and selection paths' },
        'objects.traces':           { kind: 'state',    doc: 'touch traces' },

        'layout.type':              { kind: 'function', doc: 'the layout: Bergé (default, the only one that supports the weight filter), spiral, Buchheim, unit lines, unit vectors' },
        'layout.weight':            { kind: 'function', returns: 'number', doc: 'the layout weight of a node, summed over the subtree: the share of the wedge. Default leaves 1, inner nodes 0' },
        'layout.childOrder':        { kind: 'enum', values: ['data', 'balanced', 'alternating'], doc: 'the order of the children in their wedge: as given, the heaviest in the middle so the heaviest path runs straight (like a spruce), or as given and reversed on every second level (even heights)' },
        'layout.multirowHighDegreeNodes': { kind: 'boolean', doc: 'the leaf children of a node with many of them in several rows (a staircase); the node needs only the angle of its columns, a big fan no longer squeezes its siblings. Off: one row, every leaf its own angle. Try the star generator' },
        'layout.rootLinkLength':    { kind: 'number', min: .01, max: 1, step: .01, nullable: true, doc: 'shorter links near the root: the root children get this part of a link, the leaves the whole one, linear in between. Off: the root children half, all others whole. The Tree of Life\'s rectangular view uses .1' },
        'layout.initSize':          { kind: 'number', min: .3, max: 1, step: .01, doc: 'the start zoom: the outermost visible node within this part of the disk radius' },
        'layout.rootWedge.orientation': { kind: 'angle', min: 0, max: 2 * π, step: π / 180, doc: 'the direction of the root wedge: where the children of the root go' },
        'layout.rootWedge.angle':   { kind: 'angle', min: π / 18, max: 2 * π, step: π / 180, doc: 'the opening angle of the root wedge; the gap is where the stem goes' },

        'filter.cullingRadius':     { kind: 'number', min: .5, max: 1, step: .01, doc: 'nodes beyond this radius are hidden' },
        'filter.weightFilter':      { kind: 'object', nullable: true, doc: 'the weight filter: the number of visible nodes decides what is drawn. Off: every node within cullingRadius is visible (fine for small trees, large trees get slow)' },
        'filter.weightFilter.weight': { kind: 'function', returns: 'number', doc: 'the culling weight of a node, summed over the subtree. Default leaves 1, inner nodes height²' },
        'filter.weightFilter.rangeNodes': { kind: 'range', min: 0, max: 5000, step: 10, doc: 'the number of visible nodes the filter aims at: it hides more above max, shows more below min. The filter adapts its threshold a little on every update, so the visible set settles over a few frames' },
        'filter.weightFilter.alpha': { kind: 'number', min: 1.001, max: 2, step: .005, doc: 'how fast the filter adapts its weight threshold per update' },
        'filter.weightFilter.magic': { kind: 'state',  doc: 'the weight threshold, set by the filter' },
        'filter.focusExtension':    { kind: 'number', min: .5, max: 4, step: .05, doc: 'focus radius = min(λ × focusExtension, maxFocusRadius), so it grows when you zoom in (Layers › Indicators › focus-r draws it). Inside it the filter hides nothing' },
        'filter.maxFocusRadius':    { kind: 'number', min: .1, max: .99, step: .01, doc: 'the largest focus radius' },
        'filter.wikiRadius':        { kind: 'number', min: .1, max: 1, step: .01, doc: 'the radius of the labels-r-𝐖 indicator: an application radius, e.g. for showing details of the nodes within it' },
        'filter.labelScore':        { kind: 'function', returns: 'number', nullable: true, doc: 'the weight of a node when the label layers choose which nodes get a label (times the squared display scale). Off: the subtree weight' },

        'geometry.view':            { kind: 'enum', values: ['disk', 'halfplane'], doc: 'the projection onto the screen: the disk, or the rectangular half-plane view (the disk border becomes the top edge, the gap of the root wedge goes to infinity below, links are arcs centered on the border). Layout, filter and interaction stay the same; also an own Projection object' },
        'geometry.diskSize':        { kind: 'number', min: .5, max: 1.5, step: .01, doc: 'the diameter of the disk in the square view (.96); > 1: beyond the view' },
        'geometry.layers':          { kind: 'layers', doc: 'the layer stack in drawing order: specs { type, name, data, options }, or the name of a default layer' },
        'geometry.layerOptions':    { kind: 'object', doc: 'options per layer name, over the specs (the layer types describe them)' },
        'geometry.clipRadius':      { kind: 'number', min: .5, max: 1.5, step: .01, doc: 'the radius of the clip circle of the disk' },
        'geometry.nodeRadius':      { kind: 'function', returns: 'number', min: .002, max: .06, step: .001, doc: 'the radius of a node disk (unitdisk, node). Default relative to the width of its link: leaves 1.5 × (a disk three times as wide), inner nodes .5 × (never wider than the link; shown with nodes › show all)' },
        'geometry.nodeScale':       { kind: 'function', returns: 'number', min: .1, max: 3, step: .05, doc: 'the scale of a node disk: default the distance scale, .8 for nodes with hidden children' },
        'geometry.nodeFilter':      { kind: 'function', returns: 'boolean', doc: 'which nodes get a disk when the nodes layer shows "leaves": leaves, the root and nodes with hidden children' },
        'geometry.linkWidth':       { kind: 'function', returns: 'number', min: .0005, max: .03, step: .0005, doc: 'the width of a link: default .025 × the distance scale × the weight scale' },
        'geometry.linkCurvature':   { kind: 'enum', values: ['-', '+', '0', 'l'], doc: 'the curvature of links and paths; a layer can override it. − hyperbolic geodesic (default), + the arc to the other side, 0 straight, l straight as SVG lines (looks like 0, a little more JavaScript per frame)' },
        'geometry.shrinkAtRim':     { kind: 'enum', values: ['none', 'damped', 'full'], doc: 'the size of labels, force labels and emojis toward the rim: constant, 1 to .5 (default), or like the links (to 0). A layer binds its own size to the data with its option scale, times this factor' },
        'geometry.captionBackground': { kind: 'enum', values: ['all', 'center', 'none'], doc: 'which labels get a background rect (v1 option; the label layers\' option background decides)' },
        'geometry.captionFont':     { kind: 'string', doc: 'the font the labels are measured in (only without an SVG to measure in)' },
        'geometry.captionHeight':   { kind: 'number', min: .01, max: .12, step: .005, doc: 'the height of a label line in disk units' },
        'geometry.transformation':  { kind: 'state',  doc: 'the hyperbolic transformation (P, θ, λ): the view' },
        'geometry.startPosition':   { kind: 'point', min: -.9, max: .9, step: .01, nullable: true, doc: 'the translation at the start: where the root sits in the disk, e.g. { re: 0, im: .5 }. Off: the root in the center' },

        'geometry.captionPx':       { kind: 'number', min: 6, max: 30, step: .5, unit: 'px', nullable: true, doc: 'the labels in screen pixels: the font of the labels is scaled so a caption has this size on the screen, kept when the tree\'s element changes its size; captionHeight is set to captionRatio × the font. Off: in the units of the disk (as large as the disk)' },
        'geometry.captionRatio':    { kind: 'number', min: 1, max: 2, step: .05, doc: 'with captionPx: captionHeight (the label boxes) this many times the font size' },
        'geometry.startView':       { kind: 'object', doc: 'the start view: \'overview\' (api.overview: the root at the bottom, the main branchings in the middle) or { P, λ }. The tree zooms up to it and moves there at the start; api.gotoStart() goes back (a home button). Off: no start animation' },

        'interaction.mouseRadius':  { kind: 'number', min: .3, max: 1, step: .01, doc: 'the radius within which the mouse picks nodes' },
        'interaction.highlightNode': { kind: 'enum', values: ['mousehover', 'center', 'none'], doc: 'which node is highlighted (hovered: the hover path, cell and label): the node under the mouse, the node nearest to the center (also while dragging; for touch screens), or none. Strategies set the node state (hovered, selected); the layers only decide how they show it' },
        'interaction.highlightUpdate': { kind: 'enum', values: ['live', 'settled'], doc: 'when the highlight is set: live at once (every mouse move, every frame while dragging), settled when the view stands still and the mouse or the center rested highlightDelay ms' },
        'interaction.highlightDelay': { kind: 'number', min: 0, max: 1000, step: 10, unit: 'ms', doc: 'settled: the rest before the highlight is set' },
        'interaction.highlightLabelFallback': { kind: 'enum', values: ['none', 'ancestor'], doc: 'a highlighted node without a label: ancestor shows the label of its nearest ancestor with one (only as the hover label), none shows no label' },
        'interaction.selection':    { kind: 'enum', values: ['none', 'single', 'multi'], doc: 'the selection strategy: single replaces the old selection, multi keeps up to maxSelections' },
        'interaction.maxSelections': { kind: 'number', min: 1, max: 100, step: 1, doc: 'multi: the oldest selection is dropped beyond this' },
        'interaction.clickAction':  { kind: 'enum', values: ['select', 'goto', 'none'], doc: 'what a click does besides onNodeClick: toggle the selection, animate the node to the center, nothing' },
        'interaction.onNodeClick':  { kind: 'callback', doc: 'a click on a node (node, mouse position, layer)' },
        'interaction.onNodeSelect': { kind: 'callback', doc: 'every selection change (node, selected)' },
        'interaction.onNodeHold':   { kind: 'callback', nullable: true, doc: 'the pointer pressed on a node for holdDuration ms without moving; no click follows' },
        'interaction.holdDuration': { kind: 'number', min: 100, max: 3000, step: 50, unit: 'ms', doc: 'ms until onNodeHold' },
        'interaction.onNodeHover':  { kind: 'callback', doc: 'the node under the pointer changed (undefined when leaving the tree)' },
        'interaction.onHoverNodeChange': { kind: 'callback', doc: 'the hovered node changed (after the paths are updated)' },
        'interaction.onCenterNodeChange': { kind: 'callback', doc: 'the node in the center changed (node, path string)' },
        'interaction.λbounds':      { kind: 'pair', min: .001, max: 1, step: .005, doc: 'the zoom λ stays within [min, max]' },
        'interaction.minFill':      { kind: 'number', min: .3, max: 1, step: .01, nullable: true, doc: 'the tree never fills less than this share of the disk radius: the lower λ bound is computed per tree after loading, replacing λbounds[0]' },
        'interaction.maxLinkLength': { kind: 'number', min: .1, max: 1, step: .01, nullable: true, doc: 'a normal link with its parent in the middle of the disk is at most this long (share of the radius): the upper λ bound, replacing λbounds[1]' },
        'interaction.animationDuration': { kind: 'number', min: 0, max: 3000, step: 25, unit: 'ms', doc: 'ms of goto, gotoNode, gotoHome, gotoλ, gotoOverview' },
        'interaction.animationEasing': { kind: 'function', returns: 'number', doc: 'the curve of those animations: share of the way at share t of the time, 0..1 (default: symmetric tanh sigmoid)' },
        'interaction.wheelFactor':  { kind: 'number', min: 1.01, max: 2, step: .005, doc: 'the zoom per wheel step' },
    }

    // ---------------------------------------------------------------------------------
    // the layer options, by layer type ('*': every layer) and option name

    const layerOptions = {
        '*': {
            invisible:  { kind: 'boolean', doc: 'the layer is not drawn' },
            hideOnDrag: { kind: 'boolean', doc: 'the layer is not drawn while dragging, pinching or animating' },
            plane:      { kind: 'enum', values: ['disk', 'content', 'overlay'], doc: 'the compositor plane (default by layer name)' },
            data:       { kind: 'data', doc: 'what the layer draws: a channel of the frame cache (links, paths, cells, emojis, …) or a function of the layer' },
            className:  { kind: 'string', doc: 'the CSS class of the layer\'s elements' },
            removed:    { kind: 'boolean', doc: 'the layer is taken out of the stack' },
        },
        'background': {},
        'cells': {
            hover:       { kind: 'boolean', doc: 'highlight the cell under the mouse (the events and callbacks fire either way)' },
            selection:   { kind: 'boolean', doc: 'highlight the cells of the selected nodes' },
            fill:        { kind: 'function', returns: 'color', doc: 'the fill of a cell (the cell\'s data is the node)' },
            stroke:      { kind: 'function', returns: 'color', doc: 'the stroke of a cell' },
            strokeWidth: { kind: 'function', returns: 'number', min: 0, max: .02, step: .0005, doc: 'the stroke width of a cell' },
        },
        'focus': {
            r:      { kind: 'function', returns: 'number', min: .004, max: 1, step: .004, doc: 'the radius of the circle (a function of the layer context)' },
            center: { kind: 'function', returns: 'point', doc: 'the center of the circle in disk coordinates (a function of the layer context)' },
        },
        'nodes': {
            show:        { kind: 'enum', values: ['leaves', 'all'], doc: 'which nodes get a disk: the leaves, the root and nodes with hidden children (geometry.nodeFilter), or all; the API also takes a function of the node' },
            r:           { kind: 'function', returns: 'number', min: .002, max: .06, step: .001, doc: 'the radius; default geometry.nodeRadius' },
            transform:   { kind: 'function', returns: 'string', doc: 'the SVG transform of a disk; default the node position scaled by geometry.nodeScale' },
            fill:        { kind: 'function', returns: 'color', doc: 'the fill of a disk (default: the theme)' },
            stroke:      { kind: 'function', returns: 'color', doc: 'the stroke of a disk' },
            strokeWidth: { kind: 'function', returns: 'number', min: 0, max: .02, step: .0005, doc: 'the stroke width of a disk' },
            hover:       Object.assign({ doc: 'how hover is shown: the path to the root, the node only, not at all' }, stateDisplay),
            selection:   Object.assign({ doc: 'how the selection is shown' }, stateDisplay),
            lazyScale:   { kind: 'number', min: 1, max: 3, step: .1, doc: 'nodes with hidden children (class lazy, red in the themes) are drawn this much larger' },
        },
        'arcs': {
            role:        { kind: 'enum', values: ['links', 'paths'], internal: true, doc: 'the links of the tree, or the hover and selection paths over them' },
            curvature:   Object.assign({ doc: 'the curvature of the arcs; default geometry.linkCurvature' }, curvature),
            stroke:      { kind: 'function', returns: 'color', doc: 'the stroke of an arc (default: the theme)' },
            strokeWidth: { kind: 'function', returns: 'number', min: .001, max: .05, step: .0005, doc: 'the width of an arc; default geometry.linkWidth' },
            hover:       Object.assign({ doc: 'how hover is shown: the path to the root, the node\'s link only, not at all' }, stateDisplay),
            selection:   Object.assign({ doc: 'how the selection is shown' }, stateDisplay),
        },
        'stem': {
            curvature: Object.assign({ doc: 'the curvature of the stem' }, curvature),
            width:     { kind: 'function', returns: 'number', min: .001, max: .05, step: .0005, doc: 'the width of the stem; default geometry.linkWidth' },
        },
        'symbols': {
            transform: { kind: 'function', returns: 'string', doc: 'the SVG transform of a symbol' },
            hover:     Object.assign({ doc: 'how hover is shown' }, stateDisplay),
            selection: Object.assign({ doc: 'how the selection is shown' }, stateDisplay),
        },
        'images': {
            width:     { kind: 'number', min: .01, max: .3, step: .005, doc: 'the width of an image (disk units)' },
            height:    { kind: 'number', min: .01, max: .3, step: .005, doc: 'the height of an image' },
            imagehref: { kind: 'function', returns: 'string', doc: 'the image URL of a node; default precalc.imageHref (not set by the playground data)' },
        },
        'labels': {
            kind:       { kind: 'enum', values: ['text', 'emoji'], internal: true, doc: 'the labels beside their node, or the emojis centered on it' },
            text:       { kind: 'function', returns: 'string', doc: 'the text of a node; default precalc.label' },
            delta:      { kind: 'function', returns: 'point', doc: 'the offset of the text from the node' },
            color:      { kind: 'function', returns: 'color', doc: 'the color of the text (default: the theme)' },
            background: { kind: 'function', returns: 'boolean', doc: 'a background rect behind the label: on for every label, off, or per node' },
            scale:      { kind: 'function', returns: 'number', min: .2, max: 3, step: .05, doc: 'the size bound to the data (default 1), times geometry.shrinkAtRim' },
            maxLabels:  { kind: 'number', min: 0, max: 200, step: 1, doc: 'at most this many labels: the highest subtree weight × display scale² (big subtrees near the center first; the root always)' },
            hoverLabel: { kind: 'boolean', doc: 'always a label for the node under the mouse (it counts in maxLabels)' },
            hoverPathLabels: { kind: 'boolean', doc: 'labels on the path from the node under the mouse to the root, nearest first; they take maxLabels first, the other labels get the rest' },
            asImage:    { kind: 'boolean', doc: 'every distinct text once as a cached bitmap (faster with many labels, a little blurry when zoomed by the browser)' },
        },
        'labels-force': {
            text:       { kind: 'function', returns: 'string', doc: 'the text of a node; default precalc.label' },
            color:      { kind: 'function', returns: 'color', doc: 'the color of the text (default: the theme)' },
            background: { kind: 'function', returns: 'boolean', doc: 'a background rect behind the label: on, off, or per node (default: the root)' },
            scale:      { kind: 'function', returns: 'number', min: .2, max: 3, step: .05, doc: 'the size bound to the data (default 1), times geometry.shrinkAtRim' },
            maxLabels:  { kind: 'number', min: 0, max: 200, step: 1, doc: 'at most this many labels' },
            hoverLabel: { kind: 'boolean', doc: 'always a label for the node under the mouse (it counts in maxLabels)' },
            hoverPathLabels: { kind: 'boolean', doc: 'labels on the path from the node under the mouse to the root, nearest first; they take maxLabels first, the other labels get the rest' },
            leaderLines: { kind: 'enum', values: ['auto', 'always', 'never'], doc: 'a line from a label to its node: when the label was pushed away from it, always, never' },
            transition: { kind: 'number', min: 0, max: 1000, step: 10, unit: 'ms', doc: 'labels grow when they appear, shrink when they disappear, the others give way smoothly (0: off)' },
            hoverTransition: { kind: 'boolean', doc: 'the label of the node under the mouse animated like the others (off: there and gone at once)' },
        },
        'labels-placed': {
            text:       { kind: 'function', returns: 'string', doc: 'the text of a node; default precalc.label' },
            background: { kind: 'function', returns: 'boolean', doc: 'a background rect behind the label: on, off, or per node' },
            scale:      { kind: 'function', returns: 'number', min: .2, max: 3, step: .05, doc: 'the size bound to the data (default 1), times geometry.shrinkAtRim' },
            maxLabels:  { kind: 'number', min: 0, max: 200, step: 1, doc: 'at most this many labels' },
            hoverLabel: { kind: 'boolean', doc: 'always a label for the node under the mouse (it counts in maxLabels)' },
            hoverPathLabels: { kind: 'boolean', doc: 'labels on the path from the node under the mouse to the root, nearest first; they take maxLabels first, the other labels get the rest' },
            leaderLines: { kind: 'enum', values: ['auto', 'always', 'never'], doc: 'a line from a label to its node: for labels placed away from it, always, never' },
            transition: { kind: 'number', min: 0, max: 1000, step: 10, unit: 'ms', doc: 'labels grow and shrink, a label that changes its place glides there (0: off)' },
        },
        'emoji-backgrounds': {
            emojiLayer: { kind: 'string', doc: 'the emoji layer it lies under: its scale and the size of its emojis' },
            padding:    { kind: 'number', min: .8, max: 2, step: .05, doc: 'the radius of a disk: half the emoji\'s larger side times this' },
            fill:       { kind: 'function', returns: 'color', doc: 'the fill of a disk (default: the theme)' },
            stroke:     { kind: 'function', returns: 'color', doc: 'the border of a disk (default: the theme)' },
        },
        'interaction': {
            mouseRadius: { kind: 'number', min: .3, max: 1, step: .01, doc: 'the radius within which the mouse picks nodes; default interaction.mouseRadius' },
        },
        'traces': {},
        'highlight-marker': {
            r:          { kind: 'function', returns: 'number', min: .002, max: .1, step: .001, doc: 'the radius of the disk in the center of the disk (a number or a function of the layer context, e.g. of geometry.captionHeight), times the rim factor (geometry.shrinkAtRim) where it is' },
            duration:   { kind: 'number', min: 0, max: 1000, step: 10, unit: 'ms', doc: 'the way from the old to the new highlighted node, along the tree (0: it jumps)' },
            fill:       { kind: 'function', returns: 'color', doc: 'the fill of the disk, a function of the highlighted node (default: the theme)' },
            stroke:     { kind: 'function', returns: 'color', doc: 'the border of the disk, a function of the highlighted node (default: the theme)' },
        },
    }
    layerOptions.paths = layerOptions.arcs
    // the emojis: a label layer of kind 'emoji' without the label limit (every icon is drawn)
    layerOptions.emojis = Object.fromEntries(['kind', 'text', 'delta', 'color', 'background', 'scale', 'asImage'].map(k => [k, layerOptions.labels[k]]))
    layerOptions.emojis.text = { kind: 'function', returns: 'string', doc: 'the icon of a node; default precalc.icon' }

    // what a layer type draws
    const layerDocs = {
        'background':    'the background of the projection (the disk, the half-plane)',
        'cells':         'the voronoi cells of the visible nodes: the click areas, always computed (hover and click find the node under the pointer with them); this layer only draws them',
        'focus':         'an indicator circle of the disk (a radius of the filter or the interaction, the zoom λ)',
        'nodes':         'the node disks',
        'arcs':          'the links of the tree as geodesics of the projection',
        'paths':         'the hover and selection paths, drawn over the links (thicker, in the path\'s color)',
        'stem':          'the root\'s stem: from the root into the gap of the root wedge',
        'symbols':       'a star for the root and the start node of the filter\'s path',
        'images':        'images of nodes with precalc.imageHref, centered on the node',
        'labels':        'labels at their node, without placement against each other',
        'emojis':        'the icons (precalc.icon) centered on their node, as bitmaps; the slowest layer to render',
        'emoji-backgrounds': 'a disk with a border under every emoji, as large as the emoji (off by default)',
        'labels-force':  'labels moved by a relaxation: pulled to their rest place (above the node in the center, outward toward the rim), pushed apart where they overlap; positions kept between frames',
        'labels-placed': 'labels placed on candidate positions like on a map: never overlapping, a label without a free place is left out',
        'interaction':   'mouse, touch and wheel: hover, drag, pinch, zoom, click and hold',
        'traces':        'touch traces while touching',
        'highlight-marker': 'a disk on the highlighted node; when the highlight moves on it moves there along the tree, up to the common ancestor and down (off by default)',
    }

    /** The descriptor of a core option path: the longest described prefix (undefined if none). */
    function optionInfo(path) {
        let p = path
        while (p) {
            if (options[p]) return options[p]
            const i = p.lastIndexOf('.')
            p = i < 0 ? '' : p.slice(0, i)
        }
        return undefined
    }
    /** The descriptors of a layer type's options: the common ones and the type's own. */
    const layerOptionInfos = type => Object.assign({}, layerOptions['*'], layerOptions[type] || {})
    // the descriptor of a layer option; for a layer of unknown type the first type that has the option
    const layerOptionInfo = (type, option) => layerOptionInfos(type)[option]
        || (!type && Object.values(layerOptions).map(o => o[option]).find(Boolean))

    // ---------------------------------------------------------------------------------
    // named function values: what cannot be a constant or a scale, by path pattern
    // ('*' matches one segment); the overlay holds "@name"

    const palette = ['#e53935', '#43a047', '#1e88e5', '#fb8c00', '#8e24aa', '#00acc1']
    const byDepth = n => palette[((n && n.depth) || 0) % palette.length]
    const isLeaf = n => !n.children || !n.children.length
    const libNodeRadius = () => hyt.coreDefaults().geometry.nodeRadius
    const named = {
        'layout.type': {
            'berge':       hyt.layouts.layoutBergé,
            'spiral':      hyt.layouts.layoutSpiral,
            'buchheim':    hyt.layouts.layoutBuchheim,
            'unitLines':   hyt.layouts.layoutUnitLines,
            'unitVectors': hyt.layouts.layoutUnitVectors,
        },
        'layout.weight': {
            'uniform':     n => 1,
            'leaves':      n => (isLeaf(n) ? 1 : 0),
        },
        'filter.weightFilter.weight': {
            'uniform':     n => 1,
            'height²':     n => (isLeaf(n) ? 1 : n.height * n.height),
        },
        'filter.labelScore': {
            'shallow first': n => 1 / (n.depth + 1),
            'data.value':    n => (n.data && typeof n.data.value === 'number' ? n.data.value : undefined),
        },
        'geometry.nodeRadius': {
            // leaves a constant, inner nodes the library default
            'leaves 0.015':      (ud, n) => (isLeaf(n) ? .015 : libNodeRadius()(ud, n)),
            // inner nodes like the leaves (1.5 × the link width)
            'inner like leaves': (ud, n) => libNodeRadius()(ud, Object.assign({}, n, { children: null })),
        },
        'geometry.nodeScale': {
            'distance only': d => d.distScale,
        },
        'geometry.nodeFilter': {
            'leaves only': n => isLeaf(n),
            'all':         n => true,
        },
        'geometry.linkWidth': {
            'thin':  d => .01 * d.distScale * d.precalc.weightScale,
            'by distance only': d => .025 * d.distScale,
        },
        'geometry.layerOptions.*.fill':   { 'by depth': byDepth },
        'geometry.layerOptions.*.stroke': { 'by depth': byDepth },
        'geometry.layerOptions.*.color':  { 'by depth': byDepth },
        'geometry.layerOptions.*.background': { 'root only': n => !n.parent, 'inner nodes': n => !isLeaf(n) },
    }
    const matches = (pattern, path) => {
        const a = pattern.split('.'), b = path.split('.')
        return a.length === b.length && a.every((s, i) => s === '*' || s === b[i])
    }
    /** The named values of a path: name → function (empty if none). */
    function namedFor(path) {
        const out = {}
        for (const [pattern, values] of Object.entries(named))
            if (matches(pattern, path)) Object.assign(out, values)
        return out
    }

    // ---------------------------------------------------------------------------------
    // scale specs: { "@scale": { value, scale, interpolator, opacity } } (colors) or
    // { "@scale": { value, scale, range } } (numbers) -> hyt.colorBy / hyt.sizeBy

    const interpolators = ['Viridis', 'Inferno', 'Magma', 'Plasma', 'Cividis', 'Turbo', 'Warm', 'Cool', 'Rainbow', 'Sinebow',
        'Blues', 'Greens', 'Greys', 'Oranges', 'Purples', 'Reds', 'BuGn', 'BuPu', 'GnBu', 'OrRd', 'PuBu', 'PuRd', 'RdPu', 'YlGn', 'YlOrRd',
        'BrBG', 'PRGn', 'PiYG', 'PuOr', 'RdBu', 'RdYlBu', 'RdYlGn', 'Spectral']
    const scaleTypes = ['linear', 'sqrt', 'log']
    const valueNames = () => Object.keys(hyt.nodeValues)
    /** The node value of a scale spec: a name of hyt.nodeValues or data.<key>. */
    function nodeValue(name) {
        if (hyt.nodeValues[name]) return hyt.nodeValues[name]
        if (typeof name === 'string' && name.startsWith('data.')) {
            const key = name.slice(5)
            return n => (n && n.data && typeof n.data[key] === 'number' ? n.data[key] : NaN)
        }
        return hyt.nodeValues.weight
    }
    function scaleFunction(spec, returns, info) {
        const value = nodeValue(spec.value)
        const scale = scaleTypes.includes(spec.scale) ? spec.scale : 'sqrt'
        if (returns === 'color') {
            const interpolator = (typeof d3 !== 'undefined' && d3['interpolate' + (spec.interpolator || 'Viridis')]) || (t => `rgb(${Math.round(t * 255)},80,${Math.round((1 - t) * 255)})`)
            return hyt.colorBy(value, interpolator, spec.opacity === undefined ? 1 : spec.opacity, scale)
        }
        const range = Array.isArray(spec.range) && spec.range.length === 2 ? spec.range
            : [info && info.min !== undefined ? info.min : 0, info && info.max !== undefined ? info.max : 1]
        return hyt.sizeBy(value, range, scale)
    }
    const isScaleSpec = v => v && typeof v === 'object' && !Array.isArray(v) && '@scale' in v

    /**
     * The function of a function option from its mode in the overlay: a function as
     * is, "@name" from the registry, a scale spec, a constant (a boolean stays one).
     */
    function resolveValue(path, v, info) {
        if (v === null || v === undefined || typeof v === 'function') return v
        if (typeof v === 'string' && v.startsWith('@')) {
            const f = namedFor(path)[v.slice(1)]
            if (!f) console.warn(`playground: no named value ${v} for ${path}`)
            return f
        }
        if (isScaleSpec(v)) return scaleFunction(v['@scale'], info && info.returns, info)
        if (typeof v === 'boolean' && info && info.returns === 'boolean') return v
        return () => v
    }

    const isPlain = v => v !== null && typeof v === 'object' && !Array.isArray(v) && Object.getPrototypeOf(v) === Object.prototype

    /**
     * A copy of an overlay with the modes of its function options resolved to
     * functions (resolveValue); the layer options by the layer's type
     * (layerTypeOf(name)) and the specs of geometry.layers by their own type.
     */
    function resolveNamed(overlay, layerTypeOf = () => undefined) {
        const typeOf = name => layerTypeOf(name) || defaultTypeOf(name)
        const walk = (node, path) => {
            if (!isPlain(node)) return node
            const out = {}
            for (const [k, v] of Object.entries(node)) {
                const p = path ? `${path}.${k}` : k
                if (p === 'geometry.layers' && Array.isArray(v)) { out[k] = v.map(resolveSpec); continue }
                if (path === 'geometry.layerOptions' && isPlain(v)) { out[k] = resolveLayerOptions(v, typeOf(k), p); continue }
                const info = optionInfo(p)
                out[k] = info && info.kind === 'function' ? resolveValue(p, v, info)
                    : isScaleSpec(v) ? resolveValue(p, v, info)
                    : walk(v, p)
            }
            return out
        }
        const resolveLayerOptions = (opts, type, path) => {
            const out = {}
            for (const [k, v] of Object.entries(opts)) {
                const info = layerOptionInfo(type, k)
                out[k] = (info && info.kind === 'function') || isScaleSpec(v) || (!info && typeof v === 'string' && v.startsWith('@'))
                    ? resolveValue(`${path}.${k}`, v, info) : v
            }
            return out
        }
        const resolveSpec = spec => typeof spec === 'string' || !isPlain(spec) ? spec
            : Object.assign({}, spec, spec.options ? { options: resolveLayerOptions(spec.options, spec.type, `geometry.layerOptions.${spec.name || spec.type}`) } : {})
        return walk(overlay, '')
    }
    const defaultTypeOf = name => { const s = hyt.defaultLayers().find(s => s.name === name); return s && s.type }

    window.hytOptions = {
        options, layerOptions, layerDocs, optionInfo, layerOptionInfos, layerOptionInfo,
        named, namedFor, interpolators, scaleTypes, valueNames, isScaleSpec, resolveValue, resolveNamed, defaultTypeOf, palette,
    }
})()
