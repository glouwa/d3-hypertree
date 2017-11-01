# Hypertree

## Installation

```bash
git clone git@github.com:glouwa/gulp.git
sudo npm run globalinstall
npm install
```

## Generating Tree of Life data

```bash
cd res

gulp download

gulp translate --lang en
gulp translate --lang de

gulp deploy

cd ..
```

### The fast way (all languages pretranslated)

```bash
cd res
gulp deploy
cd ..
```

and download prebuild [data](https://drive.google.com/open?id=0B8M0Y20s74LkbG1XSHctME00NXc)
and copy content to res/hierarchy/Open Tree of Life/.

'res/hierarchy/Open Tree of Life/afrotheria/afrotheria.d3.json-de.lang.json'
should be a valid path if done correctly.


## Run

```bash
gulp watch
```

Will build and open a browser window.


## ISDS Project10
Michael Glatzhofer
0230699
michael.glatzhofer@student.tugraz.at
706.505  Projekt Informationssysteme  10 ECTS

### refactoring
    - split in 3, rollup, webpack (tests!), npm
    - define api, extract infterface
    - write howto
    - reduce package size
    - predefine api for
    - configrable component, with configuation ui

### features
o upto a few thousand nodes
o "perimeter culling"
o hyperbolic zoom = radius adjustment
o default zoom level (see whole tree)
o label filtering
    - by data (importance is defined in dataset)
    - by algo
o multi-touch events / responsive
o level-of-detail drag (lines on drag, curves on refresh)
    - lines on drag, curves on refresh
    - hide labels on drag
    - hide nodes on drag if nessessary
o save as svg

[o semantic (doi) filtering]


### performace consderations
    - svg into frame buffer = miniature using css transform ?
    - is css fast? how to save as svg?
    - dataset will be loaded completly
    - svg elements limited
    - javascript limitations
        - currently all nodes are transformed from hyperbolic space to euclidian
        - keep this if possible, otherwise:
            - get a visible node, (the one under mouse?)
            - transform children unitl r > .995 and add to visible set
            - transform parent unitl r > .995 and add to visible set

























