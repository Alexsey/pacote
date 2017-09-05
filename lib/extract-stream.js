'use strict'

const path = require('path')
const tar = require('tar')

module.exports = extractStream
function extractStream (dest, opts) {
  opts = opts || {}
  const sawIgnores = new Set()
  return tar.x({
    cwd: dest,
    filter: (name, entry) => !entry.header.type.match(/^.*link$/i),
    strip: 1,
    onwarn: msg => opts.log && opts.log.warn('tar', msg),
    uid: opts.uid,
    gid: opts.gid,
    onentry (entry) {
      entry.mode = entry.mode | (
        entry.type.toLowerCase() === 'directory' ? opts.dmode : opts.fmode
      )
      entry.mode = entry.mode & (~opts.umask || 0)

      // Note: This mirrors logic in the fs read operations that are
      // employed during tarball creation, in the fstream-npm module.
      // It is duplicated here to handle tarballs that are created
      // using other means, such as system tar or git archive.
      if (entry.type.toLowerCase() === 'file') {
        const base = path.basename(entry.path)
        if (base === '.npmignore') {
          sawIgnores.add(entry.path)
        } else if (base === '.gitignore') {
          const npmignore = entry.path.replace(/\.gitignore$/, '.npmignore')
          if (!sawIgnores.has(npmignore)) {
            // Rename, may be clobbered later.
            entry.path = npmignore
          }
        }
      }
    }
  })
}
