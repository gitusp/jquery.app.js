$.fn.cut = function() {
	return this.each(function(){
		if(this.parentNode) this.parentNode.removeChild( this );
	});
};
