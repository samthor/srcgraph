/*
 * Copyright 2017 Google Inc. All rights reserved.
 *
 * Licensed under the Apache License, Version 2.0 (the "License"); you may not
 * use this file except in compliance with the License. You may obtain a copy of
 * the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS, WITHOUT
 * WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the
 * License for the specific language governing permissions and limitations under
 * the License.
 */

const through = require('through2');
const graph = require('./graph.js');
const rollup = require('rollup');
const path = require('path');
const File = require('vinyl');

// TODO: pass around sourcemaps
const sourcemaps = require('vinyl-sourcemaps-apply')

module.exports = function(options) {
  options = Object.assign({
    format: 'es',
  }, options);

  const entrypoints = [];

  const moduleNames = new Map();
  function flattenModuleId(id) {
    const flat = id.replace(/[^\w]/g, '_');

    let candidate = flat;
    let count = 0;
    while (moduleNames.has(candidate)) {
      candidate = flat + (++count);
    }
    moduleNames.set(id, candidate);
    return candidate;
  }

  function buffer(file, enc, cb) {
    if (file.isNull()) {
      return cb(null, file);
    } else if (file.isStream()) {
      return cb(new Error());
    }
    entrypoints.push(file);
    cb();
  }

  async function end() {
    // graph wants relative paths
    const paths = entrypoints.map((file) => path.relative('.', file.path));
    const modules = await graph(paths);
    modules.forEach((module) => flattenModuleId(module.id));

    // store absolute module path => relative module ID, so we can resolve globals for IIFE mode
    const absolutePaths = new Map();
    modules.forEach((module) => absolutePaths[path.resolve(module.id)] = module.id);

    for (let i = 0, module; module = modules[i]; ++i) {
      const bundle = await rollup.rollup({
        // TODO: local gulp logger?
//        onwarn: logger,
        entry: module.id,
        external: (id) => module.external(id),
      });

      const moduleName = flattenModuleId(module.id);
      const result = await bundle.generate({
        format: options.format,
        moduleName,
        sourceMap: true,
        globals: (id) => flattenModuleId(absolutePaths[id]),
      });

      this.push(new File({
        path: path.resolve(module.id),
        contents: new Buffer(result.code),
      }));
    }

  }

  return new through.obj(buffer, function(cb) {
    end.call(this).then(() => cb(null)).catch((err) => cb(err));
  });
};
