var Promise = require('bluebird')
var Multer = require('multer')
var os = require('os')
var archiver = require('archiver')
var fs = require('fs')
var toArray = require('stream-to-array')
var unzip = require('unzip2')
var helpers = require('./helpers')
var multer

function reqToStream (req) {
  function findFirstFile () {
    for (var f in req.files) {
      if (req.files.hasOwnProperty(f)) {
        return req.files[f]
      }
    }
  }

  var file = findFirstFile()

  return fs.createReadStream(file.path)
}

function streamToEntities (stream) {
  return new Promise(function (resolve, reject) {
    var entities = {}

    stream.pipe(unzip.Parse())
      .on('error', reject)
      .on('entry', function (e) {
        if (e.type === 'File') {
          toArray(e, function (err, arr) {
            if (err) {
              return reject(err)
            }

            try {
              var es = e.path.split('/')[0]
              entities[es] = entities[es] || []
              entities[es].push(JSON.parse(Buffer.concat(arr).toString()))
            } catch (e) {
              return reject(e)
            }
          })
        } else {
          e.autodrain()
        }
      }).on('close', function () {
        resolve(entities)
      })
  })
}

function importStream (reporter, stream) {
  reporter.logger.debug('reading import stream')
  return streamToEntities(stream).then(function (entries) {
    var sum = Object.keys(entries).reduce(function (o, v, i) {
      return o + entries[v].length
    }, 0)
    reporter.logger.debug('import found ' + sum + ' objects')
    return Promise.mapSeries(Object.keys(entries), function (c) {
      helpers.base64ToBuffer(reporter.documentStore.model, c, entries[c])
      return Promise.mapSeries(entries[c], function (d) {
        return reporter.documentStore.collections[c].update({ _id: d._id }, { $set: d }, { upsert: true })
      })
    })
  })
}

function importValidation (reporter, stream) {
  var log = ''
  return streamToEntities(stream).then(function (entries) {
    return Promise.mapSeries(Object.keys(entries), function (c) {
      helpers.base64ToBuffer(reporter.documentStore.model, c, entries[c])
      return Promise.mapSeries(entries[c], function (d) {
        return reporter.documentStore.collections[c].find({ _id: d._id }).then(function (res) {
          if (res.length === 0) {
            log += 'Entity insert: (' + c + ') ' + (d.name || d._id) + os.EOL
          } else {
            log += 'Entity update: (' + c + ') ' + (d.name || d._id) + os.EOL
          }
        })
      })
    })
  }).then(function () {
    return log
  })
}

function exportToStream (reporter, selection) {
  reporter.logger.debug('exporting objects, with selection ' + JSON.stringify(selection || []))
  return Promise.map(Object.keys(reporter.documentStore.collections), function (c) {
    return reporter.documentStore.collections[c].find({}).then(function (res) {
      if (selection) {
        res = res.filter(function (r) {
          return selection.indexOf(r._id.toString()) > -1
        })
      }
      helpers.bufferToBase64(reporter.documentStore.model, c, res)
      return res
    })
  }).then(function (results) {
    return Object.keys(reporter.documentStore.collections).reduce(function (o, v, i) {
      o[v] = results[i]
      return o
    }, {})
  }).then(function (entities) {
    var sum = Object.keys(entities).reduce(function (o, v, i) {
      return o + entities[v].length
    }, 0)
    reporter.logger.debug('export will zip ' + sum + ' objects')

    var archive = archiver('zip')
    Object.keys(entities).forEach(function (c) {
      entities[c].forEach(function (e) {
        archive.append(JSON.stringify(e), { name: c + '/' + (e.name ? (e.name + '-' + e._id) : e._id) + '.json' })
      })
    })
    archive.finalize()
    return archive
  })
}

module.exports = function (reporter, definition) {
  multer = Multer({ dest: reporter.options.tempDirectory })

  reporter.export = function (selection) {
    return exportToStream(reporter, selection)
  }

  reporter.import = function (stream) {
    return importStream(reporter, stream)
  }
  reporter.importValidation = function (stream) {
    return importValidation(reporter, stream)
  }

  reporter.on('express-configure', function (app) {
    app.post('/api/export', function (req, res, next) {
      exportToStream(reporter, req.body.selection).then(function (stream) {
        stream.pipe(res)
      }).catch(next)
    })

    app.post('/api/import', multer.array('import.zip'), function (req, res, next) {
      importStream(reqToStream(req)).then(function () {
        res.send({ status: '0', message: 'ok' })
      }).catch(next)
    })

    app.post('/api/validate-import', multer.array('import.zip'), function (req, res, next) {
      importStream(reqToStream(req)).then(function (log) {
        res.send({ status: '0', log: log })
      }).catch(next)
    })
  })
}

