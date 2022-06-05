from cqparts import Part
Part.importer('step')('./public/models/dog.STEP').exporter('gltf')(filename='dog.gltf', embed=True)

