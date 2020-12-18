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
        this._beforeUrlVisit = [];
        this._afterUrlRendered = [];
    }

    /**
     * Start the crawl, using the startUrl and maxCrawlDepth set in constructor
     * @param {boolean} [headless=true] Run the browser in headless mode without visible GUI
     * @returns {Promise<Cookie[]>} an array of all cookies that have been found while crawling
     */
    async startCrawl(headless = true) {
        this._urlQueue.enqueue(this._startUrl, 0);

        let driver;
        if (headless) {
            driver = await new Selenium.Builder().forBrowser('chrome')
                .setChromeOptions(new ChromeDriver.Options().headless().addArguments('--log-level=3'))
                .build();
        }
        else {
            driver = await new Selenium.Builder().forBrowser('chrome')
                .setChromeOptions(new ChromeDriver.Options().addArguments('--log-level=3'))
                .build();
        }

        driver.manage().deleteAllCookies();

        try {
            while (this._urlQueue.hasNext()) {
                let nextUrlData = this._urlQueue.next();
                await this._visitUrl(driver, nextUrlData.url, nextUrlData.crawlDepth);
            }
            return this._dictToValues(this._foundCookiesDict);
        } finally {
            await driver.quit();
        }
    }

    /**
     * Calls callbackFn before the URL is being navigated to
     * @param {(url: string, crawlDepth: number) => Promise} callbackFn
     */
    beforeUrlVisit(callbackFn) {
        this._beforeUrlVisit.push(callbackFn);
    }

    /**
     * Calls callbackFn after the url has been rendered and scraped, passing a browser instance allowing for custom javascript execution.
     * @param {(url: string, crawlDepth: number, cookies: Cookie[], browser: Selenium.WebDriver) => Promise} callbackFn 
     */
    afterUrlRendered(callbackFn) {
        this._afterUrlRendered.push(callbackFn);
    }

    async _visitUrl(driver, url, currentCrawlDepth) {
        // Notify beforeUrlVisit subscribers
        for(const fn of this._beforeUrlVisit) {
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
        for(const fn of this._afterUrlRendered) {
            await fn(url, currentCrawlDepth, this._dictToValues(this._foundCookiesDict), driver);
        }
    }

    async _extractUrls(driver) {
        // Extract all url strings
        let hrefElements = await driver.findElements(By.css("a[href]"));
        return Promise.all(hrefElements.map(e => e.getAttribute('href')));
    }

    _getDomainOf(url) {
        // Get everything from 'http://' or 'https://' until the next '/'
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

    _dictToValues(dictionary) {
        return Object.keys(dictionary).map(key => dictionary[key]);
    }
}

module.exports = CookieCrawler