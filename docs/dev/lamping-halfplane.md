# Half-plane view: what Lamping and Rao did, compared with ours

Research notes (2026-11-23) for the rectangular view (`geometry.halfPlane`,
`src/models/transformation/cayley.ts`). Question: does the hyperbolic browser
work of Lamping and Rao describe a rectangular view via the Cayley transform,
and how does our prototype compare?

Short answer: the papers from the 1990s use only the disk. The half-plane
version is a later patent by the same authors (Inxight, filed 2001). It lays the
tree out directly in the half-plane, on horocycles, with a non-conformal
compression and constrained navigation. Our prototype maps the disk layout with
the Cayley transform instead, which is exact but gives a different, busier
picture.

## Sources

| Source | Content |
|---|---|
| Lamping, Rao, Pirolli: *A Focus+Context Technique Based on Hyperbolic Geometry for Visualizing Large Hierarchies*, CHI '95 | the hyperbolic browser, disk display |
| Lamping, Rao: *The Hyperbolic Browser: A Focus+Context Technique for Visualizing Large Hierarchies*, J. of Visual Languages and Computing 7 (1996) 33–55 | the long version: layout, mapping, navigation, animation, implementation |
| US 5,590,250 (Xerox, 1996): *Layout of node-link structures in space with negative curvature* | the patent for the disk browser |
| US 6,901,555 B2 (Hida, Lamping, Rao; Inxight, filed 2001-07-09, expired 2022): *Tree visualization system and method based upon a compressed half-plane model of hyperbolic geometry* | the half-plane version |

Links: [JVLC 1996, text copy](https://ondoc.logand.com/d/8083/txt),
[CHI '95 (PDF)](https://ils.unc.edu/~march/courses/357_f03/p388-lamping.pdf),
[US5590250A](https://patents.google.com/patent/US5590250A/en),
[US6901555B2](https://patents.google.com/patent/US6901555B2/en).

The formulas in the copies are damaged by OCR; formulas below are
reconstructions.

## The disk browser (1995/96, US 5,590,250)

- **Model**: the Poincaré disk. The Klein model (straight geodesics) was tried and
  rejected: nodes a link or two from the focus get almost no screen space. The
  Poincaré model "preserves the shapes of fan-outs at nodes".
- **Non-circular display**: only as an outlook: "Other transformations of the
  mapping from the hyperbolic plane to the display can yield other effects", any
  conformal map, an ellipse, a dual-focus map that changes the aspect ratio by
  about 50 %. No half-plane, no Cayley transform, no rectangle as display region.
- **Navigation**: the layout is computed once; a change of focus is a rigid
  motion of the disk, z' = (θz + P) / (1 + P̄θz), composed into one cumulative
  transformation (θ normalized against round-off). Translations rotate nodes; two
  options: keep the root's orientation, or rotate so the children of the focus
  fan out in a canonical direction.
- **Zoom**: none. Magnification comes only from moving a region to the center.
- **Links**: arcs (geodesics), "to convey a sense of warping of the space and to
  preserve the angle near the node centers"; straight lines during animation
  (cheaper; near the center the arcs are almost straight anyway).
- **Border**: nodes below about one pixel are not drawn (during animation a
  larger limit, 0.07); text needs at least a few characters of room.

This matches d3-hypertree's disk pipeline (it implements the same ideas), except
that d3-hypertree zooms by the layout's λ.

## The half-plane browser (US 6,901,555 B2)

- **Model**: positions are stored in the half-plane model directly; there is no
  map from the disk. The patent "adapts the hyperbolic tree browser methods to
  the half-plane model". Moves are half-plane isometries: along the horizon
  `(x, y) → (x + d·y, y)` and in depth `(x, y) → (x, y·e^(−d))`.
- **Layout**: on horocycles. The children of a node lie on a horocycle drawn as a
  line parallel to the horizon, so siblings form columns ("the illusion of
  columns"). The distance from a parent to its children grows with the width the
  children need (`dist = max(min_dist, log((totalWidth + spacing) / parent.width))`,
  widths like `max(min_width, 0.5·asinh(0.2·n))`).
- **Orientation**: the horizon (the boundary at infinity) preferably on the
  right, for left-to-right reading like a table; the bottom is mentioned as an
  alternative. The focus in the middle, its ancestors toward the opposite side,
  its descendants toward the horizon.
- **Compression**: deliberately not conformal. Without it the half-plane "provides
  little contextual information about the ancestors of the node in focus, and
  generally makes less efficient use of screen real-estate". The depth axis is
  compressed with `f = C / (A − y)` (C = 1, A = 1.075 "after experimentation"), the
  width axis with the local ratio `f²/C`, so that columns stay columns.
- **Navigation**: constrained to the two axes: a drag along the horizon scrolls
  through the siblings, a drag across it moves between levels, a click centers the
  node; drags that are 90 % along an axis count as along it, clicks near the
  border count as 5 % away from it.
- **Links**: arcs or straight lines; with the column layout they are short.
- **Advantages named**: efficient use of narrow, rectangular windows (a squeezed
  disk "allocates more space arbitrarily to nodes along the long axis"), labels in
  reading direction, predictable movement up/down and across. Trade-off: the tree
  is no longer confined to a closed region.

## Comparison with our prototype

| | Inxight half-plane (2001) | d3-hypertree `geometry.halfPlane` |
|---|---|---|
| Layout | directly in the half-plane, siblings on horocycles (columns) | Bergé layout in the disk, then the Cayley map: siblings on circle arcs (fans) |
| Horizon | right (reading direction), or bottom | bottom |
| Ancestors | toward the opposite side, compressed into view | above; far ones (Im w > 3) are only hidden, their links leave the view; the space above the focus is often empty |
| Links | arcs or lines, short | exact geodesics: large semicircles centered on the bottom edge |
| Navigation | along the two axes (isometries), click centers | free drag as in the disk: branches turn and shift freely |
| Sizes | columns of fixed width, text in reading direction | the map's scale, capped at the size in the center |
| Zoom | none (a fixed stretch parameter) | λ of the layout (decided: zoom is a layout change) |

Why our view looks worse: it is the exact half-plane picture of a disk layout,
the "map at the end of the pipeline" from our plan. The readability of the
Inxight design comes from three things that a display map cannot give: the
horocycle layout (columns instead of fans), the compression of the ancestor side,
and the navigation along the axes.

## Options

1. **Inxight-style half-plane as a second prototype**, next to the current one:
   a layout in the half-plane on horocycles, the compression and orientation
   (horizon right or bottom), navigation along the axes (`w → w + t`, `w → k·w`
   as moves, a click centers). Zoom can stay a layout parameter. This is its own
   pipeline next to the disk, not a display option.
2. **Improve the current prototype** without a new layout: horizon on the right,
   compression of the ancestor side, navigation constrained to the axes.
3. **Leave the rectangular view as it is** for now.
4. **A conformal map of the whole disk onto the rectangle** (Schwarz–Christoffel,
   the "any conformal map" of Lamping's outlook): keeps everything the disk has (the
   root and the path to it always in the picture, nodes bounded, fans with their
   angles), only the four corners are compressed. No new layout or navigation.

Decided 2026-11-27: option 4, `geometry.view: 'rectangle'`
(`src/geometry/schwarz-christoffel.ts`, `src/projection/rectangle.ts`); the Tree of
Life's `?view=rect` uses it. The half-plane stays as `'halfplane'`. Reason: no
isometry keeps the root in view while a leaf is magnified; the disk has that
property through its compactness, and the Cayley map gives it up by sending a rim
point to infinity.
