const { getEntityDisplay, getEntityNameDisplay } = require('../helpers')

module.exports = function createRecordManager (reporter, req, {
  entitiesInZip,
  importByEntitySet,
  targetFolder,
  targetFolderPath
}) {
  const ignored = []
  const deletedByCollectionMap = new Map()
  const records = []

  const pendingReferencesUpdates = []
  const entityRecordCollectionMap = new WeakMap()
  const entityRecordNewValueMap = new WeakMap()
  const lazyReferencesMap = new WeakMap()
  const entitySetFoldersMap = new Map()
  const entitiesInRecords = {}

  const addIgnore = ({ reason, collectionName, entity }) => {
    const { entityDisplayProperty, entityDisplay } = getEntityDisplay(reporter, { collectionName, entity })

    ignored.push({
      reason,
      collectionName,
      entityDisplayProperty,
      entityDisplay,
      entity
    })
  }

  const isDeleted = async ({ collectionName, entity }) => {
    let exists

    if (!deletedByCollectionMap.has(collectionName)) {
      exists = false
    } else {
      const deletedEntities = deletedByCollectionMap.get(collectionName)

      exists = deletedEntities.find((dEntity) => {
        return dEntity._id === entity._id
      }) != null
    }

    // check also that parent folder is not deleted
    if (!exists && entity.folder) {
      const parentFolder = await reporter.documentStore.collection('folders').findOne({
        shortid: entity.folder.shortid
      }, req)

      if (parentFolder) {
        const parentIsDeleted = await isDeleted({ collectionName: 'folders', entity: parentFolder })
        return parentIsDeleted
      }
    }

    return exists
  }

  const addRecord = async (record) => {
    if (record.action === 'insert' || record.action === 'update') {
      entityRecordCollectionMap.set(record.entity, record.collectionName)
      entitiesInRecords[record.collectionName] = entitiesInRecords[record.collectionName] || []
      entitiesInRecords[record.collectionName].push(record.entity)

      const { entityNameDisplay, entityNameDisplayProperty } = await getEntityNameDisplay(reporter, {
        allLocalEntities: entitiesInZip,
        entity: record.originalEntity || record.entity,
        collectionName: record.collectionName,
        targetFolderPath,
        importByEntitySet,
        req
      })

      record.entityNameDisplay = entityNameDisplay
      record.entityNameDisplayProperty = entityNameDisplayProperty
    } else {
      const publicKey = reporter.documentStore.model.entitySets[record.collectionName].entityTypePublicKey

      if (publicKey) {
        const entityNameDisplay = await reporter.folders.resolveEntityPath(record.entity, record.collectionName, req)
        record.entityNameDisplayProperty = 'path'
        record.entityNameDisplay = entityNameDisplay
      } else {
        record.entityNameDisplayProperty = '_id'
        record.entityNameDisplay = record.entity._id
      }
    }

    records.push(record)
  }

  const addDelete = async ({ collectionName, entity }) => {
    if (!deletedByCollectionMap.has(collectionName)) {
      deletedByCollectionMap.set(collectionName, [])
    }

    const items = deletedByCollectionMap.get(collectionName)
    items.push(entity)

    await addRecord({
      action: 'delete',
      collectionName,
      entityId: entity._id,
      entity
    })
  }

  const addLazyReferenceBetween = (parent, ref) => {
    if (!lazyReferencesMap.has(parent)) {
      lazyReferencesMap.set(parent, [])
    }

    const references = lazyReferencesMap.get(parent)
    references.push(ref)
  }

  return {
    ignore: (ignoreRecord) => {
      addIgnore(ignoreRecord)
    },
    addDelete,
    addAndResolveAction: async ({ collectionName, entity: originalEntity }) => {
      const entitySet = reporter.documentStore.model.entitySets[collectionName]
      const humanReadableKey = entitySet.humanReadableKey
      const entity = { ...originalEntity }
      let targetEntityPath
      let parentEntitySetInfo

      if (importByEntitySet) {
        // in theory we should also validate that we don't execute this if
        // the collection is folders, however in reality the "importByEntitySet"
        // will only be true for legacy export, which will never contain folders
        parentEntitySetInfo = await getParentEntitySetFolder(collectionName)
      }

      const collection = reporter.documentStore.collection(collectionName)

      try {
        targetEntityPath = await reporter.folders.resolveEntityPath(entity, collectionName, req, async (folderShortId) => {
          let folderFound

          if (entitiesInZip.folders) {
            folderFound = entitiesInZip.folders.find((e) => e.shortid === folderShortId)
          }

          return folderFound
        })

        if (importByEntitySet) {
          // it is safe to do this because when "importByEntitySet" is true it means
          // we are processing a legacy export, which will never container folders
          targetEntityPath = `/${collectionName}${targetEntityPath}`
        }

        if (targetFolderPath) {
          targetEntityPath = `${targetFolderPath}${targetEntityPath}`
        }
      } catch (e) {
        addIgnore({
          reason: 'missingParentFolder',
          collectionName,
          entity
        })

        return
      }

      const targetParentEntityPath = getParentEntityPath(targetEntityPath)
      const searchByPathResult = await reporter.folders.resolveEntityFromPath(targetEntityPath, undefined, req)
      const existingEntity = searchByPathResult ? searchByPathResult.entity : undefined
      const existingEntityCollectionName = searchByPathResult ? searchByPathResult.entitySet : undefined
      const existingEntityIsDeleted = existingEntity ? await isDeleted({ collectionName: existingEntityCollectionName, entity: existingEntity }) : false
      let updateEntityId
      let action

      if (existingEntity && existingEntityCollectionName !== collectionName && !existingEntityIsDeleted) {
        await addDelete({ collectionName: existingEntityCollectionName, entity: existingEntity })
      }

      if (existingEntity && existingEntityCollectionName === collectionName && !existingEntityIsDeleted) {
        // conflict on path
        action = 'update'
        updateEntityId = existingEntity._id

        if (entity._id !== existingEntity._id) {
          // we need to remove the _id because we want to preserve
          // the _id that is already on store
          delete entity._id
        }

        if (humanReadableKey && entity[humanReadableKey] !== existingEntity[humanReadableKey]) {
          const entityHumanReadableValue = entity[humanReadableKey]

          // we need to remove the humanReadableKey because we want to preserve
          // the humanReadableKey that is already on store
          delete entity[humanReadableKey]

          // we need to fix the references on the zip to
          // use the humanReadableKey of the store (normal update)
          pendingReferencesUpdates.push({
            collectionName,
            referenceValue: entityHumanReadableValue,
            newReferenceValue: existingEntity[humanReadableKey]
          })
        }
      } else {
        // no collision on path
        action = 'insert'

        if (humanReadableKey) {
          const duplicatedEntityByHumanReadableKey = await collection.findOne({
            [humanReadableKey]: entity[humanReadableKey]
          }, req)

          const duplicatedEntityIsDeleted = duplicatedEntityByHumanReadableKey ? await isDeleted({
            collectionName,
            entity: duplicatedEntityByHumanReadableKey
          }) : false

          if (duplicatedEntityByHumanReadableKey && !duplicatedEntityIsDeleted) {
            const entityPathOfDuplicated = await reporter.folders.resolveEntityPath(duplicatedEntityByHumanReadableKey, collectionName, req)
            const parentEntityPathOfDuplicated = getParentEntityPath(entityPathOfDuplicated)

            if (parentEntityPathOfDuplicated === targetParentEntityPath) {
              // handle entity rename, nothing more to update here because
              // the humanReadableKey on the zip at this point should be the same
              // than the one on the store
              action = 'update'
              updateEntityId = duplicatedEntityByHumanReadableKey._id
            } else {
              const entityHumanReadableValue = entity[humanReadableKey]

              // we should remove the humanReadableKey to avoid the conflict
              // we need to re-generate a new one
              delete entity[humanReadableKey]

              // we need to fix the references on the zip to
              // use the humanReadableKey that is going to be generated (lazy update)
              pendingReferencesUpdates.push({
                collectionName,
                referenceValue: entityHumanReadableValue,
                baseEntity: entity
              })
            }
          }
        }

        if (action === 'insert') {
          const duplicatedEntityById = await collection.findOne({
            _id: entity._id
          }, req)

          const duplicatedEntityIsDeleted = duplicatedEntityById ? await isDeleted({
            collectionName,
            entity: duplicatedEntityById
          }) : false

          if (duplicatedEntityById && !duplicatedEntityIsDeleted) {
            // we need to regenerate the _id to avoid the conflict
            delete entity._id
          }
        } else {
          // if there is an update we need to remove the _id because
          // we want to preserve the _id that is already on store
          delete entity._id
        }
      }

      const record = {
        action,
        collectionName,
        originalEntity,
        entity
      }

      if (updateEntityId) {
        record.entityId = updateEntityId
      }

      if (parentEntitySetInfo) {
        if (parentEntitySetInfo.lazy) {
          // we need to update the reference to the parent folder when the folder
          // gets inserted, this will resolved later during the processing of the records
          addLazyReferenceBetween(parentEntitySetInfo.entity, entity)
        } else {
          entity.folder = parentEntitySetInfo.value
        }
      }

      if (entity.folder == null && targetFolder) {
        entity.folder = {
          shortid: targetFolder.shortid
        }
      }

      record.updateReferences = createUpdateForLazyReferences(record)

      await addRecord(record)
    },
    end: async () => {
      for (const pendingReferenceUpdate of pendingReferencesUpdates) {
        const { collectionName, referenceValue } = pendingReferenceUpdate
        const linkedEntities = findLinkedEntitiesForReferenceValue(collectionName, referenceValue)

        if (linkedEntities.length === 0) {
          continue
        }

        // if there is no new value set then it means we should queue
        // a lazy reference for the update to be executed later
        if (!pendingReferenceUpdate.hasOwnProperty('newReferenceValue')) {
          for (const entity of linkedEntities) {
            addLazyReferenceBetween(pendingReferenceUpdate.baseEntity, entity)
          }

          continue
        }

        for (const entity of linkedEntities) {
          updateReference(entityRecordCollectionMap.get(entity), entity, collectionName, referenceValue, pendingReferenceUpdate.newReferenceValue)
        }
      }

      return {
        records,
        ignored
      }
    }
  }

  async function getParentEntitySetFolder (collectionName) {
    const entitySet = reporter.documentStore.model.entitySets[collectionName]

    if (entitySetFoldersMap.has(collectionName)) {
      return entitySetFoldersMap.get(collectionName)
    }

    let result

    if (entitySet.splitIntoDirectories === true) {
      let existingContainerFolder

      if (!targetFolder) {
        existingContainerFolder = await reporter.documentStore.collection('folders').findOne({ name: collectionName, folder: null }, req)
      } else {
        existingContainerFolder = await reporter.documentStore.collection('folders').findOne({ name: collectionName, folder: targetFolder.shortid }, req)
      }

      if (!existingContainerFolder) {
        const newFolder = {
          name: collectionName
        }

        if (targetFolder) {
          newFolder.folder = {
            shortid: targetFolder.shortid
          }
        }

        await addRecord({
          action: 'insert',
          collectionName: 'folders',
          entity: newFolder
        })

        result = { lazy: true, entity: newFolder }
      } else {
        result = { value: { shortid: existingContainerFolder.shortid } }
      }
    } else {
      result = { value: null }
    }

    entitySetFoldersMap.set(collectionName, result)

    return result
  }

  function findLinkedEntitiesForReferenceValue (collectionReferenceTargetName, referenceValue) {
    const entities = []
    const targetCollections = []

    for (const property of reporter.documentStore.model.entitySets[collectionReferenceTargetName].linkedReferenceProperties) {
      if (!targetCollections.includes(property.entitySet)) {
        targetCollections.push(property.entitySet)
      }
    }

    for (const colName of targetCollections) {
      const entitiesInCollection = entitiesInRecords[colName] || []

      for (const entity of entitiesInCollection) {
        const exists = existsReference(colName, entity, collectionReferenceTargetName, referenceValue)

        if (exists) {
          entities.push(entity)
        }
      }
    }

    return entities
  }

  function findPropertiesForCollectionReference (collectionReferenceOriginName, collectionReferenceTargetName) {
    const properties = []

    for (const prop of reporter.documentStore.model.entitySets[collectionReferenceOriginName].referenceProperties) {
      if (prop.referenceTo === collectionReferenceTargetName) {
        properties.push(prop.name)
      }
    }

    return properties
  }

  function existsReference (collectionReferenceOriginName, entity, collectionReferenceTargetName, referenceValue) {
    let exists = false
    const propertiesToCheck = findPropertiesForCollectionReference(collectionReferenceOriginName, collectionReferenceTargetName)

    for (const propName of propertiesToCheck) {
      const entityType = reporter.documentStore.getEntityType(
        reporter.documentStore.model.entitySets[collectionReferenceOriginName].entityType
      )

      const propParts = propName.split('.')

      exists = existsReferenceInProperty(entityType, entity, referenceValue, propParts)

      if (exists) {
        break
      }
    }

    return exists
  }

  function existsReferenceInProperty (type, obj, referenceValue, propsToEvaluate) {
    if (obj == null || propsToEvaluate.length === 0) {
      return false
    }

    const currentPropName = propsToEvaluate[0]
    const restProps = propsToEvaluate.slice(1)
    const currentPropDef = type[currentPropName]
    const currentPropValue = obj[currentPropName]

    if (currentPropValue == null || currentPropDef == null) {
      return false
    }

    const resolveResult = reporter.documentStore.resolvePropertyDefinition(currentPropDef)

    if (resolveResult.subType && resolveResult.def.type.startsWith('Collection(')) {
      if (!Array.isArray(currentPropValue)) {
        return false
      }

      return currentPropValue.some((val) => {
        return existsReferenceInProperty(resolveResult.subType, val, referenceValue, restProps)
      })
    } else if (resolveResult.def.type.startsWith('Collection(') && resolveResult.subType == null) {
      if (restProps.length > 0) {
        return false
      }

      if (!Array.isArray(currentPropValue)) {
        return false
      }

      return currentPropValue.some((val) => val === referenceValue)
    } else if (resolveResult.subType) {
      return existsReferenceInProperty(resolveResult.subType, currentPropValue, referenceValue, restProps)
    }

    if (restProps.length > 0) {
      return false
    }

    return currentPropValue === referenceValue
  }

  function updateReference (collectionReferenceOriginName, entity, collectionReferenceTargetName, referenceValue, newReferenceValue) {
    const propertiesToCheck = findPropertiesForCollectionReference(collectionReferenceOriginName, collectionReferenceTargetName)

    for (const propName of propertiesToCheck) {
      const entityType = reporter.documentStore.getEntityType(
        reporter.documentStore.model.entitySets[collectionReferenceOriginName].entityType
      )

      const propParts = propName.split('.')

      updateReferenceInProperty(entityType, entity, referenceValue, newReferenceValue, propParts)
    }
  }

  function updateReferenceInProperty (type, obj, referenceValue, newReferenceValue, propsToEvaluate) {
    const currentPropName = propsToEvaluate[0]
    const restProps = propsToEvaluate.slice(1)
    const currentPropDef = type[currentPropName]
    const currentPropValue = obj[currentPropName]

    if (currentPropDef == null) {
      return
    }

    const resolveResult = reporter.documentStore.resolvePropertyDefinition(currentPropDef)

    if (resolveResult.subType && resolveResult.def.type.startsWith('Collection(')) {
      if (restProps.length === 0) {
        return
      }

      if (!Array.isArray(currentPropValue)) {
        obj[currentPropName] = []
      }

      if (obj[currentPropName].length === 0) {
        const newItem = {}
        obj[currentPropName].push(newItem)
        updateReferenceInProperty(resolveResult.subType, newItem, undefined, newReferenceValue, restProps)
      } else {
        const exists = obj[currentPropName].some((val) => {
          return existsReferenceInProperty(resolveResult.subType, val, referenceValue, restProps)
        })

        if (exists) {
          obj[currentPropName].forEach((val, idx) => {
            obj[currentPropName][idx] = val || {}
            return updateReferenceInProperty(resolveResult.subType, obj[currentPropName][idx], referenceValue, newReferenceValue, restProps)
          })
        } else {
          const newItem = {}
          obj[currentPropName].push(newItem)
          updateReferenceInProperty(resolveResult.subType, newItem, undefined, newReferenceValue, restProps)
        }
      }
    } else if (resolveResult.def.type.startsWith('Collection(') && resolveResult.subType == null) {
      if (restProps.length > 0) {
        return
      }

      if (!Array.isArray(currentPropValue)) {
        obj[currentPropName] = []
      }

      if (referenceValue != null && obj[currentPropName].includes(referenceValue)) {
        obj[currentPropName].forEach((val, idx) => {
          if (val === referenceValue) {
            obj[currentPropName][idx] = newReferenceValue
          }
        })
      } else {
        obj[currentPropName].push(newReferenceValue)
      }
    } else if (resolveResult.subType) {
      obj[currentPropName] = obj[currentPropName] || {}
      return updateReferenceInProperty(resolveResult.subType, obj[currentPropName], referenceValue, newReferenceValue, restProps)
    }

    if (restProps.length > 0) {
      return
    }

    if (referenceValue != null) {
      if (obj[currentPropName] === referenceValue) {
        obj[currentPropName] = newReferenceValue
      }
    } else {
      obj[currentPropName] = newReferenceValue
    }
  }

  function createUpdateForLazyReferences (record) {
    return async function updateReferences (newEntity, processRecord) {
      if (record.action === 'insert' || record.action === 'update') {
        const entitiesToUpdate = lazyReferencesMap.get(record.entity) || []

        for (const entity of entitiesToUpdate) {
          const collectionReferenceOriginName = entityRecordCollectionMap.get(entity)
          const collectionReferenceTargetName = entityRecordCollectionMap.get(record.entity)
          const originHumanReadableKey = reporter.documentStore.model.entitySets[collectionReferenceOriginName].humanReadableKey

          if (originHumanReadableKey == null) {
            continue
          }

          if (entityRecordNewValueMap.has(entity)) {
            // if we get here it means that the entity was already processed, so we need to
            // execute an update directly to the store
            const entityUpdate = {}

            updateReference(
              collectionReferenceOriginName,
              entityUpdate,
              collectionReferenceTargetName,
              undefined,
              newEntity[originHumanReadableKey]
            )

            const entityNewInfo = entityRecordNewValueMap.get(entity)

            const updateRecord = {
              action: 'update',
              collectionName: collectionReferenceOriginName,
              entityId: entityNewInfo._id,
              entity: entityUpdate
            }

            updateRecord.entityNameDisplayProperty = 'path'
            updateRecord.entityNameDisplay = await reporter.folders.resolveEntityPath(entityNewInfo, collectionReferenceOriginName, req)

            await processRecord(updateRecord)
          } else {
            // update the entity information and later it will be processed in the store
            updateReference(
              collectionReferenceOriginName,
              entity,
              collectionReferenceTargetName,
              undefined,
              newEntity[originHumanReadableKey]
            )
          }
        }

        entityRecordNewValueMap.set(record.entity, newEntity)
      }
    }
  }
}

function getParentEntityPath (entityPath) {
  const resultPath = entityPath.split('/').slice(0, -1).join('/')

  if (resultPath === '') {
    return '/'
  }

  return resultPath
}
