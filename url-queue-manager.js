/**
 * Each URL can only be enqueued once.
 * Disregards unnecessary URL parts (such as anchors) and ignores URLs whose crawldepth is above maxCrawlDepth
 */
class UrlQueueManager {

    constructor(domain, maxCrawlDepth) {
        this.domain = domain;
        this.maxCrawlDepth = maxCrawlDepth;
        this._queue = [];
        this._markedUrls = new Set();
    }

    enqueue(url, crawlDepth) {
        if(crawlDepth <= this.maxCrawlDepth &&  url.startsWith(this.domain)) {
            url = this._trimUrl(url);
            if(!url.endsWith('.pdf') && !this._markedUrls.has(url)) {
                this._queue.push({ url, crawlDepth });
                this._markedUrls.add(url);
            }
        }
    }

    hasNext() {
        return this._queue.length > 0;
    }

    next() {
        // Inefficient: This operation is O(n) instead of O(1)
        return this._queue.shift();
    }

    getMarkedUrls() {
        return [...this._markedUrls];
    }

    _trimUrl(url) {
        let anchorIndex = url.indexOf('#');
        url = anchorIndex > 0 ? url.substring(0, anchorIndex) : url;
        let urlParamIndex = url.indexOf('?');
        return urlParamIndex > 0 ? url.substring(0, urlParamIndex) : url;
    }
}

module.exports = UrlQueueManager;