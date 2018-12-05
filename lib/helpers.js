const toArray = require('stream-to-array')
const yauzl = require('yauzl')
const Promise = require('bluebird')
const archiver = require('archiver')

module.exports.unzipEntities = (zipFilePath) => {
  let zipFile

  return new Promise((resolve, reject) => {
    const entities = {}
    let metadata

    // using lazyEntries: true to keep memory usage under control with zip files with
    // a lot of files inside
    yauzl.open(zipFilePath, { lazyEntries: true }, (openZipErr, zipHandler) => {
      if (openZipErr) {
        return reject(openZipErr)
      }

      let hasError = false

      zipFile = zipHandler

      zipFile.readEntry()

      zipFile
        .on('error', (err) => {
          if (hasError) {
            return
          }

          hasError = true
          reject(err)
        }).on('entry', (entry) => {
          if (hasError) {
            return
          }

          if (/\/$/.test(entry.fileName)) {
            // if entry is a directory just continue with the next entry.
            return zipFile.readEntry()
          }

          zipFile.openReadStream(entry, (err, readStream) => {
            if (hasError) {
              return
            }

            if (err) {
              hasError = true
              return reject(err)
            }

            toArray(readStream, (err, arr) => {
              if (hasError) {
                return
              }

              if (err) {
                hasError = true
                return reject(err)
              }

              try {
                if (entry.fileName === 'metadata.json') {
                  metadata = JSON.parse(Buffer.concat(arr).toString())
                } else {
                  const es = entry.fileName.split('/')[0]
                  entities[es] = entities[es] || []
                  entities[es].push(JSON.parse(Buffer.concat(arr).toString()))
                }

                zipFile.readEntry()
              } catch (e) {
                hasError = true
                reject(
                  new Error(
                    `Unable to parse file "${
                      entry.fileName
                    }" inside zip, make sure to import zip created using jsreport export`
                  )
                )
              }
            })
          })
        }).on('close', () => {
          if (hasError) {
            // close event can may be emitted after an error
            // when releasing the zip file
            return
          }

          resolve({ entities, metadata })
        })
    })
  }).catch((err) => {
    if (zipFile && zipFile.isOpen) {
      // ensure closing the zip file in case of error
      zipFile.close()
    }

    throw err
  })
}

module.exports.zipEntities = (entities, metadata) => {
  const archive = archiver('zip')

  archive.append(JSON.stringify(metadata), { name: 'metadata.json' })

  Object.keys(entities).forEach((c) => {
    entities[c].forEach((e) => {
      archive.append(JSON.stringify(e), { name: c + '/' + (e.name ? (e.name + '-' + e._id) : e._id) + '.json' })
    })
  })

  archive.finalize()
  return archive
}

module.exports.parseMultipart = (multer) => (req, res, cb) => {
  multer.array('import.zip')(req, res, (err) => {
    if (err) {
      return cb(new Error('Unable to read import.zip key from multipart stream'))
    }

    function findFirstFile () {
      for (let f in req.files) {
        if (req.files.hasOwnProperty(f)) {
          return req.files[f]
        }
      }
    }

    const file = findFirstFile()

    if (!file) {
      return cb(new Error('Unable to read import.zip key from multipart stream'))
    }

    cb(null, file.path)
  })
}
