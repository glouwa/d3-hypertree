# One-edge rectangular view ("dendrogram-like"): analysis

Status: analysis, nothing implemented (2026-11-27). Question: starting from the
Schwarz–Christoffel rectangle (`geometry.view: 'rectangle'`), can the ideal boundary
of the hyperbolic plane (the rim of the disk) be mapped onto the top edge only,
giving a dendrogram-like picture with the root static at the bottom middle and the
path from every visible node to the root always completely visible?

## Summary

- **Not with a conformal map.** A conformal map of the disk onto a rectangle puts
  the rim on the whole perimeter (today: all four edges, the root's gap in the middle
  of the bottom edge, not three). The only conformal picture with the rim on one
  straight line is the half-plane (the Cayley map we already have as `'halfplane'`),
  whose "one edge" is infinitely long and whose root side is at infinity. The wanted
  view is therefore the half-plane *compressed* into a rectangle, which is
  necessarily non-conformal (as Inxight did), or a different layout.
- **Proposal A (projection only):** Cayley to the half-plane, then the compression
  `Y = y / (1 + y)`, `X = (A/2)·tanh(2x / (A (1 + y)²))`. Top edge = the rim (all
  leaves), bottom/left/right edges = the single ideal point of the root's gap. Along
  the center line it has exactly the disk's scale (locally isotropic), the root's
  stem bends to the bottom middle. Everything else (layout, λ zoom, Möbius
  navigation, culling, cells) stays. 1–2 days.
- **Root static at the bottom middle: no** for A with the current layout and free
  navigation. The root is a node like any other; dragging moves it, and the 300°
  root wedge lets branches lie below the root. It is static only with navigation
  restricted to the isometries that fix the gap's ideal point (`x → a·x + b`,
  `y → a·y`, a 2-day add-on) *and* a layout whose children are always above their
  parent (a horocycle layout, proposal C). Then it is static in y; static in x
  only if the view is anchored at the root instead of the focus.
- **Paths always completely visible: yes in the weak sense, no in the strong one.**
  A maps the whole disk into the rectangle, so every path is inside the picture (as
  in the SC rectangle today), but near the edges it is compressed to invisibility.
  The strong property (every path legible, monotone in depth) needs the horocycle
  layout C, where y is a function of depth and the ancestors have more room than in
  the disk.
- **Dendrogram-like:** A gives "leaves at the top, root side at the bottom", not
  levels: the Bergé layout's link lengths and directions vary, so equal depth does
  not mean equal height. Levels need C (all nodes of depth k on one horocycle).
- **Recommendation:** build A as a projection (`geometry.view: 'horizon'` or as the
  new behaviour of `'halfplane'`), test it on the Tree of Life, add the restricted
  navigation as an option if the picture asks for it. C is a second pipeline
  (layout + transformation + navigation), 2–3 weeks, only if dendrogram levels are
  really wanted; it combines well with the focus-rooted layout
  (docs/dev/FOCUS-ROOTED-LAYOUT.md).

## 1. Current state: what the rectangle does with the rim

`src/geometry/schwarz-christoffel.ts`, `src/projection/rectangle.ts`: the disk is
rotated so the gap of the root wedge points to `z = 1`, then

```
ζ = i·a·(1 + z) / (1 − z)          (Cayley, a = 1/√k; z = 0 → ζ = i·a)
w = sn⁻¹(ζ, k)                     (Schwarz–Christoffel for four right angles)
x = Re w / K ∈ [−1, 1],  y = (Im w − K'/2) / K ∈ [−K'/2K, K'/2K]
```

The rim `|z| = 1` becomes the real axis of ζ, and `sn⁻¹` maps the real axis onto
the whole perimeter of the rectangle: the four corners are the rim points with
`ζ = ±1, ±1/k`. So all four edges are ideal boundary. `z = 1` (the gap, `ζ = ∞`)
goes to the middle of the bottom edge; the rim arc around the gap is the bottom
edge. It looks like three edges only because the gap has no nodes, just the stem.
The map is conformal (fans keep their angles), its scale is zero at the corners
and larger than the disk's near the middles of the long edges (sizes are capped at
the center's).

In the `'halfplane'` prototype (`cayley.ts`, `projection/halfplane.ts`) the rim is
the single line `Im w = 0` (drawn as the top edge at view y = −1), and the gap is
the point at infinity below. That is the only conformal picture with the rim on one
line; its price is an unbounded view (the root and far ancestors leave it,
docs/dev/LAMPING-HALFPLANE.md).

## 2. Why one edge needs a non-conformal step

