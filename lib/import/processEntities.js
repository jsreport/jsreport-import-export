const pReduce = require('p-reduce')
const { getEntityNameDisplay } = require('../helpers')

module.exports = async function processEntities (reporter, req, {
  collectionName,
  entities,
  allEntities,
  metadata,
  logs,
  rootFolder,
  rootFolderPath,
  continueOnFail,
  remove = false
} = {}) {
  const importByEntitySet = metadata == null
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

    const { entityNameDisplay, publicKey: entityPublicKeyProp } = await getEntityNameDisplay(reporter, {
      allLocalEntities: allEntities,
      entity: entityToProcess,
      collectionName,
      rootFolderPath,
      importByEntitySet,
      req
    })

    processingInfo.entityNameDisplay = entityNameDisplay
    processingInfo.entityPublicKey = entityToProcess[entityPublicKeyProp]

    const mainProcessing = await pReduce(reporter.import._processings, (prevImportProcess, importProcess) => {
      return Promise.resolve(importProcess(
        prevImportProcess,
        processingInfo
      ))
    }, null)

    try {
      await mainProcessing(req, reporter.documentStore.collections[collectionName], entityToProcess)
    } catch (e) {
      if (!continueOnFail) {
        throw e
      }
    }
  }
}
