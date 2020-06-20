const Multer = require('multer')
const importZipFile = require('./import')
const exportToStream = require('./export')
const { parseMultipart } = require('./helpers')
let multer

module.exports = (reporter, definition) => {
  const importFilteringListeners = reporter.createListenerCollection()
  const importValidationListeners = reporter.createListenerCollection()

  multer = Multer({ dest: reporter.options.tempAutoCleanupDirectory })

  reporter.export = async (selection, req) => {
    const result = await exportToStream(reporter, selection, req)
    return result
  }

  reporter.import = (...args) => {
    let zipFilePath = args[0]
    let req
    let opts

    // back-compatibility
    if (args[1] && args[1].__isJsreportRequest__) {
      req = args[1]
    } else {
      opts = args[1]
      req = args[2]
    }

    if (opts == null) {
      opts = {}
    }

    return importZipFile(reporter, zipFilePath, {
      ...opts,
      validation: false
    }, req)
  }

  reporter.import.filteringListeners = importFilteringListeners

  reporter.import.registerProcessing = function (fn) {
    this._processings = this._processings || []
    this._processings.push(fn)
  }

  reporter.importValidation = (...args) => {
    let zipFilePath = args[0]
    let req
    let opts

    // back-compatibility
    if (args.length < 3) {
      req = args[1]
    } else {
      opts = args[1]
      req = args[2]
    }

    if (opts == null) {
      opts = {}
    }

    return importZipFile(reporter, zipFilePath, {
      ...opts,
      validation: true
    }, req)
  }

  reporter.importValidation.validationListeners = importValidationListeners

  // default processing when importing an entity
  reporter.import.registerProcessing((originalProcess, info) => {
    return async (req, col, entity) => {
      const action = info.action

      try {
        if (action === 'delete') {
          if (info.entityId == null) {
            throw new Error('Original entity id not available')
          }

          await col.remove({ _id: info.entityId }, req)
        } else if (action === 'update') {
          if (info.entityId == null) {
            throw new Error('Original entity id not available')
          }

          // do copy of entity because we don't want the original obj to be mutated
          await col.update({ _id: info.entityId }, { $set: { ...entity } }, req)

          const newEntity = await col.findOne({ _id: info.entityId }, req)

          return newEntity
        } else if (action === 'insert') {
          // do copy of entity because we don't want the original obj to be mutated
          const newEntity = await col.insert({ ...entity }, req)

          return newEntity
        } else {
          throw new Error(`Action "${action}" not implemented`)
        }
      } catch (e) {
        const log = `Unable to ${action} an entity (${info.collectionName}) "${info.entityNameDisplay}" during the import: ${e}`

        // this skips error with missing permissions or any other error during the query
        reporter.logger.warn(log)
        info.logs.push(log)

        e.message = log

        throw e
      }
    }
  })

  reporter.on('express-configure', (app) => {
    app.post('/api/export', (req, res) => {
      exportToStream(reporter, req.body.selection, req).then((result) => {
        const stream = result.stream
        res.set('Export-Entities-Count', JSON.stringify(result.entitiesCount))
        stream.pipe(res)
      }).catch(res.error)
    })

    app.post('/api/import', (req, res) => {
      parseMultipart(multer)(req, res, (err, zipPath) => {
        if (err) {
          return res.error(err)
        }

        const opts = {}

        if (req.query.targetFolder != null) {
          opts.targetFolder = req.query.targetFolder
        }

        if (req.query.fullImport != null) {
          opts.fullImport = req.query.fullImport === true || req.query.fullImport === 'true'
        }

        if (req.query.continueOnFail != null) {
          opts.continueOnFail = req.query.continueOnFail === true || req.query.continueOnFail === 'true'
        }

        importZipFile(reporter, zipPath, opts, req).then((result) => {
          res.set('Import-Entities-Count', JSON.stringify(result.entitiesCount))
          res.send({ status: '0', message: 'ok', log: result.log })
        }).catch(res.error)
      })
    })

    app.post('/api/validate-import', (req, res) => {
      parseMultipart(multer)(req, res, (err, zipPath) => {
        if (err) {
          return res.error(err)
        }

        const opts = {}

        if (req.query.targetFolder != null) {
          opts.targetFolder = req.query.targetFolder
        }

        if (req.query.fullImport != null) {
          opts.fullImport = req.query.fullImport === true || req.query.fullImport === 'true'
        }

        importZipFile(reporter, zipPath, {
          ...opts,
          validation: true
        }, req).then((result) => {
          res.set('Import-Entities-Count', JSON.stringify(result.entitiesCount))
          res.send({ status: '0', log: result.log })
        }).catch(res.error)
      })
    })
  })

  reporter.initializeListeners.add(definition.name, () => {
    if (reporter.express) {
      const exportableEntitySets = Object.keys(reporter.documentStore.model.entitySets).reduce((acu, entitySetName) => {
        const entitySet = reporter.documentStore.model.entitySets[entitySetName]

        if (entitySet.exportable == null || entitySet.exportable === true) {
          acu.push(entitySetName)
        }

        return acu
      }, [])

      reporter.express.exposeOptionsToApi(definition.name, {
        exportableEntitySets: exportableEntitySets
      })
    }
  })
}
