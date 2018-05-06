var gulp        = require('gulp')
var ts          = require('gulp-typescript')
var sass        = require('gulp-sass')
var concat      = require('gulp-concat')
var gutil       = require('gulp-util')
var plumber     = require('gulp-plumber')
var debug       = require('gulp-debug')
var merge       = require('merge2')
var del         = require('del')
var webpack     = require('webpack-stream')

var debug = false // conditional pipe element? how?

var paths = {
    src: './src/',
    dist: './dist/'
}

var files = {
    darkcss:  'index-browser-dark.css',
    lightcss: 'index-browser-light.css',
    mainjs:   'index.js'
}

var scss = (t)=> gulp.src(paths.src + `**/*${t}.scss`)
    .pipe(plumber())
    //.pipe(debug())
    .pipe(sass())
    .pipe(concat(files[t+'css']))
    .pipe(gulp.dest(paths.dist))

// ---------------------------------------------------------------------------------------------

gulp.task('clean', () =>
    del([
        'dist/js/**/*',
        'dist/d/**/*'
    ])
)

gulp.task('tsc', () => {
    var tsResult = gulp.src(paths.src + '**/*.ts')
        .pipe(plumber())
        .pipe(ts.createProject(require('./tsconfig').compilerOptions)())

    return merge([
        tsResult.dts.pipe(gulp.dest(paths.dist + 'd/')),
        tsResult.js.pipe(gulp.dest(paths.dist + 'js/'))
    ])
})

gulp.task('webpack', ['tsc'], () =>
    gulp.src(paths.dist + 'js/' + files.mainjs)
        .pipe(plumber())
        .pipe(webpack({
            output: { filename:files.mainjs },
            devtool: 'source-map'
        }))
        .pipe(gulp.dest(paths.dist)) 
)

gulp.task('sass',    ()=> merge([scss('light'), scss('dark')]))   

// ---------------------------------------------------------------------------------------------

gulp.task('build',    ['webpack', 'sass'])
gulp.task('test',     ['build'])
gulp.task('data')

gulp.task('commit',   ['test'])
gulp.task('push',     ['commit'])
gulp.task('deploy')

gulp.task('default',  ['watch'])
gulp.task('watch',    ['build'], () => {    
    gulp.watch('../ducd/dist/index.js', ['build'])
    gulp.watch(paths.src + '**/*.ts',   ['build'])
    gulp.watch(paths.src + '**/*.scss', ['sass'])
})
