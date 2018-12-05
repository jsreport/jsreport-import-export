process.env.DEBUG = 'jsreport'
require('should')
const request = require('supertest')
const jsreport = require('jsreport-core')
const fs = require('fs')
const Promise = require('bluebird')
const path = require('path')
const { unzipEntities } = require('../lib/helpers')

const mongo = { store: { provider: 'mongodb' }, extensions: { 'mongodb-store': { databaseName: 'test', address: '127.0.0.1' } } }
const fsStore = { store: { provider: 'fs' } }

const postgres = {
  store: {
    provider: 'postgres'
  },
  extensions: {
    'postgres-store': {
      'host': 'localhost',
      'port': 5432,
      'database': 'jsreport',
      'user': 'postgres',
      'password': 'password'
    }
  }
}

function saveExportStream (reporter, stream) {
  return new Promise(function (resolve, reject) {
    const exportPath = path.join(reporter.options.tempDirectory, 'myExport.zip')
    const exportDist = fs.createWriteStream(exportPath)

    stream.on('error', reject)
    exportDist.on('error', reject)

    exportDist.on('finish', function () {
      resolve(exportPath)
    })

    stream.pipe(exportDist)
  })
}

describe('rest api', () => {
  let reporter

  beforeEach(() => {
    reporter = jsreport()
      .use(require('../')())
      .use(require('jsreport-templates')())
      .use(require('jsreport-express')())

    return reporter.init()
  })

  afterEach(async () => {
    if (reporter) {
      await reporter.close()
    }
  })

  it('/api/export and /api/import should get store to the original state', async () => {
    const importPath = path.join(reporter.options.tempDirectory, 'myImport.zip')

    // insert a fake template
    await reporter.documentStore.collection('templates').insert({ content: 'foo', name: 'foo', engine: 'none', recipe: 'html' })

    // export store to myImport.zip
    await new Promise((resolve) => {
      const exportStream = request(reporter.express.app).post('/api/export')
      exportStream.pipe(fs.createWriteStream(importPath)).on('finish', resolve)
    })

    // clean up all templates in store
    await reporter.documentStore.collection('templates').remove({})

    // import myImport.zip back
    await request(reporter.express.app)
      .post('/api/import')
      .attach('import.zip', importPath)
      .expect(200)

    // check if the template is back
    const res = await reporter.documentStore.collection('templates').find({})
    res.should.have.length(1)
  })

  it('should return meaningfull message when import.zip missing', () => {
    return request(reporter.express.app)
      .post('/api/import')
      .attach('wrong.zip', path.join(__dirname, 'exportsTest.js'))
      .expect(500, /import\.zip/)
  })

  it('should return meaningfull message when there is no multipart part', () => {
    return request(reporter.express.app)
      .post('/api/import')
      .expect(500, /import\.zip/)
  })
})

