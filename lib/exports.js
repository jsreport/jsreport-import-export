const Promise = require('bluebird')
const os = require('os')
const omit = require('lodash.omit')
const Multer = require('multer')
const pkg = require('../package.json')
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

  const { entities, metadata } = await unzipEntities(zipFilePath)
  const importByEntitySet = metadata == null

  const sum = Object.keys(entities).reduce((o, v, i) => (o + entities[v].length), 0)

  reporter.logger.debug(`import found ${sum} objects`)

  const collectionsWithoutFolders = Object.keys(omit(reporter.documentStore.collections, ['folders']))

  async function processEntities (collectionName, entities) {
    let containerFolder

    if (importByEntitySet && entities.length > 0) {
      containerFolder = await reporter.documentStore.collections['folders'].findOne({ name: collectionName, folder: null }, req)

      if (!containerFolder) {
        containerFolder = await reporter.documentStore.collections['folders'].insert({ name: collectionName }, req)
      }
    }

    for (let d of entities) {
      const entityToProcess = importByEntitySet ? { ...d, folder: { shortid: containerFolder.shortid } } : d

      await reporter.import.filteringListeners.fire(req, entityToProcess, metadata)

      const mainProcessing = await Promise.reduce(reporter.import._processings, (prevImportProcess, importProcess) => {
        return Promise.resolve(importProcess(
          prevImportProcess,
          req,
          reporter.documentStore.collections[collectionName],
          entityToProcess,
          metadata
        ))
      }, null)

      await mainProcessing(req, reporter.documentStore.collections[collectionName], entityToProcess, metadata)
    }
  }

  if (reporter.documentStore.collections.folders != null) {
    // we process folders first to avoid gettings errors related to missing
    // folder when inserting an entity
    const collection = reporter.documentStore.collection('folders')
    const validFolders = collection.convertBase64ToBufferInEntity(entities.folders || [])

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

    if (collection && entities[c] != null) {
      const validEntities = collection.convertBase64ToBufferInEntity(entities[c])
      await processEntities(c, validEntities)
    }
  }
}

async function importValidation (reporter, zipFilePath, req) {
  let logs = []
  const warnings = []

  const { entities, metadata } = await unzipEntities(zipFilePath)
  const importByEntitySet = metadata == null

  if (Object.keys(entities).length === 0) {
    logs.push('No entities found to import')
    return logs
  }

  if (importByEntitySet) {
    warnings.push([
      'Warning: zip contains entities from old installation in which everything was grouped by entity sets.',
      os.EOL,
      'entities in this zip will be imported into folders that emulates the previous grouping by entity sets',
      os.EOL
    ].join(''))
  }

  const validations = []

  for (const c of Object.keys(entities)) {
    const collection = reporter.documentStore.collection(c)

    if (!collection && entities[c].length > 0) {
      warnings.push(`Warning: zip contains entities (${entities[c].length}) from collection "${c}" which is not available in this installation, these entities won't be imported`)
    } else if (collection) {
      const validEntities = collection.convertBase64ToBufferInEntity(entities[c])

      for (const d of validEntities) {
        const res = await reporter.documentStore.collections[c].find({ _id: d._id }, req)

        var validationInfo = {
          importType: res.length === 0 ? 'insert' : 'update',
          collectionName: c,
          entity: d
        }

        let entityNameDisplay

        if (d.name != null) {
          if (importByEntitySet) {
            entityNameDisplay = `/${c}/${d.name}`
          } else {
            entityNameDisplay = await reporter.folders.resolveEntityPath(d, c, req, async (folderShortId) => {
              let folderFound

              if (entities.folders) {
                folderFound = entities.folders.find((e) => e.shortid === folderShortId)
              }

              if (!folderFound) {
                folderFound = await reporter.documentStore.collection('folders').findOne({
                  shortid: folderShortId
                }, req)
              }

              return folderFound
            })
          }
        } else {
          entityNameDisplay = d._id
        }

        validationInfo.log = (
          `Entity ${validationInfo.importType}: (${validationInfo.collectionName}) ${entityNameDisplay}`
        )

        await reporter.importValidation.validationListeners.fire(req, validationInfo)

        validations.push({
          nameDisplay: entityNameDisplay,
          log: validationInfo.log
        })
      }
    }
  }

  logs = logs.concat(warnings)

  logs = logs.concat(validations.sort((a, b) => {
    const nameA = a.nameDisplay.toUpperCase()
    const nameB = b.nameDisplay.toUpperCase()

    if (nameA < nameB) {
      return -1
    }

    if (nameA > nameB) {
      return 1
    }

    return 0
  }).map((v) => v.log))

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

  reporter.logger.debug(`export will zip ${sum} objects`)

  return zipEntities(entities, {
    reporterVersion: reporter.version,
    importExportVersion: pkg.version,
    storeProvider: reporter.options.store.provider,
    createdAt: new Date().getTime()
  })
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
