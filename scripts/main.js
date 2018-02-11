/* jshint esversion: 5, unused: true, undef: true */
/* global v6, _, document, platform, Float32Array */
;( function ( window, undefined ) {

'use strict';

var pi = Math.PI,
    cos = Math.cos,
    sin = Math.sin,
    sqrt = Math.sqrt,
    min = Math.min,
    max = Math.max;

var root = document.documentElement,
    size = min( root.clientWidth, root.clientHeight ),
    MINIMAP_SIZE = _.clamp( size / 4, 100, 200 );

// width and height of the map
var w = 2500,
    h = 2500;

var bullets = [],
    keys = [],
    asteroidsLength = 175,
    asteroids = Array( asteroidsLength ),
    // 400 shots per minute
    threshold = 60 / 400,
    time = threshold,
    renderer, ship, stick, button, camera, minimap;

var KEYS = {
  SPACE: 32,
  LARR : 37,
  UARR : 38,
  RARR : 39
};

var intersects = {
  'rectangle-point': function ( x1, y1, w1, h1, x2, y2 ) {
    return x2 < x1 + w1 && x2 > x1 && y2 < y1 + h1 && y2 > y1;
  },

  'rectangle-rectangle': function ( x1, y1, w1, h1, x2, y2, w2, h2 ) {
    return ( x1 < x2 + w2 && x1 + w1 > x2 + w2 || x1 + w1 > x2 && x1 < x2 ) && ( y1 < y2 + h2 && y1 + h1 > y2 + h2 || y1 + h1 > y2 && y1 < y2 );
  },

  'rectangle-circle': function ( x1, y1, w1, h1, x2, y2, r2 ) {
    if ( !( ( x1 < x2 + r2 && x1 + w1 > x2 + r2 || x1 + w1 > x2 - r2 && x1 < x2 - r2 ) && ( y1 < y2 + r2 && y1 + h1 > y2 + r2 || y1 + h1 > y2 - r2 && y1 < y2 - r2 ) ) ) {
      return false;
    }

    var dx = x2 - max( min( x2, x1 + w1 ), x1 ),
        dy = y2 - max( min( y2, y1 + h1 ), y1 );

    return dx * dx + dy * dy < r2 * r2;
  },

  'circle-point': function ( x1, y1, r1, x2, y2 ) {
    return sqrt( ( x2 - x1 ) * ( x2 - x1 ) + ( y2 - y1 ) * ( y2 - y1 ) ) < r1;
  },

  'circle-circle': function ( x1, y1, r1, x2, y2, r2 ) {
    return sqrt( ( x2 - x1 ) * ( x2 - x1 ) + ( y2 - y1 ) * ( y2 - y1 ) ) < r1 + r2;
  }
};

/** WebGL slow in iOS Safari and on PC. */
var safari = platform.os &&
  platform.os.family === 'iOS' &&
  platform.name === 'Safari';

var touchable = 'ontouchend' in window,
    mode = touchable && !safari ? 'webgl' : '2d';

if ( touchable ) {
  var BIG_R = 45,
      SMALL_R = BIG_R * 0.6;

  /** Makes from 3D-like normalized coordinates 2D. */
  var foo = function ( value, size ) {
    return ( value + 1 ) * 0.5 * size;
  };

  /** Converts touch zone with 3D coordinates in 2D. */
  var get_touch_zone = function ( values, w, h ) {
    var x1 = foo( values[ 0 ], w ),
        y1 = foo( values[ 1 ], h ),
        x2 = foo( values[ 2 ], w ),
        y2 = foo( values[ 3 ], h );

    return [
      x1, y1, x2 - x1, y2 - y1
    ];
  };

  // Yes, I know about all these
  // variables "out of scope".
  var Button = function ( x, y ) {
    var touchstart = function ( event ) {
      var touches = event.changedTouches,
          i = touches.length,
          touch;

      while ( i > 0 ) {
        touch = touches[ --i ];

        /** If a finger on the button, then say it. */
        if ( intersects[ 'circle-point' ](
          that.x,
          that.y,
          BIG_R,
          touch.clientX,
          touch.clientY ) )
        {
          that.state = that.redraw = identifiers[ touch.identifier ] = true;
          break;
        }
      }
    };

    var touchmove = function ( event ) {
      var touches = event.changedTouches,
          len = touches.length,
          i = 0,
          touch, id;

      for ( ; i < len; ++i ) {
        touch = touches[ i ];
        id = touch.identifier;

        /** If a finger on the button, then say it. */
        if ( intersects[ 'circle-point' ](
          that.x,
          that.y,
          BIG_R,
          touch.clientX,
          touch.clientY ) )
        {
          if ( !that.state ) {
            that.state = that.redraw = true;
          }

          identifiers[ id ] = true;

        /** Otherwise, if this finger was on the button before. */
        } else if ( identifiers[ id ] ) {
          that.finger_removed_from_button( id );
        }
      }
    };

    var touchend = function ( event ) {
      var touches = event.changedTouches,
          i = touches.length,
          id;

      while ( i > 0 ) {
        /** If this finger was on the button before. */
        if ( identifiers[ id = touches[ --i ].identifier ] ) {
          that.finger_removed_from_button( id );
        }
      }
    };

    var that = this,
        identifiers = that.__identifiers = [];

    var options = {
      mode: mode
    };

    that.renderer = v6( options ).noFill();
    that.x = foo( x, that.renderer.width );
    that.y = foo( y, that.renderer.height );

    _( window )
      .on( 'touchstart', touchstart )
      .on( 'touchmove', touchmove )
      .on( 'touchend', touchend );
  };

  Button.prototype = {
    show: function () {
      this.renderer
        .clear()
        .stroke( this.colors[ this.state ] )
        .polygon( this.x, this.y, BIG_R, 8 );

      this.redraw = false;
      return this;
    },

    finger_removed_from_button: function ( id ) {
      /** For not to change the state to the same value multiple times. */
      if ( this.state ) {
        this.state = false;
        this.redraw = true;
      }

      /** Say that this finger is no longer on the button. */
      this.__identifiers[ id ] = null;
    },

    colors: {
      'false': v6.rgba( 255, 0.3 ),
      'true' : v6.rgba( 255, 0.7 )
    },

    state: false,
    redraw: true,
    constructor: Button
  };

  /** One stick of gamepad. */
  var Stick = function ( options ) {
    var renderer_options = {
      mode: mode
    };

    var that = this,
        renderer = that.renderer =
          v6( renderer_options ).noFill(),
        identifiers = that.__identifiers = [],
        start = that.start = v6.vec2(),
        location = that.location = v6.vec2(),
        touch_zone;

    var touchstart = function ( event ) {
      var touches = event.changedTouches,
          i = touches.length,
          unset = true,
          touch, touched, x, y;

      while ( i > 0 ) {
        touch = touches[ --i ];

        /** A finger on the stick touch zone? */
        touched = identifiers[ touch.identifier ] =
          intersects[ 'rectangle-point' ](
            touch_zone[ 0 ],
            touch_zone[ 1 ],
            touch_zone[ 2 ],
            touch_zone[ 3 ],
            x = touch.clientX,
            y = touch.clientY );

        /** If yes, and this last event from the `touches` (reverse loop). */
        if ( touched && unset ) {
          /** Then handle it! */
          start.set( x, y );
          that.state = 1;
          that.redraw = unset = true;
          that._angle = that._value = null;
        }
      }
    };

    var touchmove = function ( event ) {
      var touches = event.changedTouches,
          i = touches.length,
          touch;

      while ( i > 0 ) {
        /** if this finger interacts with the stick (on `touchstart` was in the touch zone). */
        if ( identifiers[ ( touch = touches[ --i ] ).identifier ] ) {
          /** Move the movable part of the stick. */
          location
            .set( touch.clientX - start[ 0 ], touch.clientY - start[ 1 ] )
            .limit( BIG_R );
          that.state = 2;
          that.redraw = true;
          that._angle = that._value = null;
          break;
        }
      }
    };

    var touchend = function ( event ) {
      var touches = event.changedTouches,
          i = touches.length,
          unset = true,
          id;

      while ( i > 0 ) {
        /** if this finger interacts with the stick before. */
        if ( identifiers[ id = touches[ --i ].identifier ] ) {
          if ( unset ) {
            that.cancel();
            unset = true;
          }

          identifiers[ id ] = false;
        }
      }
    };

    var resize = function ( event ) {
      /** We'll call this function below. */
      if ( event ) {
        renderer.fullwindow();
      }

      touch_zone = get_touch_zone(
        options.touch_zone,
        renderer.width,
        renderer.height );

      that.x = foo( options.x, renderer.width );
      that.y = foo( options.y, renderer.height );
      that.cancel();
    };

    resize();

    _( window )
      .on( 'touchstart', touchstart )
      .on( 'touchmove', touchmove )
      .on( 'touchend', touchend )
      .on( 'resize', resize );
  };

  Stick.prototype = {
    show: function () {
      this.renderer
        .restore()
        .clear()
        .save()
        .setTransform( 1, 0, 0, 1, this.start[ 0 ], this.start[ 1 ] )
        .stroke( this.colors[ this.state ] )
        .polygon( 0, 0, BIG_R, 8 )
        .polygon( this.location[ 0 ], this.location[ 1 ], SMALL_R, 8 );

      this.redraw = false;
      return this;
    },

    value: function () {
      if ( this._value == null ) {
        this._value = this.location.mag() / BIG_R;
      }

      return this._value;
    },

    angle: function () {
      if ( this._angle == null ) {
        this._angle = this.location.angle();
      }

      return this._angle;
    },

    cancel: function () {
      this.location.set( 0, 0 );
      this.start.set( this.x, this.y );
      this.state = 0;
      this.redraw = true;
      this._angle = this._value = null;
      this.__identifiers.length = 0;
      return this;
    },

    colors: [
      v6.rgba( 255, 0.3 ),
      v6.rgba( 255, 0.5 ),
      v6.rgba( 255, 0.7 )
    ],

    state: 0,
    redraw: true,
    constructor: Stick
  };
}

_( window )
  .keydown( function ( event ) {
    if ( ui.hidden ) {
      keys[ event.keyCode ] = true;
    } else {
      play();
    }
  } )
  .keyup( function ( event ) {
    keys[ event.keyCode ] = false;
  } );

var Asteroid = function ( x, y, renderer ) {
  var n = _.random( 16, 25 ),
      step = 2 * pi / n,
      vertices = this.vertices =
        new Float32Array( ( n + 1 ) * 2 ),
      padding;

  if ( typeof x != 'object' ) {
    this.radius = _.random( 15, 30 );
    this.renderer = renderer;
    this.location = v6.vec2( x, y );
  } else {
    this.radius = x.radius * 0.5;
    this.renderer = x.renderer;
    this.location = x.location.copy();
  }

  for ( ; n >= 0; --n ) {
    padding = _.random( 0.5, 1 );
    vertices[     n * 2 ] = this.radius * cos( n * step ) * padding;
    vertices[ 1 + n * 2 ] = this.radius * sin( n * step ) * padding;
  }

  this.velocity = v6.Vector2D.random().mult( 5 );
};

Asteroid.prototype = {
  update: function ( dt ) {
    this.location.add( this.velocity.copy().mult( dt ) );

    if ( this.location[ 0 ] < this.radius ) {
      this.location[ 0 ] = this.radius;
      this.velocity[ 0 ] *= -1;
    } else if ( this.location[ 0 ] + this.radius > w ) {
      this.location[ 0 ] = w - this.radius;
      this.velocity[ 0 ] *= -1;
    }

    if ( this.location[ 1 ] < this.radius ) {
      this.location[ 1 ] = this.radius;
      this.velocity[ 1 ] *= -1;
    } else if ( this.location[ 1 ] + this.radius > h ) {
      this.location[ 1 ] = h - this.radius;
      this.velocity[ 1 ] *= -1;
    }

    return this;
  },

  show: function () {
    var x = this.location[ 0 ],
        y = this.location[ 1 ],
        r = this.radius;

    if ( camera.sees( x - r, y - r, r * 2, r * 2 ) ) {
      this.renderer
        .save()
        .translate( x, y )
        .drawVertices( this.vertices, this.vertices.length * 0.5 )
        .restore();
    }

    return this;
  },

  destroy: function () {
    return this.radius >= 15 ? [
      new Asteroid( this ),
      new Asteroid( this )
    ] : null;
  }
};

var Ship = function ( x, y, renderer ) {
  this.location = v6.vec2( x, y );
  this.velocity = v6.vec2();
  this.acceleration = v6.vec2();
  this.accelerationForce = v6.vec2();
  this.renderer = renderer;
};

Ship.prototype = {
  show: function () {
    this.renderer
      .save()
      .translate( this.location[ 0 ], this.location[ 1 ] )
      .rotate( this.angle )
      .fill( true )
      .noStroke()
      .drawVertices( this.vertices, this.n )
      .noFill()
      .stroke( true )
      .restore();

    return this;
  },

  applyForce: function ( force ) {
    return this.acceleration.add( force ), this;
  },

  update: function ( dt ) {
    if ( this.direction ) {
      this.angle += this.direction * this.steering * dt;
    }

    this.location.add( this.velocity.copy().mult( dt ) );
    this.velocity.add( this.acceleration );
    this.acceleration.mult( 0 );

    if ( this.location[ 0 ] > w ) {
      this.location[ 0 ] = w;
      this.velocity[ 0 ] = 0;
    } else if ( this.location[ 0 ] < 0 ) {
      this.location[ 0 ] = this.velocity[ 0 ] = 0;
    }

    if ( this.location[ 1 ] > h ) {
      this.location[ 1 ] = h;
      this.velocity[ 1 ] = 0;
    } else if ( this.location[ 1 ] < 0 ) {
      this.location[ 1 ] = this.velocity[ 1 ] = 0;
    }

    if ( this.velocity.mag() < 1 ) {
      this.velocity.mult( 0 );
    }

    return this;
  },

  accelerate: function ( value ) {
    return this.applyForce( this.accelerationForce.set( this.accelerationValue * value, 0 ).rotate( this.angle ) );
  },

  direction: 0,
  rx: 9,
  ry: 6,
  angle: 0,
  accelerationValue: 5,
  constructor: Ship
};

Ship.prototype.vertices = ( function () {
  var n = this.n = 3,
      i = n - 1,
      step = pi * 2 / n,
      vertices = new Float32Array( n * 2 );

  for ( ; i >= 0; --i ) {
    vertices[     i * 2 ] = cos( i * step ) * this.rx;
    vertices[ 1 + i * 2 ] = sin( i * step ) * this.ry;
  }

  return vertices;
} ).call( Ship.prototype );

var bar = function () {
  if ( ui.hidden ) {
    menu();
  } else {
    restart();
  }
};

var update = function ( dt ) {
  var i, j, destroyed, bullet, angle,
      asteroid, shoots, steering;

  i = asteroids.length - 1;

  if ( i < 0 ) {
    return bar();
  }

  for ( ; i >= 0; --i ) {
    asteroid = asteroids[ i ];

    destroyed = intersects[ 'circle-circle' ](
      asteroid.location[ 0 ],
      asteroid.location[ 1 ],
      asteroid.radius,
      ship.location[ 0 ],
      ship.location[ 1 ],
      // max of rx, ry
      ship.rx );

    if ( destroyed ) {
      return bar();
    }
  }

  if ( ui.hidden ) {
    if ( !touchable || stick.state !== 2 ) {
      // 1 PI per second
      steering = pi * 1 * dt;

      if ( keys[ KEYS.LARR ] ) {
        ship.angle -= steering;
      } else if ( keys[ KEYS.RARR ] ) {
        ship.angle += steering;
      }

      if ( keys[ KEYS.UARR ] ) {
        ship.accelerate( 1 );
      }
    } else {
      ship.angle = stick.angle();
      ship.accelerate( stick.value() );
    }
  }

  i = asteroids.length - 1;

  for ( ; i >= 0; --i ) {
    asteroids[ i ].update( dt );
  }

  time += dt;

  if ( ui.hidden ) {
    shoots = keys[ KEYS.SPACE ] ||
      ( touchable && button.state );

    if ( shoots && time > threshold ) {
      /** Angle between bullets. */
      angle = 0.05;

      bullets.push(
        [ ship.location[ 0 ], ship.location[ 1 ], ship.angle, ship.velocity.copy() ],
        [ ship.location[ 0 ], ship.location[ 1 ], ship.angle + pi * angle, ship.velocity.copy() ],
        [ ship.location[ 0 ], ship.location[ 1 ], ship.angle - pi * angle, ship.velocity.copy() ] );

      time = 0;
    }
  }

  for ( i = bullets.length - 1; i >= 0; --i ) {
    bullet = bullets[ i ];
    bullet[ 0 ] += ( 750 * cos( bullet[ 2 ] ) + bullet[ 3 ][ 0 ] ) * dt;
    bullet[ 1 ] += ( 750 * sin( bullet[ 2 ] ) + bullet[ 3 ][ 1 ] ) * dt;

    /** If the bullet is within the map. */
    if ( bullet[ 0 ] >= 0 &&
      bullet[ 0 ] <= w &&
      bullet[ 1 ] >= 0 &&
      bullet[ 1 ] <= h )
    {
      /** Then for all asteroids, check... */
      for ( j = asteroids.length - 1; j >= 0; --j ) {
        asteroid = asteroids[ j ];

        /** ... If bullet hits the asteroid. */
        if ( intersects[ 'circle-point' ](
          asteroid.location[ 0 ],
          asteroid.location[ 1 ],
          asteroid.radius,
          bullet[ 0 ], bullet[ 1 ] ) )
        {
          destroyed = asteroid.destroy();

          /** If the asteroid was large enough and returned its fragments. */
          if ( destroyed ) {
            /** Then add them. */
            _.merge( asteroids, destroyed );
          }

          /** Remove the asteroid. */
          asteroids.splice( j, 1 );
          /** Remove the bullet. */
          bullets.splice( i, 1 );
          break;
        }
      }

    /** Otherwise, remove the bullet. */
    } else {
      bullets.splice( i, 1 );
    }
  }

  ship.update( dt );
  /** Simulating inertia. */
  ship.velocity.mult( 0.9875 );

  camera
    .lookAt( ship.location )
    .update();
};

var render = function () {
  var shipX = ship.location[ 0 ],
      shipY = ship.location[ 1 ],
      i = asteroids.length - 1,
      r = minimap.width * 0.5,
      asteroid, x, y;

  minimap
    .clear()
    .noStroke()
    .fill( 255, 255, 255, 0.2 )
    .arc( r, r, r )
    .stroke( 255, 0, 0 )
    .lineWidth( 5 )
    .point( r, r )
    .lineWidth( 3 )
    .stroke( 255 );

  renderer
    .restore()
    .backgroundColor( 0 )
    .save()
    .setTransformFromCamera( camera )
    .stroke( true )
    .noFill()
    .rect( 0, 0, w, h );

  ship.show();

  for ( ; i >= 0; --i ) {
    asteroid = asteroids[ i ].show();
    /** Zoom out the minimap. */
    x = ( asteroid.location[ 0 ] - shipX ) * 0.06;
    y = ( asteroid.location[ 1 ] - shipY ) * 0.06;

    /** If the point can be placed within the minimap. */
    if ( sqrt( x * x + y * y ) < r ) {
      minimap.point( r + x, r + y );
    }
  }

  if ( touchable ) {
    if ( button.redraw ) {
      button.show();
    }

    if ( stick.redraw ) {
      stick.show();
    }
  }

  renderer
    .noStroke()
    .fill( true );

  for ( i = bullets.length - 1; i >= 0; --i ) {
    renderer.arc( bullets[ i ][ 0 ], bullets[ i ][ 1 ], 2 );
  }
};

var randPos = function ( value, size ) {
  return _.random() ?
    _.random( value + 50, size ) :
    _.random( 0, value - 50 );
};

var restart = function () {
  var i = ( asteroids.length = asteroidsLength ) - 1,
      shipX = w * 0.5,
      shipY = h * 0.5;

  for ( ; i >= 0; --i ) {
    asteroids[ i ] = new Asteroid(
      randPos( shipX, w ),
      randPos( shipY, h ),
      renderer );
  }

  ship.location.set( shipX, shipY );
  ship.velocity.set( 0, 0 );
  ship.acceleration.set( 0, 0 );
};

var play = function () {
  restart();

  if ( !ui.hidden ) {
    ui.hide();
  }
};

var menu = function () {
  if ( ui.hidden ) {
    ui.show();
  }
};

var ui = {
  init: _.once( function () {
    var selectors = [
      '#overlay',
      '#menu',
      '#play'
    ];

    var i = selectors.length - 1,
        elements = this.elements = {};

    for ( ; i >= 0; --i ) {
      elements[ selectors[ i ] ] = _( selectors[ i ] );
    }

    elements[ '#play' ].click( play );
  } ),

  show: function () {
    this.elements[ '#overlay' ].addClass( 'active' );
    this.hidden = false;
  },

  hide: function () {
    this.elements[ '#overlay' ].removeClass( 'active' );
    this.hidden = true;
  },

  hidden: false
};

_( function ( _ ) {
  renderer = v6( {
    mode: mode
  } )
    .stroke( 255 )
    .fill( 255 )
    .lineWidth( 2 );

  camera = renderer.camera( {
    // smooth camera
    speed: [
      0.075,
      0.075
    ]
  } );

  minimap = new v6.Renderer2D( {
    width : MINIMAP_SIZE,
    height: MINIMAP_SIZE
  } );

  minimap.canvas.style.top =
    minimap.canvas.style.left = '16px';

  if ( touchable ) {
    stick = new Stick( {
      touch_zone: [
        0, 0, 1, 1
      ],

      x: 0.5,
      y: 0.5
    } );

    button = new Button( -0.5, 0.5 );
  } else {
    _( document.body ).addClass( 'desktop' );
  }

  ship = new Ship( 0, 0, renderer );
  restart();
  v6.ticker( update, render ).tick();
  ui.init();
} );

} )( this );
