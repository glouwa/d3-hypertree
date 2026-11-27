# Focus-rooted layout (re-rooting): design notes

Status: idea, not planned (2026-11-27). Written up after the analysis of the
deep-navigation collapse (wheel zoom at depth 43 emptied the view; fixed by
laying the path out top-down and never leaving it empty, `filter/culling.ts`
`pathToLastVisible`, and by starting the frame after a wheel or pinch step at
the preserved node, `hypertree.ts` `updateLayoutPath_`). Those fixes remove
the bug; this document is about the design limit behind it and about what a
layout relative to the focus node would give and cost, in particular for trees
loaded in parts.

## 1. The current design: absolute coordinates, root at the origin

`layout.type` (`layoutBergé`, `src/layout/layouts.ts`) places every node in the
Poincaré disk with the root at 0. A node's position is a function of its
parent's position and wedge only:

```
z(child) = h2e(T(z(parent)), polar(bisector, λ · linkLength))
```

i.e. a hyperbolic translation of the parent's frame by λ·linkLength in the
direction of the child's wedge bisector. The wedge itself is transported to the
child by two Möbius maps (`wedgeTranslate`). `λ` is a global link length; a
λ change re-lays out everything that is drawn.

The layout is lazy: `layoutNode` (`src/filter/culling.ts`) recomputes a node
only when λ, the layout function or the parent's position object changed, and
only for nodes the frame touches (the path from the center node to the root,
the DFS over the visible nodes).

The view is the Möbius transformation `T = { P, θ, λ }`
(`src/geometry/hyperbolic-math.ts`, `h2e`): `view = θ·(z + P') / (…)`, with the
node at `−P` mapped to the center. Navigating to a deep node means `|P| → 1`.

Readers of absolute layout coordinates (`n.layout.z`, `.zp`, `.zStrCache`):

| Where | What |
|---|---|
| `filter/culling.ts` `layoutNode`, `peocessNodeTransformation` | layout on demand, `transform(n.layout.z)` into the view |
| `filter/culling.ts` `peocessNode` | `transformStrCacheZ` (untransformed position string, the layout layer of the playground) |
| `hypertree.ts` `api.gotoNode`, `api.transform` | `P = −z(node)` as the goto target |
| `hypertree.ts` `updateLayoutPath_` | wheel/pinch/animateToλ: relays the ancestors of the preserved node, `P = −z(node)` |
| `hypertree.ts` `layoutReference` | a clone of all layouts (layout animation) |
| `layout/fit.ts` | the reach of a λ (max `zp.r` of the visible nodes), `layout.initSize` |
| `layout/overview.ts` | positions of all nodes for the overview start view |
| `interaction/view-bounds.ts` | the root's disk position (`diskPos(root)`), the stem rule |
| app `overlay.ts` | `goto(−z(node))` |

The Voronoi cells, culling, labels and projections work on view coordinates
and do not depend on the layout frame.

## 2. The limits of absolute coordinates

### Depth

Each link is a hyperbolic step of length `d = 2·atanh(λ)` (in the metric where
the disk radius r has distance 2·atanh r). A node at depth n lies at hyperbolic
distance ≤ n·d from the root, i.e. its Euclidean distance to the rim is

```
1 − |z| ≈ 2·e^(−n·d)
```

(measured: Mammalia depth 43 at λ 0.0985 → 5.4e-4; the formula gives 4e-4; the
first link is half as long.)

Two walls follow:

- **The clamp.** `setZ` clamps every position to `|z| ≤ 1 − 1e-8` (`maxR`).
  Beyond that depth nodes are pulled onto one circle; children of one parent
  differ by angle only and their wedges degenerate. The picture is wrong, not
  just imprecise.
- **Precision of the view transform.** `h2e` with `|P| → 1` magnifies absolute
  errors of z by `1 / (1 − |P|²)`. Doubles near 1 carry ~1e-16, so errors
  reach a thousandth of the disk (a pixel on a phone) at `1 − |z| ≈ 1e-13`.

