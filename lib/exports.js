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

async function getEntityNameDisplay (reporter, { entity, allLocalEntities, collectionName, targetFolderPath, importByEntitySet, req }) {
  let entityNameDisplay

  const publicKey = reporter.documentStore.model.entitySets[collectionName].entityTypePublicKey

  if (publicKey && entity[publicKey] != null) {
    if (importByEntitySet) {
      if (reporter.documentStore.model.entitySets[collectionName].splitIntoDirectories === true) {
        entityNameDisplay = `/${collectionName}/${entity[publicKey]}`
      } else {
        entityNameDisplay = `/${entity[publicKey]}`
      }
    } else {
      entityNameDisplay = await reporter.folders.resolveEntityPath(entity, collectionName, req, async (folderShortId) => {
        let folderFound

        if (allLocalEntities.folders) {
          folderFound = allLocalEntities.folders.find((e) => e.shortid === folderShortId)
        }

        if (!folderFound) {
          folderFound = await reporter.documentStore.collection('folders').findOne({
            shortid: folderShortId
          }, req)
        }

        return folderFound
      })
    }

    if (targetFolderPath != null) {
      entityNameDisplay = `${targetFolderPath}${entityNameDisplay}`
    }
  } else {
    entityNameDisplay = entity._id
  }

  return { entityNameDisplay, publicKey }
}

