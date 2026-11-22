# Test fixtures

Constant input files for the data loader tests and scene snapshots. Changing a
file changes the expected scenes, so update the snapshots in the same commit.

| File | Format | Nodes | Origin |
|---|---|---|---|
| small.d3.json | d3 hierarchy JSON | small | hand-written |
| small.lang.json | language map | | hand-written, labels for small.d3.json |
| flare.csv | CSV (dot paths) | 252 | the Flare class hierarchy from the d3 examples |
| animals.skos.xml | SKOS | small | hand-written |
| primates.treeml.xml | TreeML | 192 | copy of the primates tree from hypertree-of-life, by the same author, released for this repo |
