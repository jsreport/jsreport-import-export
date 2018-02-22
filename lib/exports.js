const Promise = require('bluebird')
const Multer = require('multer')
const os = require('os')
const archiver = require('archiver')
const fs = require('fs')
const toArray = require('stream-to-array')
const unzip = require('unzip2')
const helpers = require('./helpers')
let multer

function parseMultipart (req, res, cb) {
  multer.array('import.zip')(req, res, (err) => {
    if (err) {
      return cb(new Error('Unable to read import.zip key from multipart stream'))
    }

    function findFirstFile () {
      for (let f in req.files) {
        if (req.files.hasOwnProperty(f)) {
          return req.files[f]
        }
      }
    }

    const file = findFirstFile()

    if (!file) {
      return cb(new Error('Unable to read import.zip key from multipart stream'))
    }

    cb(null, fs.createReadStream(file.path))
  })
}

function streamToEntities (stream) {
  return new Promise((resolve, reject) => {
    const entities = {}
    // unzip stream for some reason emits close event before the entries streams are fully drained
    // as workaround we wait for all the entries manually with counter
    let entryCounter = 0
    let closed = false
    stream.pipe(unzip.Parse())
      .on('error', reject)
      .on('entry', (e) => {
        if (e.type === 'File') {
          entryCounter++
          toArray(e, (err, arr) => {
            if (err) {
              return reject(err)
            }

            try {
              var es = e.path.split('/')[0]
              entities[es] = entities[es] || []
              entities[es].push(JSON.parse(Buffer.concat(arr).toString()))
              if (--entryCounter === 0 && closed) {
                resolve(entities)
              }
            } catch (e) {
              return reject(e)
            }
          })
        } else {
          e.autodrain()
        }
      }).on('close', () => {
        closed = true
        if (entryCounter === 0) {
          resolve(entities)
        }
      })
  })
}

async function importStream (reporter, stream, req) {
  reporter.logger.debug('reading import stream')
  const entries = await streamToEntities(stream)
  const sum = Object.keys(entries).reduce((o, v, i) => (o + entries[v].length), 0)
  reporter.logger.debug('import found ' + sum + ' objects')

  for (let c of Object.keys(entries)) {
    helpers.base64ToBuffer(reporter.documentStore.model, c, entries[c])

    for (let d of entries[c]) {
      await reporter.import.filteringListeners.fire(req, d)
      const mainProcessing = await Promise.reduce(reporter.import._processings, (prevImportProcess, importProcess) => {
        return Promise.resolve(importProcess(
          prevImportProcess,
          req,
          reporter.documentStore.collections[c],
          d
        ))
      }, null)
      await mainProcessing(req, reporter.documentStore.collections[c], d)
    }
  }
}

async function importValidation (reporter, stream, req) {
  const logs = []

  const entries = await streamToEntities(stream)
  for (const c of Object.keys(entries)) {
    helpers.base64ToBuffer(reporter.documentStore.model, c, entries[c])

    for (const d of entries[c]) {
      const res = await reporter.documentStore.collections[c].find({ _id: d._id })
      var validationInfo = {
        importType: res.length === 0 ? 'insert' : 'update',
        collectionName: c,
        entity: d
      }

      validationInfo.log = (
        'Entity ' + validationInfo.importType +
            ': (' + validationInfo.collectionName + ') ' + (d.name || d._id)
      )

      await reporter.importValidation.validationListeners.fire(req, validationInfo)
      logs.push(validationInfo.log)
    }
  }
  return logs.join(os.EOL)
}

async function exportToStream (reporter, selection, req) {
  reporter.logger.debug('exporting objects, with selection ' + JSON.stringify(selection || []))
  const results = await Promise.map(Object.keys(reporter.documentStore.collections), async (c) => {
    let res = await reporter.documentStore.collections[c].find({}, req)
    if (selection) {
      res = res.filter(function (r) {
        return selection.indexOf(r._id.toString()) > -1
      })
    }
    helpers.bufferToBase64(reporter.documentStore.model, c, res)
    return res
  })

  const entities = Object.keys(reporter.documentStore.collections).reduce((o, v, i) => {
    o[v] = results[i]
    return o
  }, {})

  const sum = Object.keys(entities).reduce((o, v, i) => (o + entities[v].length), 0)
  reporter.logger.debug('export will zip ' + sum + ' objects')

  const archive = archiver('zip')
  Object.keys(entities).forEach((c) => {
    entities[c].forEach((e) => {
      archive.append(JSON.stringify(e), { name: c + '/' + (e.name ? (e.name + '-' + e._id) : e._id) + '.json' })
    })
  })
  archive.finalize()
  return archive
}

module.exports = (reporter, definition) => {
  const importFilteringListeners = reporter.createListenerCollection()
  const importValidationListeners = reporter.createListenerCollection()

  multer = Multer({ dest: reporter.options.tempDirectory })

  reporter.export = (selection, req) => exportToStream(reporter, selection, req)
  reporter.import = (stream, req) => importStream(reporter, stream, req)
  reporter.import.filteringListeners = importFilteringListeners

  reporter.import.registerProcessing = function (fn) {
    this._processings = this._processings || []
    this._processings.push(fn)
  }

  reporter.importValidation = (stream, req) => importValidation(reporter, stream, req)
  reporter.importValidation.validationListeners = importValidationListeners

  // default processing when importing an entity
  reporter.import.registerProcessing((originalProcess) => {
    return async (req, col, entity) => {
      try {
        await col.update({ _id: entity._id }, { $set: entity }, { upsert: true }, req)
        if (originalProcess) {
          return originalProcess(req, col, entity)
        }
      } catch (e) {
        // this skips error with missing permissions
        reporter.logger.warn('Unable to upsert an entity during the import ' + e)
      }
    }
  })

  reporter.on('express-configure', (app) => {
    app.post('/api/export', (req, res) => {
      exportToStream(reporter, req.body.selection, req).then((stream) => {
        stream.pipe(res)
      }).catch(res.error)
    })

    app.post('/api/import', (req, res) => {
      parseMultipart(req, res, (err, stream) => {
        if (err) {
          return res.error(err)
        }

        importStream(reporter, stream, req).then(() => res.send({ status: '0', message: 'ok' })).catch(res.error)
      })
    })

    app.post('/api/validate-import', (req, res) => {
      parseMultipart(req, res, (err, stream) => {
        if (err) {
          return res.error(err)
        }

        importValidation(reporter, stream, req).then((log) => res.send({ status: '0', log: log })).catch(res.error)
      })
    })
  })
}
