import React, {Component} from 'react'
import Studio, { EntityTree } from 'jsreport-studio'
import fileSaver from 'filesaver.js-npm'

export default class ExportModal extends Component {
  componentWillMount () {
    const { options } = this.props
    let selections = {}

    const references = this.getExportableReferences(Studio.getReferences())

    Object.keys(references).forEach((k) => {
      Object.keys(references[k]).forEach((e) => {
        if (options.initialSelected != null) {
          const selected = Array.isArray(options.initialSelected) ? options.initialSelected : [options.initialSelected]

          selected.forEach((s) => {
            if (references[k][e]._id === s) {
              selections[references[k][e]._id] = true
            } else if (selections[references[k][e]._id] == null) {
              selections[references[k][e]._id] = false
            }
          })
        } else {
          selections[references[k][e]._id] = true
        }
      })
    })

    this.setState(selections)
  }

  getExportableReferences (references) {
    const exportableEntitySets = Studio.extensions['import-export'].options.exportableEntitySets

    return Object.keys(references).reduce((acu, entitySetName) => {
      if (exportableEntitySets.indexOf(entitySetName) !== -1) {
        acu[entitySetName] = references[entitySetName]
      }

      return acu
    }, {})
  }

  handleNodeSelect (references, es, v) {
    let updates = {}

    if (Array.isArray(es)) {
      es.forEach((_id) => {
        updates[_id] = v
      })
    } else {
      references[es].forEach((e) => {
        updates[e._id] = v
      })
    }

    this.setState(updates)
  }

  async download () {
    try {
      let response = await Studio.api.post('api/export', {
        data: {
          selection: Object.keys(this.state).filter((k) => this.state[k])
        },
        responseType: 'blob'
      }, true)

      fileSaver.saveAs(response, 'export.zip')
    } catch (e) {
      alert('Unable to prepare export ' + e.message + ' ' + e.stack)
    }
  }

  render () {
    const references = this.getExportableReferences(Studio.getReferences())

    Object.keys(references).forEach((k) => {
      Object.keys(references[k]).forEach((e) => (references[k][e] = Object.assign({}, references[k][e], { __selected: this.state[references[k][e]._id] })))
    })

    return (
      <div className='form-group'>
        <div>
          <h1><i className='fa fa-download' /> Export objects</h1>
        </div>
        <div style={{height: '30rem', overflow: 'auto'}}>
          <EntityTree
            activeEntity={Studio.getActiveEntity()}
            entities={references}
            selectable
            onNodeSelect={(es, v) => this.handleNodeSelect(references, es, v)}
            onSelect={(e, v) => this.setState({ [e._id]: !this.state[e._id] })}
          />
        </div>
        <div className='button-bar'>
          <a className='button confirmation' onClick={() => this.download()}>
            Download
          </a>
        </div>
      </div>
    )
  }
}
