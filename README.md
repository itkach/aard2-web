# Aard2 for Web
*Aard2 for Web* is a minimalistic Web UI to look up words and
  browse content of dictionaries in [slob format](https://github.com/itkach/slob).

*Aard2 for Web* requires [Java 1.6 or newer](http://java.com/download/index.jsp) and a modern browser
  such as [Chrome](https://www.google.com/chrome/browser/) or [Firefox](http://mozilla.org/firefox).

[Download Aard2 for Web](https://github.com/itkach/aard2-web/releases/)

To start the application, run

	java -Dslobber.browse=true -jar aard2-web-0.3.jar ~/Downloads/*.slob

(assuming you have some slob files in *~/Downloads*
directory). This should open Aard2 web UI page
(http://localhost:8013) in the default system browser.

To start the web server on a different port, set system
property *slobber.port*. For example, to start on port 8014:

	java -jar -Dslobber.port=8014 -Dslobber.browse=true ~/Downloads/*.slob