function groupFoldersByLevel (folders) {
  // group folders by level
  const groups = {}

  folders.forEach((folder) => {
    let level = 0
    let currentFolder = folder

    while (currentFolder != null) {
      if (currentFolder.folder != null) {
        const foundFolder = folders.find((f) => f.shortid === currentFolder.folder.shortid)

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

  return groups
}

async function importZipFile (reporter, zipFilePath, opts, req) {
  reporter.logger.debug('reading import zip file')

  const { entities, metadata } = await unzipEntities(zipFilePath)
  const importByEntitySet = metadata == null
  let targetFolder
  const logs = []

  const sum = Object.keys(entities).reduce((o, v, i) => (o + entities[v].length), 0)

  reporter.logger.debug(`import found ${sum} objects`)

  if (sum === 0) {
    logs.push('Info: No entities found to import')
    return logs.join(os.EOL)
  }

  if (opts.fullImport === true) {
    logs.push([
      `Info: Processing as full import mode`,
      os.EOL
    ].join(''))
  } else if (opts.targetFolder != null) {
    let targetFolderPath
    targetFolder = await reporter.documentStore.collection('folders').findOne({ shortid: opts.targetFolder }, req)

    if (!targetFolder) {
      throw reporter.createError(`Import validation error: target folder (shortid: ${opts.targetFolder}) does not exists, make sure to pass shortid of folder that exists`, {
        statusCode: 400,
        weak: true
      })
    }

    targetFolderPath = await reporter.folders.resolveEntityPath(targetFolder, 'folders', req)

    logs.push([
      `Info: entities in zip will be imported inside target folder ${targetFolderPath}`,
      os.EOL
    ].join(''))
  }

  const collectionsWithoutFolders = Object.keys(omit(entities, ['folders']))

  async function processEntities (collectionName, entities, { rootFolder, remove = false } = {}) {
    const publicKey = reporter.documentStore.model.entitySets[collectionName].entityTypePublicKey
    let containerFolderRef
    let containerFolder

    if (importByEntitySet && entities.length > 0) {
      if (reporter.documentStore.model.entitySets[collectionName].splitIntoDirectories === true) {
        if (!rootFolder) {
          containerFolder = await reporter.documentStore.collections['folders'].findOne({ name: collectionName, folder: null }, req)
        }

        if (!containerFolder) {
          const newFolder = {
            name: collectionName
          }

          if (rootFolder) {
            newFolder.folder = {
              shortid: rootFolder.shortid
            }
          }

          containerFolder = await reporter.documentStore.collections['folders'].insert(newFolder, req)
        }
      }

      if (containerFolder) {
        containerFolderRef = { shortid: containerFolder.shortid }
      } else {
        containerFolderRef = null
      }
    }

    for (let d of entities) {
      const entityToProcess = importByEntitySet ? { ...d, folder: containerFolderRef } : d

      if (entityToProcess.folder == null && rootFolder) {
        entityToProcess.folder = {
          shortid: rootFolder.shortid
        }
      }

      await reporter.import.filteringListeners.fire(req, entityToProcess, metadata, logs)

      if (remove !== true) {
        // we validate that folder for the entity to be imported exists
        if (entityToProcess.folder != null) {
          const parentFolder = await reporter.documentStore.collection('folders').findOne({
            shortid: entityToProcess.folder.shortid
          }, req)

          if (!parentFolder) {
            let entityDisplay
            let entityDisplayProperty

            if (publicKey) {
              entityDisplayProperty = publicKey
              entityDisplay = entityToProcess[publicKey]
            } else {
              entityDisplayProperty = '_id'
              entityDisplay = entityToProcess._id
            }

            const log = `Parent folder for entity (${collectionName}) ${entityDisplayProperty}: ${entityDisplay} does not exists, skipping import of it`

            logs.push(log)
            reporter.logger.warn(log)

            continue
          }
        }

        if (rootFolder) {
          const entityExists = await reporter.documentStore.collection(collectionName).findOne({
            _id: d._id
          }, req)

          if (entityExists) {
            const log = `Entity: (${collectionName}) (${publicKey && d[publicKey] != null ? `${publicKey}: ${d[publicKey]}, ` : ''}_id: ${
              d._id
            }) can not be imported because there is another entity with the same _id, entity import was skipped`

            logs.push(log)
            reporter.logger.warn(log)

            continue
          }
        }
      }

      const processingInfo = {
        remove,
        req,
        collectionName,
        metadata,
        logs
      }

      const mainProcessing = await Promise.reduce(reporter.import._processings, (prevImportProcess, importProcess) => {
        return Promise.resolve(importProcess(
          prevImportProcess,
          processingInfo
        ))
      }, null)

      await mainProcessing(req, reporter.documentStore.collections[collectionName], entityToProcess)
    }
  }

  // when doing full import we first delete entities at the root level and let core do the cascade updates
  if (opts.fullImport === true) {
    // it is important that we first try to delete the folders for correct permissions propagation
    const foldersNotInZip = await reporter.documentStore.collection('folders').find({
      folder: null
    }, req)

    await processEntities('folders', foldersNotInZip, { remove: true })

    for (let c of collectionsWithoutFolders) {
      const collection = reporter.documentStore.collection(c)

      if (!collection) {
        continue
      }

      const rootEntities = await collection.find({
        folder: null
      }, req)

      await processEntities(c, rootEntities, { remove: true })
    }
  }

  if (reporter.documentStore.collections.folders != null) {
    // we process folders first to avoid gettings errors related to missing
    // folder when inserting an entity
    const collection = reporter.documentStore.collection('folders')
    const validFolders = collection.convertBase64ToBufferInEntity(entities.folders || [])

    const groups = groupFoldersByLevel(validFolders)

    const foldersToProcess = []
    let currentLevel = 0

    while (groups[currentLevel] != null && groups[currentLevel].length > 0) {
      foldersToProcess.push(...groups[currentLevel])
      currentLevel++
    }

    await processEntities('folders', foldersToProcess, { rootFolder: targetFolder })
  }

  for (let c of collectionsWithoutFolders) {
    const collection = reporter.documentStore.collection(c)

    if (!collection) {
      if (entities[c] != null && entities[c].length > 0) {
        reporter.logger.warn(`zip contains entities (${entities[c].length}) from collection "${c}" which is not available in this installation, these entities were not imported`)
      }
      continue
    }

    if (entities[c] != null) {
      const validEntities = collection.convertBase64ToBufferInEntity(entities[c])
      await processEntities(c, validEntities, { rootFolder: targetFolder })
    }
  }

  if (logs.length === 0) {
    return ''
  }

  logs.push('Info: import finished')

  return logs.join(os.EOL)
}

async function importValidation (reporter, zipFilePath, opts, req) {
  const { entities, metadata } = await unzipEntities(zipFilePath)
  const importByEntitySet = metadata == null
  let targetFolderPath
  let logs = []

  const sum = Object.keys(entities).reduce((o, v, i) => (o + entities[v].length), 0)

  if (sum === 0) {
    logs.push('Info: No entities found to import')
    return logs.join(os.EOL)
  }

  if (opts.fullImport === true) {
    logs.push([
      `Info: Processing as full import mode`,
      os.EOL
    ].join(''))
  } else if (opts.targetFolder != null) {
    const targetFolder = await reporter.documentStore.collection('folders').findOne({ shortid: opts.targetFolder }, req)

    if (!targetFolder) {
      throw reporter.createError(`Import validation error: target folder (shortid: ${opts.targetFolder}) does not exists, make sure to pass shortid of folder that exists`, {
        statusCode: 400,
        weak: true
      })
    }

    targetFolderPath = await reporter.folders.resolveEntityPath(targetFolder, 'folders', req)

    logs.push([
      `Info: entities in zip will be imported inside target folder ${targetFolderPath}`,
      os.EOL
    ].join(''))
  }

  if (importByEntitySet) {
    logs.push([
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
      logs.push(`Warning: zip contains entities (${entities[c].length}) from collection "${c}" which is not available in this installation, these entities won't be imported`)
    } else if (collection) {
      const validEntities = collection.convertBase64ToBufferInEntity(entities[c])
      let entitiesNotInZip = []

      if (opts.fullImport === true) {
        entitiesNotInZip = await reporter.documentStore.collections[c].find({}, req)

        for (const d of validEntities) {
          const foundIndex = entitiesNotInZip.findIndex((e) => e._id === d._id)

          if (foundIndex !== -1) {
            entitiesNotInZip.splice(foundIndex, 1)
          }
        }

        for (const d of entitiesNotInZip) {
          const validationInfo = {
            importType: 'delete',
            collectionName: c,
            entity: d
          }

          const { entityNameDisplay } = await getEntityNameDisplay(reporter, {
            allLocalEntities: {},
            entity: d,
            collectionName: c,
            targetFolderPath,
            importByEntitySet,
            req
          })

          validationInfo.log = (
            `Entity ${validationInfo.importType}: (${validationInfo.collectionName}) ${entityNameDisplay}`
          )

          validationInfo.nameDisplay = entityNameDisplay

          await reporter.importValidation.validationListeners.fire(req, validationInfo)

          validations.push({
            nameDisplay: entityNameDisplay,
            log: validationInfo.log
          })
        }
      }

      for (const d of validEntities) {
        const res = await reporter.documentStore.collections[c].find({ _id: d._id }, req)

        const validationInfo = {
          importType: res.length === 0 ? 'insert' : 'update',
          collectionName: c,
          entity: d
        }

        const { entityNameDisplay, publicKey } = await getEntityNameDisplay(reporter, {
          allLocalEntities: entities,
          entity: d,
          collectionName: c,
          targetFolderPath,
          importByEntitySet,
          req
        })

        validationInfo.log = (
          `Entity ${validationInfo.importType}: (${validationInfo.collectionName}) ${entityNameDisplay}`
        )

        validationInfo.nameDisplay = entityNameDisplay

        await reporter.importValidation.validationListeners.fire(req, validationInfo)

        if (targetFolderPath != null && res.length > 0) {
          validations.push({
            nameDisplay: entityNameDisplay,
            log: `Entity: (${validationInfo.collectionName}) (${publicKey && d[publicKey] != null ? `${publicKey}: ${d[publicKey]}, ` : ''}_id: ${
              d._id
            }) can not be imported because there is another entity with the same _id, entity won't be imported`
          })
        } else {
          validations.push({
            nameDisplay: entityNameDisplay,
            log: validationInfo.log
          })
        }
      }
    }
  }

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

  if (logs.length === 0) {
    return ''
  }

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
        return foldersRefIds.includes(r._id.toString()) || selection.includes(r._id.toString())
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

    return importZipFile(reporter, zipFilePath, opts, req)
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

    return importValidation(reporter, zipFilePath, opts, req)
  }

  reporter.importValidation.validationListeners = importValidationListeners

  // default processing when importing an entity
  reporter.import.registerProcessing((originalProcess, info) => {
    return async (req, col, entity) => {
      let action

      try {
        if (info.remove === true) {
          action = 'remove'

          await col.remove({ _id: entity._id }, req)
        } else {
          action = 'upsert'

          const updateCount = await col.update({ _id: entity._id }, { $set: entity }, req)

          if (updateCount === 0) {
            await col.insert(entity, req)
          }
        }

        if (originalProcess) {
          return originalProcess(req, col, entity)
        }
      } catch (e) {
        const log = `Unable to ${action} an entity during the import: ${e}`

        // this skips error with missing permissions or any other error during the query
        reporter.logger.warn(log)
        info.logs.push(log)
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

        const opts = {}

        if (req.query.targetFolder != null) {
          opts.targetFolder = req.query.targetFolder
        }

        if (req.query.fullImport != null) {
          opts.fullImport = req.query.fullImport === true || req.query.fullImport === 'true'
        }

        importZipFile(reporter, zipPath, opts, req).then((log) => res.send({ status: '0', message: 'ok', log })).catch(res.error)
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

        importValidation(reporter, zipPath, opts, req).then((log) => res.send({ status: '0', log })).catch(res.error)
      })
    })
  })
}
