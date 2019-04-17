import ExportModal from './ExportModal.js'
import ImportModal from './ImportModal.js'
import Studio from 'jsreport-studio'

Studio.addToolbarComponent((props) => (
  <div className='toolbar-button' onClick={() => Studio.openModal(ExportModal)}>
    <i className='fa fa-download' /> Export
  </div>
), 'settings')

Studio.addToolbarComponent((props) => (
  <div className='toolbar-button' onClick={() => Studio.openModal(ImportModal)}>
    <i className='fa fa-upload' /> Import
  </div>
), 'settings')

Studio.addEntityTreeContextMenuItemsResolver(({
  node,
  entity,
  isRoot,
  isGroupEntity,
  getAllEntitiesInHierarchy
}) => {
  const items = []

  if (isRoot) {
    items.push({
      key: 'Import',
      title: 'Import',
      icon: 'fa-upload',
      onClick: () => {
        Studio.openModal(ImportModal)
      }
    })

    items.push({
      key: 'Export',
      title: 'Export',
      icon: 'fa-download',
      onClick: () => {
        Studio.openModal(ExportModal)
      }
    })
  } else if (isGroupEntity && entity.__entitySet === 'folders') {
    items.push({
      key: 'Import',
      title: 'Import into folder',
      icon: 'fa-upload',
      onClick: () => {
        Studio.openModal(ImportModal, { selectedFolderShortid: entity.shortid })
      }
    })

    items.push({
      key: 'Export',
      title: 'Export folder',
      icon: 'fa-download',
      onClick: () => {
        const selected = getAllEntitiesInHierarchy(node, true)
        Studio.openModal(ExportModal, { initialSelected: selected })
      }
    })
  }

  return {
    grouped: true,
    items
  }
})
