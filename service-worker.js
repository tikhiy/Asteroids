var cache_name = '0.650554143038383';

var paths = [
  'index.html',
  'fonts/Ubuntu-Regular.ttf',
  'fonts/Ubuntu-Medium.ttf',
  'scripts/peako.js',
  'scripts/v6.js',
  'scripts/platform.js',
  'scripts/main.js',
  'styles/main.css'
];

this.addEventListener( 'install', function ( event ) {
  event.waitUntil( caches.open( cache_name ).then( function ( cache ) {
    return cache.addAll( paths ).then( function () {
     self.skipWaiting();
    } );
  } ) );
}, false );

this.addEventListener( 'fetch', function ( event ) {
  event.respondWith( caches.match( event.request ).then( function ( response ) {
    return response || fetch( event.request.clone() ).then( function ( response ) {
      if ( response && response.status === 200 && response.type === 'basic' ) {
        var res = response.clone();

        caches.open( cache_name ).then( function ( cache ) {
          cache.put( event.request, res );
        } );
      }

      return response;
    } );
  } ) );
}, false );

this.addEventListener( 'activate', function ( event ) {
  var whitelist = [ cache_name ];

  event.waitUntil( caches.keys().then( function ( list ) {
    return Promise.all( list.map( function ( key ) {
      if ( whitelist.indexOf( key ) < 0 ) {
        return caches.delete( key );
      }
    } ) );
  } ) );
}, false );
