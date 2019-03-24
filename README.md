# Aard2 for Web
*Aard2 for Web* is a minimalistic Web UI to look up words and
  browse content of dictionaries in [slob format](https://github.com/itkach/slob).

*Aard2 for Web* requires [Java 1.6 or newer](http://java.com/download/index.jsp) and a modern browser
  such as [Chrome](https://www.google.com/chrome/browser/) or [Firefox](http://mozilla.org/firefox).

[Download Aard2 for Web](https://github.com/itkach/aard2-web/releases/)

To start the application, run

	java -Dslobber.browse=true -jar aard2-web-0.7.jar ~/Downloads/*.slob

(assuming you have some slob files in *~/Downloads*
directory). This should open Aard2 web UI page
(http://localhost:8013) in the default system browser.

To start the web server on a different port, set system
property *slobber.port*. For example, to start on port 8014:

	java -jar -Dslobber.port=8014 -Dslobber.browse=true ~/Downloads/*.slob

If you'd like to run the web server online, with the other computers being able to connect, be sure to specify the *Dslobber.host* argument. For example, to run the server on port 8080 while having the IP address of 172.31.3.69, use the following command
	java -Dslobber.browse=false -Dslobber.port=8080 -Dslobber.host=172.31.3.69 -jar aard2-web-0.7.jar ~/slob/*.slob

In theory, in the similar to Flask server manner, if *-Dslobber.host* is set to the address of 0.0.0.0 , the app should automatically pick up its public IP address and hence allow external inbound connections. However, such 'trick' is yet to be tested.

Finally, as a side note, on some cloud machines, and on AWS machines in particular, it's not possible to re-map port 80 for this app, even after disabling or completely removing apps using it. As a workaround, you might want to insert the following sample Javascript file that would redirect all inbound connections from port 80 to your desired port (which in this case is port 8080)

	<!DOCTYPE HTML>
	<html lang="en-US">
	<head>
	<meta charset="UTF-8">
	<meta http-equiv="refresh" content="1; url= http://example.url:8080">
	<script type="text/javascript">
	window.location.href = "http://example.url:8080"
	</script>
	<title>Page Redirection</title>
	</head>
	<body>
	If you are not redirected automatically, follow this <a href='http://example.url:8080>link</a>.
	</body>
	</html>
	
