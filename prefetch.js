'use strict'

const BB = require('bluebird')

const cache = require('./lib/cache')
const finished = BB.promisify(require('mississippi').finished)
const optCheck = require('./lib/util/opt-check')
const rps = BB.promisify(require('realize-package-specifier'))

module.exports = prefetch
function prefetch (spec, opts) {
  opts = optCheck(opts)
  const startTime = Date.now()
  if (!opts.cache) {
    opts.log.info('prefetch', 'skipping prefetch: no cache provided')
    return BB.resolve({spec})
  }
  if (opts.integrity && !opts.preferOnline) {
    opts.log.silly('prefetch', 'checking if', opts.integrity, 'is already cached')
    return cache.get.hasContent(opts.cache, opts.integrity).then(integrity => {
      if (integrity) {
        opts.log.silly('prefetch', 'content already exists for', spec.raw, `(${Date.now() - startTime}ms)`)
        return {
          spec,
          integrity,
          byDigest: true
        }
      } else {
        return prefetchByManifest(startTime, spec, opts)
      }
    })
  } else {
    opts.log.silly('prefetch', 'no integrity hash provided for', spec, '- fetching by manifest')
    return prefetchByManifest(startTime, spec, opts)
  }
}

function prefetchByManifest (start, spec, opts) {
  const res = typeof spec === 'string'
  ? rps(spec, opts.where)
  : BB.resolve(spec)
  let manifest
  let integrity
  return res.then(res => {
    const stream = require('./lib/handlers/' + res.type + '/tarball')(res, opts)
    if (!stream) { return }
    stream.on('data', function () {})
    stream.on('manifest', m => { manifest = m })
    stream.on('integrity', i => { integrity = i })
    return finished(stream)
  }).then(() => {
    opts.log.verbose('prefetch', `${spec} done in ${Date.now() - start}ms`)
    return {
      manifest,
      spec,
      integrity: integrity || manifest._integrity,
      byDigest: false
    }
  })
}
