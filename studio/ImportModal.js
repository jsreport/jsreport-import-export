import React, {Component} from 'react'
import Studio from 'jsreport-studio'

const EntityRefSelect = Studio.EntityRefSelect

class ImportFinishedModal extends Component {
  componentDidMount () {
    setTimeout(() => this.confirmBtn.focus(), 0)
  }

  componentWillUnmount () {
    Studio.reset().catch(() => {})
  }

  confirm () {
    this.props.close()

    Studio.reset().catch((e) => { console.error(e) })
  }

  render () {
    const { log } = this.props.options

    return (
      <div>
        <h1><i className='fa fa-info-circle' /> Import finished</h1>
        {log != null && log !== '' && (
          <div className='form-group'>
            <div>
              <i>Some errors/warnings happened during the import:</i>
            </div>
            <textarea style={{width: '100%', boxSizing: 'border-box'}} rows='10' readOnly value={log} />
          </div>
        )}
        <div className='form-group'>
          <i>Now we need to reload the studio..</i>
        </div>
        <div className='button-bar'>
          <button ref={(el) => { this.confirmBtn = el }} className='button confirmation' onClick={() => this.confirm()}>
            Ok
          </button>
        </div>
      </div>
    )
  }
}

export default class ImportModal extends Component {
  constructor (props) {
    super(props)

    this.state = {
      selectedFolderShortid: props.options != null && props.options.selectedFolderShortid ? props.options.selectedFolderShortid : null,
      fullImport: false,
      validated: false
    }
  }

  upload (e) {
    if (!e.target.files.length) {
      return
    }

    this.setState({
      status: '1',
      processing: true,
      log: 'Validating import....'
    })

    this.file = e.target.files[0]
    const reader = new FileReader()

    reader.onloadend = async () => {
      this.refs.file.value = ''

      try {
        const result = await Studio.api.post('api/validate-import', {
          params: {
            fullImport: this.state.fullImport,
            targetFolder: this.state.selectedFolderShortid
          },
          attach: { filename: 'import.zip', file: this.file }
        }, true)

        this.setState({
          validated: true,
          status: result.status,
          processing: false,
          log: result.log
        })
      } catch (e) {
        this.setState({
          validated: true,
          status: '1',
          processing: false,
          log: e.message + ' ' + e.stack
        })
      }
    }

    reader.onerror = function () {
      alert('There was an error reading the file!')
    }

    reader.readAsArrayBuffer(this.file)
  }

  async import () {
    try {
      this.setState({
        status: '1',
        processing: true,
        log: 'Working on import....'
      })

      const result = await Studio.api.post('api/import', {
        params: {
          fullImport: this.state.fullImport,
          targetFolder: this.state.selectedFolderShortid
        },
        attach: { filename: 'import.zip', file: this.file }
      }, true)

      Studio.openModal(ImportFinishedModal, {
        log: result.log
      })
    } catch (e) {
      this.setState({
        status: '1',
        processing: false,
        log: e.message + ' ' + e.stack
      })
    }
  }

  cancel () {
    this.setState({
      validated: false
    })
  }

  openFileDialog () {
    this.refs.file.dispatchEvent(new MouseEvent('click', {
      'view': window,
      'bubbles': false,
      'cancelable': true
    }))
  }

  render () {
    return (
      <div>
        <input type='file' key='file' ref='file' style={{display: 'none'}} onChange={(e) => this.upload(e)} />

        <h1><i className='fa fa-upload' /> Import objects</h1>

        <div className='form-group'>
          <p>
            A <b>validation is run first</b>, so you can safely upload the exported package and review the changes which will be performed. Afterwards <b>you can confirm or cancel the import</b>.
          </p>
        </div>
        <div className='form-group'>
          <div>
            <label style={{ opacity: (this.state.processing === true || this.state.validated) ? 0.7 : 1 }}>
              <input
                type='checkbox'
                style={{ verticalAlign: 'middle' }}
                disabled={this.state.processing === true || this.state.validated}
                onChange={(e) => {
                  this.setState({
                    fullImport: e.target.checked
                  })
                }}
              />
              <span style={{ verticalAlign: 'middle' }}>Full Import</span>
            </label>
          </div>
          {this.state.fullImport && (
            <p style={{ marginTop: '15px' }}>
              A <b>full import</b> means that <b>all the entities that are not present in the zip will be deleted</b>, after the import <b>you will have only the entities that were present in the zip</b>.
            </p>
          )}
        </div>
        <div className='form-group'>
          <div style={{
            display: !this.state.fullImport ? 'block' : 'none',
            border: '1px dashed black',
            padding: '0.6rem',
            opacity: (this.state.processing === true || this.state.validated) ? 0.7 : 1
          }}>
            <label>You can <b>optionally</b> select a folder in which the entities  will be inserted</label>
            <EntityRefSelect
              noModal
              allowNewFolder
              treeStyle={{ height: '12rem' }}
              headingLabel='Select folder'
              filter={(references) => ({ folders: references.folders })}
              selectableFilter={(isGroup, entity) => entity.__entitySet === 'folders'}
              value={this.state.selectedFolderShortid}
              disabled={this.state.processing === true || this.state.validated}
              onChange={(selected) => {
                this.setState({
                  selectedFolderShortid: selected.length > 0 ? selected[0].shortid : null
                })
              }}
            />
          </div>
          {!this.state.validated && (
            <div className='button-bar'>
              <a className='button confirmation' onClick={() => this.openFileDialog()}>
                Validate
              </a>
            </div>
          )}
          <br />
          {this.state.validated && (
            <div>
              <div>
                <i>Log of changes with the import:</i>
              </div>
              <textarea style={{width: '100%', boxSizing: 'border-box'}} rows='10' readOnly value={this.state.log} />
            </div>
          )}
          {this.state.validated && this.state.status === '0' && (
            <div className='button-bar'>
              <a className='button danger' onClick={() => this.cancel()}>
                Cancel
              </a>
              <a className='button confirmation' onClick={() => this.import()}>
                Import
              </a>
            </div>
          )}
        </div>
      </div>
    )
  }
}

(function (window) {
  try {
    new MouseEvent('test')  // eslint-disable-line
    return false // No need to polyfill
  } catch (e) {
    // Need to polyfill - fall through
  }

  // Polyfills DOM4 MouseEvent

  var MouseEvent = function (eventType, params) {
    params = params || { bubbles: false, cancelable: false }
    var mouseEvent = document.createEvent('MouseEvent')
    mouseEvent.initMouseEvent(eventType, params.bubbles, params.cancelable, window, 0, 0, 0, 0, 0, false, false, false, false, 0, null)

    return mouseEvent
  }

  MouseEvent.prototype = Event.prototype

  window.MouseEvent = MouseEvent
})(window)