By Carathéodory's theorem a conformal map of the open disk onto a bounded Jordan
domain extends to a homeomorphism of the closures: the whole rim goes onto the
whole boundary curve. With a rectangle as the target the rim is on all four edges,
whatever the map. To have the rim on the top edge only, the other three edges must
be the image of something that is not rim: a single ideal point (the gap) blown up
into three edges, or finite points. Neither is conformal. So either

- keep the layout and the Möbius navigation and put a non-conformal compression
  after the Cayley map (candidates A, B), or
- change the model: lay the tree out in the half-plane on horocycles and navigate
  with the isometries that fix infinity (candidate C, the Inxight design).

## 3. Candidates

Notation: half-plane coordinates `(x, y)`, `y > 0`, from the Cayley map with the
gap at `∞` and the view center at `(0, 1)` (the disk center). The view rectangle has
height 1 (`Y ∈ [0, 1]`, 0 at the top) and width `A` (the aspect ratio),
`X ∈ [−A/2, A/2]`. Along the disk diameter through the gap, `z = t` (t toward the
gap), the Cayley map gives `y = (1 + t) / (1 − t)`.

### A. Compressed half-plane (projection only)

```
Y = y / (1 + y)                              = (1 + t) / 2 on the axis: the disk's radial scale
X = (A/2) · tanh( 2x / (A (1 + y)²) )
```

- **Edges.** Top `Y = 0` ⟺ `y = 0`: the rim, all leaves, every rim point except
  the gap at `x = −cot(φ/2)` (φ the rim angle from the gap). Bottom `Y = 1` ⟺
  `y = ∞`, left/right `X = ±A/2` ⟺ `x = ±∞` at finite y: all three are limits
  toward the one ideal point `∞`, the gap. No node of the tree lies on them; nodes
  approach them only when a branch is dragged toward the gap's direction.
- **Scale.** At `x = 0`: `∂X/∂x = ∂Y/∂y = 1/(1 + y)²`, the map is isotropic along
  the center line; at the center (`y = 1`) it is the disk's scale (1/4 per
  half-plane unit = 1/2 per disk unit). Toward the top edge sizes shrink like `y`
  (the half-plane's exponential shrink, as the disk's `1 − |z|`), toward the bottom
  like `1/y`. Off the center line the `tanh` compresses x by `sech²(…)` and adds a
  shear (`∂X/∂y ≠ 0`); the simpler separable variant `X = (A/2)·tanh(x/2A)` has no
  shear but makes deep ancestors near the bottom (`y ≫ 1`, `x ≈ 0`) wide and flat
  (horizontal size ∝ y, vertical ∝ 1/y). The `(1 + y)²` in the argument fixes that.
  Nodes stay circles (they are drawn with a scalar `distScale`, taken from the local
  scale `√det J`); link curves and Voronoi cells are distorted.
- **Geodesics.** Not circles any more. Draw them as in `rectangle.ts`: a quadratic
  curve through the image of the disk arc's midpoint; long links (ancestors near the
  edges) may need a polyline of a few samples. The stem (the geodesic root → gap)
  is the vertical ray `x = x_root` in the half-plane; compressed it bends toward
  `X = 0` as `y → ∞`: every stem ends at the bottom middle.
- **Root.** At `(x_r, y_r)`, the stem below it. `y_r` is large (root at the
  bottom) only when the view center lies "above" the root, i.e. the geodesic from
  the root to the center leaves it upward. The root rule of `view-bounds.ts` only
  keeps the center out of the 60° gap, so the stem may leave at up to 150° from the
  direction to the center: the root can be beside or even above the center
  (`y_r < 1`), with its stem crossing the whole picture down to the bottom. The
  300° root wedge also puts some children below the root. So the root is in the
  picture always, at the bottom often, static never, under free navigation.
- **Paths.** Every node is inside the rectangle (the map is onto the open
  rectangle), so every path is in the picture. Legibility is another matter: the
  path to a root that sits at the top edge far to the side runs along the edge at
  zero size. Monotone in depth it is not (see §4).
- **Navigation, zoom, culling.** Unchanged: pointer positions go back through the
  inverse (`y = Y/(1 − Y)`, `x = (A(1 + y)²/2)·atanh(2X/A)`, inverse Cayley), the
  transformation `{P, θ, λ}`, the λ zoom, the weight filter and `keepTreeInView` work
  in the disk as today.
