process.env.DEBUG = 'jsreport'
require('should')
var Reporter = require('jsreport-core')

var mongo = { connectionString: { name: 'mongodb', databaseName: 'test', address: '127.0.0.1' } }
var fs = { connectionString: { name: 'fs' } }
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

describe('exports', function () {
  var reporter

  describe('in memory store', function () {
    common()
  })

  describe('fs store', function () {
    common(fs)
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
    test(fs, mongo)
  })

  describe('from mongo to fs', function () {
    test(mongo, fs)
  })

  describe('from fs to postgres', function () {
    test(fs, postgres)
  })

  describe('from postgres to fs', function () {
    test(postgres, fs)
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