| λ | d | depth at the clamp (1 − |z| = 1e-8) | depth at the precision wall (1e-13) | 1 − |z| at depth 43 |
|---|---|---|---|---|
| 0.05 | 0.100 | 191 | 306 | 2.7e-2 |
| 0.10 | 0.201 | 95 | 153 | 3.6e-4 |
| 0.15 | 0.302 | 63 | 101 | 4.5e-6 |
| 0.20 | 0.405 | 47 | 76 | 5.4e-8 |
| 0.25 | 0.511 | 37 | 60 | 5.8e-10 |
| 0.30 | 0.619 | 31 | 49 | 5.5e-12 |

The λ a user wants near the leaves is the large one (the subtree spread out),
so the walls are met first where the user is deepest. The Tree of Life clade
trees reach depth ~45; Mammalia at λ 0.25 is already at the clamp.

### Fragility near the rim

Everything on the path from the center to the root lives within 1e-4 of the
rim when the center is deep. Small inconsistencies there (a node laid out with
an old λ, a parent moved by a relayout, the path search starting from a stale
center) become large view errors or an empty visible set, which is what the
collapse was. The fixes make the path handling consistent, but the margin
stays tiny.

### Partial trees

With the root at the origin every position depends on the whole chain to the
root. Loading a subtree downward works (children are laid out from their
parent's frame, nothing else moves). Loading upward does not: without the root
there is no origin, and every new ancestor would move everything loaded so far.

## 3. The idea: lay out relative to the focus node

Hyperbolic space is homogeneous: the layout rule only uses parent–child
relations (bisector angle, link length, wedge transport), so the tree can be
laid out from any node as the origin and gives the same configuration up to an
isometry. A focus-rooted layout makes the current center node F the origin of
the layout frame.

**State.** `{ F, T_local, λ }` instead of `{ P, θ, λ }`: the frame node F, a
Möbius transformation with small `|P|` (F is near the view center by
definition), and λ as today.

**Downward** from F: unchanged (`layoutBergé` from F's frame).

**Upward** from F to the root: the parent's frame is found from the child's.
Lay out the parent's children in the parent's own frame (parent at 0, wedge
orientation as transported today) and read F's position `p_F` in it; the
isometry that maps `p_F → 0` (with the matching rotation) is the parent's frame
expressed in F's frame. Then the parent's siblings, the grandparent, etc.
Cost O(depth), done once per re-root, lazily per frame as today.

**Re-rooting.** When the center node changes from F to F' (same hysteresis as
today's `centerNode`, `centerMargin`), the layout frame moves to F'. The view
must not change: F' has a known view position v (and orientation) in the old
frame, so `T_local' = shift(0 → v)` with θ carrying the transported rotation.
`|P'| = |v|` is small; precision is reset at every re-root. All cached positions
are invalid (`layoutNode` needs a frame id in its validity check); the next
frame recomputes the visible set, O(visible), the same cost as a λ change
today.

**Goto / animations.** `gotoNode` becomes: re-root along the path to the target
step by step (every step is small), or animate `T_local` in the current frame
when the target is near. `updateLayoutPath_` becomes trivial (the preserved node
is in the frame, or is made the frame).

**Root direction.** `keepTreeInView`, the stem and `rootWedge` use the root's
position today. In the new frame the root is at a well defined position as long
as it is loaded; if it is not (partial tree) the direction of the oldest known
ancestor stands in for it.

## 4. Advantages

- **Precision independent of depth.** Only the visible neighbourhood (within
  the culling radius) is ever computed; `1 − |z|` of the nodes that matter
  stays at the order of `e^(−cullingDepth·d)`, the same at depth 5 and 500.
  The clamp and the precision wall disappear; λ can be large at any depth.
- **No rim arithmetic.** The class of bugs behind the collapse (stale layout
  on the path, empty path, cancellation in `h2e`) cannot occur: the path from
  the center outward is laid out from the center.
- **Partial loading in both directions.** Children of a visible node are laid
  out from its frame (also today); ancestors are laid out upward from F, so a
  tree can be opened at any node and grown toward the root on demand. The root
  is not needed. The re-root event is the natural load trigger (load what the
  new frame will show next).
- **Deep and infinite trees.** File systems, call trees, streamed hierarchies.
- **Hyperbolically correct animations.** Moving along a path node by node
  keeps every step small; a goto across the tree is a chain of small steps
  instead of one P interpolation near the rim.
- **The projections, culling, Voronoi, labels and the renderers are untouched**
  (they see view coordinates).
- For the Tree of Life: the clade files are a coarse partial loading already.
  With a focus-rooted layout the main tree could load a clade tree into its
  node when the user navigates into it, instead of switching pages. The
  pipeline would have to give the main-tree leaves the clade's weights.

## 5. Costs and disadvantages

- **The state changes its meaning.** `{ P, θ, λ }` is public: `api.goto(P, λ)`,
  `transformation.state`, the start views (`fit.ts`, `overview.ts`), the app's
  overlay, the e2e tests, URL/preset values that contain a P. Either keep a
  compatibility layer that converts "P relative to the root" to `{ F, T_local }`
  (possible while the root is loaded) or change the API (`goto(node, offset)`).
- **Every reader of absolute positions must change** (table in section 1):
  `gotoNode`, `transform`, `updateLayoutPath_`, `layoutReference`, `fit.ts`,
  `overview.ts`, `view-bounds.ts`, the layout layer's `transformStrCacheZ`, the
  app's overlay. Positions are only comparable within one frame; anything that
  stores a position must store the frame with it.
- **Upward layout is new code.** The inverse wedge transport, the fan rows
  (`FAN_STEP`, `fanRun`) and `childOrder` must be reproduced from the parent's
  frame exactly as the downward layout does, or siblings jump at a re-root.
  The cleanest way is the one in section 3 (lay out the parent's children in
  the parent's frame, then move), which reuses the downward code.
- **Custom layouts.** `layout.type` is a user-supplied function `(root, λ,
  noRecursion)`; the alternative layouts (`layoutUnitVectors`, `layoutSpiral`,
  `layoutBuchheim`, `layoutLamping`) are absolute. They would stay root-framed
  (frame = root, no re-rooting) or be dropped. The layout function signature
  gains a frame.
- **Re-root cost and flicker.** A re-root invalidates all cached positions
  (O(visible) relayout, the λ-change cost, ~ms on the desktop, tens of ms on a
  phone at Mammalia size). It must be rate-limited (the center hysteresis) and
  never happen mid-gesture, or dragging pays it on every frame.
- **Weights for partial trees** are independent of the layout but needed for
  it: the sector widths, the culling weights and the label sizes are subtree
  sums (`data/weights.ts`, computed once per tree). A data source that delivers
  parts must deliver the subtree counts of the unloaded stubs, and the sums
  must be updated incrementally on load (also the fan weights per parent).
- **Testing.** The picture must be identical before and after a re-root; the
  snapshot tests cover that only at the start view. New tests for re-root
  invariance, upward layout vs downward layout, and partial loading.
- **Effort.** Layout upward and frame bookkeeping ~2 days; migrating the
  readers, API compatibility and tests ~3 days; partial loading itself is a
  separate feature on top (data source interface, weights, load triggers).

## 6. Alternatives considered

- **Higher precision storage** (hyperbolic polar coordinates: distance as a
  plain double, angle): removes the storage problem but not the cancellation
  in the view transform with `|P| → 1`, and not the clamp. Not sufficient alone.
- **Clamp λ by depth** so the deepest visible node stays inside the clamp:
  cheap, keeps the current design, but forbids exactly the spread the user
  wants near the leaves. Could be a stop-gap (`λ_max(depth)` from the table).
- **Keep absolute coordinates, raise the clamp** to `1 − 1e-13`: moves the
  wall a few levels (λ 0.25: depth 37 → 60), no structural change. Possible
  quick win but the precision wall is then the hard limit.

## 7. Decision

Not now. The acute bug is fixed in the current design. Re-rooting is the right
basis if one of these comes: on-demand loading of parts of a tree (especially
upward or without the root), trees deeper than the table allows at the wanted
λ, or a request for large λ near the leaves of the clade trees. Until then,
`λ_max(depth)` or the raised clamp are the cheap options.
