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

  function end() {
    // graph wants relative paths
    const paths = entrypoints.map((file) => path.relative('.', file.path));
    const absolutePaths = new Map();

    const process = (moduleName, module) => {
      const rollupConf = {
        // TODO: local gulp logger?
//        onwarn: logger,
        entry: module.id,
        external: (id) => module.external(id),
      };
      const bundleConf = {
        format: options.format,
        moduleName,
        sourceMap: true,
        globals: (id) => flattenModuleId(absolutePaths[id]),
      };
      return rollup.rollup(rollupConf)
          .then((bundle) => bundle.generate(bundleConf))
          .then((result) => {
            // got result module, push onto gulp output
            this.push(new File({
              path: path.resolve(module.id),
              contents: new Buffer(result.code),
            }));
          });
    };

    return graph(paths).then((modules) => {
      return Promise.all(modules.map((module) => {
        // store absolute module path => relative module ID, so we can resolve globals for IIFEs
        absolutePaths[path.resolve(module.id)] = module.id;
        return process(flattenModuleId(module.id), module);
      }));
    });
  }

  return new through.obj(buffer, function(cb) {
    end.call(this).then(() => cb(null)).catch((err) => cb(err));
  });
};
