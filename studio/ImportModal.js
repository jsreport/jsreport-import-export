import React, {Component} from 'react'
import Studio from 'jsreport-studio'

export default class ImportModal extends Component {
  upload (e) {
    if (!e.target.files.length) {
      return
    }

    this.file = e.target.files[0]
    const reader = new FileReader()

    reader.onloadend = async () => {
      this.refs.file.value = ''

      try {
        const result = await Studio.api.post('api/validate-import', {
          attach: { filename: 'import.zip', file: this.file }
        })
        this.setState(result)
      } catch (e) {
        this.setState({
          status: 1,
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
        status: 1,
        log: 'Working on import....'
      })
      await Studio.api.post('api/import', {
        attach: { filename: 'import.zip', file: this.file }
      })
    } catch (e) {
      return this.setState({
        status: 1,
        log: e.message + ' ' + e.stack
      })
    }

    confirm('Import successfull. We need to reload the studio.')
    location.reload()
  }

  openFileDialog () {
    this.refs.file.dispatchEvent(new MouseEvent('click', {
      'view': window,
      'bubbles': false,
      'cancelable': true
    }))
  }

  render () {
    return <div>
      <input type='file' key='file' ref='file' style={{display: 'none'}} onChange={(e) => this.upload(e)} />

      <h1><i className='fa fa-upload' /> Import objects</h1>

      <div className='form-group'>
        <p>
          You can safely upload the exported package and review the changes which will be performed. Afterwards you can
          reject or perform the import.
        </p>

        <div className='button-bar'>
          <a className='button confirmation' onClick={() => this.openFileDialog()}>
            Validate
          </a>
        </div>
      </div>

      {this.state ? <div className='form-group'>
        <div>
          <textarea style={{width: '100%', boxSizing: 'border-box'}} rows='10' readOnly value={this.state.log} />
        </div>

        <div className='button-bar'>
          <a className='button confirmation' onClick={() => this.import()}>
            Import
          </a>
        </div>
      </div> : <div />}
    </div>
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