- **Add-on A′: navigation fixing the gap.** Restrict drags to the Möbius maps that
  fix the ideal point `g` (in the half-plane `x → a·x + b`, `y → a·y`: scroll along
  the horizon and move between levels, Inxight's two axes). Then the vertical order
  of nodes is preserved, a root that starts at the bottom stays at the bottom, and
  the stem never crosses the picture. Implementation in `interaction-layer.ts`:
  project the drag's `shift` onto that two-parameter subgroup (the hyperbolic
  translation along the geodesic through `g` and the parabolic motion around `g`),
  ~2 days with tests. The λ zoom (wheel, pinch) stays as it is.
- **Pros:** reuses `cayley.ts` and the shape of `rectangle.ts`; cheap (closed form,
  ~30 flops per node against the SC map's Carlson iteration); bounded view with the
  rim on one edge; labels in reading direction along the horizon; the stem always
  to the bottom middle. **Cons:** non-conformal (shear and squeeze off the center
  line); the root and the ancestors are small near the bottom when zoomed in deep
  (as in the disk, not better); no depth levels; the whole rim on one edge means
  the leaf density per edge length is higher than in the disk.

### B. The band (strip) model

`ξ = log w` maps the half-plane onto the strip `0 < Im ξ < π`: two ideal edges
(the two halves of the real axis), the left end the rim point `w = 0`, the right end
the gap. Conformal, with one geodesic (center → gap) as its straight axis; a tanh
along the axis would bound it. It is the dendrogram picture turned by 90° with the
leaves on *two* edges (top and bottom) and the root side at one end. To have one
rim edge you would cut the strip in half along the axis, which is not a map of the
disk any more. Not a candidate for the wanted view; worth remembering as the
natural picture when one path (focus → root) is the subject.

### C. Horocycle layout in the half-plane (Inxight, US 6,901,555)

A layout directly in half-plane coordinates: the children of a node at `(x_p, y_p)`
lie on the horocycle `y = y_p·e^(−d)` (a line parallel to the horizon), spread in x
according to the width their subtrees need; `d` grows with that width. Navigation
only by the isometries fixing `∞` (scroll along the horizon, move between levels,
click to center) and a non-conformal compression of the ancestor side so the root
stays in view. With the horizon at the top:

- **Root:** the deepest node (largest y) always, since every child is above its
  parent; static in y when the compression is anchored at the root
  (`Y = 1 − g(log(y_root / y))`, `g: [0, ∞) → [0, 1)` monotone, e.g. a tanh with a
  focus-dependent scale); static in x only if the x compression is anchored at the
  root's column too, which means the *focus* moves sideways when the user scrolls.
  Inxight centers the focus and lets the root move. One has to choose.
- **Paths:** y decreases strictly from the root toward the leaves, x stays within
  the tanh-bounded view: every path from a visible node to the root is inside the
  picture *and* monotone, with the ancestors given room by the compression. This
  is the strong property the question asks for.
- **Dendrogram:** with a constant `d` every depth is one horizontal line; with
  Inxight's width-dependent `d` the levels are per subtree (a true dendrogram axis
  only for the constant choice). Leaves of finite depth sit on their level, the top
  edge stays empty ideal boundary.
- **Cost:** a second pipeline. New layout function (half-plane coordinates, widths
  from subtree leaf counts, `data/weights.ts` has them), a new transformation state
  (`a, b` instead of `{P, θ, λ}`; or keep `{P, θ, λ}` restricted to the subgroup
  fixing `g`, which keeps `api.goto`, the start views and the tests closer), the
  culling by hyperbolic distance from the focus instead of `cachep.r` and
  `cullingRadius`, `view-bounds` replaced by the root anchoring, the interaction
  layer's drag mapping, the λ zoom reinterpreted as the level distance. 2–3 weeks.
  Shares the goal of docs/dev/FOCUS-ROOTED-LAYOUT.md: a layout anchored at the
  focus or root rather than absolute disk coordinates.

### Comparison

| | SC rectangle (today) | A compressed half-plane | A′ with navigation fixing the gap | C horocycle layout |
|---|---|---|---|---|
| Rim on | all four edges | top edge only | top edge only | top edge only (empty) |
| Conformal | yes | no (isotropic on the center line) | no | no |
| Root in the picture | always, anywhere on/near the rim | always, mostly near the bottom | always, stays below the tree | always, bottom |
| Root static | no | no | in y nearly, not in x | in y; in x by choice |
| Paths inside the picture | yes | yes | yes | yes |
| Paths legible and monotone | no | no | mostly (no levels) | yes |
| Depth levels | no | no | no | yes (constant d) |
| Layout / λ zoom / culling unchanged | yes | yes | yes | no |
| New code | — | one Projection (~200 lines) + tests | + drag projection (~100 lines) | layout, transformation, culling, navigation |
| Effort | — | 1–2 days | +2 days | 2–3 weeks |

