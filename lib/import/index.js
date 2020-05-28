const os = require('os')
const processEntities = require('./processEntities')
const { unzipEntities, groupFoldersByLevel, getEntityNameDisplay } = require('../helpers')

async function importZipFile (reporter, zipFilePath, opts, req) {
  if (opts.validation !== true) {
    reporter.logger.debug('reading import zip file')
  }

  const { entities: entitiesInZip, metadata } = await unzipEntities(zipFilePath)
  let targetFolder
  let targetFolderPath
  const logs = []
  let entitiesCount = {}

  const sum = Object.keys(entitiesInZip).reduce((o, v, i) => {
    entitiesCount[v] = entitiesInZip[v].length
    return o + entitiesInZip[v].length
  }, 0)

  if (opts.validation !== true) {
    reporter.logger.debug(`import found ${sum} objects`)
  }

  if (sum === 0) {
    logs.push('Info: No entities found to import')

    return {
      entitiesCount,
      log: logs.join(os.EOL)
    }
  }

  if (opts.fullImport === true) {
    logs.push([
      `Info: Processing as full import mode`,
      os.EOL
    ].join(''))
  } else if (opts.targetFolder != null) {
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

  if (opts.validation === true) {
    await processImportValidation(
      reporter,
      req,
      entitiesInZip,
      metadata,
      targetFolderPath,
      logs,
      opts
    )
  } else {
    await processImport(
      reporter,
      req,
      entitiesInZip,
      metadata,
      targetFolder,
      targetFolderPath,
      logs,
      opts
    )
  }

  if (opts.validation !== true) {
    reporter.logger.debug(`import finished`)
  }

  if (logs.length === 0) {
    return {
      entitiesCount,
      log: ''
    }
  }

  if (opts.validation !== true) {
    logs.push('Info: import finished')
  }

  return {
    entitiesCount,
    log: logs.join(os.EOL)
  }
}

async function processImport (
  reporter,
  req,
  entitiesInZip,
  metadata,
  targetFolder,
  targetFolderPath,
  logs,
  opts
) {
  await reporter.documentStore.beginTransaction(req)

  try {
    const exportableCollectionsWithoutFolders = Object.keys(reporter.documentStore.collections).filter((collectionName) => {
      return (
        (
          // null check for backcompatible support
          reporter.documentStore.model.entitySets[collectionName].exportable == null ||
          reporter.documentStore.model.entitySets[collectionName].exportable === true
        ) && collectionName !== 'folders'
      )
    })

    // when doing full import we first delete entities at the root level and let core do the cascade updates
    if (opts.fullImport === true) {
      // it is important that we first try to delete the folders for correct permissions propagation
      const foldersNotInZip = await reporter.documentStore.collection('folders').find({
        folder: null
      }, req)

      await processEntities(reporter, req, {
        collectionName: 'folders',
        entities: foldersNotInZip,
        allEntities: entitiesInZip,
        metadata,
        logs,
        continueOnFail: opts.continueOnFail,
        remove: true
      })

      for (let c of exportableCollectionsWithoutFolders) {
        const collection = reporter.documentStore.collection(c)

        if (!collection) {
          continue
        }

        const rootEntities = await collection.find({
          folder: null
        }, req)

        await processEntities(reporter, req, {
          collectionName: c,
          entities: rootEntities,
          allEntities: entitiesInZip,
          metadata,
          logs,
          continueOnFail: opts.continueOnFail,
          remove: true
        })
      }
    }

    if (reporter.documentStore.collections.folders != null) {
      // we process folders first to avoid gettings errors related to missing
      // folder when inserting an entity
      const collection = reporter.documentStore.collection('folders')
      const validFolders = await collection.deserializeProperties(entitiesInZip.folders || [])

      const groups = groupFoldersByLevel(validFolders)

      const foldersToProcess = []
      let currentLevel = 0

      while (groups[currentLevel] != null && groups[currentLevel].length > 0) {
        foldersToProcess.push(...groups[currentLevel])
        currentLevel++
      }

      await processEntities(reporter, req, {
        collectionName: 'folders',
        entities: foldersToProcess,
        allEntities: entitiesInZip,
        metadata,
        logs,
        rootFolder: targetFolder,
        rootFolderPath: targetFolderPath,
        continueOnFail: opts.continueOnFail
      })
    }

    for (let c of exportableCollectionsWithoutFolders) {
      const collection = reporter.documentStore.collection(c)

      if (!collection) {
        if (entitiesInZip[c] != null && entitiesInZip[c].length > 0) {
          reporter.logger.warn(`zip contains entities (${entitiesInZip[c].length}) from collection "${c}" which is not available in this installation, these entities were not imported`)
        }
        continue
      }

      if (entitiesInZip[c] != null) {
        const validEntities = await collection.deserializeProperties(entitiesInZip[c])
        await processEntities(reporter, req, {
          collectionName: c,
          entities: validEntities,
          allEntities: entitiesInZip,
          metadata,
          logs,
          rootFolder: targetFolder,
          rootFolderPath: targetFolderPath,
          continueOnFail: opts.continueOnFail
        })
      }
    }

    await reporter.documentStore.commitTransaction(req)
  } catch (e) {
    await reporter.documentStore.rollbackTransaction(req)

    e.message = `Import failed: ${e.message}`

    throw e
  }
}

async function processImportValidation (
  reporter,
  req,
  entitiesInZip,
  metadata,
  targetFolderPath,
  logs,
  opts
) {
  const exportableCollections = Object.keys(reporter.documentStore.collections).filter((collectionName) => {
    // null check for backcompatible support
    return (
      reporter.documentStore.model.entitySets[collectionName].exportable == null ||
      reporter.documentStore.model.entitySets[collectionName].exportable === true
    )
  })

  const importByEntitySet = metadata == null

  if (importByEntitySet) {
    logs.push([
      'Warning: zip contains entities from old installation in which everything was grouped by entity sets.',
      os.EOL,
      'entities in this zip will be imported into folders that emulates the previous grouping by entity sets',
      os.EOL
    ].join(''))
  }

  const validations = []

  for (const c of Object.keys(entitiesInZip)) {
    let collection = reporter.documentStore.collection(c)

    if (!collection && entitiesInZip[c].length > 0) {
      logs.push(`Warning: zip contains entities (${entitiesInZip[c].length}) from collection "${c}" which is not available in this installation, these entities won't be imported`)
    } else if (collection && !exportableCollections.includes(collection.name) && entitiesInZip[c].length > 0) {
      logs.push(`Warning: zip contains entities (${entitiesInZip[c].length}) from collection "${c}" which is not exportable, these entities won't be imported`)
    } else if (collection) {
      const validEntities = await collection.deserializeProperties(entitiesInZip[c])
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
          allLocalEntities: entitiesInZip,
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

  const logsFromValidations = validations.sort((a, b) => {
    const nameA = a.nameDisplay.toUpperCase()
    const nameB = b.nameDisplay.toUpperCase()

    if (nameA < nameB) {
      return -1
    }

    if (nameA > nameB) {
      return 1
    }

    return 0
  }).map((v) => v.log)

  if (logsFromValidations.length > 0) {
    logs.push(...logsFromValidations)
  }
}

module.exports = importZipFile
