const should = require('should')
const saveExportStream = require('./saveExportStream')

module.exports = (getReporter) => {
  let reporter

  beforeEach(() => {
    reporter = getReporter()
  })

  describe('when no entity path conflict', () => {
    it('should produce entity insert when _id conflict on same folder level (import on root)', async () => {
      const t1 = await reporter.documentStore.collection('templates').insert({
        name: 'foo',
        shortid: 'foo',
        engine: 'none',
        recipe: 'html'
      })

      const req = reporter.Request({})
      const { stream } = await reporter.export([t1._id.toString()], req)
      const exportPath = await saveExportStream(reporter, stream)
      await reporter.documentStore.collection('templates').remove({})

      await reporter.documentStore.collection('templates').insert({
        _id: t1._id,
        name: 'bar',
        shortid: 'bar',
        engine: 'none',
        recipe: 'html'
      })

      await reporter.import(exportPath, req)

      const templatesRes = await reporter.documentStore.collection('templates').find({})

      templatesRes.should.have.length(2)

      templatesRes[0]._id.should.be.not.eql(templatesRes[1]._id)
      templatesRes.should.matchAny((t) => t.name.should.be.eql('foo'))
      templatesRes.should.matchAny((t) => t.name.should.be.eql('bar'))
    })

    it('should produce entity insert when _id conflict on same folder level (import on folder)', async () => {
      const t1 = await reporter.documentStore.collection('templates').insert({
        name: 'foo',
        shortid: 'foo',
        engine: 'none',
        recipe: 'html'
      })

      const req = reporter.Request({})
      const { stream } = await reporter.export([t1._id.toString()], req)
      const exportPath = await saveExportStream(reporter, stream)
      await reporter.documentStore.collection('templates').remove({})

      const f1 = await reporter.documentStore.collection('folders').insert({ name: 'folder', shortid: 'folder' })

      await reporter.documentStore.collection('templates').insert({
        _id: t1._id,
        name: 'bar',
        shortid: 'bar',
        engine: 'none',
        recipe: 'html',
        folder: {
          shortid: f1.shortid
        }
      })

      await reporter.import(exportPath, {
        targetFolder: f1.shortid
      }, req)

      const foldersRes = await reporter.documentStore.collection('folders').find({})
      const templatesRes = await reporter.documentStore.collection('templates').find({})

      foldersRes.should.have.length(1)
      templatesRes.should.have.length(2)

      templatesRes[0]._id.should.be.not.eql(templatesRes[1]._id)
      templatesRes.should.matchAny((t) => t.name.should.be.eql('foo') && t.folder.shortid.should.be.eql(f1.shortid))
      templatesRes.should.matchAny((t) => t.name.should.be.eql('bar') && t.folder.shortid.should.be.eql(f1.shortid))
    })

    it('should produce entity insert when _id conflict on different folder level (import on root)', async () => {
      const t1 = await reporter.documentStore.collection('templates').insert({
        name: 'foo',
        shortid: 'foo',
        engine: 'none',
        recipe: 'html'
      })

      const req = reporter.Request({})
      const { stream } = await reporter.export([t1._id.toString()], req)
      const exportPath = await saveExportStream(reporter, stream)
      await reporter.documentStore.collection('templates').remove({})

      const f1 = await reporter.documentStore.collection('folders').insert({ name: 'folder', shortid: 'folder' })

      await reporter.documentStore.collection('templates').insert({
        _id: t1._id,
        name: 'bar',
        shortid: 'bar',
        engine: 'none',
        recipe: 'html',
        folder: {
          shortid: f1.shortid
        }
      })

      await reporter.import(exportPath, req)

      const foldersRes = await reporter.documentStore.collection('folders').find({})
      const templatesRes = await reporter.documentStore.collection('templates').find({})

      foldersRes.should.have.length(1)
      templatesRes.should.have.length(2)

      templatesRes[0]._id.should.be.not.eql(templatesRes[1]._id)
      templatesRes.should.matchAny((t) => t.name.should.be.eql('bar') && t.folder.shortid.should.be.eql(f1.shortid))
      templatesRes.should.matchAny((t) => t.name.should.be.eql('foo') && should(t.folder).be.not.ok())
    })

    it('should produce entity insert when _id conflict on different folder level (import on folder)', async () => {
      const t1 = await reporter.documentStore.collection('templates').insert({
        name: 'foo',
        shortid: 'foo',
        engine: 'none',
        recipe: 'html'
      })

      const req = reporter.Request({})
      const { stream } = await reporter.export([t1._id.toString()], req)
      const exportPath = await saveExportStream(reporter, stream)
      await reporter.documentStore.collection('templates').remove({})

      await reporter.documentStore.collection('templates').insert({
        _id: t1._id,
        name: 'bar',
        shortid: 'bar',
        engine: 'none',
        recipe: 'html'
      })

      const f1 = await reporter.documentStore.collection('folders').insert({ name: 'folder', shortid: 'folder' })

      await reporter.import(exportPath, {
        targetFolder: f1.shortid
      }, req)

      const foldersRes = await reporter.documentStore.collection('folders').find({})
      const templatesRes = await reporter.documentStore.collection('templates').find({})

      foldersRes.should.have.length(1)
      templatesRes.should.have.length(2)

      templatesRes[0]._id.should.be.not.eql(templatesRes[1]._id)
      templatesRes.should.matchAny((t) => t.name.should.be.eql('bar') && should(t.folder).be.not.ok())
      templatesRes.should.matchAny((t) => t.name.should.be.eql('foo') && t.folder.shortid.should.be.eql(f1.shortid))
    })

    it('should produce entity update when humanReadableKey conflict on same folder level (import on root)', async () => {
      const t1 = await reporter.documentStore.collection('templates').insert({
        name: 'foo',
        engine: 'none',
        recipe: 'html'
      })

      const req = reporter.Request({})
      const { stream } = await reporter.export([t1._id.toString()], req)
      const exportPath = await saveExportStream(reporter, stream)
      await reporter.documentStore.collection('templates').remove({})

      await reporter.documentStore.collection('templates').insert({
        name: 'bar',
        shortid: t1.shortid,
        engine: 'none',
        recipe: 'html'
      })

      await reporter.import(exportPath, req)

      const templatesRes = await reporter.documentStore.collection('templates').find({})

      templatesRes.should.have.length(1)

      templatesRes[0].name.should.be.eql('foo')
      templatesRes[0].shortid.should.be.eql(t1.shortid)
    })

    it('should produce entity update when humanReadableKey conflict on same folder level (import on folder)', async () => {
      const t1 = await reporter.documentStore.collection('templates').insert({
        name: 'foo',
        engine: 'none',
        recipe: 'html'
      })

      const req = reporter.Request({})
      const { stream } = await reporter.export([t1._id.toString()], req)
      const exportPath = await saveExportStream(reporter, stream)
      await reporter.documentStore.collection('templates').remove({})

      const f1 = await reporter.documentStore.collection('folders').insert({ name: 'folder', shortid: 'folder' })

      await reporter.documentStore.collection('templates').insert({
        name: 'bar',
        shortid: t1.shortid,
        engine: 'none',
        recipe: 'html',
        folder: {
          shortid: f1.shortid
        }
      })

      await reporter.import(exportPath, {
        targetFolder: f1.shortid
      }, req)

      const templatesRes = await reporter.documentStore.collection('templates').find({})

      templatesRes.should.have.length(1)

      templatesRes[0].name.should.be.eql('foo')
      templatesRes[0].shortid.should.be.eql(t1.shortid)
      templatesRes[0].folder.shortid.should.be.eql(f1.shortid)
    })

    it('should produce entity update and keep references when humanReadableKey conflict on same folder level (import on root)', async () => {
      const d1 = await reporter.documentStore.collection('data').insert({
        name: 'data',
        dataJson: `{ "a": "a" }`
      })

      const t1 = await reporter.documentStore.collection('templates').insert({
        name: 'foo',
        engine: 'none',
        recipe: 'html',
        data: {
          shortid: d1.shortid
        }
      })

      const req = reporter.Request({})
      const { stream } = await reporter.export([d1._id.toString(), t1._id.toString()], req)
      const exportPath = await saveExportStream(reporter, stream)
      await reporter.documentStore.collection('data').remove({})
      await reporter.documentStore.collection('templates').remove({})

      await reporter.documentStore.collection('data').insert({
        name: 'data2',
        shortid: d1.shortid,
        dataJson: `{ "a": "b" }`
      })

      await reporter.import(exportPath, req)

      const templatesRes = await reporter.documentStore.collection('templates').find({})
      const dataEntitiesRes = await reporter.documentStore.collection('data').find({})

      dataEntitiesRes.should.have.length(1)
      templatesRes.should.have.length(1)

      dataEntitiesRes[0].name.should.be.eql('data')
      dataEntitiesRes[0].shortid.should.be.eql(d1.shortid)
      JSON.parse(dataEntitiesRes[0].dataJson).a.should.be.eql('a')
      templatesRes[0].name.should.be.eql('foo')
      templatesRes[0].data.shortid.should.be.eql(d1.shortid)
    })

    it('should produce entity update and keep references when humanReadableKey conflict on same folder level (import on folder)', async () => {
      const d1 = await reporter.documentStore.collection('data').insert({
        name: 'data',
        dataJson: `{ "a": "a" }`
      })

      const t1 = await reporter.documentStore.collection('templates').insert({
        name: 'foo',
        engine: 'none',
        recipe: 'html',
        data: {
          shortid: d1.shortid
        }
      })

      const req = reporter.Request({})
      const { stream } = await reporter.export([d1._id.toString(), t1._id.toString()], req)
      const exportPath = await saveExportStream(reporter, stream)
      await reporter.documentStore.collection('data').remove({})
      await reporter.documentStore.collection('templates').remove({})

      const f1 = await reporter.documentStore.collection('folders').insert({
        name: 'folder',
        shortid: 'folder'
      })

      await reporter.documentStore.collection('data').insert({
        name: 'data2',
        shortid: d1.shortid,
        dataJson: `{ "a": "b" }`,
        folder: {
          shortid: f1.shortid
        }
      })

      await reporter.import(exportPath, {
        targetFolder: f1.shortid
      }, req)

      const templatesRes = await reporter.documentStore.collection('templates').find({})
      const dataEntitiesRes = await reporter.documentStore.collection('data').find({})

      dataEntitiesRes.should.have.length(1)
      templatesRes.should.have.length(1)

      dataEntitiesRes[0].name.should.be.eql('data')
      dataEntitiesRes[0].shortid.should.be.eql(d1.shortid)
      JSON.parse(dataEntitiesRes[0].dataJson).a.should.be.eql('a')
      dataEntitiesRes[0].folder.shortid.should.be.eql(f1.shortid)
      templatesRes[0].name.should.be.eql('foo')
      templatesRes[0].data.shortid.should.be.eql(d1.shortid)
      templatesRes[0].folder.shortid.should.be.eql(f1.shortid)
    })

    it('should produce entity insert when humanReadableKey conflict on different folder level (import on root)', async () => {
      const t1 = await reporter.documentStore.collection('templates').insert({
        name: 'foo',
        engine: 'none',
        recipe: 'html'
      })

      const req = reporter.Request({})
      const { stream } = await reporter.export([t1._id.toString()], req)
      const exportPath = await saveExportStream(reporter, stream)
      await reporter.documentStore.collection('templates').remove({})

      const f1 = await reporter.documentStore.collection('folders').insert({ name: 'folder', shortid: 'folder' })

      await reporter.documentStore.collection('templates').insert({
        name: 'bar',
        shortid: t1.shortid,
        engine: 'none',
        recipe: 'html',
        folder: {
          shortid: f1.shortid
        }
      })

      await reporter.import(exportPath, req)

      const foldersRes = await reporter.documentStore.collection('folders').find({})
      const templatesRes = await reporter.documentStore.collection('templates').find({})

      foldersRes.should.have.length(1)
      templatesRes.should.have.length(2)

      templatesRes[0].shortid.should.be.not.eql(templatesRes[1].shortid)
      templatesRes.should.matchAny((t) => t.name.should.be.eql('bar') && t.folder.shortid.should.be.eql(f1.shortid))
      templatesRes.should.matchAny((t) => t.name.should.be.eql('foo') && should(t.folder).be.not.ok())
    })

    it('should produce entity insert when humanReadableKey conflict on different folder level (import on folder)', async () => {
      const t1 = await reporter.documentStore.collection('templates').insert({
        name: 'foo',
        engine: 'none',
        recipe: 'html'
      })

      const req = reporter.Request({})
      const { stream } = await reporter.export([t1._id.toString()], req)
      const exportPath = await saveExportStream(reporter, stream)
      await reporter.documentStore.collection('templates').remove({})

      await reporter.documentStore.collection('templates').insert({
        name: 'bar',
        shortid: t1.shortid,
        engine: 'none',
        recipe: 'html'
      })

      const f1 = await reporter.documentStore.collection('folders').insert({ name: 'folder', shortid: 'folder' })

      await reporter.import(exportPath, {
        targetFolder: f1.shortid
      }, req)

      const foldersRes = await reporter.documentStore.collection('folders').find({})
      const templatesRes = await reporter.documentStore.collection('templates').find({})

      foldersRes.should.have.length(1)
      templatesRes.should.have.length(2)

      templatesRes[0].shortid.should.be.not.eql(templatesRes[1].shortid)
      templatesRes.should.matchAny((t) => t.name.should.be.eql('bar') && should(t.folder).be.not.ok())
      templatesRes.should.matchAny((t) => t.name.should.be.eql('foo') && t.folder.shortid.should.be.eql(f1.shortid))
    })

    it('should produce entity insert and updated references when humanReadableKey conflict on different folder level (import on root)', async () => {
      const d1 = await reporter.documentStore.collection('data').insert({
        name: 'data',
        dataJson: `{ "a": "a" }`
      })

      const t1 = await reporter.documentStore.collection('templates').insert({
        name: 'foo',
        engine: 'none',
        recipe: 'html',
        data: {
          shortid: d1.shortid
        }
      })

      const req = reporter.Request({})
      const { stream } = await reporter.export([d1._id.toString(), t1._id.toString()], req)
      const exportPath = await saveExportStream(reporter, stream)
      await reporter.documentStore.collection('data').remove({})
      await reporter.documentStore.collection('templates').remove({})

      const f1 = await reporter.documentStore.collection('folders').insert({
        name: 'folder',
        shortid: 'folder'
      })

      await reporter.documentStore.collection('data').insert({
        name: 'data2',
        shortid: d1.shortid,
        dataJson: `{ "a": "b" }`,
        folder: {
          shortid: f1.shortid
        }
      })

      await reporter.import(exportPath, req)

      const templatesRes = await reporter.documentStore.collection('templates').find({})
      const dataEntitiesRes = await reporter.documentStore.collection('data').find({})

      dataEntitiesRes.should.have.length(2)
      templatesRes.should.have.length(1)

      dataEntitiesRes[0].shortid.should.not.be.eql(dataEntitiesRes[1].shortid)

      dataEntitiesRes.should.matchAny((d) => (
        d.name.should.be.eql('data') &&
        should(d.folder).be.not.ok() &&
        JSON.parse(d.dataJson).a.should.be.eql('a')
      ))

      dataEntitiesRes.should.matchAny((d) => (
        d.name.should.be.eql('data2') &&
        d.folder.shortid.should.be.eql(f1.shortid) &&
        JSON.parse(d.dataJson).a.should.be.eql('b')
      ))

      templatesRes[0].data.shortid.should.be.eql(dataEntitiesRes.find((d) => d.name === 'data').shortid)
    })

    it('should produce entity insert and updated references when humanReadableKey conflict on different folder level (import on folder)', async () => {
      const d1 = await reporter.documentStore.collection('data').insert({
        name: 'data',
        dataJson: `{ "a": "a" }`
      })

      const t1 = await reporter.documentStore.collection('templates').insert({
        name: 'foo',
        engine: 'none',
        recipe: 'html',
        data: {
          shortid: d1.shortid
        }
      })

      const req = reporter.Request({})
      const { stream } = await reporter.export([d1._id.toString(), t1._id.toString()], req)
      const exportPath = await saveExportStream(reporter, stream)
      await reporter.documentStore.collection('data').remove({})
      await reporter.documentStore.collection('templates').remove({})

      const f1 = await reporter.documentStore.collection('folders').insert({
        name: 'folder',
        shortid: 'folder'
      })

      await reporter.documentStore.collection('data').insert({
        name: 'data2',
        shortid: d1.shortid,
        dataJson: `{ "a": "b" }`
      })

      await reporter.import(exportPath, {
        targetFolder: f1.shortid
      }, req)

      const templatesRes = await reporter.documentStore.collection('templates').find({})
      const dataEntitiesRes = await reporter.documentStore.collection('data').find({})

      dataEntitiesRes.should.have.length(2)
      templatesRes.should.have.length(1)

      dataEntitiesRes[0].shortid.should.not.be.eql(dataEntitiesRes[1].shortid)

      dataEntitiesRes.should.matchAny((d) => (
        d.name.should.be.eql('data') &&
        d.folder.shortid.should.be.eql(f1.shortid) &&
        JSON.parse(d.dataJson).a.should.be.eql('a')
      ))

      dataEntitiesRes.should.matchAny((d) => (
        d.name.should.be.eql('data2') &&
        should(d.folder).be.not.ok() &&
        JSON.parse(d.dataJson).a.should.be.eql('b')
      ))

      templatesRes[0].folder.shortid.should.be.eql(f1.shortid)
      templatesRes[0].data.shortid.should.be.eql(dataEntitiesRes.find((d) => d.name === 'data').shortid)
    })

    it('should produce entity update when both _id and humanReadableKey conflict on same folder level (import on root)', async () => {
      const t1 = await reporter.documentStore.collection('templates').insert({
        name: 'foo',
        engine: 'none',
        recipe: 'html'
      })

      const req = reporter.Request({})
      const { stream } = await reporter.export([t1._id.toString()], req)
      const exportPath = await saveExportStream(reporter, stream)
      await reporter.documentStore.collection('templates').remove({})

      await reporter.documentStore.collection('templates').insert({
        _id: t1._id,
        name: 'bar',
        shortid: t1.shortid,
        engine: 'none',
        recipe: 'html'
      })

      await reporter.import(exportPath, req)

      const templatesRes = await reporter.documentStore.collection('templates').find({})

      templatesRes.should.have.length(1)

      templatesRes[0]._id.should.be.eql(t1._id)
      templatesRes[0].shortid.should.be.eql(t1.shortid)
      templatesRes[0].name.should.be.eql(t1.name)
    })

    it('should produce entity update when both _id and humanReadableKey conflict on same folder level (import on folder)', async () => {
      const t1 = await reporter.documentStore.collection('templates').insert({
        name: 'foo',
        engine: 'none',
        recipe: 'html'
      })

      const req = reporter.Request({})
      const { stream } = await reporter.export([t1._id.toString()], req)
      const exportPath = await saveExportStream(reporter, stream)
      await reporter.documentStore.collection('templates').remove({})

      const f1 = await reporter.documentStore.collection('folders').insert({ name: 'folder', shortid: 'folder' })

      await reporter.documentStore.collection('templates').insert({
        _id: t1._id,
        name: 'bar',
        shortid: t1.shortid,
        engine: 'none',
        recipe: 'html',
        folder: {
          shortid: f1.shortid
        }
      })

      await reporter.import(exportPath, {
        targetFolder: f1.shortid
      }, req)

      const foldersRes = await reporter.documentStore.collection('folders').find({})
      const templatesRes = await reporter.documentStore.collection('templates').find({})

      foldersRes.should.have.length(1)
      templatesRes.should.have.length(1)

      templatesRes[0]._id.should.be.eql(t1._id)
      templatesRes[0].shortid.should.be.eql(t1.shortid)
      templatesRes[0].name.should.be.eql(t1.name)
      templatesRes[0].folder.shortid.should.be.eql(f1.shortid)
    })

    it('should produce entity update and keep references when both _id and humanReadableKey conflict on same folder level (import on root)', async () => {
      const d1 = await reporter.documentStore.collection('data').insert({
        name: 'data',
        dataJson: `{ "a": "a" }`
      })

      const t1 = await reporter.documentStore.collection('templates').insert({
        name: 'foo',
        engine: 'none',
        recipe: 'html',
        data: {
          shortid: d1.shortid
        }
      })

      const req = reporter.Request({})
      const { stream } = await reporter.export([d1._id.toString(), t1._id.toString()], req)
      const exportPath = await saveExportStream(reporter, stream)
      await reporter.documentStore.collection('data').remove({})
      await reporter.documentStore.collection('templates').remove({})

      await reporter.documentStore.collection('data').insert({
        _id: d1._id,
        name: 'data2',
        shortid: d1.shortid,
        dataJson: `{ "a": "b" }`
      })

      await reporter.import(exportPath, req)

      const templatesRes = await reporter.documentStore.collection('templates').find({})
      const dataEntitiesRes = await reporter.documentStore.collection('data').find({})

      dataEntitiesRes.should.have.length(1)
      templatesRes.should.have.length(1)

      dataEntitiesRes[0]._id.should.be.eql(d1._id)
      dataEntitiesRes[0].shortid.should.be.eql(d1.shortid)
      dataEntitiesRes[0].name.should.be.eql(d1.name)
      JSON.parse(dataEntitiesRes[0].dataJson).a.should.be.eql('a')
      templatesRes[0].name.should.be.eql('foo')
      templatesRes[0].data.shortid.should.be.eql(d1.shortid)
    })

    it('should produce entity update and keep references when both _id and humanReadableKey conflict on same folder level (import on folder)', async () => {
      const d1 = await reporter.documentStore.collection('data').insert({
        name: 'data',
        dataJson: `{ "a": "a" }`
      })

      const t1 = await reporter.documentStore.collection('templates').insert({
        name: 'foo',
        engine: 'none',
        recipe: 'html',
        data: {
          shortid: d1.shortid
        }
      })

      const req = reporter.Request({})
      const { stream } = await reporter.export([d1._id.toString(), t1._id.toString()], req)
      const exportPath = await saveExportStream(reporter, stream)
      await reporter.documentStore.collection('data').remove({})
      await reporter.documentStore.collection('templates').remove({})

      const f1 = await reporter.documentStore.collection('folders').insert({
        name: 'folder',
        shortid: 'folder'
      })

      await reporter.documentStore.collection('data').insert({
        _id: d1._id,
        name: 'data2',
        shortid: d1.shortid,
        dataJson: `{ "a": "b" }`,
        folder: {
          shortid: f1.shortid
        }
      })

      await reporter.import(exportPath, {
        targetFolder: f1.shortid
      }, req)

      const templatesRes = await reporter.documentStore.collection('templates').find({})
      const dataEntitiesRes = await reporter.documentStore.collection('data').find({})

      dataEntitiesRes.should.have.length(1)
      templatesRes.should.have.length(1)

      dataEntitiesRes[0]._id.should.be.eql(d1._id)
      dataEntitiesRes[0].shortid.should.be.eql(d1.shortid)
      dataEntitiesRes[0].name.should.be.eql(d1.name)
      JSON.parse(dataEntitiesRes[0].dataJson).a.should.be.eql('a')
      dataEntitiesRes[0].folder.shortid.should.be.eql(f1.shortid)
      templatesRes[0].name.should.be.eql(t1.name)
      templatesRes[0].data.shortid.should.be.eql(d1.shortid)
      templatesRes[0].folder.shortid.should.be.eql(f1.shortid)
    })

    it('should produce entity insert when both _id and humanReadableKey conflict on different folder level (import on root)', async () => {
      const t1 = await reporter.documentStore.collection('templates').insert({
        name: 'foo',
        engine: 'none',
        recipe: 'html'
      })

      const req = reporter.Request({})
      const { stream } = await reporter.export([t1._id.toString()], req)
      const exportPath = await saveExportStream(reporter, stream)
      await reporter.documentStore.collection('templates').remove({})

      const f1 = await reporter.documentStore.collection('folders').insert({ name: 'folder', shortid: 'folder' })

      await reporter.documentStore.collection('templates').insert({
        _id: t1._id,
        name: 'bar',
        shortid: t1.shortid,
        engine: 'none',
        recipe: 'html',
        folder: {
          shortid: f1.shortid
        }
      })

      await reporter.import(exportPath, req)

      const foldersRes = await reporter.documentStore.collection('folders').find({})
      const templatesRes = await reporter.documentStore.collection('templates').find({})

      foldersRes.should.have.length(1)
      templatesRes.should.have.length(2)

      templatesRes[0]._id.should.be.not.eql(templatesRes[1]._id)
      templatesRes[0].shortid.should.be.not.eql(templatesRes[1].shortid)
      templatesRes.should.matchAny((t) => t.name.should.be.eql('bar') && t._id.should.be.eql(t1._id) && t.shortid.should.be.eql(t1.shortid) && t.folder.shortid.should.be.eql(f1.shortid))
      templatesRes.should.matchAny((t) => t.name.should.be.eql('foo') && should(t.folder).be.not.ok())
    })

    it('should produce entity insert when both _id and humanReadableKey conflict on different folder level (import on folder)', async () => {
      const t1 = await reporter.documentStore.collection('templates').insert({
        name: 'foo',
        engine: 'none',
        recipe: 'html'
      })

      const req = reporter.Request({})
      const { stream } = await reporter.export([t1._id.toString()], req)
      const exportPath = await saveExportStream(reporter, stream)
      await reporter.documentStore.collection('templates').remove({})

      await reporter.documentStore.collection('templates').insert({
        _id: t1._id,
        name: 'bar',
        shortid: t1.shortid,
        engine: 'none',
        recipe: 'html'
      })

      const f1 = await reporter.documentStore.collection('folders').insert({ name: 'folder', shortid: 'folder' })

      await reporter.import(exportPath, {
        targetFolder: f1.shortid
      }, req)

      const foldersRes = await reporter.documentStore.collection('folders').find({})
      const templatesRes = await reporter.documentStore.collection('templates').find({})

      foldersRes.should.have.length(1)
      templatesRes.should.have.length(2)

      templatesRes[0]._id.should.be.not.eql(templatesRes[1]._id)
      templatesRes[0].shortid.should.be.not.eql(templatesRes[1].shortid)
      templatesRes.should.matchAny((t) => t.name.should.be.eql('bar') && should(t.folder).be.not.ok())
      templatesRes.should.matchAny((t) => t.name.should.be.eql('foo') && t.folder.shortid.should.be.eql(f1.shortid))
    })

    it('should produce entity insert and updated references when both _id and humanReadableKey conflict on different folder level (import on root)', async () => {
      const d1 = await reporter.documentStore.collection('data').insert({
        name: 'data',
        dataJson: `{ "a": "a" }`
      })

      const t1 = await reporter.documentStore.collection('templates').insert({
        name: 'foo',
        engine: 'none',
        recipe: 'html',
        data: {
          shortid: d1.shortid
        }
      })

      const req = reporter.Request({})
      const { stream } = await reporter.export([d1._id.toString(), t1._id.toString()], req)
      const exportPath = await saveExportStream(reporter, stream)
      await reporter.documentStore.collection('data').remove({})
      await reporter.documentStore.collection('templates').remove({})

      const f1 = await reporter.documentStore.collection('folders').insert({
        name: 'folder',
        shortid: 'folder'
      })

      await reporter.documentStore.collection('data').insert({
        _id: d1._id,
        name: 'data2',
        shortid: d1.shortid,
        dataJson: `{ "a": "b" }`,
        folder: {
          shortid: f1.shortid
        }
      })

      await reporter.import(exportPath, req)

      const templatesRes = await reporter.documentStore.collection('templates').find({})
      const dataEntitiesRes = await reporter.documentStore.collection('data').find({})

      dataEntitiesRes.should.have.length(2)
      templatesRes.should.have.length(1)

      dataEntitiesRes[0]._id.should.not.be.eql(dataEntitiesRes[1]._id)
      dataEntitiesRes[0].shortid.should.not.be.eql(dataEntitiesRes[1].shortid)

      dataEntitiesRes.should.matchAny((d) => (
        d.name.should.be.eql('data') &&
        should(d.folder).be.not.ok() &&
        JSON.parse(d.dataJson).a.should.be.eql('a')
      ))

      dataEntitiesRes.should.matchAny((d) => (
        d.name.should.be.eql('data2') &&
        d.folder.shortid.should.be.eql(f1.shortid) &&
        JSON.parse(d.dataJson).a.should.be.eql('b')
      ))

      templatesRes[0].data.shortid.should.be.eql(dataEntitiesRes.find((d) => d.name === 'data').shortid)
    })

    it('should produce entity insert and updated references when both _id and humanReadableKey conflict on different folder level (import on folder)', async () => {
      const d1 = await reporter.documentStore.collection('data').insert({
        name: 'data',
        dataJson: `{ "a": "a" }`
      })

      const t1 = await reporter.documentStore.collection('templates').insert({
        name: 'foo',
        engine: 'none',
        recipe: 'html',
        data: {
          shortid: d1.shortid
        }
      })

      const req = reporter.Request({})
      const { stream } = await reporter.export([d1._id.toString(), t1._id.toString()], req)
      const exportPath = await saveExportStream(reporter, stream)
      await reporter.documentStore.collection('data').remove({})
      await reporter.documentStore.collection('templates').remove({})

      const f1 = await reporter.documentStore.collection('folders').insert({
        name: 'folder',
        shortid: 'folder'
      })

      await reporter.documentStore.collection('data').insert({
        _id: d1._id,
        name: 'data2',
        shortid: d1.shortid,
        dataJson: `{ "a": "b" }`
      })

      await reporter.import(exportPath, {
        targetFolder: f1.shortid
      }, req)

      const templatesRes = await reporter.documentStore.collection('templates').find({})
      const dataEntitiesRes = await reporter.documentStore.collection('data').find({})

      dataEntitiesRes.should.have.length(2)
      templatesRes.should.have.length(1)

      dataEntitiesRes[0]._id.should.not.be.eql(dataEntitiesRes[1]._id)
      dataEntitiesRes[0].shortid.should.not.be.eql(dataEntitiesRes[1].shortid)

      dataEntitiesRes.should.matchAny((d) => (
        d.name.should.be.eql('data') &&
        d.folder.shortid.should.be.eql(f1.shortid) &&
        JSON.parse(d.dataJson).a.should.be.eql('a')
      ))

      dataEntitiesRes.should.matchAny((d) => (
        d.name.should.be.eql('data2') &&
        should(d.folder).be.not.ok() &&
        JSON.parse(d.dataJson).a.should.be.eql('b')
      ))

      templatesRes[0].folder.shortid.should.be.eql(f1.shortid)
      templatesRes[0].data.shortid.should.be.eql(dataEntitiesRes.find((d) => d.name === 'data').shortid)
    })

    it('should produce updated references when no humanReadableKey conflict but entities referenced in conflict', async () => {
      const d1 = await reporter.documentStore.collection('data').insert({
        name: 'data',
        dataJson: `{ "a": "a" }`
      })

      const t1 = await reporter.documentStore.collection('templates').insert({
        name: 'foo',
        engine: 'none',
        recipe: 'html',
        data: {
          shortid: d1.shortid
        }
      })

      const req = reporter.Request({})
      const { stream } = await reporter.export([d1._id.toString(), t1._id.toString()], req)
      const exportPath = await saveExportStream(reporter, stream)
      await reporter.documentStore.collection('data').remove({})
      await reporter.documentStore.collection('templates').remove({})

      const f1 = await reporter.documentStore.collection('folders').insert({
        name: 'folder',
        shortid: 'folder'
      })

      await reporter.documentStore.collection('data').insert({
        _id: d1._id,
        name: 'data2',
        shortid: d1.shortid,
        dataJson: `{ "a": "b" }`,
        folder: {
          shortid: f1.shortid
        }
      })

      await reporter.import(exportPath, req)

      const templatesRes = await reporter.documentStore.collection('templates').find({})
      const dataEntitiesRes = await reporter.documentStore.collection('data').find({})

      dataEntitiesRes.should.have.length(2)
      templatesRes.should.have.length(1)

      dataEntitiesRes[0]._id.should.not.be.eql(dataEntitiesRes[1]._id)
      dataEntitiesRes[0].shortid.should.not.be.eql(dataEntitiesRes[1].shortid)

      dataEntitiesRes.should.matchAny((d) => (
        d.name.should.be.eql('data') &&
        should(d.folder).be.not.ok() &&
        JSON.parse(d.dataJson).a.should.be.eql('a')
      ))

      dataEntitiesRes.should.matchAny((d) => (
        d.name.should.be.eql('data2') &&
        d.folder.shortid.should.be.eql(f1.shortid) &&
        JSON.parse(d.dataJson).a.should.be.eql('b')
      ))

      templatesRes[0].data.shortid.should.not.be.eql(d1.shortid)
      templatesRes[0].data.shortid.should.be.eql(dataEntitiesRes.find((d) => d.name === 'data').shortid)
    })
  })

  describe('when entity path conflict', () => {
    it('should produce entity update when _id conflict on same folder level (import on root)', async () => {
      const t1 = await reporter.documentStore.collection('templates').insert({
        name: 'foo',
        engine: 'none',
        recipe: 'html'
      })

      const req = reporter.Request({})
      const { stream } = await reporter.export([t1._id.toString()], req)
      const exportPath = await saveExportStream(reporter, stream)
      await reporter.documentStore.collection('templates').remove({})

      await reporter.documentStore.collection('templates').insert({
        _id: t1._id,
        name: 'foo',
        engine: 'none',
        recipe: 'html'
      })

      await reporter.import(exportPath, req)

      const templatesRes = await reporter.documentStore.collection('templates').find({})

      templatesRes.should.have.length(1)

      templatesRes[0]._id.should.be.eql(t1._id)
      templatesRes[0].name.should.be.eql(t1.name)
    })

    it('should produce entity update when _id conflict on same folder level (import on folder)', async () => {
      const t1 = await reporter.documentStore.collection('templates').insert({
        name: 'foo',
        engine: 'none',
        recipe: 'html'
      })

      const req = reporter.Request({})
      const { stream } = await reporter.export([t1._id.toString()], req)
      const exportPath = await saveExportStream(reporter, stream)
      await reporter.documentStore.collection('templates').remove({})

      const f1 = await reporter.documentStore.collection('folders').insert({ name: 'folder', shortid: 'folder' })

      await reporter.documentStore.collection('templates').insert({
        _id: t1._id,
        name: 'foo',
        engine: 'none',
        recipe: 'html',
        folder: {
          shortid: f1.shortid
        }
      })

      await reporter.import(exportPath, {
        targetFolder: f1.shortid
      }, req)

      const foldersRes = await reporter.documentStore.collection('folders').find({})
      const templatesRes = await reporter.documentStore.collection('templates').find({})

      foldersRes.should.have.length(1)
      templatesRes.should.have.length(1)

      templatesRes[0]._id.should.be.eql(t1._id)
      templatesRes.should.matchAny((t) => t.name.should.be.eql('foo') && t.folder.shortid.should.be.eql(f1.shortid))
    })

    it('should produce entity update when _id conflict on different folder level (import on root)', async () => {
      const t1 = await reporter.documentStore.collection('templates').insert({
        name: 'foo',
        engine: 'handlebars',
        recipe: 'html'
      })

      const req = reporter.Request({})
      const { stream } = await reporter.export([t1._id.toString()], req)
      const exportPath = await saveExportStream(reporter, stream)
      await reporter.documentStore.collection('templates').remove({})

      const f1 = await reporter.documentStore.collection('folders').insert({ name: 'folder', shortid: 'folder' })

      await reporter.documentStore.collection('templates').insert({
        _id: t1._id,
        name: 'bar',
        engine: 'none',
        recipe: 'html',
        folder: {
          shortid: f1.shortid
        }
      })

      await reporter.documentStore.collection('templates').insert({
        name: 'foo',
        engine: 'none',
        recipe: 'html'
      })

      await reporter.import(exportPath, req)

      const foldersRes = await reporter.documentStore.collection('folders').find({})
      const templatesRes = await reporter.documentStore.collection('templates').find({})

      foldersRes.should.have.length(1)
      templatesRes.should.have.length(2)

      templatesRes[0]._id.should.be.not.eql(templatesRes[1]._id)

      templatesRes.should.matchAny((t) => t.name.should.be.eql('bar') && t.folder.shortid.should.be.eql(f1.shortid))

      templatesRes.should.matchAny((t) => (
        t.name.should.be.eql('foo') &&
        t._id.should.be.not.eql(t1._id) &&
        t.engine.should.be.eql(t1.engine) &&
        should(t.folder).be.not.ok()
      ))
    })

    it('should produce entity update when _id conflict on different folder level (import on folder)', async () => {
      const t1 = await reporter.documentStore.collection('templates').insert({
        name: 'foo',
        engine: 'handlebars',
        recipe: 'html'
      })

      const req = reporter.Request({})
      const { stream } = await reporter.export([t1._id.toString()], req)
      const exportPath = await saveExportStream(reporter, stream)
      await reporter.documentStore.collection('templates').remove({})

      await reporter.documentStore.collection('templates').insert({
        _id: t1._id,
        name: 'bar',
        engine: 'none',
        recipe: 'html'
      })

      const f1 = await reporter.documentStore.collection('folders').insert({ name: 'folder', shortid: 'folder' })

      await reporter.documentStore.collection('templates').insert({
        name: 'foo',
        engine: 'none',
        recipe: 'html',
        folder: {
          shortid: f1.shortid
        }
      })

      await reporter.import(exportPath, {
        targetFolder: f1.shortid
      }, req)

      const foldersRes = await reporter.documentStore.collection('folders').find({})
      const templatesRes = await reporter.documentStore.collection('templates').find({})

      foldersRes.should.have.length(1)
      templatesRes.should.have.length(2)

      templatesRes[0]._id.should.be.not.eql(templatesRes[1]._id)

      templatesRes.should.matchAny((t) => t.name.should.be.eql('bar') && should(t.folder).be.not.ok())

      templatesRes.should.matchAny((t) => (
        t.name.should.be.eql('foo') &&
        t._id.should.be.not.eql(t1._id) &&
        t.engine.should.be.eql(t1.engine) &&
        t.folder.shortid.should.be.eql(f1.shortid)
      ))
    })

    it('should produce entity update when humanReadableKey conflict on same folder level (import on root)', async () => {
      const t1 = await reporter.documentStore.collection('templates').insert({
        name: 'foo',
        engine: 'handlebars',
        recipe: 'html'
      })

      const req = reporter.Request({})
      const { stream } = await reporter.export([t1._id.toString()], req)
      const exportPath = await saveExportStream(reporter, stream)
      await reporter.documentStore.collection('templates').remove({})

      await reporter.documentStore.collection('templates').insert({
        name: 'foo',
        shortid: t1.shortid,
        engine: 'none',
        recipe: 'html'
      })

      await reporter.import(exportPath, req)

      const templatesRes = await reporter.documentStore.collection('templates').find({})

      templatesRes.should.have.length(1)

      templatesRes[0].name.should.be.eql('foo')
      templatesRes[0].shortid.should.be.eql(t1.shortid)
      templatesRes[0].engine.should.be.eql('handlebars')
    })

    it('should produce entity update when humanReadableKey conflict on same folder level (import on folder)', async () => {
      const t1 = await reporter.documentStore.collection('templates').insert({
        name: 'foo',
        engine: 'handlebars',
        recipe: 'html'
      })

      const req = reporter.Request({})
      const { stream } = await reporter.export([t1._id.toString()], req)
      const exportPath = await saveExportStream(reporter, stream)
      await reporter.documentStore.collection('templates').remove({})

      const f1 = await reporter.documentStore.collection('folders').insert({ name: 'folder', shortid: 'folder' })

      await reporter.documentStore.collection('templates').insert({
        name: 'foo',
        shortid: t1.shortid,
        engine: 'none',
        recipe: 'html',
        folder: {
          shortid: f1.shortid
        }
      })

      await reporter.import(exportPath, {
        targetFolder: f1.shortid
      }, req)

      const templatesRes = await reporter.documentStore.collection('templates').find({})

      templatesRes.should.have.length(1)

      templatesRes[0].name.should.be.eql('foo')
      templatesRes[0].shortid.should.be.eql(t1.shortid)
      templatesRes[0].engine.should.be.eql(t1.engine)
      templatesRes[0].folder.shortid.should.be.eql(f1.shortid)
    })

    it('should produce entity update and keep references when humanReadableKey conflict on same folder level (import on root)', async () => {
      const d1 = await reporter.documentStore.collection('data').insert({
        name: 'data',
        dataJson: `{ "a": "a" }`
      })

      const t1 = await reporter.documentStore.collection('templates').insert({
        name: 'foo',
        engine: 'none',
        recipe: 'html',
        data: {
          shortid: d1.shortid
        }
      })

      const req = reporter.Request({})
      const { stream } = await reporter.export([d1._id.toString(), t1._id.toString()], req)
      const exportPath = await saveExportStream(reporter, stream)
      await reporter.documentStore.collection('data').remove({})
      await reporter.documentStore.collection('templates').remove({})

      await reporter.documentStore.collection('data').insert({
        name: 'data',
        shortid: d1.shortid,
        dataJson: `{ "a": "b" }`
      })

      await reporter.import(exportPath, req)

      const templatesRes = await reporter.documentStore.collection('templates').find({})
      const dataEntitiesRes = await reporter.documentStore.collection('data').find({})

      dataEntitiesRes.should.have.length(1)
      templatesRes.should.have.length(1)

      dataEntitiesRes[0].name.should.be.eql('data')
      dataEntitiesRes[0].shortid.should.be.eql(d1.shortid)
      JSON.parse(dataEntitiesRes[0].dataJson).a.should.be.eql('a')
      templatesRes[0].name.should.be.eql('foo')
      templatesRes[0].data.shortid.should.be.eql(d1.shortid)
    })

    it('should produce entity update and keep references when humanReadableKey conflict on same folder level (import on folder)', async () => {
      const d1 = await reporter.documentStore.collection('data').insert({
        name: 'data',
        dataJson: `{ "a": "a" }`
      })

      const t1 = await reporter.documentStore.collection('templates').insert({
        name: 'foo',
        engine: 'none',
        recipe: 'html',
        data: {
          shortid: d1.shortid
        }
      })

      const req = reporter.Request({})
      const { stream } = await reporter.export([d1._id.toString(), t1._id.toString()], req)
      const exportPath = await saveExportStream(reporter, stream)
      await reporter.documentStore.collection('data').remove({})
      await reporter.documentStore.collection('templates').remove({})

      const f1 = await reporter.documentStore.collection('folders').insert({
        name: 'folder',
        shortid: 'folder'
      })

      await reporter.documentStore.collection('data').insert({
        name: 'data',
        shortid: d1.shortid,
        dataJson: `{ "a": "b" }`,
        folder: {
          shortid: f1.shortid
        }
      })

      await reporter.import(exportPath, {
        targetFolder: f1.shortid
      }, req)

      const templatesRes = await reporter.documentStore.collection('templates').find({})
      const dataEntitiesRes = await reporter.documentStore.collection('data').find({})

      dataEntitiesRes.should.have.length(1)
      templatesRes.should.have.length(1)

      dataEntitiesRes[0].name.should.be.eql('data')
      dataEntitiesRes[0].shortid.should.be.eql(d1.shortid)
      JSON.parse(dataEntitiesRes[0].dataJson).a.should.be.eql('a')
      dataEntitiesRes[0].folder.shortid.should.be.eql(f1.shortid)
      templatesRes[0].name.should.be.eql('foo')
      templatesRes[0].data.shortid.should.be.eql(d1.shortid)
      templatesRes[0].folder.shortid.should.be.eql(f1.shortid)
    })

    it('should produce entity update when humanReadableKey conflict on different folder level (import on root)', async () => {
      const t1 = await reporter.documentStore.collection('templates').insert({
        name: 'foo',
        engine: 'handlebars',
        recipe: 'html'
      })

      const req = reporter.Request({})
      const { stream } = await reporter.export([t1._id.toString()], req)
      const exportPath = await saveExportStream(reporter, stream)
      await reporter.documentStore.collection('templates').remove({})

      const f1 = await reporter.documentStore.collection('folders').insert({ name: 'folder', shortid: 'folder' })

      await reporter.documentStore.collection('templates').insert({
        name: 'bar',
        shortid: t1.shortid,
        engine: 'none',
        recipe: 'html',
        folder: {
          shortid: f1.shortid
        }
      })

      await reporter.documentStore.collection('templates').insert({
        name: 'foo',
        engine: 'none',
        recipe: 'html'
      })

      await reporter.import(exportPath, req)

      const foldersRes = await reporter.documentStore.collection('folders').find({})
      const templatesRes = await reporter.documentStore.collection('templates').find({})

      foldersRes.should.have.length(1)
      templatesRes.should.have.length(2)

      templatesRes[0].shortid.should.be.not.eql(templatesRes[1].shortid)

      templatesRes.should.matchAny((t) => t.name.should.be.eql('bar') && t.folder.shortid.should.be.eql(f1.shortid))

      templatesRes.should.matchAny((t) => (
        t.name.should.be.eql('foo') &&
        t._id.should.be.not.eql(t1._id) &&
        t.engine.should.be.eql(t1.engine) &&
        should(t.folder).be.not.ok()
      ))
    })

    it('should produce entity update when humanReadableKey conflict on different folder level (import on folder)', async () => {
      const t1 = await reporter.documentStore.collection('templates').insert({
        name: 'foo',
        engine: 'handlebars',
        recipe: 'html'
      })

      const req = reporter.Request({})
      const { stream } = await reporter.export([t1._id.toString()], req)
      const exportPath = await saveExportStream(reporter, stream)
      await reporter.documentStore.collection('templates').remove({})

      await reporter.documentStore.collection('templates').insert({
        name: 'bar',
        shortid: t1.shortid,
        engine: 'none',
        recipe: 'html'
      })

      const f1 = await reporter.documentStore.collection('folders').insert({ name: 'folder', shortid: 'folder' })

      await reporter.documentStore.collection('templates').insert({
        name: 'foo',
        engine: 'none',
        recipe: 'html',
        folder: {
          shortid: f1.shortid
        }
      })

      await reporter.import(exportPath, {
        targetFolder: f1.shortid
      }, req)

      const foldersRes = await reporter.documentStore.collection('folders').find({})
      const templatesRes = await reporter.documentStore.collection('templates').find({})

      foldersRes.should.have.length(1)
      templatesRes.should.have.length(2)

      templatesRes[0].shortid.should.be.not.eql(templatesRes[1].shortid)

      templatesRes.should.matchAny((t) => t.name.should.be.eql('bar') && should(t.folder).be.not.ok())

      templatesRes.should.matchAny((t) => (
        t.name.should.be.eql('foo') &&
        t._id.should.be.not.eql(t1._id) &&
        t.engine.should.be.eql(t1.engine) &&
        t.folder.shortid.should.be.eql(f1.shortid)
      ))
    })

    it('should produce entity update and updated references when humanReadableKey conflict on different folder level (import on root)', async () => {
      const d1 = await reporter.documentStore.collection('data').insert({
        name: 'data',
        dataJson: `{ "a": "a" }`
      })

      const t1 = await reporter.documentStore.collection('templates').insert({
        name: 'foo',
        engine: 'none',
        recipe: 'html',
        data: {
          shortid: d1.shortid
        }
      })

      const req = reporter.Request({})
      const { stream } = await reporter.export([d1._id.toString(), t1._id.toString()], req)
      const exportPath = await saveExportStream(reporter, stream)
      await reporter.documentStore.collection('data').remove({})
      await reporter.documentStore.collection('templates').remove({})

      const f1 = await reporter.documentStore.collection('folders').insert({
        name: 'folder',
        shortid: 'folder'
      })

      await reporter.documentStore.collection('data').insert({
        name: 'data',
        dataJson: `{ "a": "b" }`
      })

      await reporter.documentStore.collection('data').insert({
        name: 'data2',
        shortid: d1.shortid,
        dataJson: `{ "a": "b" }`,
        folder: {
          shortid: f1.shortid
        }
      })

      await reporter.import(exportPath, req)

      const templatesRes = await reporter.documentStore.collection('templates').find({})
      const dataEntitiesRes = await reporter.documentStore.collection('data').find({})

      dataEntitiesRes.should.have.length(2)
      templatesRes.should.have.length(1)

      dataEntitiesRes[0].shortid.should.not.be.eql(dataEntitiesRes[1].shortid)

      dataEntitiesRes.should.matchAny((d) => (
        d.name.should.be.eql('data') &&
        should(d.folder).be.not.ok() &&
        JSON.parse(d.dataJson).a.should.be.eql('a')
      ))

      dataEntitiesRes.should.matchAny((d) => (
        d.name.should.be.eql('data2') &&
        d.folder.shortid.should.be.eql(f1.shortid) &&
        JSON.parse(d.dataJson).a.should.be.eql('b')
      ))

      templatesRes[0].data.shortid.should.be.not.eql(d1.shortid)
      templatesRes[0].data.shortid.should.be.eql(dataEntitiesRes.find((d) => d.name === 'data').shortid)
    })

    it('should produce entity update and updated references when humanReadableKey conflict on different folder level (import on folder)', async () => {
      const d1 = await reporter.documentStore.collection('data').insert({
        name: 'data',
        dataJson: `{ "a": "a" }`
      })

      const t1 = await reporter.documentStore.collection('templates').insert({
        name: 'foo',
        engine: 'none',
        recipe: 'html',
        data: {
          shortid: d1.shortid
        }
      })

      const req = reporter.Request({})
      const { stream } = await reporter.export([d1._id.toString(), t1._id.toString()], req)
      const exportPath = await saveExportStream(reporter, stream)
      await reporter.documentStore.collection('data').remove({})
      await reporter.documentStore.collection('templates').remove({})

      const f1 = await reporter.documentStore.collection('folders').insert({
        name: 'folder',
        shortid: 'folder'
      })

      await reporter.documentStore.collection('data').insert({
        name: 'data',
        dataJson: `{ "a": "b" }`,
        folder: {
          shortid: f1.shortid
        }
      })

      await reporter.documentStore.collection('data').insert({
        name: 'data2',
        shortid: d1.shortid,
        dataJson: `{ "a": "b" }`
      })

      await reporter.import(exportPath, {
        targetFolder: f1.shortid
      }, req)

      const templatesRes = await reporter.documentStore.collection('templates').find({})
      const dataEntitiesRes = await reporter.documentStore.collection('data').find({})

      dataEntitiesRes.should.have.length(2)
      templatesRes.should.have.length(1)

      dataEntitiesRes[0].shortid.should.not.be.eql(dataEntitiesRes[1].shortid)

      dataEntitiesRes.should.matchAny((d) => (
        d.name.should.be.eql('data') &&
        JSON.parse(d.dataJson).a.should.be.eql('a') &&
        d.folder.shortid.should.be.eql(f1.shortid)
      ))

      dataEntitiesRes.should.matchAny((d) => (
        d.name.should.be.eql('data2') &&
        JSON.parse(d.dataJson).a.should.be.eql('b') &&
        should(d.folder).be.not.ok()
      ))

      templatesRes[0].data.shortid.should.be.not.eql(d1.shortid)
      templatesRes[0].data.shortid.should.be.eql(dataEntitiesRes.find((d) => d.name === 'data').shortid)
    })

    it('should produce entity update when both _id and humanReadableKey conflict on same folder level (import on root)', async () => {
      const t1 = await reporter.documentStore.collection('templates').insert({
        name: 'foo',
        engine: 'handlebars',
        recipe: 'html'
      })

      const req = reporter.Request({})
      const { stream } = await reporter.export([t1._id.toString()], req)
      const exportPath = await saveExportStream(reporter, stream)
      await reporter.documentStore.collection('templates').remove({})

      await reporter.documentStore.collection('templates').insert({
        _id: t1._id,
        name: 'foo',
        shortid: t1.shortid,
        engine: 'none',
        recipe: 'html'
      })

      await reporter.import(exportPath, req)

      const templatesRes = await reporter.documentStore.collection('templates').find({})

      templatesRes.should.have.length(1)

      templatesRes[0].name.should.be.eql('foo')
      templatesRes[0]._id.should.be.eql(t1._id)
      templatesRes[0].shortid.should.be.eql(t1.shortid)
      templatesRes[0].engine.should.be.eql('handlebars')
    })

    it('should produce entity update when both _id and humanReadableKey conflict on same folder level (import on folder)', async () => {
      const t1 = await reporter.documentStore.collection('templates').insert({
        name: 'foo',
        engine: 'handlebars',
        recipe: 'html'
      })

      const req = reporter.Request({})
      const { stream } = await reporter.export([t1._id.toString()], req)
      const exportPath = await saveExportStream(reporter, stream)
      await reporter.documentStore.collection('templates').remove({})

      const f1 = await reporter.documentStore.collection('folders').insert({ name: 'folder', shortid: 'folder' })

      await reporter.documentStore.collection('templates').insert({
        _id: t1._id,
        name: 'foo',
        shortid: t1.shortid,
        engine: 'none',
        recipe: 'html',
        folder: {
          shortid: f1.shortid
        }
      })

      await reporter.import(exportPath, {
        targetFolder: f1.shortid
      }, req)

      const templatesRes = await reporter.documentStore.collection('templates').find({})

      templatesRes.should.have.length(1)

      templatesRes[0].name.should.be.eql('foo')
      templatesRes[0]._id.should.be.eql(t1._id)
      templatesRes[0].shortid.should.be.eql(t1.shortid)
      templatesRes[0].engine.should.be.eql(t1.engine)
      templatesRes[0].folder.shortid.should.be.eql(f1.shortid)
    })

    it('should produce entity update and keep references when both _id and humanReadableKey conflict on same folder level (import on root)', async () => {
      const d1 = await reporter.documentStore.collection('data').insert({
        name: 'data',
        dataJson: `{ "a": "a" }`
      })

      const t1 = await reporter.documentStore.collection('templates').insert({
        name: 'foo',
        engine: 'none',
        recipe: 'html',
        data: {
          shortid: d1.shortid
        }
      })

      const req = reporter.Request({})
      const { stream } = await reporter.export([d1._id.toString(), t1._id.toString()], req)
      const exportPath = await saveExportStream(reporter, stream)
      await reporter.documentStore.collection('data').remove({})
      await reporter.documentStore.collection('templates').remove({})

      await reporter.documentStore.collection('data').insert({
        _id: d1._id,
        name: 'data',
        shortid: d1.shortid,
        dataJson: `{ "a": "b" }`
      })

      await reporter.import(exportPath, req)

      const templatesRes = await reporter.documentStore.collection('templates').find({})
      const dataEntitiesRes = await reporter.documentStore.collection('data').find({})

      dataEntitiesRes.should.have.length(1)
      templatesRes.should.have.length(1)

      dataEntitiesRes[0].name.should.be.eql('data')
      dataEntitiesRes[0]._id.should.be.eql(d1._id)
      dataEntitiesRes[0].shortid.should.be.eql(d1.shortid)
      JSON.parse(dataEntitiesRes[0].dataJson).a.should.be.eql('a')
      templatesRes[0].name.should.be.eql('foo')
      templatesRes[0].data.shortid.should.be.eql(d1.shortid)
    })

    it('should produce entity update and keep references when both _id and humanReadableKey conflict on same folder level (import on folder)', async () => {
      const d1 = await reporter.documentStore.collection('data').insert({
        name: 'data',
        dataJson: `{ "a": "a" }`
      })

      const t1 = await reporter.documentStore.collection('templates').insert({
        name: 'foo',
        engine: 'none',
        recipe: 'html',
        data: {
          shortid: d1.shortid
        }
      })

      const req = reporter.Request({})
      const { stream } = await reporter.export([d1._id.toString(), t1._id.toString()], req)
      const exportPath = await saveExportStream(reporter, stream)
      await reporter.documentStore.collection('data').remove({})
      await reporter.documentStore.collection('templates').remove({})

      const f1 = await reporter.documentStore.collection('folders').insert({
        name: 'folder',
        shortid: 'folder'
      })

      await reporter.documentStore.collection('data').insert({
        _id: d1._id,
        name: 'data',
        shortid: d1.shortid,
        dataJson: `{ "a": "b" }`,
        folder: {
          shortid: f1.shortid
        }
      })

      await reporter.import(exportPath, {
        targetFolder: f1.shortid
      }, req)

      const templatesRes = await reporter.documentStore.collection('templates').find({})
      const dataEntitiesRes = await reporter.documentStore.collection('data').find({})

      dataEntitiesRes.should.have.length(1)
      templatesRes.should.have.length(1)

      dataEntitiesRes[0].name.should.be.eql('data')
      dataEntitiesRes[0]._id.should.be.eql(d1._id)
      dataEntitiesRes[0].shortid.should.be.eql(d1.shortid)
      JSON.parse(dataEntitiesRes[0].dataJson).a.should.be.eql('a')
      dataEntitiesRes[0].folder.shortid.should.be.eql(f1.shortid)
      templatesRes[0].name.should.be.eql('foo')
      templatesRes[0].data.shortid.should.be.eql(d1.shortid)
      templatesRes[0].folder.shortid.should.be.eql(f1.shortid)
    })

    it('should produce entity update when both _id and humanReadableKey conflict on different folder level (import on root)', async () => {
      const t1 = await reporter.documentStore.collection('templates').insert({
        name: 'foo',
        engine: 'handlebars',
        recipe: 'html'
      })

      const req = reporter.Request({})
      const { stream } = await reporter.export([t1._id.toString()], req)
      const exportPath = await saveExportStream(reporter, stream)
      await reporter.documentStore.collection('templates').remove({})

      const f1 = await reporter.documentStore.collection('folders').insert({ name: 'folder', shortid: 'folder' })

      await reporter.documentStore.collection('templates').insert({
        _id: t1._id,
        name: 'bar',
        shortid: t1.shortid,
        engine: 'none',
        recipe: 'html',
        folder: {
          shortid: f1.shortid
        }
      })

      await reporter.documentStore.collection('templates').insert({
        name: 'foo',
        engine: 'none',
        recipe: 'html'
      })

      await reporter.import(exportPath, req)

      const foldersRes = await reporter.documentStore.collection('folders').find({})
      const templatesRes = await reporter.documentStore.collection('templates').find({})

      foldersRes.should.have.length(1)
      templatesRes.should.have.length(2)

      templatesRes[0]._id.should.be.not.eql(templatesRes[1]._id)
      templatesRes[0].shortid.should.be.not.eql(templatesRes[1].shortid)

      templatesRes.should.matchAny((t) => (
        t.name.should.be.eql('bar') &&
        t._id.should.be.eql(t1._id) &&
        t.shortid.should.be.eql(t1.shortid) &&
        t.folder.shortid.should.be.eql(f1.shortid)
      ))

      templatesRes.should.matchAny((t) => (
        t.name.should.be.eql('foo') &&
        t._id.should.be.not.eql(t1._id) &&
        t.shortid.should.be.not.eql(t1.shortid) &&
        t.engine.should.be.eql(t1.engine) &&
        should(t.folder).be.not.ok()
      ))
    })

    it('should produce entity update when both _id and humanReadableKey conflict on different folder level (import on folder)', async () => {
      const t1 = await reporter.documentStore.collection('templates').insert({
        name: 'foo',
        engine: 'handlebars',
        recipe: 'html'
      })

      const req = reporter.Request({})
      const { stream } = await reporter.export([t1._id.toString()], req)
      const exportPath = await saveExportStream(reporter, stream)
      await reporter.documentStore.collection('templates').remove({})

      await reporter.documentStore.collection('templates').insert({
        _id: t1._id,
        name: 'bar',
        shortid: t1.shortid,
        engine: 'none',
        recipe: 'html'
      })

      const f1 = await reporter.documentStore.collection('folders').insert({ name: 'folder', shortid: 'folder' })

      await reporter.documentStore.collection('templates').insert({
        name: 'foo',
        engine: 'none',
        recipe: 'html',
        folder: {
          shortid: f1.shortid
        }
      })

      await reporter.import(exportPath, {
        targetFolder: f1.shortid
      }, req)

      const foldersRes = await reporter.documentStore.collection('folders').find({})
      const templatesRes = await reporter.documentStore.collection('templates').find({})

      foldersRes.should.have.length(1)
      templatesRes.should.have.length(2)

      templatesRes[0]._id.should.be.not.eql(templatesRes[1]._id)
      templatesRes[0].shortid.should.be.not.eql(templatesRes[1].shortid)

      templatesRes.should.matchAny((t) => (
        t.name.should.be.eql('bar') &&
        t._id.should.be.eql(t1._id) &&
        t.shortid.should.be.eql(t1.shortid) &&
        should(t.folder).be.not.ok()
      ))

      templatesRes.should.matchAny((t) => (
        t.name.should.be.eql('foo') &&
        t._id.should.be.not.eql(t1._id) &&
        t.shortid.should.be.not.eql(t1.shortid) &&
        t.engine.should.be.eql(t1.engine) &&
        t.folder.shortid.should.be.eql(f1.shortid)
      ))
    })

    it('should produce entity update and updated references when both _id and humanReadableKey conflict on different folder level (import on root)', async () => {
      const d1 = await reporter.documentStore.collection('data').insert({
        name: 'data',
        dataJson: `{ "a": "a" }`
      })

      const t1 = await reporter.documentStore.collection('templates').insert({
        name: 'foo',
        engine: 'none',
        recipe: 'html',
        data: {
          shortid: d1.shortid
        }
      })

      const req = reporter.Request({})
      const { stream } = await reporter.export([d1._id.toString(), t1._id.toString()], req)
      const exportPath = await saveExportStream(reporter, stream)
      await reporter.documentStore.collection('data').remove({})
      await reporter.documentStore.collection('templates').remove({})

      const f1 = await reporter.documentStore.collection('folders').insert({
        name: 'folder',
        shortid: 'folder'
      })

      await reporter.documentStore.collection('data').insert({
        name: 'data',
        dataJson: `{ "a": "b" }`
      })

      await reporter.documentStore.collection('data').insert({
        _id: d1._id,
        name: 'data2',
        shortid: d1.shortid,
        dataJson: `{ "a": "b" }`,
        folder: {
          shortid: f1.shortid
        }
      })

      await reporter.import(exportPath, req)

      const templatesRes = await reporter.documentStore.collection('templates').find({})
      const dataEntitiesRes = await reporter.documentStore.collection('data').find({})

      dataEntitiesRes.should.have.length(2)
      templatesRes.should.have.length(1)

      dataEntitiesRes[0]._id.should.not.be.eql(dataEntitiesRes[1]._id)
      dataEntitiesRes[0].shortid.should.not.be.eql(dataEntitiesRes[1].shortid)

      dataEntitiesRes.should.matchAny((d) => (
        d.name.should.be.eql('data') &&
        d._id.should.be.not.eql(d1._id) &&
        d.shortid.should.be.not.eql(d1.shortid) &&
        should(d.folder).be.not.ok() &&
        JSON.parse(d.dataJson).a.should.be.eql('a')
      ))

      dataEntitiesRes.should.matchAny((d) => (
        d.name.should.be.eql('data2') &&
        d.folder.shortid.should.be.eql(f1.shortid) &&
        JSON.parse(d.dataJson).a.should.be.eql('b')
      ))

      templatesRes[0].data.shortid.should.be.not.eql(d1.shortid)
      templatesRes[0].data.shortid.should.be.eql(dataEntitiesRes.find((d) => d.name === 'data').shortid)
    })

    it('should produce entity update and updated references when both _id and humanReadableKey conflict on different folder level (import on folder)', async () => {
      const d1 = await reporter.documentStore.collection('data').insert({
        name: 'data',
        dataJson: `{ "a": "a" }`
      })

      const t1 = await reporter.documentStore.collection('templates').insert({
        name: 'foo',
        engine: 'none',
        recipe: 'html',
        data: {
          shortid: d1.shortid
        }
      })

      const req = reporter.Request({})
      const { stream } = await reporter.export([d1._id.toString(), t1._id.toString()], req)
      const exportPath = await saveExportStream(reporter, stream)
      await reporter.documentStore.collection('data').remove({})
      await reporter.documentStore.collection('templates').remove({})

      const f1 = await reporter.documentStore.collection('folders').insert({
        name: 'folder',
        shortid: 'folder'
      })

      await reporter.documentStore.collection('data').insert({
        name: 'data',
        dataJson: `{ "a": "b" }`,
        folder: {
          shortid: f1.shortid
        }
      })

      await reporter.documentStore.collection('data').insert({
        _id: d1._id,
        name: 'data2',
        shortid: d1.shortid,
        dataJson: `{ "a": "b" }`
      })

      await reporter.import(exportPath, {
        targetFolder: f1.shortid
      }, req)

      const templatesRes = await reporter.documentStore.collection('templates').find({})
      const dataEntitiesRes = await reporter.documentStore.collection('data').find({})

      dataEntitiesRes.should.have.length(2)
      templatesRes.should.have.length(1)

      dataEntitiesRes[0]._id.should.not.be.eql(dataEntitiesRes[1]._id)
      dataEntitiesRes[0].shortid.should.not.be.eql(dataEntitiesRes[1].shortid)

      dataEntitiesRes.should.matchAny((d) => (
        d.name.should.be.eql('data') &&
        d._id.should.be.not.eql(d1._id) &&
        d.shortid.should.be.not.eql(d1.shortid) &&
        JSON.parse(d.dataJson).a.should.be.eql('a') &&
        d.folder.shortid.should.be.eql(f1.shortid)
      ))

      dataEntitiesRes.should.matchAny((d) => (
        d.name.should.be.eql('data2') &&
        JSON.parse(d.dataJson).a.should.be.eql('b') &&
        should(d.folder).be.not.ok()
      ))

      templatesRes[0].data.shortid.should.be.not.eql(d1.shortid)
      templatesRes[0].data.shortid.should.be.eql(dataEntitiesRes.find((d) => d.name === 'data').shortid)
    })

    it('should produce entity update and updated references when no humanReadableKey conflict but entities referenced in conflict', async () => {
      const d1 = await reporter.documentStore.collection('data').insert({
        name: 'data',
        dataJson: `{ "a": "a" }`
      })

      const t1 = await reporter.documentStore.collection('templates').insert({
        name: 'foo',
        engine: 'handlebars',
        recipe: 'html',
        data: {
          shortid: d1.shortid
        }
      })

      const req = reporter.Request({})
      const { stream } = await reporter.export([d1._id.toString(), t1._id.toString()], req)
      const exportPath = await saveExportStream(reporter, stream)
      await reporter.documentStore.collection('data').remove({})
      await reporter.documentStore.collection('templates').remove({})

      const f1 = await reporter.documentStore.collection('folders').insert({
        name: 'folder',
        shortid: 'folder'
      })

      await reporter.documentStore.collection('templates').insert({
        name: 'foo',
        engine: 'none',
        recipe: 'html'
      })

      await reporter.documentStore.collection('data').insert({
        name: 'data',
        dataJson: `{ "a": "b" }`
      })

      await reporter.documentStore.collection('data').insert({
        _id: d1._id,
        name: 'data2',
        shortid: d1.shortid,
        dataJson: `{ "a": "b" }`,
        folder: {
          shortid: f1.shortid
        }
      })

      await reporter.import(exportPath, req)

      const templatesRes = await reporter.documentStore.collection('templates').find({})
      const dataEntitiesRes = await reporter.documentStore.collection('data').find({})

      dataEntitiesRes.should.have.length(2)
      templatesRes.should.have.length(1)

      dataEntitiesRes[0]._id.should.not.be.eql(dataEntitiesRes[1]._id)
      dataEntitiesRes[0].shortid.should.not.be.eql(dataEntitiesRes[1].shortid)

      dataEntitiesRes.should.matchAny((d) => (
        d.name.should.be.eql('data') &&
        d._id.should.be.not.eql(d1._id) &&
        d.shortid.should.be.not.eql(d1.shortid) &&
        should(d.folder).be.not.ok() &&
        JSON.parse(d.dataJson).a.should.be.eql('a')
      ))

      dataEntitiesRes.should.matchAny((d) => (
        d.name.should.be.eql('data2') &&
        d._id.should.be.eql(d1._id) &&
        d.shortid.should.be.eql(d1.shortid) &&
        d.folder.shortid.should.be.eql(f1.shortid) &&
        JSON.parse(d.dataJson).a.should.be.eql('b')
      ))

      templatesRes[0].engine.should.be.eql(t1.engine)
      templatesRes[0].data.shortid.should.not.be.eql(d1.shortid)
      templatesRes[0].data.shortid.should.be.eql(dataEntitiesRes.find((d) => d.name === 'data').shortid)
    })
  })
}
