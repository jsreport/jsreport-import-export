process.env.DEBUG = 'jsreport'
require('should')
var request = require('supertest')
var Reporter = require('jsreport-core')
var fs = require('fs')
var Promise = require('bluebird')
var path = require('path')

var mongo = { connectionString: { name: 'mongodb', databaseName: 'test', address: '127.0.0.1' } }
var fsStore = { connectionString: { name: 'fs' } }
var postgres = {
  connectionString: {
    'name': 'postgres',
    'host': 'localhost',
    'port': 5432,
    'database': 'jsreport',
    'user': 'postgres',
    'password': 'password'
  }
}

describe('rest api', function () {
  var reporter

  beforeEach(function () {
    reporter = new Reporter()
        .use(require('../')())
        .use(require('jsreport-templates')())
        .use(require('jsreport-express')())

    return reporter.init()
  })

  it('/api/export and /api/import should get store to the original state', function () {
    var importPath = path.join(reporter.options.tempDirectory, 'myImport.zip')

    // insert a fake template
    return reporter.documentStore.collection('templates').insert({ content: 'foo' }).then(function () {
      // export store to myImport.zip
      return new Promise(function (resolve) {
        var exportStream = request(reporter.express.app).post('/api/export')
        exportStream.pipe(fs.createWriteStream(importPath)).on('finish', resolve)
      }).then(function () {
        // clean up all templates in store
        return reporter.documentStore.collection('templates').remove({})
      }).then(function () {
        // import myImport.zip back
        return request(reporter.express.app)
            .post('/api/import')
            .attach('import.zip', importPath)
            .expect(200)
      })
    }).then(function () {
      // check if the template is back
      return reporter.documentStore.collection('templates').find({}).then(function (res) {
        res.should.have.length(1)
      })
    })
  })

  it('should return meaningfull message when import.zip missing', function (done) {
    request(reporter.express.app)
      .post('/api/import')
      .attach('wrong.zip', path.join(__dirname, 'exportsTest.js'))
      .expect(500, /import\.zip/)
      .end(done)
  })

  it('should return meaningfull message when there is no multipart part', function (done) {
    request(reporter.express.app)
      .post('/api/import')
      .expect(500, /import\.zip/)
      .end(done)
  })
})

describe('exports', function () {
  var reporter

  describe('in memory store', function () {
    common()
  })

  describe('fs store', function () {
    common(fsStore)
  })

  describe('mongodb store', function () {
    common(mongo)
  })

  describe('postgres store', function () {
    common(postgres)
  })

  function common (options) {
    beforeEach(function () {
      reporter = new Reporter(options)
        .use(require('jsreport-templates')())
        .use(require('jsreport-images')())
        .use(require('jsreport-fs-store')())
        .use(require('jsreport-mongodb-store')())
        .use(require('jsreport-postgres-store')())
        .use(require('../')())

      return reporter.init().then(function () {
        return reporter.documentStore.drop()
      }).then(function () {
        return reporter.init()
      })
    })

    it('should be able to export import on empty db', function () {
      return reporter.export().then(function (stream) {
        return reporter.import(stream)
      })
    })

    it('should import back deleted entity', function () {
      return reporter.documentStore.collection('templates').insert({ name: 'foo' }).then(function () {
        return reporter.export().then(function (stream) {
          return reporter.documentStore.collection('templates').remove({}).then(function () {
            return reporter.import(stream)
          }).then(function () {
            return reporter.documentStore.collection('templates').find({}).then(function (res) {
              res.should.have.length(1)
              res[0].name.should.be.eql('foo')
            })
          })
        })
      })
    })

    it('should update entity in import', function () {
      return reporter.documentStore.collection('templates').insert({ name: 'foo', content: 'x' }).then(function () {
        return reporter.export().then(function (stream) {
          return reporter.documentStore.collection('templates').update({}, { $set: { content: 'y' } }).then(function () {
            return reporter.import(stream)
          }).then(function () {
            return reporter.documentStore.collection('templates').find({}).then(function (res) {
              res.should.have.length(1)
              res[0].name.should.be.eql('foo')
              res[0].content.should.be.eql('x')
            })
          })
        })
      })
    })

    it('should filter out entities by selection in export', function () {
      return reporter.documentStore.collection('templates').insert({ name: 'foo' }).then(function (e) {
        return reporter.documentStore.collection('templates').insert({ name: 'foo2' }).then(function (e2) {
          return reporter.export([e2._id.toString()]).then(function (stream) {
            return reporter.documentStore.collection('templates').remove({ _id: e._id }).then(function () {
              return reporter.documentStore.collection('templates').remove({ _id: e2._id }).then(function () {
                return reporter.import(stream)
              })
            }).then(function () {
              return reporter.documentStore.collection('templates').find({}).then(function (res) {
                res.should.have.length(1)
                res[0].name.should.be.eql('foo2')
              })
            })
          })
        })
      })
    })

    it('should handle buffers', function () {
      return reporter.documentStore.collection('images').insert({ name: 'foo', content: 'foo' }).then(function () {
        return reporter.export().then(function (stream) {
          return reporter.documentStore.collection('images').remove({}).then(function () {
            return reporter.import(stream)
          }).then(function () {
            return reporter.documentStore.collection('images').find({}).then(function (res) {
              res.should.have.length(1)
              res[0].content.toString().should.be.eql('foo')
            })
          })
        })
      })
    })
  }
})

describe('exports across stores', function () {
  describe('from fs to mongo', function () {
    test(fsStore, mongo)
  })

  describe('from mongo to fs', function () {
    test(mongo, fsStore)
  })

  describe('from fs to postgres', function () {
    test(fsStore, postgres)
  })

  describe('from postgres to fs', function () {
    test(postgres, fsStore)
  })

  describe('from mongo to postgres', function () {
    test(mongo, postgres)
  })

  describe('from postgres to mongo', function () {
    test(postgres, mongo)
  })

  function test (options, options2) {
    var reporter1
    var reporter2

    beforeEach(function () {
      reporter1 = new Reporter(options)
        .use(require('jsreport-templates')())
        .use(Object.assign({}, require('jsreport-fs-store')()))
        .use(Object.assign({}, require('jsreport-mongodb-store')()))
        .use(Object.assign({}, require('jsreport-postgres-store')()))
        .use(require('../')())

      reporter2 = new Reporter(options2)
        .use(require('jsreport-templates')())
        .use(Object.assign({}, require('jsreport-fs-store')()))
        .use(Object.assign({}, require('jsreport-mongodb-store')()))
        .use(Object.assign({}, require('jsreport-postgres-store')()))
        .use(require('../')())

      return reporter1.init().then(function () {
        return reporter2.init()
      }).then(function () {
        return reporter1.documentStore.drop()
      }).then(function () {
        return reporter2.documentStore.drop()
      }).then(function () {
        return reporter1.init()
      }).then(function () {
        return reporter2.init()
      })
    })

    it('should export import', function () {
      return reporter1.documentStore.collection('templates').insert({ name: 'foo' }).then(function () {
        return reporter1.export().then(function (stream) {
          return reporter2.import(stream)
        }).then(function () {
          return reporter2.documentStore.collection('templates').find({}).then(function (res) {
            res.should.have.length(1)
            res[0].name.should.be.eql('foo')
          })
        })
      })
    })
  }
})
