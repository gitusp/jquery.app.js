/*!
 * jQuery app framework
 *
 * Copyright 2012, usp
 * Dual licensed under the MIT or GPL Version 2 licenses.
 *
 * The library requires jquery-ba-hashchange-js
 * http://benalman.com/code/projects/jquery-hashchange/docs/files/jquery-ba-hashchange-js.html
 * thanks!!
 */

/*
 * special event register
 */
$.event.special.viewrender = $.event.special.viewactivate = $.event.special.viewdeactivate = {noBubble : true};

var app = (function (app)
	{
		var views = {},
			prevViews = [],
			hashKey;

		app.extend({
			/** 
			 * add view
			 * @param {String} name the view name
			 * @param {jQuery} view the view 
			 * @param {String} group the view's group
			 * @returns {jQuery} appself
			 */
			addView : function (name, view, group)
				{
					// closures for view
					var requires = [];
						viewdeactivateKey = null,
						viewactivateKey = null,
						viewrenderKey = null,
						viewdeactivateCancel = false;

					// register view
					if (views[name]){
						throw('view name ' + name + ' already exists.');
					} else {
						views[name] = view;
					}

					// expand view
					view.extend({
						/** 
						 * config or get require
						 * @param {String?} name the view name
						 * @returns {jQuery?} viewself
						 */
						require : function (name)
							{
								if (name === undefined) {
									return requires;
								} else {
									requires.push(name);
									return view;
								}
							},

						/** 
						 * getter of group
						 * @returns {String} his group
						 */
						getGroup : function ()
							{
								return group;
							},

						deactivate : function ()
							{
								if (viewdeactivateKey) {
									return;
								}
								viewdeactivateKey = setTimeout( viewdeactivate, 0 );

								for(var i = 0; i < requires.length; i++ ){
									app.getView( requires[i] ).deactivate();
								}
							},
						activate : function (name)
							{
								if (viewactivateKey) {
									return;
								}

								var cancel,
									i = 0;
								for(; i < requires.length; i++ ){
									app.getView( requires[i] ).activate(name);
								}
								if (viewdeactivateKey) {
									cancel = viewdeactivateCancel = true;
								}
								viewactivateKey = setTimeout(function ()
									{
										viewactivate(name, cancel);
									}, 0);
							},
						render : function (query)
							{
								if (viewrenderKey) {
									return;
								}
								viewrenderKey = setTimeout(function()
									{
										viewrender(query);
									}, 0 );
							}
					});

					// default handler of view
					self.bind( 'viewrender' , function( e , query ){
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

					return app;

					function viewdeactivate(){
						viewdeactivateKey=null;
						if( !viewdeactivateCancel ){
							view.trigger( 'viewdeactivate' );
						}
						viewdeactivateCancel = false;
					}

					// internal viewactivate
					function viewactivate( name , cancel ){
						viewactivateKey=null;
						if( !cancel ){
							view.trigger( 'viewactivate' , name );
						}
					}

					// internal viewrender
					function viewrender( query ){
						viewrenderKey=null;
						view.trigger( 'viewrender' , query );
					}
				},

			/** 
			 * get view
			 * @param {String} name the view name
			 * @returns {jQuery} the view
			 */
			getView : function (name)
				{
					if (!views[name]) {
						throw('view name ' + name + ' not exists.');
					}

					return views[name];
				},

			/** 
			 * prepare hash
			 * @param {String} name view name
			 * @param {Object} query passed to view
			 * @returns {jQuery} appself
			 */
			prepare : function (name, query)
				{
					var viewName,
						group = app.getView(name).getGroup(),
						viewPrototype = hash().split('/'),
						i = 0;

					// private view
					if (!group) {
						throw('view name ' + name + ' is private.');
					}

					// remove exclusive
					for (; i < viewPrototype.length; i++) {
						if( !viewPrototype[i] ){
							viewPrototype.splice( i , 1 );
							i--;
							continue;
						}

						viewName = viewPrototype[i].split('|')[0];
						if( app.getView( viewName ).getGroup() === group ){
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
					hash( '/' + viewPrototype.join('/') );

					return app;
				},

			/** 
			 * remove view
			 * @param {String} name view name
			 * @returns {jQuery} appself
			 */
			remove : function (name)
				{
					var viewName,
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

					return app;
				},

			/** 
			 * render views
			 * @returns {jQuery} appself
			 */
			render : function ()
				{
					var i,
						viewName,
						query;

					// viewdeactivate
					for( i = 0; i < prevViews.length; i++ ){
						viewName = prevViews[i].split('|')[0];
						app.getView(viewName).deactivate();
						//self.getView(viewName).trigger('_viewdeactivate');
					}

					// viewactivate and viewrender
					var views = hash().split('/');
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

						app.getView(viewName).activate(viewName);
						app.getView(viewName).render(query);
						//self.getView(viewName).trigger('_viewactivate' , viewName);
						//self.getView(viewName).trigger('_viewrender' , query );
					}

					// current 2 prev
					prevViews = views;

					return app;
				},
		});

		// default event binding
		// NOTE: normally we bind app.render to viewchange evnet
		app.hashchange(function ()
			{
				clearTimeout(hashKey);
				hashKey = setTimeout(function ()
					{
						app.trigger('viewchange');
					}, 0);
			});

		return app;

		/** 
		 * handle hash
		 * @param {String} hash if be feed then set hash, or return hash
		 * @returns {String?} current hash
		 */
		function hash(hash)
		{
			if (hash === undefined) {
				return $.browser.mozilla ?
					(window.location.href.split('#')[1] || '') :
					window.location.hash.replace(/^#/, '');
			} else {
				window.location.hash = hash;
			}
		}

		/** 
		 * find required view
		 * @param {String} needle view name
		 * @param {String} haystack current evaled name
		 * @returns {Boolean?} deps
		 */
		function findRequiredView( needle , haystack )
		{
			if( needle === haystack ) return true;

			var requires = app.getView( haystack ).require(),
				i = 0;

			for(; i < requires.length; i++ ){
				if( findRequiredView.call( this , needle , requires[i] ) ){
					return true;
				}
			}

			return false;
		}
	})($(window));
