const Promise = require('bluebird')
const os = require('os')
const Multer = require('multer')
const { parseMultipart, unzipEntities, zipEntities } = require('./helpers')
let multer

async function importZipFile (reporter, zipFilePath, req) {
  reporter.logger.debug('reading import zip file')

  const entries = await unzipEntities(zipFilePath)
  const sum = Object.keys(entries).reduce((o, v, i) => (o + entries[v].length), 0)

  reporter.logger.debug('import found ' + sum + ' objects')

  for (let c of Object.keys(entries)) {
    const collection = reporter.documentStore.collection(c)

    if (collection) {
      const validEntities = collection.convertBase64ToBufferInEntity(entries[c])

      for (let d of validEntities) {
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
}

async function importValidation (reporter, zipFilePath, req) {
  let logs = []
  const warnings = []
  const entries = await unzipEntities(zipFilePath)

  if (Object.keys(entries).length === 0) {
    logs.push('No entities found to import')
    return logs
  }

  for (const c of Object.keys(entries)) {
    const collection = reporter.documentStore.collection(c)

    if (!collection && entries[c].length > 0) {
      warnings.push(`Warning: zip contains entities (${entries[c].length}) from collection "${c}" which is not available in this installation, these entities won't be imported`)
    } else if (collection) {
      const validEntities = collection.convertBase64ToBufferInEntity(entries[c])

      for (const d of validEntities) {
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
  }

  logs = logs.concat(warnings)

  return logs.join(os.EOL)
}

async function exportToStream (reporter, selection, req) {
  reporter.logger.debug('exporting objects, with selection ' + JSON.stringify(selection || []))

  const entities = await Promise.reduce(Object.keys(reporter.documentStore.collections), async (acu, c) => {
    acu[c] = []

    let res = await reporter.documentStore.collections[c].find({}, req)

    if (selection) {
      res = res.filter(function (r) {
        return selection.indexOf(r._id.toString()) > -1
      })
    }

    const collection = reporter.documentStore.collection(c)

    if (!collection) {
      return acu
    }

    const serializedEntities = collection.convertBufferToBase64InEntity(res)

    acu[c] = serializedEntities

    return acu
  }, {})

  const sum = Object.keys(entities).reduce((o, v, i) => (o + entities[v].length), 0)
  reporter.logger.debug('export will zip ' + sum + ' objects')

  return zipEntities(entities)
}

module.exports = (reporter, definition) => {
  const importFilteringListeners = reporter.createListenerCollection()
  const importValidationListeners = reporter.createListenerCollection()

  multer = Multer({ dest: reporter.options.tempAutoCleanupDirectory })

  reporter.export = (selection, req) => exportToStream(reporter, selection, req)
  reporter.import = (zipFilePath, req) => importZipFile(reporter, zipFilePath, req)
  reporter.import.filteringListeners = importFilteringListeners

  reporter.import.registerProcessing = function (fn) {
    this._processings = this._processings || []
    this._processings.push(fn)
  }

  reporter.importValidation = (zipFilePath, req) => importValidation(reporter, zipFilePath, req)
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
      parseMultipart(multer)(req, res, (err, zipPath) => {
        if (err) {
          return res.error(err)
        }

        importZipFile(reporter, zipPath, req).then(() => res.send({ status: '0', message: 'ok' })).catch(res.error)
      })
    })

    app.post('/api/validate-import', (req, res) => {
      parseMultipart(multer)(req, res, (err, zipPath) => {
        if (err) {
          return res.error(err)
        }

        importValidation(reporter, zipPath, req).then((log) => res.send({ status: '0', log: log })).catch(res.error)
      })
    })
  })
}
