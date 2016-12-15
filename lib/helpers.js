module.exports.base64ToBuffer = function (model, collection, docs) {
  var entitySet = model.entitySets[collection]
  var entityType = model.entityTypes[entitySet.entityType.replace(model.namespace + '.', '')]

  docs.forEach(function (doc) {
    for (var prop in doc) {
      if (!prop) {
        continue
      }

      var propDef = entityType[prop]

      if (!propDef) {
        continue
      }

      if (propDef.type === 'Edm.Binary') {
        doc[prop] = new Buffer(doc[prop], 'base64')
      }
    }
  })
}

module.exports.bufferToBase64 = function (model, collection, res) {
  var entitySet = model.entitySets[collection]
  var entityType = model.entityTypes[entitySet.entityType.replace(model.namespace + '.', '')]

  for (var i in res) {
    var doc = res[i]
    for (var prop in doc) {
      if (!prop) {
        continue
      }

      var propDef = entityType[prop]

      if (!propDef) {
        continue
      }

      if (propDef.type === 'Edm.Binary') {
        // nedb returns object instead of buffer on node 4
        if (!Buffer.isBuffer(doc[prop]) && !doc[prop].length) {
          var obj = doc[prop]
          obj = obj.data || obj
          doc[prop] = Object.keys(obj).map(function (key) {
            return obj[key]
          })
        }

        // unwrap mongo style buffers
        if (doc[prop]._bsontype === 'Binary') {
          doc[prop] = doc[prop].buffer
        }

        doc[prop] = new Buffer(doc[prop]).toString('base64')
      }
    }
  }
}