describe('exports', () => {
  let reporter

  describe('in memory store', () => {
    common()
  })

  describe('fs store', () => {
    common(fsStore, (reporter) => reporter.use(require('jsreport-fs-store')()))
  })

  describe('mongodb store', () => {
    common(mongo, (reporter) => reporter.use(require('jsreport-mongodb-store')()))
  })

  describe('postgres store', function () {
    common(postgres, (reporter) => reporter.use(require('jsreport-postgres-store')()))
  })

  function common (options = {}, cfg = () => {}) {
    beforeEach(async () => {
      const createReporter = () => {
        const res = jsreport(options)
          .use(require('jsreport-templates')())
          .use(require('jsreport-assets')())
          .use(require('../')())
        cfg(res)
        return res
      }
      reporter = createReporter()

      await reporter.init()
      await reporter.documentStore.drop()
      reporter = createReporter()
      await reporter.init()
    })

    it('should contain metadata.json in export', async () => {
      const stream = await reporter.export()
      const exportPath = await saveExportStream(reporter, stream)
      const exportContents = await unzipEntities(exportPath)

      exportContents.metadata.should.have.properties([
        'reporterVersion',
        'importExportVersion',
        'storeProvider',
        'createdAt'
      ])
    })

    it('should be able to export import on empty db', async () => {
      const stream = await reporter.export()
      const exportPath = await saveExportStream(reporter, stream)
      return reporter.import(exportPath)
    })

    it('should import back deleted entity', async () => {
      await reporter.documentStore.collection('templates').insert({ name: 'foo', engine: 'none', recipe: 'html' })
      const stream = await reporter.export()
      const exportPath = await saveExportStream(reporter, stream)
      await reporter.documentStore.collection('templates').remove({})
      await reporter.import(exportPath)
      const res = await reporter.documentStore.collection('templates').find({})
      res.should.have.length(1)
      res[0].name.should.be.eql('foo')
    })

    it('should update entity in import', async () => {
      await reporter.documentStore.collection('templates').insert({ name: 'foo', content: 'x', engine: 'none', recipe: 'html' })
      const stream = await reporter.export()
      const exportPath = await saveExportStream(reporter, stream)
      await reporter.documentStore.collection('templates').update({}, { $set: { content: 'y' } })
      await reporter.import(exportPath)
      const res = await reporter.documentStore.collection('templates').find({})
      res.should.have.length(1)
      res[0].name.should.be.eql('foo')
      res[0].content.should.be.eql('x')
    })

    it('should filter out entities by selection in export', async () => {
      const e = await reporter.documentStore.collection('templates').insert({ name: 'foo', engine: 'none', recipe: 'html' })
      const e2 = await reporter.documentStore.collection('templates').insert({ name: 'foo2', engine: 'none', recipe: 'html' })
      const stream = await reporter.export([e2._id.toString()])
      const exportPath = await saveExportStream(reporter, stream)
      await reporter.documentStore.collection('templates').remove({ _id: e._id })
      await reporter.documentStore.collection('templates').remove({ _id: e2._id })
      await reporter.import(exportPath)
      const res = await reporter.documentStore.collection('templates').find({})
      res.should.have.length(1)
      res[0].name.should.be.eql('foo2')
    })

    it('should be able to export import folder of entity', async () => {
      await reporter.documentStore.collection('folders').insert({ name: 'level1', shortid: 'level1' })
      const e1 = await reporter.documentStore.collection('templates').insert({ name: 'foo', engine: 'none', recipe: 'html', folder: { shortid: 'level1' } })
      const stream = await reporter.export([e1._id.toString()])
      const exportPath = await saveExportStream(reporter, stream)
      await reporter.documentStore.collection('templates').remove({})

      // doing this because reporter.documentStore.collection('folders').remove({}) does not
      // delete all entities with mongodb store
      await Promise.all((await reporter.documentStore.collection('folders').find({})).map(async (e) => {
        return reporter.documentStore.collection('folders').remove({
          _id: e._id
        })
      }))

      await reporter.import(exportPath)
      const foldersRes = await reporter.documentStore.collection('folders').find({})
      const templatesRes = await reporter.documentStore.collection('templates').find({})
      foldersRes.should.have.length(1)
      templatesRes.should.have.length(1)
      foldersRes[0].name.should.be.eql('level1')
      templatesRes[0].name.should.be.eql('foo')
    })

    it('should be able to export import parent folders of entity', async () => {
      await reporter.documentStore.collection('folders').insert({ name: 'level1', shortid: 'level1' })
      await reporter.documentStore.collection('folders').insert({ name: 'level2', shortid: 'level2', folder: { shortid: 'level1' } })
      await reporter.documentStore.collection('folders').insert({ name: 'level3', shortid: 'level3', folder: { shortid: 'level2' } })
      const e1 = await reporter.documentStore.collection('templates').insert({ name: 'foo', engine: 'none', recipe: 'html', folder: { shortid: 'level3' } })
      const stream = await reporter.export([e1._id.toString()])
      const exportPath = await saveExportStream(reporter, stream)
      await reporter.documentStore.collection('templates').remove({})

      // doing this because reporter.documentStore.collection('folders').remove({}) does not
      // delete all entities with mongodb store
      await Promise.all((await reporter.documentStore.collection('folders').find({})).map(async (e) => {
        return reporter.documentStore.collection('folders').remove({
          _id: e._id
        })
      }))

      await reporter.import(exportPath)
      const foldersRes = await reporter.documentStore.collection('folders').find({})
      const templatesRes = await reporter.documentStore.collection('templates').find({})
      foldersRes.should.have.length(3)
      templatesRes.should.have.length(1)
      foldersRes.should.matchAny((f) => { f.should.have.properties({ name: 'level1' }) })
      foldersRes.should.matchAny((f) => { f.should.have.properties({ name: 'level2' }) })
      foldersRes.should.matchAny((f) => { f.should.have.properties({ name: 'level3' }) })
      templatesRes.should.matchAny((f) => { f.should.have.properties({ name: 'foo' }) })
    })

    it('should handle buffers', async () => {
      await reporter.documentStore.collection('assets').insert({ name: 'foo', content: 'foo' })
      const stream = await reporter.export()
      const exportPath = await saveExportStream(reporter, stream)
      await reporter.documentStore.collection('assets').remove({})
      await reporter.import(exportPath)
      const res = await reporter.documentStore.collection('assets').find({})
      res.should.have.length(1)
      res[0].content.toString().should.be.eql('foo')
    })
  }
})

/*
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
          return saveExportStream(reporter, stream).then(function (exportPath) {
            return reporter2.import(exportPath)
          })
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
*/
