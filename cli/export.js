const fs = require('fs')
const urlModule = require('url')
const doRequest = require('./doRequest')
const normalizePath = require('./normalizePath')

const description = 'Export the entities of the specified jsreport instance into a zip'
const command = 'export'

exports.command = command
exports.description = description

exports.configuration = {
  globalOptions: ['serverUrl', 'user', 'password']
}

exports.builder = (yargs) => {
  const examples = getExamples(`jsreport ${command}`)

  examples.forEach((examp) => {
    yargs.example(examp[0], examp[1])
  })

  const commandOptions = {
    entitiesPath: {
      alias: 'f',
      description: 'Only include in the export the specified entities of this json file',
      type: 'string',
      requiresArg: true
    },
    entities: {
      alias: 'e',
      description: 'Only include in the export the specified entities',
      type: 'array',
      requiresArg: true
    }
  }

  const options = Object.keys(commandOptions)

  return (
    yargs
      .usage(`${description}\n\n${getUsage(`jsreport ${command}`)}`)
      .positional('zipFile', {
        type: 'string',
        description: 'Absolute or relative path to the zip file that will be created as the result of the export'
      })
      .group(options, 'Command options:')
      .options(commandOptions)
      .check((argv) => {
        if (!argv || !argv._[1]) {
          throw new Error('"zipFile" argument is required')
        }

        argv._[1] = normalizePath(argv.context.cwd, 'zipFile', argv._[1], {
          type: 'argument',
          read: false,
          strict: true
        })

        if (argv.user && !argv.serverUrl) {
          throw new Error('user option needs to be used with --serverUrl option')
        }

        if (argv.user && !argv.password) {
          throw new Error('user option needs to be used with --password option')
        }

        if (argv.password && !argv.user) {
          throw new Error('password option needs to be used with --user option')
        }

        if (argv.entitiesPath != null && argv.entities != null) {
          throw new Error('entitiesPath option can\'t be used at the same time that the --entities option')
        }

        if (argv.entities != null && !Array.isArray(argv.entities)) {
          throw new Error('entities option should be an array of entities id')
        }

        if (argv.entitiesPath != null) {
          argv.entitiesPath = normalizePath('entitiesPath', argv.entitiesPath, {
            read: true,
            json: true,
            strict: true
          })

          if (!Array.isArray(argv.entitiesPath)) {
            throw new Error('entitiesPath option should specify a json file that contain an array of entities id')
          }
        }

        return true
      })
  )
}

exports.handler = async (argv) => {
  const zipFilePath = argv._[1]
  const context = argv.context
  const verbose = argv.verbose
  const options = getOptions(argv)

  if (options.remote) {
    // connect to a remote server
    console.log(`starting export ${
      options.export && options.export.selection ? ` (entities: ${options.export.selection.join(', ')})` : '(all entities)'
    } in ${argv.serverUrl}..`)

    try {
      const result = await startExport(null, {
        verbose,
        exportOptions: options.export,
        output: zipFilePath,
        remote: options.remote
      })

      result.fromRemote = true

      return result
    } catch (e) {
      return onCriticalError(e)
    }
  }

  const cwd = context.cwd
  const workerSockPath = context.workerSockPath
  const getInstance = context.getInstance
  const initInstance = context.initInstance
  const daemonHandler = context.daemonHandler
  const findProcessByCWD = daemonHandler.findProcessByCWD

  if (verbose) {
    console.log('looking for previously daemonized instance in:', workerSockPath, 'cwd:', cwd)
  }

  // first, try to look up if there is an existing process
  // "daemonized" before in the CWD
  let processInfo

  try {
    processInfo = await findProcessByCWD(workerSockPath, cwd)
  } catch (processLookupErr) {
    return onCriticalError(processLookupErr)
  }

  // if process was found, just connect to it,
  // otherwise just continue processing
  if (processInfo) {
    if (verbose) {
      console.log(`using instance daemonized previously (pid: ${processInfo.pid})..`)
    }

    const adminAuthentication = processInfo.adminAuthentication || {}

    try {
      const result = await startExport(null, {
        verbose,
        exportOptions: options.export,
        output: zipFilePath,
        remote: {
          url: processInfo.url,
          user: adminAuthentication.username,
          password: adminAuthentication.password
        }
      })

      result.fromDaemon = true

      return result
    } catch (e) {
      return onCriticalError(e)
    }
  }

  if (verbose) {
    console.log('there is no previously daemonized instance in:', workerSockPath, 'cwd:', cwd)
  }

  try {
    if (verbose) {
      console.log('trying to start an instance in cwd:', cwd)
    }

    const _instance = await getInstance(cwd)
    let jsreportInstance

    if (verbose) {
      console.log('disabling express extension..')
    }

    if (typeof _instance === 'function') {
      jsreportInstance = _instance()
    } else {
      jsreportInstance = _instance
    }

    jsreportInstance.options = jsreportInstance.options || {}
    jsreportInstance.options.extensions = jsreportInstance.options.extensions || {}
    jsreportInstance.options.extensions.express = Object.assign(
      {},
      jsreportInstance.options.extensions.express,
      { enabled: false }
    )

    await initInstance(jsreportInstance)

    console.log(`starting export ${
      options.export && options.export.selection ? ` (entities: ${options.export.selection.join(', ')})` : '(all entities)'
    } in local instance..`)

    return (await startExport(jsreportInstance, {
      verbose: verbose,
      exportOptions: options.export,
      output: zipFilePath
    }))
  } catch (e) {
    return onCriticalError(e)
  }

  function onCriticalError (err) {
    err.message = `A critical error occurred while trying to execute the ${command} command: ${err.message}`
    throw err
  }
}

