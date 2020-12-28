const Selenium = require('selenium-webdriver');
const By = Selenium.By;
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


/**
 * @callback BeforeUrlVisitCallback
 * @param {string} url
 * @param {number} crawlDepth
 * @returns {Promise}
 */

/**
 * @callback AfterUrlRenderedCallback
 * @param {string} url
 * @param {number} crawlDepth
 * @param {Cookie[]} cookies
 * @param {Selenium.WebDriver} browser
 * @returns {Promise}
 */


class CookieCrawler {

    /**
     * @param {string} startUrl 
     * @param {number} maxCrawlDepth 
     */
    constructor(startUrl, maxCrawlDepth) {
        /** @type {string} @private */
        this._startUrl = startUrl;

        /** @type {number} @private  */
        this._maxCrawlDepth = maxCrawlDepth || 0;

        /** @type {string} @private  */
        this._domain = this._getDomainOf(startUrl);

        /** @type {UrlQueueManager} @private  */
        this._urlQueue = new UrlQueueManager(this._domain, maxCrawlDepth);

        /** @type {Object<string, Cookie>} @private  */
        this._foundCookiesDict = {};

        /**@type {BeforeUrlVisitCallback[]} @private  */
        this._beforeUrlVisitCallbacks = [];

        /**@type {AfterUrlRenderedCallback[]} @private  */
        this._afterUrlRenderedCallbacks = [];
    }

    /**
     * Start the crawl, using the startUrl and maxCrawlDepth set in constructor
     * @param {boolean} [headless=true] Run the browser in headless mode without visible GUI
     * @returns {Promise<Cookie[]>} an array of all cookies that have been found while crawling
     */
    async startCrawl(headless = true) {
        this._urlQueue.enqueue(this._startUrl, 0);
        let driver = await this._initWebBrowser(headless);

        try {
            while (this._urlQueue.hasNext()) {
                let nextUrl = this._urlQueue.next();
                await this._visitUrl(driver, nextUrl.url, nextUrl.crawlDepth);
            }
            return this._foundCookies();
        } finally {
            await driver.quit();
        }
    }

    /**
     * Calls callbackFn and resolves Promise before the URL is being navigated to
     * @param {BeforeUrlVisitCallback} callbackFn
     */
    beforeUrlVisit(callbackFn) {
        this._beforeUrlVisitCallbacks.push(callbackFn);
    }


     /**
      * Calls callbackFn and resolves Promise after URL is fully rendered and scraped.
      * Allows execution of Javascript in the browser through the callbackFn's provided arguments.
      * @param {AfterUrlRenderedCallback} callbackFn 
      */
    afterUrlRendered(callbackFn) {
        this._afterUrlRenderedCallbacks.push(callbackFn);
    }

    /**
     * @param {Selenium.WebDriver} driver 
     * @param {string} url 
     * @param {number} currentCrawlDepth 
     * @private
     */
    async _visitUrl(driver, url, currentCrawlDepth) {
        // Notify beforeUrlVisit subscribers
        for (const fn of this._beforeUrlVisitCallbacks) {
            await fn(url, currentCrawlDepth);
        }

        // Go to url
        await driver.get(url);

        // Gather cookie data
        let cookies = await driver.manage().getCookies();
        for (let cookie of cookies) {
            if (!(cookie.name in this._foundCookiesDict)) {
                this._foundCookiesDict[cookie.name] = {
                    name: cookie.name,
                    value: cookie.value,
                    sourceUrl: url,
                    domain: cookie.domain,
                    expiry: cookie.expiry || 'session'
                };
            }
        }

        // Extract and enqueue URLs
        if (currentCrawlDepth < this._maxCrawlDepth) {
            let urls = await this._extractUrls(driver);
            urls.forEach(url => this._urlQueue.enqueue(url, currentCrawlDepth + 1));
        }

        // Notify afterUrlRendered Subscribers
        for (const fn of this._afterUrlRenderedCallbacks) {
            await fn(url, currentCrawlDepth, this._foundCookies(), driver);
        }
    }

    /**
     * @param {Selenium.WebDriver} driver
     * @returns {Promise<string[]>} All url strings
     * @private
     */
    async _extractUrls(driver) {
        let hrefElements = await driver.findElements(By.css("a[href]"));
        return Promise.all(hrefElements.map(e => e.getAttribute('href')));
    }

    /**
     * Get everything from 'http://' or 'https://' until the next '/'
     * @param {string} url
     * @returns {string} domain
     * @private
     */
    _getDomainOf(url) {
        let domain = '';
        for (let prefix of ['http://', 'https://']) {
            if (url.startsWith(prefix)) {
                domain += prefix;
                url = url.replace(prefix, '');
                break;
            }
        }
        domain += url.substring(0, url.indexOf('/') + 1);
        return domain;
    }

    /**
     * @returns {Cookie[]}
     * @private
     */
    _foundCookies() {
        return Object.keys(this._foundCookiesDict).map(key => this._foundCookiesDict[key]);
    }

    /**
     * @param {boolean} [headless=true] Run the browser in headless mode without visible GUI
     * @returns {Promise<Selenium.WebDriver>} 
     * @private
     */
    async _initWebBrowser(headless = true) {
        let options = new ChromeDriver.Options().addArguments('--log-level=3');
        if(headless) {
            options = options.headless();
        }
        let driver = await new Selenium.Builder().forBrowser('chrome').setChromeOptions(options).build();
        driver.manage().deleteAllCookies();
        return driver;
    }
}

module.exports = CookieCrawler