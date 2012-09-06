/*!
 * jQuery app framework
 *
 * Copyright 2012, usp
 * Dual licensed under the MIT or GPL Version 2 licenses.
 *
 * The library requires jquery-bbq
 * thanks!!
 */

// register special event
$.event.special.viewrender = $.event.special.viewactivate = $.event.special.viewdeactivate = {
    noBubble: true
};

// define app
var app = (function (app) {
    var views = {},
        activeView,
        hashKey;

    app.extend({
        /** 
         * add view
         * @param {String} name the view name
         * @param {jQuery} view the view 
         * @returns {jQuery} appself
         */
        addView: function (name, view) {
            // closures for view
            var requires = [],
                lastQuery,
                deactivateKey = null,
                activateKey = null,
                renderKey = null,
                deactivateCancel = false;

            // register view
            if (views[name]) {
                throw ('view name ' + name + ' already exists.');
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
                require: function (name) {
                    if (name === undefined) {
                        return requires;
                    }
                    requires.push(name);
                    return view;
                },

                /** 
                 * view deactivator
                 */
                deactivate: function () {
                    if (deactivateKey) {
                        return;
                    }

                    deactivateKey = setTimeout(viewdeactivate, 0);
                    for (var i = 0; i < requires.length; i++) {
                        app.getView(requires[i]).deactivate();
                    }
                },

                /** 
                 * view deactivator
                 */
                activate: function (name) {
                    if (activateKey) {
                        return;
                    }

                    var cancel,
                        i = 0;
                    for (; i < requires.length; i++) {
                        app.getView(requires[i]).activate(name);
                    }
                    if (deactivateKey) {
                        cancel = deactivateCancel = true;
                    }
                    activateKey = setTimeout(function () {
                        viewactivate(name, cancel);
                    }, 0);
                },

                /** 
                 * render view
                 * @param {Object} query feed
                 */
                render: function (query) {
                    if (renderKey) {
                        return;
                    }
                    renderKey = setTimeout(function () {
                        viewrender(query);
                    }, 0);
                }
            });

            // default handler of view
            view.bind('viewrender', function (e, query) {
                var originalQuery = queryStringify(query);
                if (originalQuery && originalQuery == lastQuery) {
                    e.stopImmediatePropagation();
                    return;
                }

                setTimeout(function () {
                    lastQuery = originalQuery;
                }, 0);
            });
            view.bind('viewdeactivate', function (e) {
                lastQuery = undefined;
            });

            return app;

            /** 
             * activate the view
             * @param {Object} query feed
             */
            function viewdeactivate() {
                deactivateKey = null;
                if (!deactivateCancel) {
                    view.trigger('viewdeactivate');
                }
                deactivateCancel = false;
            }

            /** 
             * deactivate the view
             * @param {String} name the view name
             * @param {Boolean} cancel is deactivate canceled
             */
            function viewactivate(name, cancel) {
                activateKey = null;
                if (!cancel) {
                    view.trigger('viewactivate', name);
                }
            }

            /** 
             * render the view
             * @param {Object} query passed to the view
             */
            function viewrender(query) {
                renderKey = null;
                view.trigger('viewrender', query);
            }
        },

        /** 
         * get view
         * @param {String} name the view name
         * @returns {jQuery} the view
         */
        getView: function (name) {
            if (!views[name]) {
                throw ('view name ' + name + ' not exists.');
            }

            return views[name];
        },

        /** 
         * stage view and set hash
         * @param {String} name view name
         * @param {Object} query passed to view
         * @returns {jQuery} appself
         */
        stage: function (name, query) {
            query = queryStringify(query);
            hash('/' + name + (query ? '|' + query : ''));
            return app;
        },

        /** 
         * render views
         * @param {String} name the view's name
         * @param {Object} query passed to the view
         * @returns {jQuery} appself
         */
        render: function (name, query) {
            var i = 0,
                view = app.getView(name);

            if (activeView) {
                activeView.deactivate();
            }
            view.activate(name);
            view.render(query);

            activeView = view;
        },

        /** 
         * init app
         * @returns {jQuery} appself
         */
        init : function () {
            app.hashchange();
            return app;
        }
    });

    // default event binding
    app.hashchange(function () {
        clearTimeout(hashKey);
        hashKey = setTimeout(function () {
            var listed = hash().split('/').pop().split('|'),
                name = listed[0],
                querystring = listed[1] || '',
                query;

            if (querystring.substr(0,1) == '?') {
                query = $.deparam.querystring(querystring);
            } else {
                query = decodeURIComponent(querystring);
            }

            app.trigger('viewchange', [name, query]);
        }, 0);
    });
    app.bind('viewchange', function (e, name, query) {
        app.render(name, query);
    });

    return app;

    /** 
     * handle hash
     * @param {String} hash if be feed then set hash, or return hash
     * @returns {String?} current hash
     */
    function hash(hash) {
        if (hash === undefined) {
            return $.browser.mozilla ? (window.location.href.split('#')[1] || '') : window.location.hash.replace(/^#/, '');
        } else {
            window.location.hash = hash;
        }
    }

    /** 
     * to query string
     * @param {Object} o
     * @returns {String} stringified
     */
    function queryStringify(o) {
        if ($.isPlainObject(o) || $.isArray(o)) {
            return $.param.querystring('', o);
        }
        if (o) {
            return encodeURIComponent(o);
        }
        return '';
    }

    /** 
     * find required view
     * @param {String} needle view name
     * @param {String} haystack current evaled name
     * @returns {Boolean} deps
     */
    function findRequiredView(needle, haystack) {
        if (needle === haystack) {
            return true;
        }

        var requires = app.getView(haystack).require(),
            i = 0;

        for (; i < requires.length; i++) {
            if (findRequiredView(needle, requires[i])) {
                return true;
            }
        }

        return false;
    }
})($(window));
