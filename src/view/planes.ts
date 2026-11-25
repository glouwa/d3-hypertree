// Compositor planes (phase 3). Layers are grouped by what moves together as a whole;
// each plane is one <g> under the layer stack. A plane with a compositing hint is
// its own compositor layer, so a euclidean transform of the whole plane (rotate,
// pan, scale, fade the view; the rectangular view's euclidean navigation) runs on
// the GPU without rasterizing again. The hyperbolic navigation changes the content
// of every layer, so it doesn't profit from finer layers.

export type Plane = 'disk' | 'content' | 'overlay'
export const planes : Plane[] = ['disk', 'content', 'overlay']

// which planes get a compositing hint; overlay holds the invisible mouse capture
// circles (5 disk radii): as its own compositor layer it would be huge and empty
export const compositedPlanes : Plane[] = ['disk', 'content']

// 'planes' (default), 'layers' (one compositor layer per layer group, as before
// phase 3) or 'none'; kept switchable for measuring
export const compositing = { mode: <'planes' | 'layers' | 'none'>'planes' }

const diskLayers = ['background', 'culling-r', 'mouse-r', 'focus-r', 'labels-r-𝐖', 'λ', '(0,0)']
const overlayLayers = ['traces', 'interaction', 'interaction-2']

/** The plane of a layer: its option plane, else by its name (content for all others). */
export function planeOf(layer) : Plane {
    const option = layer.args && layer.args.plane
    if (option && planes.includes(option)) return option
    if (diskLayers.includes(layer.name)) return 'disk'
    if (overlayLayers.includes(layer.name)) return 'overlay'
    return 'content'
}