async function startExport (jsreportInstance, { remote, exportOptions, output, verbose }) {
  let result

  if (verbose) {
    if (remote) {
      console.log('remote server options:')
      console.log(remote)
    }

    console.log('exporting with options:')
    console.log(JSON.stringify(exportOptions, null, 2))
  }

  if (remote) {
    try {
      const reqOpts = {
        url: urlModule.resolve(remote.url, 'api/export'),
        method: 'POST',
        data: exportOptions,
        responseType: 'stream'
      }

      if (remote.user || remote.password) {
        reqOpts.auth = {
          username: remote.user,
          password: remote.password
        }
      }

      const response = await doRequest(reqOpts)

      result = await saveResponse(response.data, output)

      if (response.headers && response.headers['export-entities-count'] != null) {
        result.entitiesCount = JSON.parse(response.headers['export-entities-count'])
      }
    } catch (err) {
      let customError

      if (err.code === 'ECONNREFUSED') {
        customError = new Error(`Couldn't connect to remote jsreport server in: ${
          remote.url
        } , Please verify that a jsreport server is running`)
      }

      if (!customError && err.response && err.response.statusCode != null) {
        if (err.response.statusCode === 404) {
          customError = new Error(`Couldn't connect to remote jsreport server in: ${
            remote.url
          } , Please verify that a jsreport server is running`)
        } else if (err.response.statusCode === 401) {
          customError = new Error(`Couldn't connect to remote jsreport server in: ${
            remote.url
          } , Authentication error, Please pass correct --user and --password options`)
        }
      }

      if (customError) {
        customError.originalError = err
        throw onExportError(customError)
      }

      throw err
    }
  } else {
    try {
      const exportResult = await jsreportInstance.export(exportOptions != null ? exportOptions.selection : undefined)
      const exportResultIsStream = typeof exportResult === 'object' && typeof exportResult.pipe === 'function'

      // compatibility with older versions
      result = await saveResponse(exportResultIsStream ? exportResult : exportResult.stream, output)

      if (!exportResultIsStream && exportResult.entitiesCount != null) {
        result.entitiesCount = exportResult.entitiesCount
      }
    } catch (err) {
      throw onExportError(err)
    }
  }

  if (result.entitiesCount) {
    let count = 0
    const entityCountPerSet = []

    result.entitiesCount = Object.keys(result.entitiesCount).reduce((acu, entitySet) => {
      const entitySetCount = result.entitiesCount[entitySet]

      if (entitySetCount > 0) {
        entityCountPerSet.push(`${entitySet} ${entitySetCount}`)
        count += entitySetCount
        acu[entitySet] = entitySetCount
      }

      return acu
    }, {})

    if (entityCountPerSet.length > 0) {
      console.log(`exported by entitySet: ${entityCountPerSet.join(', ')}`)
    }

    console.log(`total entities exported: ${count}`)
  }

  console.log('export finished')

  return result
}

async function saveResponse (stream, output) {
  const outputStream = writeFileFromStream(stream, output)

  return new Promise((resolve, reject) => {
    listenOutputStream(outputStream, () => {
      return resolve({
        output: output
      })
    }, reject)
  })
}

function listenOutputStream (outputStream, onFinish, onError) {
  outputStream.on('finish', () => {
    console.log('exporting has finished successfully and saved in:', outputStream.path)
    onFinish()
  })

  outputStream.on('error', (err) => {
    onError(onExportError(err))
  })
}

function writeFileFromStream (stream, output) {
  const outputStream = fs.createWriteStream(output)

  stream.pipe(outputStream)

  return outputStream
}

function onExportError (error) {
  console.error('exporting has finished with errors:')
  return error
}

function getOptions (argv) {
  let exportOpts = {}
  let remote = null

  if (argv.entities) {
    exportOpts.selection = argv.entities
  } else if (argv.entitiesPath) {
    exportOpts.selection = argv.entitiesPath
  }

  if (argv.serverUrl) {
    remote = {
      url: argv.serverUrl
    }
  }

  if (argv.user && argv.serverUrl) {
    remote.user = argv.user
  }

  if (argv.password && argv.serverUrl) {
    remote.password = argv.password
  }

  return {
    export: exportOpts,
    remote
  }
}

function getUsage (command) {
  return [
    `Usage:\n`,
    `${command} <zipFile>`,
    `${command} <zipFile> --serverUrl=<url>`,
    `${command} <zipFile> --serverUrl=<url> --user=<user> --password=<password>`,
    `${command} <zipFile> --entities entity1Id --entities entity2Id`,
    `${command} <zipFile> --entitiesPath entities.json`
  ].join('\n')
}

function getExamples (command) {
  return [
    [`${command} jsreportExport.zip`, `Export all the entities of the local instance into a zip file`],
    [`${command} jsreportExport.zip --serverUrl=http://jsreport-host.com`, `Export all the entities of the jsreport instance at http://jsreport-host.com into a zip file`],
    [`${command} jsreportExport.zip --serverUrl=http://jsreport-host.com --user admin --password xxxx`, `Export all the entities of the authenticated jsreport instance at http://jsreport-host.com into a zip file`],
    [`${command} jsreportExport.zip --entities entity1Id --entities entity2Id`, `Export just the selected entities of the local instance into a zip file`],
    [`${command} jsreportExport.zip --entitiesPath entities.json`, `Export just the selected entities (specified in a json file) of the local instance into a zip file`]
  ]
}
