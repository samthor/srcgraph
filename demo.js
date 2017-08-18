#!/usr/bin/env node
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

const graph = require('./graph.js');
const path = require('path');
const rollup = require('rollup');

const args = process.argv.slice(2);
const all = graph(args).then((modules) => {

  return modules.map(async (module) => {
    const dest = path.normalize('dist/' + module.id);

    const logger = ({loc, frame, message}) => {
      if (loc) {
        console.warn(`${loc.file} (${loc.line}:${loc.column}) ${message}`);
        frame && console.warn(frame);
      } else {
        console.warn(message);
      }
    };

    const bundle = await rollup.rollup({
      onwarn: logger,
      entry: module.id,
      external: (id) => module.external(id),
    });

    await bundle.write({
      format: 'es',
      dest: dest,
      sourceMap: true,
    });

    return module;
  });

});

all.then((all) => Promise.all(all)).then((done) => {
  console.info('done!', done);
}, (err) => {
  console.error('error', err);
});

