const createRecordManager = require('./recordsManager')
const { groupFoldersByLevel } = require('../helpers')

module.exports = async function getImportRecords (reporter, req, {
  entitiesInZip,
  targetFolder,
  targetFolderPath,
  importByEntitySet,
  fullImport
}) {
  const recordsManager = createRecordManager(reporter, req, {
    entitiesInZip,
    importByEntitySet,
    targetFolder,
    targetFolderPath
  })

  const exportableCollectionsWithoutFolders = Object.keys(reporter.documentStore.collections).filter((collectionName) => {
    return (
      (
        // null check for backcompatible support
        reporter.documentStore.model.entitySets[collectionName].exportable == null ||
        reporter.documentStore.model.entitySets[collectionName].exportable === true
      ) && collectionName !== 'folders'
    )
  })

  const exportableCollections = [...exportableCollectionsWithoutFolders, 'folders']

  if (fullImport) {
    // when doing full import we first record folders delete at the root level and let core do the cascade deletes for entities inside the folder.
    // it is important that we first save the deletes to the folders for correct permissions propagation
    const foldersAtRoot = await reporter.documentStore.collection('folders').find({
      folder: null
    }, req)

    for (const f of foldersAtRoot) {
      await recordsManager.addDelete({
        collectionName: 'folders',
        entity: f
      })
    }

    // then save the rest of deletes of entities at the root level
    for (let c of exportableCollectionsWithoutFolders) {
      const collection = reporter.documentStore.collection(c)

      if (!collection) {
        continue
      }

      const entitiesAtRoot = await collection.find({
        folder: null
      }, req)

      for (const e of entitiesAtRoot) {
        await recordsManager.addDelete({
          collectionName: c,
          entity: e
        })
      }
    }
  }

  if (reporter.documentStore.collections.folders != null) {
    // we process folders first to avoid gettings errors related to missing
    // folder when inserting an entity
    const validFolders = entitiesInZip.folders || []
    const groups = groupFoldersByLevel(validFolders)

    const foldersToProcess = []
    let currentLevel = 0

    while (groups[currentLevel] != null && groups[currentLevel].length > 0) {
      foldersToProcess.push(...groups[currentLevel])
      currentLevel++
    }

    for (const f of foldersToProcess) {
      await recordsManager.addAndResolveAction({
        collectionName: 'folders',
        entity: f
      })
    }
  }

  for (let c of exportableCollectionsWithoutFolders) {
    const entitiesToProcess = entitiesInZip[c] || []
    const collection = reporter.documentStore.collection(c)

    if (!collection && entitiesToProcess.length > 0) {
      entitiesToProcess.forEach((e) => {
        recordsManager.ignore({
          reason: 'missingCollection',
          collectionName: c,
          entity: e
        })
      })

      continue
    } else if (collection && !exportableCollections.includes(collection.name) && entitiesToProcess.length > 0) {
      entitiesToProcess.forEach((e) => {
        recordsManager.ignore({
          reason: 'collectionNotExportable',
          collectionName: c,
          entity: e
        })
      })

      continue
    }

    for (const e of entitiesToProcess) {
      await recordsManager.addAndResolveAction({
        collectionName: c,
        entity: e
      })
    }
  }

  // we are done adding records and we can now safely update
  // references that point to existing value on the store, and queue lazy updates
  // that will be resolved during records processing
  const result = await recordsManager.end()

  return result
}
