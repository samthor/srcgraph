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
      external: (id) => !module.srcs.includes(id),
    });
    const result = await bundle.write({
      format: 'es',
      dest: `${dest}/${module.id}`,
    });

    console.info('got result', result);
    return result;
  });

});


Promise.all(all).then((done) => {
  console.info('done!');
}, (err) => {
  console.error('error', err);
});

