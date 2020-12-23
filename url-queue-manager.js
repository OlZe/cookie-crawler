class UrlQueueManager {

    /**
     * @param {string} domain 
     * @param {number} maxCrawlDepth 
     */
    constructor(domain, maxCrawlDepth) {
        /** @type {string} @private*/
        this.domain = domain;

        /** @type {number} @private*/
        this.maxCrawlDepth = maxCrawlDepth;

        /** @type {{url:string, crawlDepth: number}[]} @private*/
        this._queue = [];

        /** @type {Set<string>} @private*/
        this._markedUrls = new Set();
    }

    /**
     * Enqueues the URL if it's the first occurance, is of the same domain, does not end with '.pdf' and has a crawlDepth <= maxCrawlDepth.
     * Disregards anchors and url parameters
     * @param {string} url 
     * @param {number} crawlDepth 
     */
    enqueue(url, crawlDepth) {
        if(crawlDepth <= this.maxCrawlDepth &&  url.startsWith(this.domain)) {
            url = this._trimUrl(url);
            if(!url.endsWith('.pdf') && !this._markedUrls.has(url)) {
                this._queue.push({ url, crawlDepth });
                this._markedUrls.add(url);
            }
        }
    }

    /**
     * @returns {boolean}
     */
    hasNext() {
        return this._queue.length > 0;
    }

    /**
     * @returns {{url:string, crawlDepth: number}}
     */
    next() {
        // Inefficient: This operation is O(n) instead of O(1)
        return this._queue.shift();
    }

    /**
     * @returns {string[]}
     */
    getMarkedUrls() {
        return [...this._markedUrls];
    }

    /**
     * Removes anchor and url parameters
     * @param {string} url 
     * @returns {string}
     * @private
     */
    _trimUrl(url) {
        let anchorIndex = url.indexOf('#');
        url = anchorIndex > 0 ? url.substring(0, anchorIndex) : url;
        let urlParamIndex = url.indexOf('?');
        return urlParamIndex > 0 ? url.substring(0, urlParamIndex) : url;
    }
}

module.exports = UrlQueueManager;