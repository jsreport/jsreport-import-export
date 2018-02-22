module.exports.base64ToBuffer = function (model, collection, docs) {
  const entitySet = model.entitySets[collection]
  const entityType = model.entityTypes[entitySet.entityType.replace(model.namespace + '.', '')]

  docs.forEach(function (doc) {
    for (let prop in doc) {
      if (!prop) {
        continue
      }

      const propDef = entityType[prop]

      if (!propDef) {
        continue
      }

      if (propDef.type === 'Edm.Binary') {
        doc[prop] = Buffer.from(doc[prop], 'base64')  // eslint-disable-line
      }
    }
  })
}

module.exports.bufferToBase64 = function (model, collection, res) {
  const entitySet = model.entitySets[collection]
  const entityType = model.entityTypes[entitySet.entityType.replace(model.namespace + '.', '')]

  for (let doc of res) {
    for (let prop in doc) {
      if (!prop) {
        continue
      }

      const propDef = entityType[prop]

      if (!propDef) {
        continue
      }

      if (propDef.type === 'Edm.Binary') {
        // nedb returns object instead of buffer on node 4
        if (!Buffer.isBuffer(doc[prop]) && !doc[prop].length) {
          let obj = doc[prop]
          obj = obj.data || obj
          doc[prop] = Object.keys(obj).map((key) => obj[key])
        }

        // unwrap mongo style buffers
        if (doc[prop]._bsontype === 'Binary') {
          doc[prop] = doc[prop].buffer
        }

        doc[prop] = Buffer.from(doc[prop]).toString('base64')  // eslint-disable-line
      }
    }
  }
}
