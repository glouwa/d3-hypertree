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

// commonjs lib (hypertree)
var projectname = 'd3-hypertree'

var paths = {
    src: './src/',
    dist: './dist/'
}

var files = {
    darkcss:  projectname+`-dark.css`,
    lightcss: projectname+`-light.css`,
    mainjs:   projectname+`.js`
}

libname = 'hyt' 
watchdep = {}
cssimport = {}

// ---------------------------------------------------------------------------------------------

gulp.task('clean', () => del(['dist/**/*']))
gulp.task('default',  ['watch'])
gulp.task('watch',    ['build'], () => {    
    gulp.watch('../ducd/dist/ducd.js',  ['build'])
    gulp.watch(paths.src + '**/*.ts',   ['build'])
    gulp.watch(paths.src + '**/*.scss', ['sass'])
})

// ---------------------------------------------------------------------------------------------

gulp.task('build',    ['webpack', 'sass'])
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
            output: { 
                filename: files.mainjs,
                library: libname                  // use hypertree... in browser
            },
            devtool: 'source-map',            
        }))
        .pipe(gulp.dest(paths.dist)) 
)

var scss = (t)=> gulp.src(paths.src + `**/*${t}.scss`) // all *light.scss or *dark.scss
    .pipe(plumber())
    .pipe(sass())
    .pipe(concat(files[t+'css']))                      // files.lightcss or files.darkcss
    .pipe(gulp.dest(paths.dist))
gulp.task('sass',    ()=> merge([scss('light'), scss('dark')]))   



