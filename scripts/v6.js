/**
 * Copyright (c) 2017-2018 SILENT
 * Released under the MIT License.
 * v6.js is a JavaScript Graphic Library.
 * https://github.com/silent-tempest/v6
 * p5.js:
 * https://github.com/processing/p5.js/
 */

/* jshint esversion: 5 */
/* jshint unused: true */
/* jshint undef: true */
/* global Float32Array, Uint8ClampedArray, ImageData */

;( function ( window, undefined ) {

'use strict';

var _ = window.peako,
    document = window.document,
    warn = window.console && window.console.warn || _.noop,
    err = window.console && window.console.error || _.noop,
    floor = Math.floor,
    round = Math.round,
    atan2 = Math.atan2,
    rand = Math.random,
    sqrt = Math.sqrt,
    cos = Math.cos,
    sin = Math.sin,
    min = Math.min,
    max = Math.max,
    pi = Math.PI,
    renderer_index = -1;

/**
 * Copies elements from the `b` array to `a`.
 * This is useful when `a` is TypedArray,
 * because it's faster:
 * https://jsperf.com/set-values-to-float32array-instance
 * (no matter what jsperf says
 * "something went wrong", believe me
 * (although I don't believe myself already))
 */

// var a = [],
//     b = [ 1, 2, 3 ];
// copy_array( a, b, b.length );
// // now `a` have the same elements with `b`.

var copy_array = function ( a, b, length ) {
  while ( --length >= 0 ) {
    a[ length ] = b[ length ];
  }

  return a;
};

/**
 * Checks if `canvas` has `type` context, using `getContext`.
 */
var has_context = function ( canvas, type ) {
  try {
    if ( canvas.getContext( type ) ) {
      return true;
    }
  } catch ( ex ) {
    warn( ex );
  }

  return false;
};

var support = {
  webgl: function ( canvas ) {
    if ( typeof canvas.getContext != 'function' ) {
      return 0;
    }

    return has_context( canvas, 'webgl' ) ?
      1 : has_context( canvas, 'webgl-experemental' ) ?
      2 : 0;
  }( document.createElement( 'canvas' ) )
};

var v6 = function ( options ) {
  if ( ( options && options.mode || default_options.renderer.mode ) === 'webgl' ) {
    if ( support.webgl ) {
      return new RendererWebGL( options );
    }

    warn( 'Can not get WebGL context. Falling back to 2D context' );
  }

  return new Renderer2D( options );
};

var settings = {
  degrees: false
};

var default_options = {
  renderer: {
    settings: {
      /** Pixel density of context. */
      scale: 1,

      /**
       * MDN: Can be set to change if images are smoothed
       * https://developer.mozilla.org/en-US/docs/Web/API/CanvasRenderingContext2D/imageSmoothingEnabled
       */
      smooth: false,

      colorMode: 'rgba'
    },

    /** One of: "2d", "webgl". */
    mode: '2d',

    /**
     * MDN: Boolean that indicates if the canvas
     * contains an alpha channel.  If set to false,
     * the browser now knows that the backdrop is
     * always opaque,  which can speed up drawing of
     * transparent content and images.
     * https://developer.mozilla.org/en-US/docs/Web/API/HTMLCanvasElement/getContext
     */
    alpha: true,

    /** Will be renderer added to the DOM? */
    append: true
  }
};

// v6.map( 20, 0, 100, 0, 1 ); // -> 0.2
// v6.map( -0.1, -1, 1, 0, 10 ) // -> 4.5

var map = function ( value, start1, stop1, start2, stop2, clamp ) {
  value = ( ( value - start1 ) / ( stop1 - start1 ) ) * ( stop2 - start2 ) + start2;

  if ( clamp ) {
    return start2 < stop2 ?
      _.clamp( value, start2, stop2 ) :
      _.clamp( value, stop2, start2 );
  }

  return value;
};

/**
 * Returns distance between two points.
 */

// v6.dist( 0, 0, 1, 1 ); // -> 1.4142135623730951

var dist = function ( x1, y1, x2, y2 ) {
  return sqrt( ( x2 - x1 ) * ( x2 - x1 ) + ( y2 - y1 ) * ( y2 - y1 ) );
};

// var purple = v6.lerpColor( 'red', 'blue', 0.5 );

var lerp_color = function ( a, b, value ) {
  return ( typeof a != 'object' ? parse_color( a ) : a ).lerp( b, value );
};

var lerp = function ( a, b, value ) {
  return a + ( b - a ) * value;
};

/**
 * Clone renderer `style` to `object`.
 */
var clone_style = function ( style, object ) {
  object.rectAlignX = style.rectAlignX;
  object.rectAlignY = style.rectAlignY;
  object.doFill = style.doFill;
  object.doStroke = style.doStroke;
  object.fillStyle[ 0 ] = style.fillStyle[ 0 ];
  object.fillStyle[ 1 ] = style.fillStyle[ 1 ];
  object.fillStyle[ 2 ] = style.fillStyle[ 2 ];
  object.fillStyle[ 3 ] = style.fillStyle[ 3 ];
  object.font.style = style.font.style;
  object.font.variant = style.font.variant;
  object.font.weight = style.font.weight;
  object.font.size = style.font.size;
  object.font.family = style.font.family;
  object.lineHeight = style.lineHeight;
  object.lineWidth = style.lineWidth;
  object.strokeStyle[ 0 ] = style.strokeStyle[ 0 ];
  object.strokeStyle[ 1 ] = style.strokeStyle[ 1 ];
  object.strokeStyle[ 2 ] = style.strokeStyle[ 2 ];
  object.strokeStyle[ 3 ] = style.strokeStyle[ 3 ];
  object.textAlign = style.textAlign;
  object.textBaseline = style.textBaseline;
  return object;
};

var set_image_smoothing = function ( context, value ) {
  context.imageSmoothingEnabled =
    context.oImageSmoothingEnabled =
    context.msImageSmoothingEnabled =
    context.mozImageSmoothingEnabled =
    context.webkitImageSmoothingEnabled = value;

  return context.imageSmoothingEnabled;
};

var align = function ( value, size, align ) {
  switch ( align ) {
    case 'left':
    case 'top':
      return value;
    case 'center':
    case 'middle':
      return value - size * 0.5;
    case 'right':
    case 'bottom':
      return value - size;
  }

  return 0;
};

/* FILTERS */

var filters = {
  negative: function ( data ) {
    var r = data.length - 4,
        g, b;

    for ( ; r >= 0; r -= 4 ) {
      data[ r ] = 255 - data[ r ];
      data[ g = r + 1 ] = 255 - data[ g ];
      data[ b = r + 2 ] = 255 - data[ b ];
    }

    return data;
  },

  contrast: function ( data ) {
    var r = data.length - 4,
        g, b;

    for ( ; r >= 0; r -= 4 ) {
      data[ r ] = data[ g = r + 1 ] = data[ b = r + 2 ] =
        data[ r ] * 0.299 + data[ g ] * 0.587 + data[ b ] * 0.114;
    }

    return data;
  },

  sepia: function ( data ) {
    var rindex = data.length - 4,
        gindex, bindex, r, g, b;

    for ( ; rindex >= 0; rindex -= 4 ) {
      r = data[ rindex ];
      g = data[ gindex = rindex + 1 ];
      b = data[ bindex = rindex + 2 ];
      data[ rindex ] = r * 0.393 + g * 0.769 + b * 0.189;
      data[ gindex ] = r * 0.349 + g * 0.686 + b * 0.168;
      data[ bindex ] = r * 0.272 + g * 0.534 + b * 0.131;
    }

    return data;
  }
};

/* TICKER */

var ticker = function ( update, render ) {
  return new Ticker( update, render );
};

var Ticker = function ( update, render ) {
  var ticker = this,
      tick = ticker.tick;

  if ( render === undefined ) {
    render = update;
    update = _.noop;
  }

  ticker.lasttime = _.timestamp();
  ticker.update = update;
  ticker.render = render;

  ticker.boundtick = function () {
    tick.call( ticker, null, true );
  };
};

Ticker.prototype = _.create( null );
Ticker.prototype.constructor = Ticker;
Ticker.prototype.step = 1 / 60;
Ticker.prototype.stopped = true;

Ticker.prototype.skipped =
  Ticker.prototype.lastid =
  Ticker.prototype.idoffset =
  Ticker.prototype.total = 0;

Ticker.prototype.tick = function ( fps, requested ) {
  if ( this.stopped ) {
    if ( requested ) {
      return this;
    }

    this.stopped = false;
  }

  if ( fps != null ) {
    this.step = 1 / fps;
  }

  var now = _.timestamp(),
      dt = min( 1, ( now - this.lasttime ) * 0.001 ),
      step = this.step;

  this.skipped += dt;
  this.total += dt;

  while ( this.skipped > step && !this.stopped ) {
    this.skipped -= step;
    this.update.call( this, step );
  }

  this.render.call( this, dt );
  this.lasttime = now;
  this.lastid = _.timer.request( this.boundtick );
  return this;
};

Ticker.prototype.clear = function ( skipped ) {
  _.timer.cancel( this.lastid );
  this.lasttime = _.timestamp();

  if ( skipped ) {
    this.skipped = 0;
  }

  return this;
};

Ticker.prototype.stop = function () {
  return this.stopped = true, this;
};

/* VECTOR2D */

var vec2 = function ( x, y ) {
  return new Vector2D( x, y );
};

/** IMPORTANT: components are named 0, 1 and 2 (for 3D vector). */
var Vector2D = function ( x, y ) {
  this.set( x, y );
};

Vector2D.prototype = _.create( null );
Vector2D.prototype.constructor = Vector2D;
Vector2D.prototype.length = 2;

Vector2D.prototype.set = function ( x, y ) {
  if ( typeof x == 'object' && x != null ) {
    this[ 0 ] = x[ 0 ] || 0;
    this[ 1 ] = x[ 1 ] || 0;
  } else {
    this[ 0 ] = x || 0;
    this[ 1 ] = y || 0;
  }

  return this;
};

Vector2D.prototype.lerp = function ( x, y, value ) {
  if ( typeof x == 'object' && x != null ) {
    this[ 0 ] += ( x[ 0 ] - this[ 0 ] ) * y || 0;
    this[ 1 ] += ( x[ 1 ] - this[ 1 ] ) * y || 0;
  } else {
    this[ 0 ] += ( x - this[ 0 ] ) * value || 0;
    this[ 1 ] += ( y - this[ 1 ] ) * value || 0;
  }

  return this;
};

Vector2D.prototype.add = function ( x, y ) {
  if ( typeof x == 'object' && x != null ) {
    this[ 0 ] += x[ 0 ] || 0;
    this[ 1 ] += x[ 1 ] || 0;
  } else {
    this[ 0 ] += x || 0;
    this[ 1 ] += y || 0;
  }

  return this;
};

Vector2D.prototype.sub = function ( x, y ) {
  if ( typeof x == 'object' && x != null ) {
    this[ 0 ] -= x[ 0 ] || 0;
    this[ 1 ] -= x[ 1 ] || 0;
  } else {
    this[ 0 ] -= x || 0;
    this[ 1 ] -= y || 0;
  }

  return this;
};

Vector2D.prototype.mult = function ( value ) {
  this[ 0 ] = this[ 0 ] * value || 0;
  this[ 1 ] = this[ 1 ] * value || 0;
  return this;
};

Vector2D.prototype.div = function ( value ) {
  this[ 0 ] = this[ 0 ] / value || 0;
  this[ 1 ] = this[ 1 ] / value || 0;
  return this;
};

Vector2D.prototype.angle = function () {
  return settings.degrees ?
    atan2( this[ 1 ], this[ 0 ] ) * 180 / pi :
    atan2( this[ 1 ], this[ 0 ] );
};

Vector2D.prototype.mag = function () {
  return sqrt( this[ 0 ] * this[ 0 ] + this[ 1 ] * this[ 1 ] );
};

Vector2D.prototype.magSq = function () {
  return this[ 0 ] * this[ 0 ] + this[ 1 ] * this[ 1 ];
};

Vector2D.prototype.setMag = function ( value ) {
  return this.normalize().mult( value );
};

Vector2D.prototype.normalize = function () {
  var mag = this.mag();

  if ( mag && mag !== 1 ) {
    this.div( mag );
  }

  return this;
};

Vector2D.prototype.rotate = function ( angle ) {
  var length = this.mag();

  if ( settings.degrees ) {
    angle = angle * pi / 180 + this.angle();
  } else {
    angle += this.angle();
  }

  this[ 0 ] = length * cos( angle );
  this[ 1 ] = length * sin( angle );

  return this;
};

Vector2D.prototype.dot = function ( x, y ) {
  if ( typeof x != 'object' || x == null ) {
    return this[ 0 ] * ( x || 0 ) +
           this[ 1 ] * ( y || 0 );
  }

  return this[ 0 ] * ( x[ 0 ] || 0 ) +
         this[ 1 ] * ( x[ 1 ] || 0 );
};

Vector2D.prototype.copy = function () {
  return new Vector2D( this[ 0 ], this[ 1 ] );
};

Vector2D.prototype.dist = function ( vector ) {
  return dist( this[ 0 ], this[ 1 ], vector[ 0 ], vector[ 1 ] );
};

Vector2D.prototype.limit = function ( value ) {
  var mag = this.magSq();

  if ( mag > value * value && ( mag = sqrt( mag ) ) ) {
    this.div( mag ).mult( value );
  }

  return this;
};

Vector2D.prototype.cross = function( vector ) {
  return Vector2D.cross( this, vector );
};

Vector2D.prototype.toString = function () {
  return 'vec2(' +
    ( floor( this[ 0 ] * 100 ) * 0.01 ) + ', ' +
    ( floor( this[ 1 ] * 100 ) * 0.01 ) + ')';
};

/* VECTOR3D */

/** IMPORTANT: components are named 0, 1 and 2. */
var vec3 = function ( x, y, z ) {
  return new Vector3D( x, y, z );
};

var Vector3D = function ( x, y, z ) {
  this.set( x, y, z );
};

Vector3D.prototype = _.create( null );
Vector3D.prototype.constructor = Vector3D;
Vector3D.prototype.length = 3;

Vector3D.prototype.set = function ( x, y, z ) {
  if ( typeof x == 'object' && x != null ) {
    this[ 2 ] = x[ 2 ] || 0;
    this[ 0 ] = x[ 0 ] || 0;
    this[ 1 ] = x[ 1 ] || 0;
  } else {
    this[ 0 ] = x || 0;
    this[ 1 ] = y || 0;
    this[ 2 ] = z || 0;
  }

  return this;
};

Vector3D.prototype.lerp = function ( x, y, z, value ) {
  if ( typeof x == 'object' && x != null ) {
    this[ 0 ] += ( x[ 0 ] - this[ 0 ] ) * y || 0;
    this[ 1 ] += ( x[ 1 ] - this[ 1 ] ) * y || 0;
    this[ 2 ] += ( x[ 2 ] - this[ 2 ] ) * y || 0;
  } else {
    this[ 0 ] += ( x - this[ 0 ] ) * value || 0;
    this[ 1 ] += ( y - this[ 1 ] ) * value || 0;
    this[ 2 ] += ( z - this[ 2 ] ) * value || 0;
  }

  return this;
};

Vector3D.prototype.add = function ( x, y, z ) {
  if ( typeof x == 'object' && x != null ) {
    this[ 0 ] += x[ 0 ] || 0;
    this[ 1 ] += x[ 1 ] || 0;
    this[ 2 ] += x[ 2 ] || 0;
  } else {
    this[ 0 ] += x || 0;
    this[ 1 ] += y || 0;
    this[ 2 ] += z || 0;
  }

  return this;
};

Vector3D.prototype.sub = function ( x, y, z ) {
  if ( typeof x == 'object' && x != null ) {
    this[ 0 ] -= x[ 0 ] || 0;
    this[ 1 ] -= x[ 1 ] || 0;
    this[ 2 ] -= x[ 2 ] || 0;
  } else {
    this[ 0 ] -= x || 0;
    this[ 1 ] -= y || 0;
    this[ 2 ] -= z || 0;
  }

  return this;
};

Vector3D.prototype.mult = function ( value ) {
  this[ 0 ] = this[ 0 ] * value || 0;
  this[ 1 ] = this[ 1 ] * value || 0;
  this[ 2 ] = this[ 2 ] * value || 0;
  return this;
};

Vector3D.prototype.div = function ( value ) {
  this[ 0 ] = this[ 0 ] / value || 0;
  this[ 1 ] = this[ 1 ] / value || 0;
  this[ 2 ] = this[ 2 ] / value || 0;
  return this;
};

Vector3D.prototype.angle = Vector2D.prototype.angle;

Vector3D.prototype.mag = function () {
  return sqrt( this[ 0 ] * this[ 0 ] + this[ 1 ] * this[ 1 ] + this[ 2 ] * this[ 2 ] );
};

Vector3D.prototype.magSq = function () {
  return this[ 0 ] * this[ 0 ] + this[ 1 ] * this[ 1 ] + this[ 2 ] * this[ 2 ];
};

Vector3D.prototype.setMag = Vector2D.prototype.setMag;
Vector3D.prototype.normalize = Vector2D.prototype.normalize;
Vector3D.prototype.rotate = Vector2D.prototype.rotate;

Vector3D.prototype.dot = function ( x, y, z ) {
  if ( typeof x != 'object' || x == null ) {
    return this[ 0 ] * ( x || 0 ) +
           this[ 1 ] * ( y || 0 ) +
           this[ 2 ] * ( z || 0 );
  }

  return this[ 0 ] * ( x[ 0 ] || 0 ) +
         this[ 1 ] * ( x[ 1 ] || 0 ) +
         this[ 2 ] * ( x[ 2 ] || 0 );
};

Vector3D.prototype.copy = function () {
  return new Vector3D( this[ 0 ], this[ 1 ], this[ 2 ] );
};

Vector3D.prototype.dist = function ( vector ) {
  var x = ( vector[ 0 ] - this[ 0 ] ),
      y = ( vector[ 1 ] - this[ 1 ] ),
      z = ( vector[ 2 ] - this[ 2 ] );

  return sqrt( x * x + y * y + z * z );
};

Vector3D.prototype.limit = Vector2D.prototype.limit;

Vector3D.prototype.cross = function ( vector ) {
  return Vector3D.cross( this, vector );
};

Vector3D.prototype.toString = function () {
  return 'vec3(' +
    ( floor( this[ 0 ] * 100 ) * 0.01 ) + ', ' +
    ( floor( this[ 1 ] * 100 ) * 0.01 ) + ', ' +
    ( floor( this[ 2 ] * 100 ) * 0.01 ) + ')';
};

var names = [ 'set', 'lerp', 'add', 'sub', 'mult', 'div', 'setMag', 'normalize', 'rotate', 'limit' ],
    i = names.length - 1;

for ( ; i >= 0; --i ) {
  /* jshint evil: true */
  Vector2D[ names[ i ] ] = Vector3D[ names[ i ] ] =
    Function( 'vector, x, y, z, value', 'return vector.copy().' + names[ i ] + '( x, y, z, value );' );
  /* jshint evil: false */
}

Vector2D.angle = Vector3D.angle = function ( x, y ) {
  return settings.degrees ?
    atan2( y, x ) * 180 / pi :
    atan2( y, x );
};

Vector2D.random = function () {
  return Vector2D.fromAngle( rand() * ( settings.degrees ? 360 : pi * 2 ) );
};

Vector3D.random = function () {
  var angle = rand() * pi * 2,
      z = rand() * 2 - 1,
      z_base = sqrt( 1 - z * z );

  return new Vector3D( z_base * cos( angle ), z_base * sin( angle ), z );
};

Vector2D.fromAngle = function ( angle ) {
  return settings.degrees ?
    new Vector2D( cos( angle *= pi / 180 ), sin( angle ) ) :
    new Vector2D( cos( angle ), sin( angle ) );
};

Vector3D.fromAngle = function ( angle ) {
  return settings.degrees ?
    new Vector3D( cos( angle *= pi / 180 ), sin( angle ) ) :
    new Vector3D( cos( angle ), sin( angle ) );
};

Vector2D.cross = function( a, b ) {
  return a[ 0 ] * b[ 1 ] - a[ 1 ] * b[ 0 ];
};

Vector3D.cross = function ( a, b ) {
  return new Vector3D(
    a[ 1 ] * b[ 2 ] - a[ 2 ] * b[ 1 ],
    a[ 2 ] * b[ 0 ] - a[ 0 ] * b[ 2 ],
    a[ 0 ] * b[ 1 ] - a[ 1 ] * b[ 0 ] );
};

/* COLORS */

var colors = {
  aliceblue:       'f0f8ffff', antiquewhite:         'faebd7ff',
  aqua:            '00ffffff', aquamarine:           '7fffd4ff',
  azure:           'f0ffffff', beige:                'f5f5dcff',
  bisque:          'ffe4c4ff', black:                '000000ff',
  blanchedalmond:  'ffebcdff', blue:                 '0000ffff',
  blueviolet:      '8a2be2ff', brown:                'a52a2aff',
  burlywood:       'deb887ff', cadetblue:            '5f9ea0ff',
  chartreuse:      '7fff00ff', chocolate:            'd2691eff',
  coral:           'ff7f50ff', cornflowerblue:       '6495edff',
  cornsilk:        'fff8dcff', crimson:              'dc143cff',
  cyan:            '00ffffff', darkblue:             '00008bff',
  darkcyan:        '008b8bff', darkgoldenrod:        'b8860bff',
  darkgray:        'a9a9a9ff', darkgreen:            '006400ff',
  darkkhaki:       'bdb76bff', darkmagenta:          '8b008bff',
  darkolivegreen:  '556b2fff', darkorange:           'ff8c00ff',
  darkorchid:      '9932ccff', darkred:              '8b0000ff',
  darksalmon:      'e9967aff', darkseagreen:         '8fbc8fff',
  darkslateblue:   '483d8bff', darkslategray:        '2f4f4fff',
  darkturquoise:   '00ced1ff', darkviolet:           '9400d3ff',
  deeppink:        'ff1493ff', deepskyblue:          '00bfffff',
  dimgray:         '696969ff', dodgerblue:           '1e90ffff',
  feldspar:        'd19275ff', firebrick:            'b22222ff',
  floralwhite:     'fffaf0ff', forestgreen:          '228b22ff',
  fuchsia:         'ff00ffff', gainsboro:            'dcdcdcff',
  ghostwhite:      'f8f8ffff', gold:                 'ffd700ff',
  goldenrod:       'daa520ff', gray:                 '808080ff',
  green:           '008000ff', greenyellow:          'adff2fff',
  honeydew:        'f0fff0ff', hotpink:              'ff69b4ff',
  indianred:       'cd5c5cff', indigo:               '4b0082ff',
  ivory:           'fffff0ff', khaki:                'f0e68cff',
  lavender:        'e6e6faff', lavenderblush:        'fff0f5ff',
  lawngreen:       '7cfc00ff', lemonchiffon:         'fffacdff',
  lightblue:       'add8e6ff', lightcoral:           'f08080ff',
  lightcyan:       'e0ffffff', lightgoldenrodyellow: 'fafad2ff',
  lightgrey:       'd3d3d3ff', lightgreen:           '90ee90ff',
  lightpink:       'ffb6c1ff', lightsalmon:          'ffa07aff',
  lightseagreen:   '20b2aaff', lightskyblue:         '87cefaff',
  lightslateblue:  '8470ffff', lightslategray:       '778899ff',
  lightsteelblue:  'b0c4deff', lightyellow:          'ffffe0ff',
  lime:            '00ff00ff', limegreen:            '32cd32ff',
  linen:           'faf0e6ff', magenta:              'ff00ffff',
  maroon:          '800000ff', mediumaquamarine:     '66cdaaff',
  mediumblue:      '0000cdff', mediumorchid:         'ba55d3ff',
  mediumpurple:    '9370d8ff', mediumseagreen:       '3cb371ff',
  mediumslateblue: '7b68eeff', mediumspringgreen:    '00fa9aff',
  mediumturquoise: '48d1ccff', mediumvioletred:      'c71585ff',
  midnightblue:    '191970ff', mintcream:            'f5fffaff',
  mistyrose:       'ffe4e1ff', moccasin:             'ffe4b5ff',
  navajowhite:     'ffdeadff', navy:                 '000080ff',
  oldlace:         'fdf5e6ff', olive:                '808000ff',
  olivedrab:       '6b8e23ff', orange:               'ffa500ff',
  orangered:       'ff4500ff', orchid:               'da70d6ff',
  palegoldenrod:   'eee8aaff', palegreen:            '98fb98ff',
  paleturquoise:   'afeeeeff', palevioletred:        'd87093ff',
  papayawhip:      'ffefd5ff', peachpuff:            'ffdab9ff',
  peru:            'cd853fff', pink:                 'ffc0cbff',
  plum:            'dda0ddff', powderblue:           'b0e0e6ff',
  purple:          '800080ff', red:                  'ff0000ff',
  rosybrown:       'bc8f8fff', royalblue:            '4169e1ff',
  saddlebrown:     '8b4513ff', salmon:               'fa8072ff',
  sandybrown:      'f4a460ff', seagreen:             '2e8b57ff',
  seashell:        'fff5eeff', sienna:               'a0522dff',
  silver:          'c0c0c0ff', skyblue:              '87ceebff',
  slateblue:       '6a5acdff', slategray:            '708090ff',
  snow:            'fffafaff', springgreen:          '00ff7fff',
  steelblue:       '4682b4ff', tan:                  'd2b48cff',
  teal:            '008080ff', thistle:              'd8bfd8ff',
  tomato:          'ff6347ff', turquoise:            '40e0d0ff',
  violet:          'ee82eeff', violetred:            'd02090ff',
  wheat:           'f5deb3ff', white:                'ffffffff',
  whitesmoke:      'f5f5f5ff', yellow:               'ffff00ff',
  yellowgreen:     '9acd32ff', transparent:          '00000000'
};

var rhsl = /^hsl\s*\(\s*(\d+|\d*\.\d+)\s*,\s*(\d+|\d*\.\d+)\u0025\s*,\s*(\d+|\d*\.\d+)\u0025\s*\)$|^\s*hsla\s*\(\s*(\d+|\d*\.\d+)\s*,\s*(\d+|\d*\.\d+)\u0025\s*,\s*(\d+|\d*\.\d+)\u0025\s*,\s*(\d+|\d*\.\d+)\s*\)$/,
    rrgb = /^rgb\s*\(\s*(\d+|\d*\.\d+)\s*,\s*(\d+|\d*\.\d+)\s*,\s*(\d+|\d*\.\d+)\s*\)$|^\s*rgba\s*\(\s*(\d+|\d*\.\d+)\s*,\s*(\d+|\d*\.\d+)\s*,\s*(\d+|\d*\.\d+)\s*,\s*(\d+|\d*\.\d+)\s*\)$/,
    rhex = /^(?:#)([0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f])([0-9a-f][0-9a-f])?$/,
    rhex3 = /^(?:#)([0-9a-f])([0-9a-f])([0-9a-f])([0-9a-f])?$/,
    parsed = _.create( null ),
    transparent = [ 0, 0, 0, 0 ];

var color = function ( a, b, c, d ) {
  if ( typeof a != 'string' ) {
    return new RGBA( a, b, c, d );
  }

  return parse_color( a );
};

/**
 * parse_color( '#f0f0' );
 * // -> rgba(255, 0, 255, 0)
 * parse_color( '#000000ff' );
 * // -> rgba(0, 0, 0, 1)
 * parse_color( 'magenta' );
 * // -> rgba(255, 0, 255, 1)
 * parse_color( 'transparent' );
 * // -> rgba(0, 0, 0, 0)
 * parse_color( 'hsl( 0, 100%, 50% )' );
 * // -> hsla(0, 100%, 50%, 1)
 * parse_color( 'hsla( 0, 100%, 50%, 0.5 )' );
 * // -> hsla(0, 100%, 50%, 0.5)
 */
var parse_color = function ( string ) {
  var cache = parsed[ string ] ||
    parsed[ string = _.trim( string ).toLowerCase() ];

  if ( !cache ) {
    if ( ( cache = colors[ string ] ) ) {
      cache = parsed[ string ] = new ColorData( parse_hex( cache ), RGBA );
    } else if ( ( cache = rhex.exec( string ) ) ) {
      cache = parsed[ string ] = new ColorData( parse_hex( format_hex( cache ) ), RGBA );
    } else if ( ( cache = rrgb.exec( string ) ) ) {
      cache = parsed[ string ] = new ColorData( compact_match( cache ), RGBA );
    } else if ( ( cache = rhsl.exec( string ) ) ) {
      cache = parsed[ string ] = new ColorData( compact_match( cache ), HSLA );
    } else if ( ( cache = rhex3.exec( string ) ) ) {
      cache = parsed[ string ] = new ColorData( parse_hex( format_hex( cache, true ) ), RGBA );
    } else {
      throw SyntaxError( string + " isn't valid syntax" );
    }
  }

  return new cache.constructor( cache[ 0 ], cache[ 1 ], cache[ 2 ], cache[ 3 ] );
};

/**
 * format_hex( [ '#000000ff', '000000', 'ff' ] );
 * // -> '000000ff'
 * format_hex( [ '#0007', '0', '0', '0', '7' ], true );
 * // -> '00000077'
 * format_hex( [ '#000', '0', '0', '0', null ], true );
 * // -> '000000ff'
 * Theoretically, because I didn't test these examples.
 */
var format_hex = function ( match, short_syntax ) {
  if ( !short_syntax ) {
    return match[ 1 ] + ( match[ 2 ] || 'ff' );
  }

  var r = match[ 1 ],
      g = match[ 2 ],
      b = match[ 3 ],
      a = match[ 4 ] || 'f';

  return r + r + g + g + b + b + a + a;
};

/**
 * parse_hex( '00000000' );
 * // -> [ 0, 0, 0, 0 ]
 * parse_hex( 'ff00ffff' );
 * // -> [ 255, 0, 255, 1 ]
 */
var parse_hex = function ( hex ) {
  if ( hex == 0 ) {
    return transparent;
  }

  hex = window.parseInt( hex, 16 );

  return [
    hex >> 24 & 255,
    hex >> 16 & 255,
    hex >> 8 & 255,
    ( hex & 255 ) / 255
  ];
};

/**
 * compact_match( [ 'hsl( 0, 0%, 0% )', '0', '0', '0', null, null, null, null ] );
 * // -> [ '0', '0', '0' ]
 * compact_match( [ 'rgba( 0, 0, 0, 0 )', null, null, null, '0', '0', '0', '0' ] );
 * // -> [ '0', '0', '0', '0' ]
 */
var compact_match = function ( match ) {
  return match[ 7 ] ?
    [ match[ 4 ], match[ 5 ], match[ 6 ], match[ 7 ] ] :
    [ match[ 1 ], match[ 2 ], match[ 3 ] ];
};

// I want to make that the methods
// of RGBA and HSLA prototypes change
// the objects on which they are called.
// For example, shade, lerp, darken, lighten...

var rgba = function ( r, g, b, a ) {
  return new RGBA( r, g, b, a );
};

var RGBA = function ( r, g, b, a ) {
  this.set( r, g, b, a );
};

RGBA.prototype = _.create( null );
RGBA.prototype.constructor = RGBA;
RGBA.prototype.type = 'rgba';

RGBA.prototype.contrast = function () {
  return this[ 0 ] * 0.299 + this[ 1 ] * 0.587 + this[ 2 ] * 0.114;
};

RGBA.prototype.toString = function () {
  return 'rgba(' +
    this[ 0 ] + ', ' +
    this[ 1 ] + ', ' +
    this[ 2 ] + ', ' +
    this[ 3 ] + ')';
};

/**
 * .set( 'magenta' );
 * // r = 255, g = 0, b = 255, a = 1
 * .set( '#ff00ff' );
 * // r = 255, g = 0, b = 255, a = 1
 * .set( 'rgb( 0, 0, 0 )' );
 * // r = 0, g = 0, b = 0, a = 1
 * .set( 0 );
 * // ( r, g, b ) = 0, a = 1
 * .set( 0, 0 );
 * // ( r, g, b ) = 0, a = 0
 * .set( 0, 0, 0 );
 * // r = 0, g = 0, b = 0, a = 1
 * .set( 0, 0, 0, 0 );
 * // r = 0, g = 0, b = 0, a = 0
 */
RGBA.prototype.set = function ( r, g, b, a ) {
  if ( r == null || typeof r != 'object' && typeof r != 'string' ) {
    switch ( undefined ) {
      case r: a = 1; b = g = r = 0; break;
      case g: a = 1; b = g = r = floor( r ); break;
      case b: a = g; b = g = r = floor( r ); break;
      case a: a = 1; /* falls through */
      default: r = floor( r ); g = floor( g ); b = floor( b );
    }

    this[ 0 ] = r;
    this[ 1 ] = g;
    this[ 2 ] = b;
    this[ 3 ] = a;
  } else {
    if ( typeof r == 'string' ) {
      r = parse_color( r );
    }

    if ( r.type !== this.type ) {
      r = r[ this.type ]();
    }

    this[ 0 ] = r[ 0 ];
    this[ 1 ] = r[ 1 ];
    this[ 2 ] = r[ 2 ];
    this[ 3 ] = r[ 3 ];
  }

  return this;
};

/**
 * v6.rgba( 255, 0, 0 ).hsla();
 * // -> hsla(0, 100%, 50%, 1)
 */
RGBA.prototype.hsla = function () {
  var hsla = new HSLA(),
      r = this[ 0 ] / 255,
      g = this[ 1 ] / 255,
      b = this[ 2 ] / 255,
      greatest = max( r, g, b ),
      least = min( r, g, b ),
      diff = greatest - least,
      l = ( greatest + least ) * 50,
      h, s;

  if ( diff ) {
    s = l > 50 ?
      diff / ( 2 - greatest - least ) :
      diff / ( greatest + least );

    switch ( greatest ) {
      case r: h = g < b ? 1.0472 * ( g - b ) / diff + 6.2832 : 1.0472 * ( g - b ) / diff; break;
      case g: h = 1.0472 * ( b - r ) / diff + 2.0944; break;
      default: h = 1.0472 * ( r - g ) / diff + 4.1888;
    }

    h = round( h * 360 / 6.2832 );
    s = round( s * 100 );
  } else {
    h = s = 0;
  }

  hsla[ 0 ] = h;
  hsla[ 1 ] = s;
  hsla[ 2 ] = round( l );
  hsla[ 3 ] = this[ 3 ];

  return hsla;
};

// Uses in <v6.RendererWebGL>.
RGBA.prototype.rgba = function () {
  return this;
};

/**
 * v6.rgba( 100 ).lerp( 'black', 0.5 );
 * // rgba(50, 50, 50, 1)
 */
RGBA.prototype.lerp = function ( color, value ) {
  if ( typeof color != 'object' ) {
    color = parse_color( color );
  }

  if ( color.type !== 'rgba' ) {
    color = color.rgba();
  }

  return new RGBA(
    lerp( this[ 0 ], color[ 0 ], value ),
    lerp( this[ 1 ], color[ 1 ], value ),
    lerp( this[ 2 ], color[ 2 ], value ) );
};

var hsla = function ( h, s, l, a ) {
  return new HSLA( h, s, l, a );
};

var HSLA = function ( h, s, l, a ) {
  this.set( h, s, l, a );
};

HSLA.prototype = _.create( null );
HSLA.prototype.constructor = HSLA;
HSLA.prototype.type = 'hsla';

HSLA.prototype.toString = function () {
  return 'hsla(' +
    this[ 0 ] + ', ' +
    this[ 1 ] + '\u0025, ' +
    this[ 2 ] + '\u0025, ' +
    this[ 3 ] + ')';
};

HSLA.prototype.set = function ( h, s, l, a ) {
  if ( h == null || typeof h != 'object' && typeof h != 'string' ) {
    switch ( undefined ) {
      case h: a = 1; l = s = h = 0; break;
      case s: a = 1; l = floor( h ); s = h = 0; break;
      case l: a = s; l = floor( h ); s = h = 0; break;
      case a: a = 1; /* falls through */
      default: h = floor( h ); s = floor( s ); l = floor( l );
    }

    this[ 0 ] = h;
    this[ 1 ] = s;
    this[ 2 ] = l;
    this[ 3 ] = a;
  } else {
    if ( typeof h == 'string' ) {
      h = parse_color( h );
    }

    if ( h.type !== this.type ) {
      h = h[ this.type ]();
    }

    this[ 0 ] = h[ 0 ];
    this[ 1 ] = h[ 1 ];
    this[ 2 ] = h[ 2 ];
    this[ 3 ] = h[ 3 ];
  }

  return this;
};

HSLA.prototype.rgba = function () {
  var rgba = new RGBA(),
      h = this[ 0 ] % 360 / 360,
      s = this[ 1 ] * 0.01,
      l = this[ 2 ] * 0.01,
      q = l < 0.5 ? l * ( 1 + s ) : l + s - ( l * s ),
      p = 2 * l - q,
      tr = h + 1 / 3,
      tg = h,
      tb = h - 1 / 3;

  if ( tr < 0 ) { ++tr; }
  if ( tg < 0 ) { ++tg; }
  if ( tb < 0 ) { ++tb; }
  if ( tr > 1 ) { --tr; }
  if ( tg > 1 ) { --tg; }
  if ( tb > 1 ) { --tb; }

  rgba[ 0 ] = round( 255 * ( tr < 1 / 6 ?
    p + ( q - p ) * 6 * tr : tr < 0.5 ?
    q : tr < 2 / 3 ?
    p + ( q - p ) * ( 2 / 3 - tr ) * 6 : p ) );

  rgba[ 1 ] = round( 255 * ( tg < 1 / 6 ?
    p + ( q - p ) * 6 * tg : tg < 0.5 ?
    q : tg < 2 / 3 ?
    p + ( q - p ) * ( 2 / 3 - tg ) * 6 : p ) );

  rgba[ 2 ] = round( 255 * ( tb < 1 / 6 ?
    p + ( q - p ) * 6 * tb : tb < 0.5 ?
    q : tb < 2 / 3 ?
    p + ( q - p ) * ( 2 / 3 - tb ) * 6 : p ) );

  rgba[ 3 ] = this[ 3 ];

  return rgba;
};

HSLA.prototype.lerp = function ( color, value ) {
  var that = this.rgba();

  if ( typeof color != 'object' ) {
    color = parse_color( color );
  }

  if ( color.type !== 'rgba' ) {
    color = color.rgba();
  }

  return new RGBA(
    lerp( that[ 0 ], color[ 0 ], value ),
    lerp( that[ 1 ], color[ 1 ], value ),
    lerp( that[ 2 ], color[ 2 ], value ) ).hsla();
};

var ColorData = function ( match, constructor ) {
  this[ 0 ] = match[ 0 ];
  this[ 1 ] = match[ 1 ];
  this[ 2 ] = match[ 2 ];
  this[ 3 ] = match[ 3 ];
  this.constructor = constructor;
};

ColorData.prototype = _.create( null );

/* FONT */

var is_global = function ( value ) {
  return value === 'inherit' || value === 'initial' || value === 'unset';
};

var is_font_style = function ( value ) {
  return value === 'normal' || value === 'italic' || value === 'oblique';
};

var is_font_variant = function ( value ) {
  return value === 'none' || value === 'normal' || value === 'small-caps';
};

var is_font_size = function ( value ) {
  return typeof value == 'number' ||
    /^(?:smaller|xx-small|x-small|small|medium|large|x-large|xx-large|larger|(\d+|\d*\.\d+)(px|em|\u0025|cm|in|mm|pc|pt|rem)?)$/.test( value );
};

var get_property_name = function ( value, name ) {
  switch ( true ) {
    case is_global( value ): return name;
    case is_font_style( value ): return 'style';
    case is_font_variant( value ): return 'variant';
    default: return 'weight';
  }
};

var font = function ( style, variant, weight, size, family ) {
  return new Font( style, variant, weight, size, family );
};

var Font = function ( style, variant, weight, size, family ) {
  this.set( style, variant, weight, size, family );
};

Font.prototype = _.create( null );
Font.prototype.constructor = Font;
Font.prototype.style = Font.prototype.variant = Font.prototype.weight = 'normal';
Font.prototype.size = 'medium';
Font.prototype.family = 'sans-serif';

Font.prototype.get = function () {
  return [
    this.style, this.variant, this.weight, this.size,  this.family
  ];
};

/**
 * font.set( 'normal' );
 * font.set( 'Ubuntu' );
 * font.set( '24px', 'Ubuntu, sans-serif' );
 * font.set( 'small-caps', 'larger', 'sans-serif' );
 * font.set( 'italic', '300', '110%', 'serif' );
 * font.set( 'normal', 'normal', 'normal', 'medium', 'sans-serif' );
 */
Font.prototype.set = function ( style, variant, weight, size, family ) {
  if ( style == null ) {
    return this;
  }

  if ( typeof style != 'object' ) {
    if ( variant === undefined ) {
      if ( is_global( style ) || is_font_size( style ) ) {
        this.size = style;
      } else {
        this.family = style;
      }
    } else if ( weight === undefined ) {
      this.size = style;
      this.family = variant;
    } else if ( size === undefined ) {
      this[ get_property_name( style, 'style' ) ] = style;
      this.size = variant;
      this.family = weight;
    } else if ( family === undefined ) {
      var a = get_property_name( style, 'style' ),
          b = get_property_name( variant, a === 'style' ? 'variant' : 'weight' );

      if ( a === b ) {
        b = a === 'style' ? 'variant' : 'weight';
      }

      this[ a ] = style;
      this[ b ] = variant;
      this.size = weight;
      this.family = size;
    } else {
      this.style = style;
      this.variant = variant;
      this.weight = weight;
      this.size = size;
      this.family = family;
    }
  } else {
    this.style = style.style;
    this.variant = style.variant;
    this.weight = style.weight;
    this.size = style.size;
    this.family = style.family;
  }

  return this;
};

Font.prototype.toString = function () {
  return this.style + ' ' + this.variant + ' ' + this.weight + ' ' + ( typeof this.size == 'number' ? this.size + 'px ' : this.size + ' ' ) + this.family;
};

/* IMAGE */

var image = function ( path, x, y, w, h ) {
  return new Image( path, x, y, w, h );
};

/**
 * new v6.Image( <Image> );
 * new v6.Image( <v6.Image> );
 * new v6.Image( path to image );
 * // With the cropping:
 * new v6.Image( ..., crop x, crop y, crop w, crop h );
 * +------+
 * | 1--2 |
 * | |  | |
 * | 3--4 |
 * +------+
 * Where:
 * 1 = crop x
 * 2 = crop y
 * 3 = crop x + crop w
 * 4 = crop y + crop h
 */
var Image = function ( path, x, y, w, h ) {
  if ( path !== undefined ) {
    if ( path instanceof window.Image ) {
      this.source = path;
    } else if ( path instanceof Image ) {
      this.source = path.source;

      if ( !path.loaded ) {
        var image = this;

        _( this.source ).one( 'load', function () {
          image.set( x, y, w, h, true );
        } );
      } else {
        this.set( x, y, w, h, true );
      }
    } else {
      this.source = document.createElement( 'img' );
      this.load( path, x, y, w, h );
    }
  } else {
    this.source = document.createElement( 'img' );
  }
};

Image.prototype = _.create( null );
Image.prototype.constructor = Image;
Image.prototype.x = Image.prototype.y = Image.prototype.width = Image.prototype.height = 0;
Image.prototype.loaded = false;
Image.prototype.path = '';

Image.prototype.set = function ( x, y, w, h, loaded ) {
  this.loaded = loaded;
  this.x = x ? floor( x ) : 0;
  this.y = y ? floor( y ) : 0;

  this.width = w == null ?
    floor( this.source.width - this.x ) : w ?
    floor( w ) : 0;

  this.height = h == null ?
    floor( this.source.height - this.y ) : h ?
    floor( h ) : 0;

  return this;
};

Image.prototype.load = function ( path, x, y, w, h ) {
  var image = this.set( 0, 0, 0, 0, false ),
      source = image.source;

  _( source ).one( 'load', function () {
    image.set( x, y, w, h, true );
  } );

  image.path = source.src = path;
  return image;
};

/* LOADER */

var loader = function () {
  return new Loader();
};

var Loader = function () {
  this.list = _.create( null );
};

Loader.prototype = _.create( null );
Loader.prototype.constructor = Loader;

/**
 * .add( 'id', 'path.json' );
 * .add( 'path.json' );
 * .add( { id: 'path.json' } );
 * .add( [ 'path.json' ] );
 */
Loader.prototype.add = function ( name, path ) {
  if ( typeof name == 'object' ) {
    if ( _.isArray( name ) ) {
      var list = this.list,
          len = name.length,
          i = 0;

      for ( ; i < len; i += 2 ) {
        list[ name[ i ] ] = name[ i + 1 ];
      }
    } else if ( name != null ) {
      _.assign( this.list, name );
    } else {
      throw TypeError();
    }
  } else if ( path === undefined ) {
    this.list[ name ] = name;
  } else {
    this.list[ name ] = path;
  }

  return this;
};

var get_promise = function ( path, name ) {
  return new _.Promise( /\.(?:png|jpe?g)$/i.test( path ) ? function ( resolve, reject ) {
    var image = new Image( path );

    if ( !image.loaded ) {
      var $source = _( image.source );

      var load = function () {
        $source.off( 'error', error );
        resolve( [ name, image ] );
      };

      var error = function () {
        $source.off( 'load', load );
        reject( [ 'Failed to load ' + path, path ] );
      };

      $source
        .one( 'load', load )
        .one( 'error', error );
    } else {
      resolve( [ name, image ] );
    }
  } : function ( resolve, reject ) {
    _.file( path, {
      onload: function ( file ) {
        resolve( [ name, file ] );
      },

      onerror: function () {
        reject( [ 'Failed to load ' + path, path ] );
      }
    } );
  } );
};

var load_err = function ( data ) {
  err( data[ 0 ] );
};

// var files = {
//    data: 'data.json'
// };
//
// var onload = function ( files ) {
//   console.log( 'Loaded: ', JSON.parse( files.data ) );
// };
//
// v6.loader()
//   .add( files )
//   .load( onload );

Loader.prototype.load = function ( setup, error ) {
  var list = this.list,
      names = _.keys( list ),
      length = names.length,
      promises = Array( length ),
      i = 0;

  for ( ; i < length; ++i ) {
    promises[ i ] = get_promise( list[ names[ i ] ], names[ i ] );
  }

  _.Promise.all( promises )
    .then( setup, error || load_err );

  return this;
};

/* RENDERER2D SHAPES */

var shape = function ( draw, no_fill, no_stroke ) {
  return function ( vertices, close ) {
    var fill = !no_fill && this.style.doFill,
        stroke = !no_stroke && this.style.doStroke,
        context = this.context;

    if ( vertices.length && ( fill || stroke || no_stroke && no_fill ) ) {
      draw.call( this, context, vertices );

      if ( fill ) {
        this._fill();
      }

      if ( stroke ) {
        this._stroke( close );
      }
    }
  };
};

var shapes = {
  points: shape( function ( context, vertices ) {
    var len = vertices.length,
        r = this.style.lineWidth,
        i = 0;

    context.fillStyle = this.style.strokeStyle;

    for ( ; i < len; i += 2 ) {
      context.beginPath();
      context.arc( vertices[ i ], vertices[ i + 1 ], r, 0, pi * 2 );
      context.fill();
    }
  }, true, true ),

  lines: shape( function ( context, vertices ) {
    var len = vertices.length,
        i = 2;

    context.beginPath();
    context.moveTo( vertices[ 0 ], vertices[ 1 ] );

    for ( ; i < len; i += 2 ) {
      context.lineTo( vertices[ i ], vertices[ i + 1 ] );
    }
  } )
};

/* RENDERER2D */

// var SCALE = window.devicePixelRatio || 1;
//
// var options = {
//   settings: {
//     scale: SCALE // default 1
//   }, // default default_options.renderer.settings
//
//   alpha : false, // default true
//   width : 100,   // default window width
//   height: 100    // default window height
// }; // default default_options.renderer
//
// var renderer = new v6.Renderer2D( options );

var Renderer2D = function ( options ) {
  create_renderer( this, '2d', options );

  this.state = {
    beginPath: false
  };
};

Renderer2D.prototype = _.create( null );
Renderer2D.prototype.constructor = Renderer2D;

/**
 * Adds <v6.Renderer2D>.canvas to the body element.
 */
Renderer2D.prototype.add = function () {
  return document.body.appendChild( this.canvas ), this;
};

/**
 * Removes all event listeners bound to
 * <v6.Renderer2D>.canvas (via peako.js)
 * and remove it from the html.
 */
Renderer2D.prototype.destroy = function () {
  return _( this.canvas ).off().remove(), this;
};

/**
 * Pushes the current style into the stack of saved styles.
 */
Renderer2D.prototype.push = function () {
  this.saves.push( clone_style( this.style, {
    fillStyle: {},
    font: {},
    strokeStyle: {}
  } ) );

  return this;
};

Renderer2D.prototype.pop = function () {
  return this.saves.length && clone_style( this.saves.pop(), this.style ), this;
};

Renderer2D.prototype.smooth = function ( value ) {
  return this.settings.smooth = set_image_smoothing( this.context, value ), this;
};

Renderer2D.prototype.resize = function ( w, h ) {
  var scale = this.settings.scale,
      canvas = this.canvas,
      style = canvas.style;

  // rescale canvas
  if ( w === undefined ) {
    w = this.rWidth;
    h = this.rHeight;
  } else {
    this.rWidth = w;
    this.rHeight = h;
  }

  style.width = w + 'px';
  style.height = h + 'px';
  canvas.width = this.width = w * scale;
  canvas.height = this.height = h * scale;
  return this;
};

Renderer2D.prototype.fullwindow = function () {
  var window = _( this.canvas.ownerDocument.defaultView );
  return this.resize( window.width(), window.height() );
};

Renderer2D.prototype.backgroundColor = function ( a, b, c, d ) {
  this.context.save();
  this.context.setTransform( this.settings.scale, 0, 0, this.settings.scale, 0, 0 );
  this.context.fillStyle = this.color( a, b, c, d );
  this.context.fillRect( 0, 0, this.width, this.height );
  this.context.restore();
  return this;
};

Renderer2D.prototype.backgroundImage = function ( image ) {
  var style = this.style,
      rectAlignX = style.rectAlignX,
      rectAlignY = style.rectAlignY;

  style.rectAlignX = 'left';
  style.rectAlignY = 'top';

  if ( image.width / ( image.height / this.height ) < this.width ) {
    this.image( image, 0, 0, this.width, 'auto' );
  } else {
    this.image( image, 0, 0, 'auto', this.height );
  }

  style.rectAlignX = rectAlignX;
  style.rectAlignY = rectAlignY;
  return this;
};

Renderer2D.prototype.background = function ( a, b, c, d ) {
  return this[ a instanceof Image ?
    'backgroundImage' :
    'backgroundColor' ]( a, b, c, d );
};

Renderer2D.prototype.clear = function ( x, y, w, h ) {
  if ( x === undefined ) {
    x = y = 0;
    w = this.width;
    h = this.height;
  } else {
    x = floor( align( x, w, this.style.rectAlignX ) );
    y = floor( align( y, h, this.style.rectAlignY ) );
  }

  this.context.clearRect( x, y, w, h );
  return this;
};

Renderer2D.prototype.rect = function ( x, y, w, h ) {
  x = floor( align( x, w, this.style.rectAlignX ) );
  y = floor( align( y, h, this.style.rectAlignY ) );

  if ( this.state.beginPath ) {
    this.context.rect( x, y, w, h );
  } else {
    this.context.beginPath();
    this.context.rect( x, y, w, h );

    if ( this.style.doFill ) {
      this._fill();
    }

    if ( this.style.doStroke ) {
      this._stroke();
    }
  }

  return this;
};

Renderer2D.prototype.line = function ( x1, y1, x2, y2 ) {
  if ( this.state.beginPath ) {
    this.context.moveTo( x1, y1 );
    this.context.lineTo( x2, y2 );
  } else if ( this.style.doStroke ) {
    this.context.beginPath();
    this.context.moveTo( x1, y1 );
    this.context.lineTo( x2, y2 );
    this._stroke();
  }

  return this;
};

/**
 * width and height can be:
 * 'initial' (same as image.width or height)
 * 'auto' (will be calculated proportionally width or height)
 * .image( v6.image( '50x100.jpg' ), 0, 0, 'auto', 200 );
 * // Draw an image stretched to 100x200.
 */
Renderer2D.prototype.image = function ( image, x, y, width, height ) {
  if ( image == null ) {
    throw TypeError( image + ' is not an object' );
  }

  if ( image.loaded ) {
    var w = typeof width != 'string' ? width : width == 'auto' || width == 'initial' ? image.width : 0,
        h = typeof height != 'string' ? height : height == 'auto' || height == 'initial' ? image.height : 0;

    if ( width === 'auto' ) {
      w /= image.height / h;
    }

    if ( height === 'auto' ) {
      h /= image.width / w;
    }

    x = floor( align( x, w, this.style.rectAlignX ) );
    y = floor( align( y, h, this.style.rectAlignY ) );
    this.context.drawImage( image.source, image.x, image.y, image.width, image.height, x, y, w, h );
  }

  return this;
};

Renderer2D.prototype.text = function ( text, x, y, maxWidth, maxHeight ) {
  var style = this.style,
      doFill = style.doFill,
      doStroke = style.doStroke && style.lineWidth > 0;

  if ( !( doFill || doStroke ) || !( text += '' ).length ) {
    return this;
  }

  text = text.split( '\n' );
  x = floor( x );
  y = floor( y );

  var context = this.context,
      lineHeight = style.lineHeight,
      maxLength = maxHeight === undefined ? Infinity : floor( maxHeight / lineHeight ),
      i, length, line, words, word, test, j, k, splittedtext;

  if ( maxWidth !== undefined ) {
    splittedtext = [];

    for ( i = 0, length = text.length; i < length && splittedtext.length < maxLength; ++i ) {
      words = text[ i ].match( /\s+|\S+/g ) || [];
      line = '';

      for ( j = 0, k = words.length; j < k && splittedtext.length < maxLength; ++j ) {
        word = words[ j ];
        test = line + word;

        if ( context.measureText( test ).width > maxWidth ) {
          splittedtext.push( line );
          line = word;
        } else {
          line = test;
        }
      }

      splittedtext.push( line );
    }

    text = splittedtext;
  }

  if ( text.length > maxLength ) {
    text.length = maxLength;
  }

  context.font = style.font.toString();
  context.textAlign = style.textAlign;
  context.textBaseline = style.textBaseline;

  if ( doFill ) {
    context.fillStyle = style.fillStyle;
  }

  if ( doStroke ) {
    context.strokeStyle = style.strokeStyle;
    context.lineWidth = style.lineWidth;
  }

  for ( i = 0, length = text.length; i < length; ++i ) {
    line = text[ i ];

    if ( doFill ) {
      context.fillText( line, x, y + i * lineHeight );
    }

    if ( doStroke ) {
      context.strokeText( line, x, y + i * lineHeight );
    }
  }

  return this;
};

Renderer2D.prototype.arc = function ( x, y, r, begin, end, anticlockwise ) {
  if ( begin === undefined ) {
    begin = 0;
    end = pi * 2;
  } else if ( settings.degrees ) {
    begin *= pi / 180;
    end *= pi / 180;
  }

  if ( !this.state.beginPath ) {
    this.context.beginPath();
    this.context.arc( x, y, r, begin, end, anticlockwise );

    if ( this.style.doFill ) {
      this._fill();
    }

    if ( this.style.doStroke ) {
      this._stroke( true );
    }
  } else {
    this.context.arc( x, y, r, begin, end, anticlockwise );
  }

  return this;
};

Renderer2D.prototype.filter = function ( filter, x, y, w, h ) {
  if ( x === undefined ) {
    x = y = 0;
    w = this.width;
    h = this.height;
  } else {
    x = floor( align( x, w, this.style.rectAlignX ) );
    y = floor( align( y, h, this.style.rectAlignY ) );
  }

  var image_data = this.context.getImageData( x, y, w, h );
  filter.call( this, image_data.data );
  this.context.putImageData( image_data, x, y );
  return this;
};

Renderer2D.prototype.font = function ( a, b, c, d, e ) {
  return this.style.font.set( a, b, c, d, e ), this;
};

Renderer2D.prototype.save = function () {
  return this.context.save(), this;
};

Renderer2D.prototype.restore = function () {
  return this.context.restore(), this;
};

Renderer2D.prototype.noFill = function () {
  return this.style.doFill = false, this;
};

Renderer2D.prototype.noStroke = function () {
  return this.style.doStroke = false, this;
};

Renderer2D.prototype.beginShape = function () {
  return this.vertices.length = 0, this;
};

Renderer2D.prototype.vertex = function ( x, y ) {
  return this.vertices.push( floor( x ), floor( y ) ), this;
};

Renderer2D.prototype.endShape = function ( type, close ) {
  if ( typeof type != 'string' ) {
    close = type;
    type = 'lines';
  }

  return shapes[ type ].call( this, this.vertices, close ), this;
};

Renderer2D.prototype.rectAlign = function ( x, y ) {
  if ( x != null ) {
    this.style.rectAlignX = x;
  }

  if ( y != null ) {
    this.style.rectAlignY = y;
  }

  return this;
};

Renderer2D.prototype.color = function ( a, b, c, d ) {
  return typeof a == 'string' ?
    v6[ this.settings.colorMode ]( parse_color( a ) ) :
    v6[ this.settings.colorMode ]( a, b, c, d );
};

Renderer2D.prototype.colorMode = function ( mode ) {
  return this.settings.colorMode = mode, this;
};

var get_polygon = function ( n ) {
  return polygons[ n ] ||
    ( polygons[ n ] = create_polygon( n ) );
};

Renderer2D.prototype._polygon = function ( x, y, rx, ry, n, a, degrees ) {
  var polygon = get_polygon( n ),
      context = this.context;

  context.save();
  context.translate( x, y );
  context.rotate( degrees ? a * pi / 180 : a );
  this.drawVertices( polygon, polygon.length >> 1, rx, ry );
  context.restore();
  return this;
};

Renderer2D.prototype.polygon = function ( x, y, r, n, a ) {
  // Reduce the precision (of what?)
  // for better caching functionality.
  // When `n` is `3.141592`, `n` will be `3.14`.
  if ( n % 1 ) {
    n = floor( n * 100 ) * 0.01;
  }

  if ( a === undefined ) {
    this._polygon( x, y, r, r, n, -pi * 0.5 );
  } else {
    this._polygon( x, y, r, r, n, a, settings.degrees );
  }

  return this;
};

Renderer2D.prototype.drawVertices = function ( data, length, _rx, _ry ) {
  var context, i;

  if ( length <= 2 ) {
    return this;
  }

  // this is a temporary (hopeful) solution (incomplete)
  if ( _rx == null ) {
    _rx = _ry = 1;
  }

  context = this.context;
  context.beginPath();
  context.moveTo( data[ 0 ] * _rx, data[ 1 ] * _ry );

  for ( i = 2, length *= 2; i < length; i += 2 ) {
    context.lineTo( data[ i ] * _rx, data[ i + 1 ] * _ry );
  }

  if ( this.style.doFill ) {
    this._fill();
  }

  if ( this.style.doStroke && this.style.lineWidth > 0 ) {
    this._stroke( true );
  }

  return this;
};

Renderer2D.prototype.point = function ( x, y ) {
  if ( this.style.doStroke ) {
    this.context.beginPath();
    this.context.arc( x, y, this.style.lineWidth * 0.5, 0, pi * 2 );
    this.context.fillStyle = this.style.strokeStyle;
    this.context.fill();
  }

  return this;
};

Renderer2D.prototype.beginPath = function () {
  this.state.beginPath = true;
  this.context.beginPath();
  return this;
};

Renderer2D.prototype.closePath = function () {
  this.state.beginPath = false;
  this.context.closePath();
  return this;
};

Renderer2D.prototype.getImageData = function ( x, y, w, h ) {
  return this.context.getImageData( x, y, w, h );
};

Renderer2D.prototype.putImageData = function ( imageData, x, y, sx, sy, sw, sh ) {
  if ( sx !== undefined ) {
    this.context.putImageData( imageData, x, y, sx, sy, sw, sh );
  } else {
    this.context.putImageData( imageData, x, y );
  }

  return this;
};

Renderer2D.prototype.rotate = function ( angle ) {
  return this.context.rotate( settings.degrees ? angle * pi / 180 : angle ), this;
};

Renderer2D.prototype._fill = function () {
  this.context.fillStyle = this.style.fillStyle;
  this.context.fill();
  return this;
};

Renderer2D.prototype._stroke = function ( close ) {
  var ctx = this.context,
      style = this.style;

  if ( close ) {
    ctx.closePath();
  }

  ctx.strokeStyle = style.strokeStyle;

  if ( ( ctx.lineWidth = style.lineWidth ) <= 1 ) {
    ctx.stroke();
  }

  ctx.stroke();
  return this;
};

Renderer2D.prototype.camera = function ( options ) {
  return new Camera( options, this );
};

Renderer2D.prototype.setTransformFromCamera = function ( camera ) {
  var scale = camera.scale[ 0 ],
      location = camera.location;

  return this.setTransform(
    scale,
    0,
    0,
    scale,
    location[ 0 ] * scale,
    location[ 1 ] * scale );
};

_.forOwnRight( {
  fontVariant: 'variant', fontStyle: 'style',
  fontWeight:  'weight',  fontSize:  'size',
  fontFamily:  'family'
}, function ( name, methodname ) {
  /* jshint evil: true */
  this[ methodname ] = Function( 'value', 'return this.style.font.' + name + ' = value, this;' );
  /* jshint evil: false */
}, Renderer2D.prototype );

_.forEachRight( [
  'scale',  'translate', 'moveTo', 'lineTo', 'setTransform', 'transform'
], function ( name ) {
  /* jshint evil: true */
  this[ name ] = Function( 'a, b, c, d, e, f', 'return this.context.' + name + '( a, b, c, d, e, f ), this;' );
  /* jshint evil: false */
}, Renderer2D.prototype );

_.forEachRight( [
  'lineWidth', 'lineHeight', 'textAlign', 'textBaseline'
], function ( name ) {
  /* jshint evil: true */
  this[ name ] = Function( 'value', 'return this.style.' + name + ' = value, this;' );
  /* jshint evil: false */
}, Renderer2D.prototype );

_.forOwnRight( { fill: 'fillStyle', stroke: 'strokeStyle' }, function ( name, method_name ) {
  var style = _.upperFirst( method_name ),
      do_style = 'do' + style,
      _method_name = '_' + method_name;

  this[ method_name ] = function ( a, b, c, d ) {
    if ( a === undefined ) {
      this[ _method_name ]();
    } else if ( typeof a != 'boolean' ) {
      this.style[ do_style ] = true;

      if ( typeof a != 'string' && this.style[ name ].type === this.settings.colorMode ) {
        this.style[ name ].set( a, b, c, d );
      } else {
        this.style[ name ] = this.color( a, b, c, d );
      }
    } else {
      this.style[ do_style ] = a;
    }

    return this;
  };
}, Renderer2D.prototype );

/* PROGRAM */

var program = function ( context, vShader, fShader ) {
  return new Program( context, vShader, fShader );
};

var Program = function ( context, vShader, fShader ) {
  this.program = create_program( context, vShader, fShader );
  this.context = context;
  this.vShader = vShader;
  this.fShader = fShader;
  this.attributes = _.create( null );
  this.uniforms = _.create( null );
  this.samplers = [];
  this.loadAttributes();
  this.loadUniforms();
};

Program.prototype = _.create( null );
Program.prototype.constructor = Program;
Program.prototype.loadedAttributes = Program.prototype.loadedUniforms = false;

Program.prototype.loadAttributes = function () {
  if ( !this.loadedAttributes ) {
    var gl = this.context,
        program = this.program,
        attrs = this.attributes,
        i = gl.getProgramParameter( program, gl.ACTIVE_ATTRIBUTES ) - 1,
        info, name, attr;

    for ( ; i >= 0; --i ) {
      info = gl.getActiveAttrib( program, i );
      name = info.name;
      attr = attrs[ name ] = _.create( null );
      attr.name = name;
      attr.type = info.type;
      attr.size = info.size;
      attr.location = gl.getAttribLocation( program, name );
    }

    this.loadedAttributes = true;
  }

  return this;
};

Program.prototype.loadUniforms = function () {
  if ( !this.loadedUniforms ) {
    var gl = this.context,
        program = this.program,
        samplers = this.samplers,
        uniforms = this.uniforms,
        i = gl.getProgramParameter( program, gl.ACTIVE_UNIFORMS ) - 1,
        samplerIndex = -1,
        info, name, uniform, index;

    for ( ; i >= 0; --i ) {
      info = gl.getActiveUniform( program, i );
      name = info.name;
      uniform = _.create( null );
      uniform.size = info.size;
      uniform.type = info.type;
      uniform.location = gl.getUniformLocation( program, name );

      if ( info.size > 1 && ( index = name.indexOf( '[0]' ) ) >= 0 ) {
        name = name.slice( 0, index );
      }

      uniforms[ uniform.name = name ] = uniform;

      if ( uniform.type === gl.SAMPLER_2D ) {
        uniform.samplerIndex = ++samplerIndex;
        samplers.push( uniform );
      }
    }

    this.loadedUniforms = true;
  }

  return this;
};

Program.prototype.use = function () {
  return this.context.useProgram( this.program ), this;
};

// from p5
Program.prototype.uniform = function ( name, data ) {
  var gl = this.context,
      uniform = this.uniforms[ name ];

  switch ( uniform.type ) {
    case gl.BOOL: gl.uniform1i( uniform.location, data ? 1 : 0 ); break;
    case gl.INT: gl.uniform1i( uniform.location, data ); break;
    case gl.FLOAT: gl[ uniform.size > 1 ? 'uniform1fv' : 'uniform1f' ]( uniform.location, data ); break;
    case gl.FLOAT_MAT3: gl.uniformMatrix3fv( uniform.location, false, data ); break;
    case gl.FLOAT_MAT4: gl.uniformMatrix4fv( uniform.location, false, data ); break;
    case gl.FLOAT_VEC2: uniform.size > 1 ? gl.uniform2fv( uniform.location, data ) : gl.uniform2f( uniform.location, data[ 0 ], data[ 1 ] ); break;
    case gl.FLOAT_VEC3: uniform.size > 1 ? gl.uniform3fv( uniform.location, data ) : gl.uniform3f( uniform.location, data[ 0 ], data[ 1 ], data[ 2 ] ); break;
    case gl.FLOAT_VEC4: uniform.size > 1 ? gl.uniform4fv( uniform.location, data ) : gl.uniform4f( uniform.location, data[ 0 ], data[ 1 ], data[ 2 ], data[ 3 ] ); break;
    default: throw TypeError( "This uniform type isn't supported for setting: " + uniform.type );
  }

  return this;
};

Program.prototype.vertexPointer = function ( index, size, type, normalized, stride, offset ) {
  this.context.enableVertexAttribArray( index );
  this.context.vertexAttribPointer( index, size, type, normalized, stride, offset );
  return this;
};

var create_program = function ( context, vShader, fShader ) {
  var program = context.createProgram();

  context.attachShader( program, vShader );
  context.attachShader( program, fShader );
  context.linkProgram( program );

  if ( !context.getProgramParameter( program, context.LINK_STATUS ) ) {
    throw Error( 'Unable to initialize the shader program' );
  }

  context.validateProgram( program );

  if ( !context.getProgramParameter( program, context.VALIDATE_STATUS ) ) {
    throw Error( 'Unable to validate the shader program' );
  }

  return program;
};

/* SHADER */

var shader = function ( v, f ) {
  return new Shader( v, f );
};

var Shader = function ( v, f ) {
  this.vShaderSource = v;
  this.fShaderSource = f;
  this.programs = _.create( null );
};

Shader.prototype = _.create( null );
Shader.prototype.constructor = Shader;

Shader.prototype.create = function ( renderer ) {
  if ( !this.programs[ renderer.index ] ) {
    this.programs[ renderer.index ] = new Program( renderer.context,
      create_shader( renderer.context, this.vShaderSource, renderer.context.VERTEX_SHADER ),
      create_shader( renderer.context, this.fShaderSource, renderer.context.FRAGMENT_SHADER ) );
  }

  return this;
};

Shader.prototype.use = function ( renderer ) {
  return this.programs[ renderer.index ].use(), this;
};

Shader.prototype.program = function ( renderer ) {
  return this.programs[ renderer.index ];
};

Shader.prototype.uniform = function ( renderer, name, data ) {
  return this.programs[ renderer.index ].uniform( name, data ), this;
};

Shader.prototype.vertexPointer = function ( renderer, index, size, type, normalized, stride, offset ) {
  return this.programs[ renderer.index ].vertexPointer( index, size, type, normalized, stride, offset ), this;
};

var create_shader = function ( context, source, type ) {
  var shader = context.createShader( type );

  context.shaderSource( shader, source );
  context.compileShader( shader );

  if ( !context.getShaderParameter( shader, context.COMPILE_STATUS ) ) {
    throw SyntaxError( 'An error occurred compiling the shaders: ' + context.getShaderInfoLog( shader ) );
  }

  return shader;
};

var get_source = function ( script ) {
  var child = script.firstChild,
      source = '';

  while ( child ) {
    // If it's a text node.
    if ( child.nodeType == 3 ) {
      source += child.textContent;
    }

    child = child.nextSibling;
  }

  return source;
};

/**
 * Wrapper for WebGL buffer.
 * But I want to delete this.
 */

var buffer = function ( context ) {
  return new Buffer( context );
};

var Buffer = function ( context ) {
  this.context = context;
  this.buffer = context.createBuffer();
};

Buffer.prototype = _.create( null );
Buffer.prototype.constructor = Buffer;

Buffer.prototype.bind = function () {
  return this.context.bindBuffer( this.context.ARRAY_BUFFER, this.buffer ), this;
};

Buffer.prototype.data = function ( data, mode ) {
  return this.context.bufferData( this.context.ARRAY_BUFFER, data, mode === undefined ? this.context.STATIC_DRAW : mode ), this;
};

/* TRANSFORM */

// webgl-2d transform class implementation

var Transform = function () {
  this.stack = [];
  this.matrix = mat3.identity();
};

Transform.prototype = _.create( null );
Transform.prototype.constructor = Transform;
Transform.prototype.index = -1;

Transform.prototype.set = function ( a, b, c, d, e, f ) {
  var matrix = this.matrix;
  matrix[ 0 ] = a; // x scale
  matrix[ 1 ] = b; // x skew
  matrix[ 3 ] = c; // y skew
  matrix[ 4 ] = d; // y scale
  matrix[ 6 ] = e; // x translate
  matrix[ 7 ] = f; // y translate
  return this;
};

Transform.prototype.save = function () {
  // Why create a matrix again, if it already exists?
  if ( this.stack[ ++this.index ] ) {
    mat3.copy( this.stack[ this.index ], this.matrix );
  } else {
    this.stack.push( mat3.clone( this.matrix ) );
  }

  return this;
};

Transform.prototype.restore = function () {
  // If the stack isn't empty, restore the last value.
  if ( this.stack.length ) {
    mat3.copy( this.matrix, this.stack[ this.index-- ] );

  // Restore the default values.
  } else {
    mat3.setIdentity( this.matrix );
  }

  return this;
};

Transform.prototype.translate = function ( x, y ) {
  return mat3.translate( this.matrix, x, y ), this;
};

Transform.prototype.rotate = function ( angle ) {
  return mat3.rotate( this.matrix, angle ), this;
};

Transform.prototype.scale = function ( x, y ) {
  return mat3.scale( this.matrix, x, y ), this;
};

Transform.prototype.transform = function ( m11, m12, m21, m22, dx, dy ) {
  var matrix = this.matrix;
  matrix[ 0 ] *= m11;
  matrix[ 1 ] *= m21;
  matrix[ 2 ] *= dx;
  matrix[ 3 ] *= m12;
  matrix[ 4 ] *= m22;
  matrix[ 5 ] *= dy;
  matrix[ 6 ] = 0;
  matrix[ 7 ] = 0;
  return this;
};

/* MATRIX3 */

var mat3 = {
  identity: function () {
    return [
      1, 0, 0,
      0, 1, 0,
      0, 0, 1
    ];
  },

  setIdentity: function ( m1 ) {
    m1[ 0 ] = m1[ 4 ] = m1[ 8 ] = 1;
    m1[ 1 ] = m1[ 2 ] = m1[ 3 ] = m1[ 5 ] = m1[ 6 ] = m1[ 7 ] = 0;
    return m1;
  },

  clone: function ( m1 ) {
    return [
      m1[ 0 ], m1[ 1 ], m1[ 2 ],
      m1[ 3 ], m1[ 4 ], m1[ 5 ],
      m1[ 6 ], m1[ 7 ], m1[ 8 ]
    ];
  },

  copy: function ( m1, m2 ) {
    m1[ 0 ] = m2[ 0 ];
    m1[ 1 ] = m2[ 1 ];
    m1[ 2 ] = m2[ 2 ];
    m1[ 3 ] = m2[ 3 ];
    m1[ 4 ] = m2[ 4 ];
    m1[ 5 ] = m2[ 5 ];
    m1[ 6 ] = m2[ 6 ];
    m1[ 7 ] = m2[ 7 ];
    m1[ 8 ] = m2[ 8 ];
    return m1;
  },

  // from glMatrix
  translate: function ( m1, x, y ) {
    m1[ 6 ] = x * m1[ 0 ] + y * m1[ 3 ] + m1[ 6 ];
    m1[ 7 ] = x * m1[ 1 ] + y * m1[ 4 ] + m1[ 7 ];
    m1[ 8 ] = x * m1[ 2 ] + y * m1[ 5 ] + m1[ 8 ];
    return m1;
  },

  // from glMatrix
  rotate: function ( m1, angle ) {
    var m10 = m1[ 0 ], m11 = m1[ 1 ], m12 = m1[ 2 ],
        m13 = m1[ 3 ], m14 = m1[ 4 ], m15 = m1[ 5 ],
        x = cos( angle ),
        y = sin( angle );

    m1[ 0 ] = x * m10 + y * m13;
    m1[ 1 ] = x * m11 + y * m14;
    m1[ 2 ] = x * m12 + y * m15;
    m1[ 3 ] = x * m13 - y * m10;
    m1[ 4 ] = x * m14 - y * m11;
    m1[ 5 ] = x * m15 - y * m12;
    return m1;
  },

  // from p5
  scale: function ( m1, x, y ) {
    m1[ 0 ] *= x;
    m1[ 1 ] *= x;
    m1[ 2 ] *= x;
    m1[ 3 ] *= y;
    m1[ 4 ] *= y;
    m1[ 5 ] *= y;
    return m1;
  }
};

var default_shaders = {

  vertex:

'precision mediump float;' +
'precision mediump int;' +
'attribute vec2 a_position;' +
'uniform vec2 u_resolution;' +
'uniform mat3 u_transform;' +

'void main () {' +
  'gl_Position = vec4( ( ( u_transform * vec3( a_position, 1.0 ) ).xy / u_resolution * 2.0 - 1.0 ) * vec2( 1, -1 ), 0, 1 );' +
'}',

  fragment:

'precision mediump float;' +
'precision mediump int;' +
'uniform vec4 u_color;' +

'void main () {' +
  'gl_FragColor = vec4( u_color.rgb / 255.0, u_color.a );' +
'}',

  background_vertex:

'precision lowp float;' +
'precision lowp int;' +
'attribute vec2 a_position;' +

'void main () {' +
  'gl_Position = vec4( a_position, 0, 1 );' +
'}',

  background_fragment:

'precision lowp float;' +
'precision lowp int;' +
'uniform vec4 u_color;' +

'void main () {' +
  'gl_FragColor = u_color;' +
'}'

};

var shaders = new Shader( default_shaders.vertex, default_shaders.fragment ),
    background_shaders = new Shader( default_shaders.background_vertex, default_shaders.background_fragment );

/**
 * In most cases, on phones (except iOS Safari)
 * `RendererWebGL` works faster than `Renderer2D`.
 */

var RendererWebGL = function ( options ) {
  create_renderer( this, 'webgl', options );
  /** For transformation functions (scale, translate, save...). */
  this.matrix = new Transform();
  /** Standard buffer, shaders, program - will be used in most cases. */
  this.buffer = new Buffer( this.context );
  this.shaders = shaders.create( this );
  this.program = shaders.program( this );
  /** Transformation isn't supported. */
  this.backgroundBuffer = new Buffer( this.context ).bind().data( background_vertices );
  this.backgroundShaders = background_shaders.create( this );
  this.backgroundProgram = background_shaders.program( this );
  /** With a separate buffer, `rect` will run a little faster. (maybe add buffers for the arc?) */
  this.rectangleBuffer = new Buffer( this.context ).bind().data( rectangle_vertices );
  /** Some weird bullshit. */
  this.blending( true );
};

RendererWebGL.prototype = _.create( null );
RendererWebGL.prototype.constructor = RendererWebGL;
RendererWebGL.prototype.add = Renderer2D.prototype.add;
RendererWebGL.prototype.destroy = Renderer2D.prototype.destroy;
RendererWebGL.prototype.push = Renderer2D.prototype.push;
RendererWebGL.prototype.pop = Renderer2D.prototype.pop;

RendererWebGL.prototype.resize = function ( w, h ) {
  Renderer2D.prototype.resize.call( this, w, h );
  this.context.viewport( 0, 0, this.width, this.height );
  return this;
};

RendererWebGL.prototype.fullwindow = Renderer2D.prototype.fullwindow;

RendererWebGL.prototype.blending = function ( blending ) {
  var gl = this.context;

  if ( blending ) {
    gl.enable( gl.BLEND );
    gl.disable( gl.DEPTH_TEST );
    gl.blendFunc( gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA );
    gl.blendEquation( gl.FUNC_ADD );
  } else {
    gl.disable( gl.BLEND );
    gl.enable( gl.DEPTH_TEST );
    gl.depthFunc( gl.LEQUAL );
  }

  return this;
};

RendererWebGL.prototype._clear_color = function ( r, g, b, a ) {
  var gl = this.context;
  gl.clearColor( r, g, b, a );
  gl.clear( gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT );
  return this;
};

RendererWebGL.prototype.clearColor = function ( a, b, c, d ) {
  var rgba = fast_rgba( this.color( a, b, c, d ) );

  return this._clear_color(
    rgba[ 0 ] / 255,
    rgba[ 1 ] / 255,
    rgba[ 2 ] / 255,
    rgba[ 3 ] );
};

var background_vertices = new Float32Array( [
  -1,  1,
   1,  1,
   1, -1,
  -1, -1
] );

RendererWebGL.prototype._background_color = function ( r, g, b, a ) {
  var gl = this.context,
      backgroundProgram = this.backgroundProgram;

  this.backgroundBuffer.bind();

  backgroundProgram
    .use()
    .uniform( 'u_color', [ r, g, b, a ] )
    .vertexPointer( backgroundProgram.attributes.a_position.location, 2, gl.FLOAT, false, 0, 0 );

  gl.drawArrays( gl.TRIANGLE_FAN, 0, 4 );
  return this;
};

var fast_rgba = function ( color ) {
  if ( color.type === 'rgba' ) {
    return color;
  }

  return color.rgba();
};

RendererWebGL.prototype.backgroundColor = function ( a, b, c, d ) {
  return this.clearColor( a, b, c, d );

  /* var rgba = fast_rgba( this.color( a, b, c, d ) ),
      r, g;

  r = rgba[ 0 ] / 255;
  g = rgba[ 1 ] / 255;
  b = rgba[ 2 ] / 255;
  a = rgba[ 3 ];

  return this[ a < 1 ?
    '_background_color' :
    '_clear_color' ]( r, g, b, a ); */
};

RendererWebGL.prototype.background = Renderer2D.prototype.background;

RendererWebGL.prototype.clear = function ( /* x, y, w, h */ ) {
  return this._clear_color( 0, 0, 0, 0 );
};

/**
 * `data`: Shape vertices [x1, y1, x2, y2...].
 * `length`: Number of vertices (not length of the data!).
 */
RendererWebGL.prototype.drawVertices = function ( data, length ) {
  var gl = this.context,
      program = this.program;

  if ( length <= 2 ) {
    return this;
  }

  if ( data ) {
    this.buffer
      .bind()
      .data( data );
   }

  program
    .use()
    .uniform( 'u_resolution', [ this.width, this.height ] )
    .uniform( 'u_transform', this.matrix.matrix )
    .vertexPointer( program.attributes.a_position.location, 2, gl.FLOAT, false, 0, 0 );

  if ( this.style.doFill ) {
    program.uniform( 'u_color', this.style.fillStyle.rgba() );
    gl.drawArrays( gl.TRIANGLE_FAN, 0, length );
  }

  if ( this.style.doStroke && this.style.lineWidth > 0 ) {
    program.uniform( 'u_color', this.style.strokeStyle.rgba() );
    gl.lineWidth( this.style.lineWidth );
    gl.drawArrays( gl.LINE_LOOP, 0, length );
  }

  return this;
};

/**
 * 1--------2
 * |        |
 * |        |
 * 4--------3
 */
var rectangle_vertices = new Float32Array( [
  0, 0, /* 1 */
  1, 0, /* 2 */
  1, 1, /* 3 */
  0, 1  /* 4 */
] );

RendererWebGL.prototype.rect = function ( x, y, w, h ) {
  x = align( x, w, this.style.rectAlignX );
  y = align( y, h, this.style.rectAlignY );

  this.matrix
    .save()
    .translate( x, y )
    .scale( w, h );

  this.rectangleBuffer.bind();
  this.drawVertices( null, 4 );
  this.matrix.restore();
  return this;
};

RendererWebGL.prototype.line = function ( x1, y1, x2, y2 ) {
  if ( !this.style.doStroke || this.style.lineWidth <= 0 ) {
    return this;
  }

  var gl = this.context,
      buffer = this.buffer,
      program = this.program,
      vertices = new Float32Array( 4 );

  vertices[ 0 ] = x1;
  vertices[ 1 ] = y1;
  vertices[ 2 ] = x2;
  vertices[ 3 ] = y2;

  buffer
    .bind()
    .data( vertices );

  program
    .use()
    .uniform( 'u_color', this.style.strokeStyle.rgba() )
    .uniform( 'u_resolution', [ this.width, this.height ] )
    .uniform( 'u_transform', this.matrix.matrix )
    .vertexPointer( program.attributes.a_position.location, 2, gl.FLOAT, false, 0, 0 );

  gl.lineWidth( this.style.lineWidth );
  gl.drawArrays( gl.LINE_LOOP, 0, 2 );

  return this;
};

/**
 * Cached polygons vertices.
 */
var polygons = _.create( null );

/**
 * Creates polygon vertices with `n` resolution.
 * Values will be between -1 and 1 (sin and cos uses).
 */
var create_polygon = function ( n ) {
  var step = 2 * pi / n,
      int_n = floor( n ),
      vertices = new Float32Array( int_n * 2 + 2 ),
      i = int_n,
      angle = step * n;

  vertices[     int_n * 2 ] = cos( angle );
  vertices[ 1 + int_n * 2 ] = sin( angle );

  for ( ; i >= 0; --i ) {
    vertices[     i * 2 ] = cos( angle = step * i );
    vertices[ 1 + i * 2 ] = sin( angle );
  }

  return vertices;
};

/**
 * Draw polygon in `x` and `y` location with
 * the width (2 * `rx`) and height (2 * `ry`),
 * resolution `n`, and rotated by `a` angle.
 */
RendererWebGL.prototype._polygon = function ( x, y, rx, ry, n, a, degrees ) {
  var polygon = get_polygon( n );

  this.matrix
    .save()
    .translate( x, y )
    .rotate( degrees ? a * pi / 180 : a )
    .scale( rx, ry );

  this.drawVertices( polygon, polygon.length >> 1 );
  this.matrix.restore();
  return this;
};

RendererWebGL.prototype.ellipse = function ( x, y, r1, r2 ) {
  return this._polygon( x, y, r1, r2, 24, 0 );
};

RendererWebGL.prototype.arc = function ( x, y, r ) {
  return this._polygon( x, y, r, r, 24, 0 );
};

RendererWebGL.prototype.polygon = Renderer2D.prototype.polygon;
RendererWebGL.prototype.font = Renderer2D.prototype.font;

RendererWebGL.prototype.save = function () {
  return this.matrix.save(), this;
};

RendererWebGL.prototype.restore = function () {
  return this.matrix.restore(), this;
};

RendererWebGL.prototype.translate = function ( x, y ) {
  return this.matrix.translate( x, y ), this;
};

RendererWebGL.prototype.rotate = function ( angle ) {
  return this.matrix.rotate( settings.degrees ? angle * pi / 180 : angle ), this;
};

RendererWebGL.prototype.scale = function ( x, y ) {
  return this.matrix.scale( x, y ), this;
};

RendererWebGL.prototype.setTransform = function ( a, b, c, d, e, f ) {
  return this.matrix.set( a, b, c, d, e, f ), this;
};

// not tested
RendererWebGL.prototype.transform = function ( a, b, c, d, e, f ) {
  return this.matrix.transform( a, b, c, d, e, f ), this;
};

RendererWebGL.prototype.noFill = Renderer2D.prototype.noFill;
RendererWebGL.prototype.noStroke = Renderer2D.prototype.noStroke;

// not tested
RendererWebGL.prototype.beginShape = function () {
  this.vertices.length = 0;
  this._vertices_is_updated = false;
  return this;
};

// not tested
RendererWebGL.prototype.vertex = function ( x, y ) {
  this.vertices.push( x, y );

  if ( this._vertices_is_updated ) {
    this._vertices_is_updated = false;
  }

  return this;
};

// not tested
RendererWebGL.prototype.endShape = function () {
  if ( !this._vertices_is_updated ) {
    this._vertices = copy_array(
      new Float32Array( this.vertices.length ),
      this.vertices,
      this.vertices.length );
  }

  return this.drawVertices( this._vertices, this._vertices.length * 0.5 );
};

RendererWebGL.prototype.rectAlign = Renderer2D.prototype.rectAlign;
RendererWebGL.prototype.color = Renderer2D.prototype.color;
RendererWebGL.prototype.colorMode = Renderer2D.prototype.colorMode;
RendererWebGL.prototype.fill = Renderer2D.prototype.fill;
RendererWebGL.prototype.stroke = Renderer2D.prototype.stroke;
RendererWebGL.prototype.lineWidth = Renderer2D.prototype.lineWidth;

// todo implement point
RendererWebGL.prototype.point = function ( x, y ) {
  return this
    .push()
    .noStroke()
    .fill( this.style.strokeStyle )
    .arc( x, y, this.style.lineWidth >> 1 )
    .pop();
};

RendererWebGL.prototype.getPixels = function ( x, y, w, h ) {
  var gl = this.context,
      pixels = new Uint8ClampedArray( w * h * 4 );

  gl.readPixels( x, y, w, h, gl.RGBA, gl.UNSIGNED_BYTE, pixels );
  return pixels;
};

RendererWebGL.prototype.getImageData = function ( x, y, w, h ) {
  return new ImageData( this.getPixels( x, y, w, h ), w, h );
};

// As I understand it, I need textures.
RendererWebGL.prototype.putImageData = function ( /* imageData, x, y, sx, sy, sw, sh */ ) {
  return this;
};

RendererWebGL.prototype.camera = Renderer2D.prototype.camera;
RendererWebGL.prototype.setTransformFromCamera = Renderer2D.prototype.setTransformFromCamera;

var defaults = function ( options, defaults ) {
  if ( options ) {
    return _.mixin( true, {}, defaults, options );
  }

  return _.mixin( true, {}, defaults );
};

/** Initializes the renderer. */
var create_renderer = function ( renderer, mode, options ) {
  options = defaults( options, default_options.renderer );
  renderer.settings = options.settings;
  renderer.mode = mode;
  renderer.index = ++renderer_index;
  /** Stack of saved styles (push, pop). */
  renderer.saves = [];
  /** Shape vertices (beginShape, vertex, endShape). */
  renderer.vertices = [];

  if ( !options.canvas ) {
    renderer.canvas = document.createElement( 'canvas' );
    renderer.canvas.innerHTML = 'Unable to run that application. Try to update your browser.';
  } else {
    renderer.canvas = options.canvas;
  }

  renderer.style = {
    rectAlignX: 'left',
    rectAlignY: 'top',
    doFill: true,
    doStroke: true,
    fillStyle: renderer.color(),
    font: new Font(),
    lineHeight: 14,
    lineWidth: 2,
    strokeStyle: renderer.color(),
    textAlign: 'left',
    textBaseline: 'top'
  };

  var context_options = {
    alpha: options.alpha
  };

  if ( mode === '2d' ) {
    renderer.context = renderer.canvas.getContext( '2d', context_options );
    renderer.smooth( renderer.settings.smooth );
  } else if ( mode === 'webgl' ) {
    switch ( support.webgl ) {
      case 1: renderer.context = renderer.canvas.getContext( 'webgl', context_options ); break;
      case 2: renderer.context = renderer.canvas.getContext( 'webgl-experemental', context_options ); break;
      case 0: throw Error( 'WebGL not supports' );
    }
  }

  if ( options.append ) {
    renderer.add();
  }

  if ( options.width != null || options.height != null ) {
    renderer.resize( options.width, options.height );
  } else {
    renderer.fullwindow();
  }
};

/**
 * Using `Camera` class, you can easily make
 * a camera for the game (or not for the game)
 * and easily operate it.
 */

var camera = function ( options, renderer ) {
  return new Camera( options, renderer );
};

var Camera = function ( options, renderer ) {
  if ( !options ) {
    options = {};
  }

  /**
   * Numbers between 0 and 1:
   * 1 - the camera will move at the speed of light
   * 0.1 - the camera will be similar to the real operator
   */
  this.speed = options.speed || [
    1, // x speed
    1, // y speed
    1, // zoom in speed
    1  // zoom out speed
  ];

  this.scale = options.scale || [
    1, // scale
    1, // min scale (zoom out)
    1  // max scale (zoom in)
  ];

  /**
   * Offset from the top-left corner of the
   * renderer to the `lookAt` position.
   */
  this.offset = options.offset;

  if ( renderer ) {
    if ( !this.offset ) {
      this.offset = new Vector2D( renderer.width * 0.5, renderer.height * 0.5 );
    }

    /** Uses in `sees` function. */
    this.renderer = renderer;
  } else if ( !this.offset ) {
    this.offset = new Vector2D();
  }

  this.location = [
    0, 0, // current location
    0, 0  // tranformed location of the object to be viewed
  ];

  /** Will be zoom in/out animation with the linear effect? */
  this.linearZoom = options.linearZoom || {
    zoomIn : true,
    zoomOut: true
  };
};

Camera.prototype = {
  /** Moves the camera to the `lookAt` position with its speed. */
  update: function ( /* dt */ ) {
    // how to use delta time here?
    var loc = this.location,
        spd = this.speed;

    if ( loc[ 0 ] !== loc[ 2 ] ) {
      loc[ 0 ] += ( loc[ 2 ] - loc[ 0 ] ) * spd[ 0 ];
    }

    if ( loc[ 1 ] !== loc[ 3 ] ) {
      loc[ 1 ] += ( loc[ 3 ] - loc[ 1 ] ) * spd[ 1 ];
    }

    return this;
  },

  /** Changes `lookAt` location. */
  lookAt: function ( at ) {
    this.location[ 2 ] = this.offset[ 0 ] / this.scale[ 0 ] - at[ 0 ];
    this.location[ 3 ] = this.offset[ 1 ] / this.scale[ 0 ] - at[ 1 ];
    return this;
  },

  /** At what position the camera looking now? */
  looksAt: function () {
    var scl = this.scale[ 0 ];

    return new Vector2D(
      ( this.offset[ 0 ] - this.location[ 0 ] * scl ) / scl,
      ( this.offset[ 1 ] - this.location[ 1 ] * scl ) / scl );
  },

  /** There is no need to draw something if it's not visible. */
 
  // if ( camera.sees( object.x, object.y, object.w, object.h ) ) {
  //   object.show();
  // }

  sees: function ( x, y, w, h, renderer ) {
    var off = this.offset,
        scl = this.scale[ 0 ],
        at = this.looksAt();

    if ( !renderer ) {
      renderer = this.renderer;
    }

    return x + w > at[ 0 ] - off[ 0 ] / scl &&
           x     < at[ 0 ] + ( renderer.width - off[ 0 ] ) / scl &&
           y + h > at[ 1 ] - off[ 1 ] / scl &&
           y     < at[ 1 ] + ( renderer.height - off[ 1 ] ) / scl;
  },

  /** Increases `scale[0]` to `scale[2]` with `speed[2]` speed. */
  zoomIn: function () {
    var scl = this.scale,
        spd;

    if ( scl[ 0 ] !== scl[ 2 ] ) {
      if ( this.linearZoom.zoomIn ) {
        spd = this.speed[ 2 ] * scl[ 0 ];
      } else {
        spd = this.speed[ 2 ];
      }

      scl[ 0 ] = min( scl[ 0 ] + spd, scl[ 2 ] );
    }
  },

  /** Decreases `scale[0]` to `scale[1]` with `speed[3]` speed. */
  zoomOut: function () {
    // copy-paste :(
    var scl = this.scale,
        spd;

    if ( scl[ 0 ] !== scl[ 1 ] ) {
      if ( this.linearZoom.zoomOut ) {
        spd = this.speed[ 3 ] * scl[ 0 ];
      } else {
        spd = this.speed[ 3 ];
      }

      scl[ 0 ] = max( scl[ 0 ] - spd, scl[ 1 ] );
    }
  },

  constructor: Camera
};

v6.Ticker = Ticker;
v6.Camera = Camera;
v6.Vector2D = Vector2D;
v6.Vector3D = Vector3D;
v6.RGBA = RGBA;
v6.HSLA = HSLA;
v6.Font = Font;
v6.Image = Image;
v6.Loader = Loader;
v6.Buffer = Buffer;
v6.Shader = Shader;
v6.Program = Program;
v6.Transform = Transform;
v6.Renderer2D = Renderer2D;
v6.RendererWebGL = RendererWebGL;
v6.ticker = ticker;
v6.camera = camera;
v6.vec2 = vec2;
v6.vec3 = vec3;
v6.rgba = rgba;
v6.hsla = hsla;
v6.font = font;
v6.color = color;
v6.image = image;
v6.loader = loader;
v6.colors = colors;
v6.buffer = buffer;
v6.mat3 = mat3;
v6.shader = shader;
v6.program = program;
v6.map = map;
v6.dist = dist;
v6.lerp = lerp;
v6.lerpColor = lerp_color;
v6.getShaderSource = get_source;
v6.support = support;
v6.filters = filters;
v6.shapes = shapes;
v6.options = default_options;
v6.shaders = default_shaders;
v6.settings = settings;
window.v6 = v6;

} )( this );
