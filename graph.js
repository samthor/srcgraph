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

const reader = require('./reader.js');

class BiMap {
  /**
   * @param {!Map<string, !Array<string>>} deps
   */
  constructor(deps) {
    this.deps_ = deps;  // TODO: copy

    /** @type {!Map<string, !Array<string>>} */
    this.incs_ = new Map();

    for (const src of deps.keys()) {
      this.incs_.set(src, [src]);
    }
    deps.forEach((required, src) => {
      required.forEach((require) => {
        const l = this.incs_.get(require);
        if (l.indexOf(src) === -1) {
          l.push(src);
        }
      });
    });
    this.incs_.forEach((value) => value.sort());
  }

  /**
   * @param {string} src
   * @return {!Array<string>} the paths this file requires directly
   */
  requires(src) {
    return this.deps_.get(src) || [];
  }

  /**
   * @param {string} src
   * @return {!Array<string>} the paths that directly require this file
   */
  requiredBy(src) {
    return this.incs_.get(src) || [];
  }
}


class Module {
  /**
   * @param {string} id
   * @param {!Array<string>} srcs
   * @param {boolean=} entrypoint
   */
  constructor(id, srcs, entrypoint=false) {
    this.id = id;
    this.srcs = srcs.slice();
    this.entrypoint = entrypoint;
  }
}


module.exports = async function(entrypoints) {
  entrypoints = entrypoints.map((entrypoint) => {
    return entrypoint.startsWith('./') ? entrypoint : './' + entrypoint;
  });

  const graph = await reader(entrypoints);
  const map = new BiMap(graph);

  // walk over graph and set (1<<n) for all demands
  const hashes = new Map();
  entrypoints.forEach((entrypoint, n) => {
    const pending = new Set([entrypoint]);
    pending.forEach((next) => {
      hashes.set(next, (hashes.get(next) || 0) | (1 << n));
      map.requires(next).forEach((src) => pending.add(src));
    });
  });

  // find all files in the same module
  const grow = (from) => {
    const hash = hashes.get(from);
    const wouldSplitSrc = (src) => {
      // entrypoints are always their own starting point
      if (entrypoints.includes(src)) {
        return true;
      }
      // checks that the src is the given hash, AND has inputs only matching that hash
      if (hashes.get(src) !== hash) {
        return true;
      }
      const all = map.requiredBy(src);
      return all.some((other) => hashes.get(other) !== hash);
    };

    // not a module entrypoint
    if (!wouldSplitSrc(from)) {
      return null;
    }

    const include = [from];
    const seen = new Set(include);

    for (let i = 0, curr; curr = include[i]; ++i) {
      const pending = map.requires(curr);
      for (let j = 0, cand; cand = pending[j]; ++j) {
        if (seen.has(cand)) {
          continue;
        }
        seen.add(cand);
        if (!wouldSplitSrc(cand)) {
          include.push(cand);
        }
      }
    }

    return include;
  };

  const modules = [];
  hashes.forEach((hash, src) => {
    const srcs = grow(src);
    if (srcs) {
      const entrypoint = entrypoints.includes(src);
      modules.push(new Module(src, srcs, entrypoint));
    }
  });

  return modules;
};