const os = require('os')
const pReduce = require('p-reduce')
const getImportRecords = require('./getImportRecords')
const { unzipEntities } = require('../helpers')

async function importZipFile (reporter, zipFilePath, opts, req) {
  const validation = opts.validation === true
  const fullImport = opts.fullImport === true
  const continueOnFail = opts.continueOnFail === true

  if (!validation) {
    reporter.logger.debug('reading import zip file')
  }

  const { entities: entitiesInZip, metadata } = await unzipEntities(zipFilePath)

  let targetFolder
  let targetFolderPath
  let sum = 0
  const importByEntitySet = metadata == null
  const entitiesCount = {}
  const logs = []

  for (let [collectionName, entities] of Object.entries(entitiesInZip)) {
    const collection = reporter.documentStore.collection(collectionName)

    entitiesCount[collectionName] = entities.length
    sum += entities.length

    if (collection) {
      entitiesInZip[collectionName] = await collection.deserializeProperties(entities)
    }
  }

  if (!validation) {
    reporter.logger.debug(`import found ${sum} objects`)
  }

  if (sum === 0) {
    logs.push('Info: No entities found to import')

    return {
      entitiesCount,
      log: logs.join(os.EOL)
    }
  }

  if (fullImport === true) {
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

  if (validation) {
    if (importByEntitySet) {
      logs.push([
        'Warning: zip contains entities from old installation in which everything was grouped by entity sets.',
        os.EOL,
        'entities in this zip will be imported into folders that emulates the previous grouping by entity sets',
        os.EOL
      ].join(''))
    }
  }

  const { records, ignored } = await getImportRecords(reporter, req, {
    entitiesInZip,
    targetFolder,
    targetFolderPath,
    importByEntitySet,
    fullImport
  })

  if (ignored.length > 0) {
    const pendingLogs = []
    const counter = {}

    for (const item of ignored) {
      const { reason, collectionName, entityDisplayProperty, entityDisplay } = item

      if (reason === 'missingCollection') {
        counter.missingCollection = counter.missingCollection || {}
        counter.missingCollection[collectionName] = counter.missingCollection[collectionName] || 0
        counter.missingCollection[collectionName] += 1
      } else if (reason === 'collectionNotExportable') {
        counter.collectionNotExportable = counter.collectionNotExportable || {}
        counter.collectionNotExportable[collectionName] = counter.collectionNotExportable[collectionName] || 0
        counter.collectionNotExportable[collectionName] += 1
      } else if (reason === 'missingParentFolder') {
        pendingLogs.push(`Warning: Parent folder for entity (${collectionName}) ${entityDisplayProperty}: ${entityDisplay} does not exists, skipping import of it`)
      } else {
        pendingLogs.push(`Warning: entity (${collectionName}) ${entityDisplayProperty}: ${entityDisplay} was skipped for import. reason: ${reason}`)
      }
    }

    if (counter.missingCollection != null) {
      Object.keys(counter.missingCollection).forEach((colName) => {
        pendingLogs.unshift(`Warning: zip contains entities (${counter.missingCollection[colName]}) from collection "${colName}" which is not available in this installation, these entities won't be imported`)
      })
    }

    if (counter.collectionNotExportable != null) {
      Object.keys(counter.collectionNotExportable).forEach((colName) => {
        pendingLogs.unshift(`Warning: zip contains entities (${counter.collectionNotExportable[colName]}) from collection "${colName}" which is not exportable, these entities won't be imported`)
      })
    }

    for (const log of pendingLogs) {
      logs.push(log)
      reporter.logger.warn(log)
    }
  }

  if (validation) {
    const validations = []

    for (const record of records) {
      const { action, collectionName, entity, entityNameDisplay, entityNameDisplayProperty } = record
      const publicKey = reporter.documentStore.model.entitySets[collectionName].entityTypePublicKey
      let renamedFrom

      const validationInfo = {
        importType: action,
        collectionName: collectionName,
        entity
      }

      if (action === 'update' && publicKey) {
        const originalEntity = await reporter.documentStore.collection(collectionName).findOne({
          _id: record.entityId
        }, req)

        if (originalEntity[publicKey] !== entity[publicKey]) {
          renamedFrom = await reporter.folders.resolveEntityPath(originalEntity, collectionName, req)
        }
      }

      if (renamedFrom) {
        validationInfo.log = (
          `Entity ${action}: (${collectionName}) rename ${renamedFrom} to ${entityNameDisplay}`
        )
      } else {
        validationInfo.log = (
          `Entity ${action}: (${collectionName}) ${entityNameDisplay}`
        )
      }

      validationInfo.nameDisplay = entityNameDisplay
      validationInfo.nameDisplayProperty = entityNameDisplayProperty

      await reporter.importValidation.validationListeners.fire(req, validationInfo)

      validations.push({
        nameDisplay: entityNameDisplay,
        log: validationInfo.log
      })
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
  } else {
    await reporter.documentStore.beginTransaction(req)

    try {
      for (const record of records) {
        try {
          await processEntityRecord(reporter, req, record, { metadata, logs })
        } catch (e) {
          if (!continueOnFail) {
            throw e
          }
        }
      }

      await reporter.documentStore.commitTransaction(req)
    } catch (e) {
      await reporter.documentStore.rollbackTransaction(req)

      e.message = `Import failed: ${e.message}`

      throw e
    }
  }

  if (!validation) {
    reporter.logger.debug(`import finished`)
  }

  if (logs.length === 0) {
    return {
      entitiesCount,
      log: ''
    }
  }

  if (!validation) {
    logs.push('Info: import finished')
  }

  return {
    entitiesCount,
    log: logs.join(os.EOL)
  }
}

async function processEntityRecord (reporter, req, record, { metadata, logs }) {
  const entityToProcess = record.entity
  const entityNameDisplay = record.entityNameDisplay
  const entityNameDisplayProperty = record.entityNameDisplayProperty
  const collectionName = record.collectionName

  await reporter.import.filteringListeners.fire(req, entityToProcess, metadata, logs)

  const processingInfo = {
    action: record.action,
    req,
    collectionName,
    metadata,
    logs
  }

  processingInfo.entityId = record.entityId
  processingInfo.entityNameDisplay = entityNameDisplay
  processingInfo.entityNameDisplayProperty = entityNameDisplayProperty

  const mainProcessing = await pReduce(reporter.import._processings, (prevImportProcess, importProcess) => {
    return Promise.resolve(importProcess(
      prevImportProcess,
      processingInfo
    ))
  }, null)

  const newEntity = await mainProcessing(req, reporter.documentStore.collections[collectionName], entityToProcess)

  if (record.updateReferences) {
    await record.updateReferences(
      newEntity,
      async (updateRecord) => processEntityRecord(reporter, req, updateRecord, { metadata, logs })
    )
  }
}

module.exports = importZipFile
