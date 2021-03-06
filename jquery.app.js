/*!
 * jQuery app framework
 *
 * Copyright 2012, usp
 * Dual licensed under the MIT or GPL Version 2 licenses.
 *
 * The library requires jquery.event.pre.js
 * https://github.com/uspDev/jquery.event.pre.js
 *
 * The library requires jquery-ba-hashchange-js
 * http://benalman.com/code/projects/jquery-hashchange/docs/files/jquery-ba-hashchange-js.html
 * thanks!!
 */

/*
 * special event register
 */
$.event.special.viewrender = $.event.special.viewactivate = $.event.special.viewdeactivate = { noBubble : true };

/*
 * define view
 */
(function(){
	var view = $.sub();
	$.sub.view = view;

	// 依存ビューを追加
	view.fn.require = function( view ){
		var requires = this.data('requires');
		requires.push( view );
		return this;
	};

	// express internal view
	$.fn.view = function(){
		// once
		if ( this.data( 'viewExpando' ) ) {
			return this;
		}
		else {
			this.data( 'viewExpando' , true );
		}

		// closure
		var self = this,
			viewdeactivateKey = null,
			viewactivateKey = null,
			viewrenderKey = null,
			viewdeactivateCancel = false;

		// viewize
		if ( !( self instanceof view ) ) {
			self = view( this );
		}

		// init member
		self.data('requires', []);

		// bind internal viewdeactivate
		self.bind('pre_viewdeactivate', function( e ){
			if( viewdeactivateKey ) e.stopPropagation();
		});
		self.bind('_viewdeactivate', function( e ){
			e.stopPropagation();
			viewdeactivateKey = setTimeout( viewdeactivate, 0 );
			eventDist.call( self , e.type );
		});

		// bind internal viewactivate
		self.bind('pre_viewactivate', function( e ){
			if( viewactivateKey ) e.stopPropagation();
		});
		self.bind('_viewactivate', function( e , viewName ){
			e.stopPropagation();
			eventDist.call( self , e.type , viewName );
			if( viewdeactivateKey )	viewdeactivateCancel = true;
			var arg = [ viewName , viewdeactivateCancel ];
			viewactivateKey = setTimeout( function(){ viewactivate.apply( this , arg ); }, 0 );
		});
		
		// bind internal viewrender
		self.bind('pre_viewrender', function( e , query ){
			if( viewrenderKey ) e.stopPropagation();
		});
		self.bind('_viewrender', function( e , query ){
			e.stopPropagation();
			var args = [ query ];
			viewrenderKey = setTimeout( function(){ viewrender.apply( this , args ); }, 0 );
		});

		// default handler
		self.bind( 'previewrender' , function( e , query ){
			var originalQuery;

			if ( $.isPlainObject( query ) ) {
				originalQuery = $.extend( true , {} , query );
			}
			else if ( $.isArray( query ) ) {
				originalQuery = $.extend( true , [] , query );
			}
			else {
				originalQuery = query;
			}
			
			setTimeout( function(){
				self.data( 'lastQuery' , originalQuery );
			} , 0 );
		} );

		// express self
		return self;

		// internal viewdeactivate
		function viewdeactivate(){
			viewdeactivateKey=null;
			if( !viewdeactivateCancel ){
				self.trigger( 'viewdeactivate' );
			}
			viewdeactivateCancel = false;
		}

		// internal viewactivate
		function viewactivate( viewName , cancel ){
			viewactivateKey=null;
			if( !cancel ){
				self.trigger( 'viewactivate' , viewName );
			}
		}

		// internal viewrender
		function viewrender( query ){
			viewrenderKey=null;
			self.trigger( 'viewrender' , query );
		}
		
		// event dist
		function eventDist(){
			var requires = this.data('requires'),
				app = this.data('app');
			for( var i = 0; i < requires.length; i++ ){
				var view = app.getView( requires[i] );
				view.trigger.apply( view , arguments );
			}
		}
	};
})();

/*
 * define app
 */
