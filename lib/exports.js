const Promise = require('bluebird')
const os = require('os')
const omit = require('lodash.omit')
const Multer = require('multer')
const { parseMultipart, unzipEntities, zipEntities } = require('./helpers')
let multer

async function getParentFoldersInFolder (reporter, fShortid, req) {
  const folders = []

  let currentFolder = await reporter.documentStore.collection('folders').findOne({
    shortid: fShortid
  }, req)

  if (currentFolder != null) {
    folders.push(currentFolder)
  }

  while (currentFolder != null) {
    if (currentFolder.folder != null) {
      currentFolder = await reporter.documentStore.collection('folders').findOne({
        shortid: currentFolder.folder.shortid
      }, req)

      if (currentFolder != null) {
        folders.push(currentFolder)
      }
    } else {
      currentFolder = null
    }
  }

  return folders
}

async function importZipFile (reporter, zipFilePath, req) {
  reporter.logger.debug('reading import zip file')

  const entries = await unzipEntities(zipFilePath)
  const sum = Object.keys(entries).reduce((o, v, i) => (o + entries[v].length), 0)

  reporter.logger.debug('import found ' + sum + ' objects')

  const collectionsWithoutFolders = Object.keys(omit(reporter.documentStore.collections, ['folders']))

  async function processEntities (collectionName, entities) {
    for (let d of entities) {
      await reporter.import.filteringListeners.fire(req, d)

      const mainProcessing = await Promise.reduce(reporter.import._processings, (prevImportProcess, importProcess) => {
        return Promise.resolve(importProcess(
          prevImportProcess,
          req,
          reporter.documentStore.collections[collectionName],
          d
        ))
      }, null)

      await mainProcessing(req, reporter.documentStore.collections[collectionName], d)
    }
  }

  if (reporter.documentStore.collections.folders != null) {
    // we process folders first to avoid gettings errors related to missing
    // folder when inserting an entity
    const collection = reporter.documentStore.collection('folders')
    const validFolders = collection.convertBase64ToBufferInEntity(entries.folders || [])

    // group folders by level
    const groups = {}

    validFolders.forEach((folder) => {
      let level = 0
      let currentFolder = folder

      while (currentFolder != null) {
        if (currentFolder.folder != null) {
          const foundFolder = validFolders.find((f) => f.shortid === currentFolder.folder.shortid)

          if (foundFolder != null) {
            level++
            currentFolder = foundFolder
          } else {
            level = -1
            currentFolder = null
            break
          }
        } else {
          currentFolder = null
        }
      }

      if (level !== -1) {
        groups[level] = groups[level] || []
        groups[level].push(folder)
      }
    })

    const foldersToProcess = []
    let currentLevel = 0

    while (groups[currentLevel] != null && groups[currentLevel].length > 0) {
      foldersToProcess.push(...groups[currentLevel])
      currentLevel++
    }

    await processEntities('folders', foldersToProcess)
  }

  for (let c of collectionsWithoutFolders) {
    const collection = reporter.documentStore.collection(c)

    if (collection && entries[c] != null) {
      const validEntities = collection.convertBase64ToBufferInEntity(entries[c])
      await processEntities(c, validEntities)
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

  const collectionsWithoutFolders = Object.keys(omit(reporter.documentStore.collections, ['folders']))
  const foldersRefInExport = []

  const entities = await Promise.reduce(collectionsWithoutFolders, async (acu, c) => {
    acu[c] = []

    let res = await reporter.documentStore.collections[c].find({}, req)

    if (selection) {
      res = res.filter((r) => {
        return selection.indexOf(r._id.toString()) > -1
      })
    }

    const collection = reporter.documentStore.collection(c)

    if (!collection) {
      return acu
    }

    if (res.length > 0) {
      res.forEach((r) => {
        if (r.folder != null && !foldersRefInExport.includes(r.folder.shortid)) {
          foldersRefInExport.push(r.folder.shortid)
        }
      })
    }

    const serializedEntities = collection.convertBufferToBase64InEntity(res)

    acu[c] = serializedEntities

    return acu
  }, {})

  if (reporter.documentStore.collections.folders != null) {
    const foldersRefIds = []

    if (foldersRefInExport.length > 0) {
      const results = await Promise.all(foldersRefInExport.map(async (fShortid) => {
        const pFolders = await getParentFoldersInFolder(reporter, fShortid, req)
        return pFolders.map((f) => f._id.toString())
      }))

      results.forEach((folders) => {
        folders.forEach((fId) => {
          if (!foldersRefIds.includes(fId)) {
            foldersRefIds.push(fId)
          }
        })
      })
    }

    let folders = await reporter.documentStore.collections.folders.find({}, req)

    if (selection) {
      folders = folders.filter((r) => {
        return foldersRefIds.includes(r._id.toString()) || selection.includes(r._id.toString()) > -1
      })
    }

    const collection = reporter.documentStore.collection('folders')
    const serializedEntities = collection.convertBufferToBase64InEntity(folders)

    entities.folders = serializedEntities
  }

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
