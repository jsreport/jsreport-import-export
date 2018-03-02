var Promise = require('bluebird')
var Multer = require('multer')
var os = require('os')
var archiver = require('archiver')
var toArray = require('stream-to-array')
var yauzl = require('yauzl')
var helpers = require('./helpers')
var multer

function parseMultipart (req, res, cb) {
  multer.array('import.zip')(req, res, function (err) {
    if (err) {
      return cb(new Error('Unable to read import.zip key from multipart stream'))
    }

    function findFirstFile () {
      for (var f in req.files) {
        if (req.files.hasOwnProperty(f)) {
          return req.files[f]
        }
      }
    }

    var file = findFirstFile()

    if (!file) {
      return cb(new Error('Unable to read import.zip key from multipart stream'))
    }

    cb(null, file.path)
  })
}

function zipFileToEntities (zipFilePath) {
  var zipFile

  return new Promise(function (resolve, reject) {
    var entities = {}

    // using lazyEntries: true to keep memory usage under control with zip files with
    // a lot of files inside
    yauzl.open(zipFilePath, { lazyEntries: true }, function (openZipErr, zipHandler) {
      if (openZipErr) {
        return reject(openZipErr)
      }

      var hasError = false

      zipFile = zipHandler

      zipFile.readEntry()

      zipFile
      .on('error', function (err) {
        if (hasError) {
          return
        }

        hasError = true
        reject(err)
      }).on('entry', function (entry) {
        if (hasError) {
          return
        }

        if (/\/$/.test(entry.fileName)) {
          // if entry is a directory just continue with the next entry.
          return zipFile.readEntry()
        }

        zipFile.openReadStream(entry, function (err, readStream) {
          if (hasError) {
            return
          }

          if (err) {
            hasError = true
            return reject(err)
          }

          toArray(readStream, function (err, arr) {
            if (hasError) {
              return
            }

            if (err) {
              hasError = true
              return reject(err)
            }

            try {
              var es = entry.fileName.split('/')[0]
              entities[es] = entities[es] || []
              entities[es].push(JSON.parse(Buffer.concat(arr).toString()))

              zipFile.readEntry()
            } catch (e) {
              hasError = true
              reject(
                new Error(
                  `Unable to parse file "${
                    entry.fileName
                  }" inside zip, make sure to import zip created using jsreport export`
                )
              )
            }
          })
        })
      }).on('close', function () {
        if (hasError) {
          // close event can may be emitted after an error
          // when releasing the zip file
          return
        }

        resolve(entities)
      })
    })
  }).catch(function (err) {
    if (zipFile && zipFile.isOpen) {
      // ensure closing the zip file in case of error
      zipFile.close()
    }

    // propagate error
    throw err
  })
}

function importZipFile (reporter, zipFilePath, req) {
  reporter.logger.debug('reading import zip file')
  return zipFileToEntities(zipFilePath).then(function (entries) {
    var sum = Object.keys(entries).reduce(function (o, v, i) {
      return o + entries[v].length
    }, 0)
    reporter.logger.debug('import found ' + sum + ' objects')
    return Promise.mapSeries(Object.keys(entries), function (c) {
      helpers.base64ToBuffer(reporter.documentStore.model, c, entries[c])
      return Promise.mapSeries(entries[c], function (d) {
        return reporter.import.filteringListeners.fire(req, d).then(function () {
          return Promise.reduce(reporter.import._processings, function (prevImportProcess, importProcess) {
            return Promise.resolve(importProcess(
              prevImportProcess,
              req,
              reporter.documentStore.collections[c],
              d
            ))
          }, null)
        }).then(function (mainProcessing) {
          return mainProcessing(req, reporter.documentStore.collections[c], d)
        })
      })
    })
  })
}

function importValidation (reporter, zipFilePath, req) {
  var logs = []

  return zipFileToEntities(zipFilePath).then(function (entries) {
    return Promise.mapSeries(Object.keys(entries), function (c) {
      helpers.base64ToBuffer(reporter.documentStore.model, c, entries[c])
      return Promise.mapSeries(entries[c], function (d) {
        return reporter.documentStore.collections[c].find({ _id: d._id }).then(function (res) {
          var validationInfo = {
            importType: res.length === 0 ? 'insert' : 'update',
            collectionName: c,
            entity: d
          }

          validationInfo.log = (
            'Entity ' + validationInfo.importType +
            ': (' + validationInfo.collectionName + ') ' + (d.name || d._id)
          )

          return reporter.importValidation.validationListeners.fire(req, validationInfo).then(function () {
            logs.push(validationInfo.log)
          })
        })
      })
    })
  }).then(function () {
    return logs.join(os.EOL)
  })
}

function exportToStream (reporter, selection, req) {
  reporter.logger.debug('exporting objects, with selection ' + JSON.stringify(selection || []))
  return Promise.map(Object.keys(reporter.documentStore.collections), function (c) {
    return reporter.documentStore.collections[c].find({}, req).then(function (res) {
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
  var importFilteringListeners = reporter.createListenerCollection()
  var importValidationListeners = reporter.createListenerCollection()

  multer = Multer({ dest: reporter.options.tempDirectory })

  reporter.export = function (selection, req) {
    return exportToStream(reporter, selection, req)
  }

  reporter.import = function (zipFilePath, req) {
    return importZipFile(reporter, zipFilePath, req)
  }

  reporter.import.filteringListeners = importFilteringListeners

  reporter.import.registerProcessing = function (fn) {
    this._processings = this._processings || []
    this._processings.push(fn)
  }

  // default processing when importing an entity
  reporter.import.registerProcessing(function (originalProcess) {
    return function (req, col, entity) {
      return col.update({ _id: entity._id }, { $set: entity }, { upsert: true }, req).catch(function (e) {
        // this skips error with missing permissions
        reporter.logger.warn('Unable to upsert an entity during the import ' + e)
      }).then(function () {
        if (originalProcess) {
          return originalProcess(req, col, entity)
        }
      })
    }
  })

  reporter.importValidation = function (zipFilePath, req) {
    return importValidation(reporter, zipFilePath, req)
  }

  reporter.importValidation.validationListeners = importValidationListeners

  reporter.on('express-configure', function (app) {
    app.post('/api/export', function (req, res) {
      exportToStream(reporter, req.body.selection, req).then(function (stream) {
        stream.pipe(res)
      }).catch(res.error)
    })

    app.post('/api/import', function (req, res) {
      parseMultipart(req, res, function (err, zipPath) {
        if (err) {
          return res.error(err)
        }

        importZipFile(reporter, zipPath, req).then(function () {
          res.send({ status: '0', message: 'ok' })
        }).catch(res.error)
      })
    })

    app.post('/api/validate-import', function (req, res) {
      parseMultipart(req, res, function (err, zipPath) {
        if (err) {
          return res.error(err)
        }

        importValidation(reporter, zipPath, req).then(function (log) {
          res.send({ status: '0', log: log })
        }).catch(res.error)
      })
    })
  })
}