(function(){
	var app = $.sub();

	// add view and set me
	app.fn.addView = function( name , view , group ){
		var views = this.data('views');
		view.data( 'app' , this );
		view.data( 'viewName' , name );
		view.data( 'viewGroup' , group );
		
		if( views[name] ){
			throw ( 'view name ' + name + ' already exists.');
		}
		else{
			views[name] = view;
		}

		return this;
	};

	// view getter
	app.fn.getView = function( name ){
		var views = this.data('views');
		if( !views[name] ){
			throw ('view name ' + name + ' not exists.');
		}

		return views[name];
	};

	// start messsage pump
	app.fn.pump = function(){
		var self = this,
			prevViews = [],
			hashCallbackKey;

		/*
		 * define hash change handler
		 */
		self.hashchange( function(){
			// freeze or not
			if ( self.data( 'freeze' ) ) {
				return;
			}

			// is doubled?
			if (!hashCallbackKey) {
				hashCallbackKey = setTimeout(function()
					{
						handleHash(prepareHash());
					}, 0);
			}
		} );

		// initialize
		self.hashchange();

		// return myself
		return self;

		// hash handler
		function handleHash(hash)
			{
				// main
				hashCallbackKey = null;

				// closure
				var i, viewName, query;

				// viewdeactivate
				for( i = 0; i < prevViews.length; i++ ){
					viewName = prevViews[i].split('|')[0];
					self.getView(viewName).trigger('_viewdeactivate');
				}

				// viewactivate and viewrender
				var views = hash.split('/');
				for( i = 0; i < views.length; i++ ){

					if( !views[i] ){
						views.splice( i , 1 );
						i--;
						continue;
					}

					viewName = views[i].split('|')[0];
					query = views[i].split('|')[1] || '';
					query = decodeURIComponent( query );

					var tempQuery;
					try {
						tempQuery = JSON.parse(  query  );
					}
					catch ( e ) {
						tempQuery = query;
					}
					query = tempQuery;

					self.getView(viewName).trigger('_viewactivate' , viewName);
					self.getView(viewName).trigger('_viewrender' , query );
				}

				// current 2 prev
				prevViews = views;

				// fire hash change
				self.trigger( 'viewchange' , views );
			}
	};

	// hash setter
	app.fn.renderView = function( name , query ){
		var self = this,
			viewName,
			group = self.getView( name ).data( 'viewGroup' ),
			viewPrototype = prepareHash().split('/'),
			i;

		// private view
		if ( !group ) {
			throw ( 'view name ' + name + ' is private.');
		}

		// remove exclusive
		for( i = 0; i < viewPrototype.length; i++ ){

			if( !viewPrototype[i] ){
				viewPrototype.splice( i , 1 );
				i--;
				continue;
			}

			viewName = viewPrototype[i].split('|')[0];
			if( self.getView( viewName ).data( 'viewGroup' ) === group ){
				viewPrototype.splice( i , 1 );
				i--;
			}
		}
		
		// add new hash
		if ( $.isPlainObject( query ) || $.isArray( query ) ) {
			query = JSON.stringify( query );
		}
		query = query ? '|' + encodeURIComponent( query ) : '';
		viewPrototype.push( name + query );
		prepareHash( '/' + viewPrototype.join('/') );

		return self;
	};

	// hash remover
	app.fn.deactivateView = function( name ){
		var self = this,
			viewName,
			viewPrototype = prepareHash().split('/'),
			i;

		// remove matched view
		for( i = 0; i < viewPrototype.length; i++ ){

			if( !viewPrototype[i] ){
				viewPrototype.splice( i , 1 );
				i--;
				continue;
			}

			viewName = viewPrototype[i].split('|')[0];
			if( findRequiredView.call( this , name , viewName ) ){
				viewPrototype.splice( i , 1 );
				i--;
			}
		}
		
		// apply new hash
		prepareHash( '/' + viewPrototype.join('/') );

		return self;
	};
	
	// freeze and unfreeze app
	app.fn.freeze = function(){
		this.data( 'freeze' , true );
	};
	app.fn.unfreeze = function(){
		this.data( 'freeze' , false );
	};

	// express internal app
	$.fn.app = function(){
		// closure
		var self = app( this );

		// init member
		self.data('views' , {});

		return self;
	};

	// find required view
	function findRequiredView( needle , haystack ){
		if( needle === haystack ) return true;

		var requires = this.getView( haystack ).data('requires'),
			i;

		for( i = 0; i < requires.length; i++ ){
			if( findRequiredView.call( this , needle , requires[i] ) ){
				return true;
			}
		}

		return false;
	};

	// hash handler
	function prepareHash ( hash ) {
		if( hash === undefined ){
			return $.browser.mozilla ?
				(window.location.href.split('#')[1] || '') :
				window.location.hash.replace(/^#/, '');
		}
		else{
			return window.location.hash = hash;
		}
	};
})();