## 4. Is it dendrogram-like?

A dendrogram needs a depth axis: all nodes of depth k at the same height. In the
half-plane that is a horocycle layout (children exactly on `y_p·e^(−d)`). The Bergé
layout (`src/layout/layouts.ts`) does not do that: the root's links are half as
long, `layout.rootLinkLength` scales links by depth, fan rows add `FAN_STEP` per
row, and a child placed sideways in its parent's wedge has nearly its parent's y
while one placed upward is a full link higher. Mapped by A, nodes of equal depth
scatter in Y; branches that leave a node sideways or downward (the 300° wedge) go
down first and come back up (every non-vertical geodesic in the half-plane returns
to the real axis). What A gives is the half-plane's *direction*: leaves toward the
top, the root side toward the bottom, labels horizontal. Levels need C, or at least
a layout with children only above their parent (root wedge ≤ 180°, which the
transported wedges of the descendants would still violate after a few levels).

## 5. Impact on the library

**A (projection).** New class in `src/projection/` implementing `Projection`
(`projection.ts`): `kind`, `followsSize = true` (the aspect ratio from the drawn
box, as `rectangle.ts`), `project` (Cayley via `cayley.ts` + the compression, the
disk position kept on the view position as `rectangle.ts` does; `distScale` by the
local scale relative to the center, capped at 1), `toView`/`toDisk` (closed form),
`geodesic` (quadratic through the mapped arc midpoint, or a short polyline),
`stem` (the vertical half-plane ray, mapped), `circle` (small circles by the local
scale, as today), `outward` (toward the top edge: `(0, −1)`), `rim` (the disk
radius of the position, as `rectangle.ts`), `viewBox`/`clip`/`voronoiExtent`/
`background` (a rectangle, like `rectangle.ts`), `overviewClamp` (the whole disk is
in the picture: identity). Register in `projection/index.ts` and
`config/schema.ts` (`geometry.view`), allow the kind in `view-bounds.ts` (the
disk-based check is valid: the view is a bijective image of the disk), document in
`playground/options.js`, `readme.md`, `CHANGELOG.md`; the app's `?view=` switch gets
a value. Tests like `test/tests/rectangle.spec.mjs`: positions inside the
rectangle, inverse accuracy, the center scale, the stem to the bottom middle,
hover/drag/wheel/click, links after deep goto. Performance: cheaper than the SC
map (no Carlson iteration; the SC map costs about 10–20 complex duplication steps
per node per frame). Risks: the shear off the center line makes link curves look
odd near the side edges; the leaf edge is dense; on a portrait phone (`A < 1`) the
x compression is strong and the horizon short, so the useful region is the middle
column (the disk is round there for a reason).

**A′ (navigation).** `interaction-layer.ts` drag handler: compute the free
`shift`, then the nearest element of the subgroup fixing `g` (two parameters from
the pointer's start and end: the translation along the geodesic through `g` from the
vertical component, the parabolic motion from the horizontal one); `view-bounds`
simplifies (the root cannot pass the center). Option
`interaction.navigation: 'free' | 'horizon'` or a flag on the projection.

**C (layout).** See the candidate: layout, transformation, culling, interaction,
view-bounds, start views (`fit.ts`, `overview.ts`), the API's `P`, tests. It should
be planned together with the focus-rooted layout, since both replace the absolute
disk coordinates and both need the weights of unloaded subtrees for partial
loading.

## 6. Recommendation

1. Build A as a projection and look at the Tree of Life in it (desktop and phone).
   It answers the question "rim on the top edge only" exactly, costs little, and
   supersedes the uncompressed `'halfplane'` prototype (same model, bounded).
2. If the picture is good but the root wanders, add A′ (navigation fixing the
   gap). Expect the root at the bottom and the stem never crossing the tree.
3. Do C only if depth levels are the goal. Then do it as the half-plane variant of
   the focus-rooted layout, not as a third absolute layout.

## 7. Open questions

- Anchor the x compression at the focus (the view center, as A does) or at the
  root's column (the root at the bottom middle, the focus wherever its column is)?
- Should A replace `'halfplane'` or be a fourth value (`'horizon'`)?
- Keep the λ zoom as the layout's link length in A (yes, nothing speaks against
  it) and in C (where it would be the level distance `d`)?
- Labels: with the horizon at the top the labels are horizontal and the leaves
  dense along the edge; does the label filter need an edge-aware rule?
- Portrait phones: a minimum aspect ratio for the compression, or let the view
  fall back to the disk below it?
