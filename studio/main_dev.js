import ExportModal from './ExportModal.js'
import ImportModal from './ImportModal.js'
import Studio from 'jsreport-studio'

Studio.addToolbarComponent((props) => <div
  className='toolbar-button' onClick={() => Studio.openModal(ExportModal)}><i className='fa fa-download' /> Export</div>, 'settings')

Studio.addToolbarComponent((props) => <div
  className='toolbar-button' onClick={() => Studio.openModal(ImportModal)}><i className='fa fa-upload' /> Import</div>, 'settings')
