class Page{
	constructor(url) {
		this.url = url;
		this.httpStatus = '';
		this.hasUnsecureBase = false;
		this.redirectedTo = '';
		this.message = '';
		this.status = false;
		this.passiveMixedContent = [];
		this.activeMixedContent = [];
	}
}

module.exports = Page;
