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
const helper = require('./helper.js');
const path = require('path');
const rollup = require('rollup');

const args = process.argv.slice(2);
const all = graph(args).then((modules) => {

  return modules.map(async (module) => {
    const dest = 'dist/' + path.dirname(module.id);
    await helper.mkdir(dest);

    const bundle = await rollup.rollup({
      entry: module.id,
      external: (id) => {
        if (id.startsWith('./')) {
          // these are relative to the module file being evaluated, so don't have an opinion
          // e.g., 'foo/bar/test.js' importing './other.js' will see that literal passed here
          return undefined;
        }
        const rel = './' + path.relative('.', id);
        return !module.srcs.includes(rel);
      },
    });

    const result = await bundle.write({
      format: 'es',
      dest: `${dest}/${module.id}`,
    });

    return result;
  });

});

all.then((all) => Promise.all(all)).then((done) => {
  console.info('done!', done);
}, (err) => {
  console.error('error', err);
});

