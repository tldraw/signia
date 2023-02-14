"use strict";
exports.__esModule = true;
var react_1 = require("react");
var clsx_1 = require("clsx");
var Link_1 = require("@docusaurus/Link");
var useDocusaurusContext_1 = require("@docusaurus/useDocusaurusContext");
var Layout_1 = require("@theme/Layout");
var HomepageFeatures_1 = require("@site/src/components/HomepageFeatures");
var index_module_css_1 = require("./index.module.css");
function HomepageHeader() {
    var siteConfig = (0, useDocusaurusContext_1["default"])().siteConfig;
    return (<header className={(0, clsx_1["default"])('hero hero--primary', index_module_css_1["default"].heroBanner)}>
      <div className="container">
        <h1 className="hero__title">{siteConfig.title}</h1>
        <p className="hero__subtitle">{siteConfig.tagline}</p>
        <div className={index_module_css_1["default"].buttons}>
          <Link_1["default"] className="button button--secondary button--lg" to="/docs/intro">
            Docusaurus Tutorial - 5min ⏱️
          </Link_1["default"]>
        </div>
      </div>
    </header>);
}
function Home() {
    var siteConfig = (0, useDocusaurusContext_1["default"])().siteConfig;
    return (<Layout_1["default"] title={"Hello from ".concat(siteConfig.title)} description="Description will go into a meta tag in <head />">
      <HomepageHeader />
      <main>
        <HomepageFeatures_1["default"] />
      </main>
    </Layout_1["default"]>);
}
exports["default"] = Home;
