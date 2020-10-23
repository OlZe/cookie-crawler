const {Builder, By, Key, until} = require('selenium-webdriver');
const ChromeDriver = require('selenium-webdriver/chrome');
const UrlQueueManager = require('./url-queue-manager');

/**
 * A Cookie
 * @typedef {Object} Cookie
 * @property {string} name
 * @property {string} value
 * @property {string} sourceUrl
 * @property {string} domain
 * @property {string|number} expiry
 */


class CookieCrawler {

    /**
     * @param {string} startUrl 
     * @param {number} maxCrawlDepth 
     */
    constructor(startUrl, maxCrawlDepth) {
        this._startUrl = startUrl;
        this._maxCrawlDepth = maxCrawlDepth || 0;
        this._domain = this._getDomainOf(startUrl);
        this._urlQueue = new UrlQueueManager(this._domain, maxCrawlDepth);
        this._foundCookiesDict = {};
        this._onUrlVisit = [];
        this._afterUrlVisit = [];
    }

    /**
     * Start the crawl, using the startUrl and maxCrawlDepth set in constructor
     * @returns {Promise<Cookie[]>} an array of all cookies that have been found while crawling
     */
    async startCrawl() {
        this._urlQueue.enqueue(this._startUrl, 0);


        let driver = await new Builder().forBrowser('chrome')
            .setChromeOptions(new ChromeDriver.Options().headless().addArguments('--log-level=3'))
            .build();
        driver.manage().deleteAllCookies();

        try {
            while(this._urlQueue.hasNext()) {
                let nextUrlData = this._urlQueue.next();
                await this._visitUrl(driver, nextUrlData.url, nextUrlData.crawlDepth);
            }
            return this._dictToValues(this._foundCookiesDict);
        } finally {
            await driver.quit();
        }
    }

    /**
     * Calls callbackFn before the URL is being visited/scraped
     * @param {(url: string, crawlDepth: number) => void} callbackFn
     */
    onUrlVisit(callbackFn) {
        this._onUrlVisit.push(callbackFn);
    }

    /**
     * Calls callbackFn after the url has been scraped, with a dictionary of cookies that have been found so far
     * @param {(url: string, crawlDepth: number, cookies: Cookie[]) => void} callbackFn 
     */
    afterUrlVisit(callbackFn) {
        this._afterUrlVisit.push(callbackFn);
    }

    async _visitUrl(driver, url, currentCrawlDepth) {
        // Notify onUrlVisit subscribers
        this._onUrlVisit.forEach(fn => fn(url, currentCrawlDepth));

        // Go to url
        await driver.get(url);

        // Gather cookie data
        let cookies = await driver.manage().getCookies();
        for(let cookie of cookies) {
            if(!(cookie.name in this._foundCookiesDict)) {
                this._foundCookiesDict[cookie.name] = {
                    name: cookie.name,
                    value: cookie.value,
                    sourceUrl: url,
                    domain: cookie.domain,
                    expiry: cookie.expiry || 'session' };
            }
        }

        // Extract and enqueue URLs
        if(currentCrawlDepth < this._maxCrawlDepth) {
            let urls = await this._extractUrls(driver);
            urls.forEach(url => this._urlQueue.enqueue(url, currentCrawlDepth + 1));
        }

        // Notify afterUrlVisit Subscribers
        this._afterUrlVisit.forEach(fn => 
            fn(url, currentCrawlDepth, this._dictToValues(this._foundCookiesDict)));
    }

    async _extractUrls(driver) {
        // Extract all url strings
        let hrefElements = await driver.findElements(By.css("a[href]"));
        return Promise.all(hrefElements.map(e => e.getAttribute('href')));
    }

    _getDomainOf(url) {
        // Get everything from 'http://' or 'https://' until the next '/'
        let domain = '';
        for(let prefix of ['http://', 'https://']) {
            if(url.startsWith(prefix)) {
                domain += prefix;
                url = url.replace(prefix, '');
                break;
            }
        }
        domain += url.substring(0, url.indexOf('/') + 1);
        return domain;
    }

    _dictToValues(dictionary) {
        return Object.keys(dictionary).map(key => dictionary[key]);
    }
}

module.exports = CookieCrawler