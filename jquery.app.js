// TODO: viewは|区切りでクエリは?でつける(=が入ってたらkeyvalue形式)
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
        activeViews = [],
        groups,
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
                 * @param {jQuery || Vector.<jQuery>} required required views
                 * @returns {jQuery?} viewself
                 */
                require: function (required) {
                    if (required === undefined) {
                        return requires;
                    }

                    if ($.isArray(required)) {
                        requires.concat(required);
                    } else {
                        requires.push(required);
                    }
                    return view;
                },

                /** 
                 * view deactivator
                 */
                _deactivate: function () {
                    if (deactivateKey) {
                        return;
                    }

                    deactivateKey = setTimeout(viewdeactivate, 0);
                    for (var i = 0; i < requires.length; i++) {
                        requires[i]._deactivate();
                    }
                },

                /** 
                 * view deactivator
                 */
                _activate: function (name) {
                    if (activateKey) {
                        return;
                    }

                    var cancel,
                        i = 0;
                    for (; i < requires.length; i++) {
                        requires[i]._activate(name);
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
                _render: function (query) {
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

                lastQuery = originalQuery;
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
            var viewName,
                group = app.getView(name).getGroup(),
                viewPrototype = hash().split('/'),
                i = 0;

            // private view
            if (!group) {
                throw ('view name ' + name + ' is private.');
            }

            // remove exclusive
            for (; i < viewPrototype.length; i++) {
                if (!viewPrototype[i]) {
                    viewPrototype.splice(i, 1);
                    i--;
                    continue;
                }

                viewName = viewPrototype[i].split('|')[0];
                if (app.getView(viewName).getGroup() === group) {
                    viewPrototype.splice(i, 1);
                    i--;
                }
            }

            // add new hash
            query = queryStringify(query);
            viewPrototype.push(name + (query ? '|' + query : ''));
            hash('/' + viewPrototype.join('/'));

            return app;
        },

        /** 
         * unstage view and set hash
         * @param {String} name view name
         * @returns {jQuery} appself
         */
        unstage: function (name) {
            var viewName,
                viewPrototype = hash().split('/'),
                i = 0;

            // remove matched view
            for (; i < viewPrototype.length; i++) {
                if (!viewPrototype[i]) {
                    viewPrototype.splice(i, 1);
                    i--;
                    continue;
                }

                viewName = viewPrototype[i].split('|')[0];
                if (findRequiredView(name, viewName)) {
                    viewPrototype.splice(i, 1);
                    i--;
                }
            }

            // apply new hash
            hash('/' + viewPrototype.join('/'));

            return app;
        },

        /** 
         * render views
         * @param {Array.<Object>} states collection of view and query
         * @returns {jQuery} appself
         */
        render: function(states) {
            var i, view;

            // viewdeactivate
            for (i = 0; i < activeViews.length; i++) {
                activeViews[i]._deactivate();
            }
            activeViews = [];

            // viewactivate and viewrender
            for (i = 0; i < states.length; i++) {
                view = app.getView(states[i].name);
                view._activate(states[i].name);
                view._render(states[i].query);
                activeViews.push(view);
            }

            return app;
        },

        /** 
         * init app
         * @param {Object} g collection groups
         * @returns {jQuery} appself
         */
        init : function (g) {
            groups = g;
            app.hashchange();
            return app;
        }
    });

    // default event binding
    app.hashchange(function () {
        clearTimeout(hashKey);
        hashKey = setTimeout(function () {
            var statesBase = hash().split('/'),
                states = [],
                splited,
                querystring,
                query,
                i = 0;

            for (; i < statesBase.length; i++) {
                if (!statesBase[i]) {
                    statesBase.splice(i, 1);
                    i--;
                    continue;
                }

                splited = statesBase[i].split('|');
                querystring = splited[1] || '';

                if (querystring.substr(0,1) == '?') {
                    query = $.deparam.querystring(querystring);
                } else {
                    query = decodeURIComponent(querystring);
                }

                states.push({
                    name: splited[0],
                    query: query
                });
            }

            app.trigger('viewchange', [states]);
        }, 0);
    });
    app.bind('viewchange', function (e, states) {
        app.render(states);
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
     * find required view
     * @param {String} needle view name
     * @param {String} haystack current evaled name
     * @returns {Boolean} deps
     */
    function findRequiredView(needle, haystack) {
        if (needle === haystack) {
            return true;
        }

        var requires = views[haystack].require(),
            i = 0;

        for (; i < requires.length; i++) {
            if (findRequiredView(needle, requires[i])) {
                return true;
            }
        }

        return false;
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
})($(window));
