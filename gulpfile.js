const gulp = require('gulp');
const srcgraph = require('./plugin.js');

gulp.task('rollup', function() {
  const options = {
  };
  return gulp.src(['test/entry*.js'])
    .pipe(srcgraph(options))
    .pipe(gulp.dest('./dist'));
});

gulp.task('default', ['rollup']);