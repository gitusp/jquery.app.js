(function(){
	var dispatch = $.event.dispatch;

	$.event.dispatch = function( event ){
		event = jQuery.event.fix( event || window.event );
		event[ jQuery.expando ] = true;
		arguments[0] = event;

		event.type = 'pre' + event.type;
		dispatch.apply( this , arguments );

		event.type = event.type.substr(3);
		return dispatch.apply( this , arguments );
	};
})();
