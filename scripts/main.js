;( function ( window, undefined ) {

'use strict';

var USE_CACHE = false;

if ( USE_CACHE && 'serviceWorker' in navigator ) {
  navigator.serviceWorker.register( 'service-worker.js' )
    .then( function ( registration ) {
      console.log( 'Registration succeeded. Scope is ' + registration.scope );
    }, function ( ex ) {
      console.log( 'Registration failed with ' + ex );
    } );
}

var root = document.documentElement,
    MINIMAP_SIZE;

if ( root.clientWidth > 1280 && root.clientHeight > 1280 ) {
  MINIMAP_SIZE = 200;
} else {
  MINIMAP_SIZE = 100;
}

var pi = Math.PI,
    cos = Math.cos,
    sin = Math.sin,
    sqrt = Math.sqrt,
    min = Math.min,
    max = Math.max,
    abs = Math.abs;

// map width and height
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

// in Safari on iOS WebGL works slow
var safari = platform.os &&
  platform.os.family === 'iOS' &&
  platform.name === 'Safari';

var touchable = 'ontouchend' in window,
    // and on PC also
    mode = touchable && !safari ? 'webgl' : '2d';

if ( touchable ) {
  var foo = function ( value, size ) {
    return ( value + 1 ) * 0.5 * size;
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

        if ( intersects[ 'circle-point' ]( x, y, 50, touch.clientX, touch.clientY ) ) {
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

        if ( intersects[ 'circle-point' ]( x, y, 50, touch.clientX, touch.clientY ) ) {
          if ( !that.state ) {
            that.state = that.redraw = true;
          }

          identifiers[ id ] = true;
        } else if ( identifiers[ id ] ) {
          if ( that.state ) {
            that.state = false;
            that.redraw = true;
          }

          identifiers[ id ] = null;
        }
      }
    };

    var touchend = function ( event ) {
      var unset = true,
          touches = event.changedTouches,
          i = touches.length,
          id;

      while ( i > 0 ) {
        if ( identifiers[ id = touches[ --i ].identifier ] ) {
          if ( unset ) {
            that.state = unset = false;
            that.redraw = true;
          }

          identifiers[ id ] = null;
        }
      }
    };

    var that = this,
        identifiers = [];

    var options = {
      mode: mode
    };

    that.renderer = v6( options ).noFill();
    that.x = x = foo( x, that.renderer.width );
    that.y = y = foo( y, that.renderer.height );

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
        .polygon( this.x, this.y, 50, 8 );

      this.redraw = false;
      return this;
    },

    colors: {
      'false': v6.rgba( 255, 0.5 ),
      'true': v6.rgba( 255 )
    },

    state: false,
    redraw: true,
    constructor: Button
  };

  var Stick = function ( x, y, touchZone ) {
    var options = {
      mode: mode
    };

    var that = this,
        renderer = that.renderer = v6( options ).noFill(),
        w = renderer.width,
        h = renderer.height;

    x = foo( x, w );
    y = foo( y, h );

    var identifiers = _.create( null ),
        start = that.start = v6.vec2( x, y ),
        location = that.location = v6.vec2();

    touchZone = [
      foo( touchZone[ 0 ], w ),
      foo( touchZone[ 1 ], h ),
      touchZone[ 2 ] * w,
      touchZone[ 3 ] * h
    ];

    var touchstart = function ( event ) {
      var touches = event.changedTouches,
          i = touches.length,
          unset = true,
          touch, x, y;

      while ( i > 0 ) {
        if ( ( identifiers[ ( touch = touches[ --i ] ).identifier ] = intersects[ 'rectangle-point' ]( touchZone[ 0 ], touchZone[ 1 ], touchZone[ 2 ], touchZone[ 3 ], x = touch.clientX, y = touch.clientY ) ) && unset ) {
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
          touch, x, y;

      while ( i > 0 ) {
        if ( identifiers[ ( touch = touches[ --i ] ).identifier ] ) {
          location.set( touch.clientX - start[ 0 ], touch.clientY - start[ 1 ] ).limit( 50 );
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
        if ( identifiers[ id = touches[ --i ].identifier ] ) {
          if ( unset ) {
            location.set( 0, 0 );
            start.set( x, y );
            that.state = 0;
            that.redraw = unset = true;
            that._angle = that._value = null;
          }

          identifiers[ id ] = false;
        }
      }
    };

    _( window )
      .on( 'touchstart', touchstart )
      .on( 'touchmove', touchmove )
      .on( 'touchend', touchend );
  };

  Stick.prototype = {
    show: function () {
      var renderer = this.renderer,
          start = this.start,
          location = this.location;

      renderer
        .clear()
        .setTransform( 1, 0, 0, 1, start[ 0 ], start[ 1 ] )
        .stroke( this.colors[ this.state ] )
        .polygon( 0, 0, 50, 8 )
        .polygon( location[ 0 ], location[ 1 ], 30, 8 );

      this.redraw = false;
      return this;
    },

    value: function () {
      return this._value == null ?
        this._value = this.location.mag() / 50 :
        this._value;
    },

    angle: function () {
      return this._angle == null ?
        this._angle = this.location.angle() :
        this._angle;
    },

    colors: [
      v6.rgba( 255, 0.5 ),
      v6.rgba( 255, 0.7 ),
      v6.rgba( 255 )
    ],

    state: 0,
    redraw: true,
    constructor: Stick
  };

  /**
   * Preventing "pull-down-to-refresh":
   * https://stackoverflow.com/questions/29008194/
   */
  var touchstart = function ( e ) {
    if ( e.touches.length == 1 ) {
      lastY = e.touches[ 0 ].clientY;
      preventRefresh = _( window ).scrollTop() == 0;
    }
  };

  var touchmove = function ( e ) {
    var touchY = e.touches[ 0 ].clientY,
        dy = touchY - lastY;

    if ( preventRefresh ) {
      if ( dy > 0 ) {
        // Why that executes but doesn't work?
        e.preventDefault();
      }

      // To suppress pull-to-refresh it
      // is sufficient to preventDefault
      // the first overscrolling touchmove.
      preventRefresh = false;
    }

    lastY = touchY;
  };

  var lastY = 0,
      preventRefresh = false;
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
  if ( typeof x != 'object' ) {
    var n = _.random( 16, 25 ),
        step = 2 * pi / n,
        vertices = this.vertices =
          new Float32Array( ( n + 1 ) * 2 ),
        padding;

    for ( ; n >= 0; --n ) {
      padding = _.random( 0.5, 1 );
      vertices[     n * 2 ] = cos( n * step ) * padding;
      vertices[ 1 + n * 2 ] = sin( n * step ) * padding;
    }

    this.renderer = renderer;
    this.location = v6.vec2( x, y );
    this.radius = _.random( 25, 49 );
  } else {
    this.renderer = x.renderer;
    this.location = x.location.copy();
    this.vertices = x.vertices.slice();
    this.radius = x.radius * 0.5;
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
        scl = camera.scale[ 0 ];

    if ( abs( ship.location[ 0 ] - x ) < renderer.width / scl &&
         abs( ship.location[ 1 ] - y ) < renderer.height / scl )
    {
      this.renderer
        .save()
        .translate( x, y )
        .scale( this.radius, this.radius )
        .drawVertices( this.vertices, this.vertices.length * 0.5 )
        .restore();
    }

    return this;
  },

  destroy: function () {
    return this.radius >= 25 ? [
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
      .scale( this.xRadius, this.yRadius )
      .fill( true )
      .drawVertices( this.vertices, this.n )
      .noFill()
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
  xRadius: 15,
  yRadius: 10,
  angle: 0,
  accelerationValue: 5,
  constructor: Ship
};

Ship.prototype.vertices = ( function () {
  var n = Ship.prototype.n = 3,
      i = n - 1,
      step = pi * 2 / n,
      vertices = new Float32Array( n * 2 );

  for ( ; i >= 0; --i ) {
    vertices[     i * 2 ] = cos( i * step );
    vertices[ 1 + i * 2 ] = sin( i * step );
  }

  return vertices;
} )();

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
      // max of xRadius, yRadius
      ship.xRadius );

    if ( destroyed ) {
      return bar();
    }
  }

  if ( ui.hidden ) {
    if ( !touchable || stick.state !== 2 ) {
      // 0.75 PI per second
      steering = pi * 0.75 * dt;

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
      angle = 0.05;

      bullets.push(
        [ ship.location[ 0 ], ship.location[ 1 ], ship.angle, ship.velocity.copy() ],
        [ ship.location[ 0 ], ship.location[ 1 ], ship.angle + pi * angle, ship.velocity.copy() ],
        [ ship.location[ 0 ], ship.location[ 1 ], ship.angle - pi * angle, ship.velocity.copy() ] );

      time = 0;
    }
  }

  i = bullets.length - 1;

  for ( ; i >= 0; --i ) {
    bullet = bullets[ i ];
    bullet[ 0 ] += ( 750 * cos( bullet[ 2 ] ) + bullet[ 3 ][ 0 ] ) * dt;
    bullet[ 1 ] += ( 750 * sin( bullet[ 2 ] ) + bullet[ 3 ][ 1 ] ) * dt;

    // If bullet not out of screen.
    if ( bullet[ 0 ] >= 0 &&
      bullet[ 0 ] <= w &&
      bullet[ 1 ] >= 0 &&
      bullet[ 1 ] <= h )
    {
      for ( j = asteroids.length - 1; j >= 0; --j ) {
        asteroid = asteroids[ j ];

        if ( intersects[ 'circle-point' ](
          asteroid.location[ 0 ],
          asteroid.location[ 1 ],
          asteroid.radius,
          bullet[ 0 ], bullet[ 1 ] ) )
        {
          destroyed = asteroid.destroy();

          if ( destroyed ) {
            _.merge( asteroids, destroyed );
          }

          asteroids.splice( j, 1 );
          bullets.splice( i, 1 );
          break;
        }
      }

    // Else remove it.
    } else {
      bullets.splice( i, 1 );
    }
  }

  ship.update( dt );
  ship.velocity.mult( 0.9875 );
  // camera.scale[ 0 ] = v6.map( ship.velocity.mag(),
  //   0, 200, camera.scale[ 2 ], camera.scale[ 1 ], true );

  camera
    .lookAt( ship.location )
    .update( dt );
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
    .rect( 0, 0, w, h );

  ship.show();

  for ( ; i >= 0; --i ) {
    asteroid = asteroids[ i ].show();
    x = ( asteroid.location[ 0 ] - shipX ) * 0.06;
    y = ( asteroid.location[ 1 ] - shipY ) * 0.06;

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

  i = bullets.length - 1;

  for ( ; i >= 0; --i ) {
    renderer.polygon(
      bullets[ i ][ 0 ],
      bullets[ i ][ 1 ], 3, 3 );
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
        elements = {};

    for ( ; i >= 0; --i ) {
      elements[ selectors[ i ] ] = _( selectors[ i ] );
    }

    this.elements = elements;
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
  ui.init();

  renderer = new v6.RendererWebGL()
    .stroke( 255 )
    .fill( 255 )
    .lineWidth( 2 );

  camera = renderer.camera( {
    scale: [
      0.6, // scale
      0.6, // min scale
      1    // max scale
    ],

    speed: 0.05 // smooth camera
  } );

  minimap = new v6.Renderer2D( {
    width : MINIMAP_SIZE,
    height: MINIMAP_SIZE
  } )
    .stroke( 255 )
    .lineWidth( 4 );

  minimap.canvas.style.top =
    minimap.canvas.style.left = '16px';

  if ( touchable ) {
    _( document.body )
      .touchstart( touchstart )
      .touchmove( touchmove );

    stick = new Stick( 0.5, 0.5, [ 0, 0, 0.5, 0.5 ] );
    button = new Button( -0.5, 0.5 );
  } else {
    _( document.body ).addClass( 'desktop' );
  }

  ship = new Ship( 0, 0, renderer );
  restart();
  v6.ticker( update, render ).tick();
} );

} )( this );
