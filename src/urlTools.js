var libUrl = require('url');

exports.isSubDomain = function (baseUrl, url){
	var regSub = new RegExp('^(?:(?:https?://)|(?://))?(?:[^/@\\.]+\\.)+'+baseUrl);
	return regSub.test(url);
}

exports.isSameDomain = function(url1, url2){
	baseUrl1 = getDomain(removeProtocol(url1));
	baseUrl2 = getDomain(removeProtocol(url2));
	
	if(baseUrl1 == baseUrl2){
		return true;
	}
	return false;
}

exports.isRelative = function(url){
	var regRelative = new RegExp('^(?!(?:https?://)|(?://)|(?:mailto:)|(?:ftps?://))');
	return (regRelative.test(url));
}


exports.isNotIn = function(list, item, property){
	var notIn = true;
	if(typeof(property) == 'undefined'){
		list.forEach(function(listItem){
			if(listItem == item){
				notIn = false;
			}
		});
	}else{
		list.forEach(function(listItem){
			if(listItem[property] == item){
				notIn = false;
			}
		});
	}
	return notIn;
}

exports.fileFormatOk = function(url){
	var regFormats = new RegExp('(\.(asp|aspx|cgi|fcgi|php|home|htm|html|xhtml|js|jsp))|(^[^\.]+)$');
	url = libUrl.parse(url);
	return regFormats.test(url['pathname']);
}

exports.removeProtocol = function(url){
	return removeProtocol(url);
}

function removeProtocol(url){
	return url.replace(/^(https?:)?\/\//, '');
}

exports.getDomain = function(url){
	return getDomain(url);
}

function getDomain(url){
	return url.replace(/^(?:https?:)?(?:\/*)([^\/\?]*)(?:[\/\?].*)?/, '$1');
}