$(function () {
  var scheduledLookupID;

  var $word = $("#word");
  var $lookupResult = $("#lookup-result");
  var $content = $("#content");
  var $styleSelect = $("#dictionary-style");
  var $contentHeader = $("#content-header");

  $contentHeader.hide();

  var defaultStyle = "Default";

  // User styles are global .css files Slobber serves under /user-styles and
  // applies (as an injected <link>) when ?style=<name> asks for one. Fetch the
  // list once so the picker can offer them alongside each article's own
  // built-in alternate stylesheets; the file name (extension included) is the
  // value, shown with ".css" stripped.
  var userStyles = [];
  $.getJSON("/user-styles", function (data) {
    userStyles = data || [];
  });

  // Style preferences are per-dictionary, not per-user: different
  // dictionaries can offer different sets of alternate styles (even
  // though in practice most share the same night.css). Keyed by each
  // dictionary's stable content "uri" tag - the same identifier
  // aard2-android already keys its own preference storage by - rather
  // than by slob id, which is an ephemeral, per-server-mount
  // identifier that would leave orphaned localStorage entries behind
  // on every restart.
  var getStylePref = function (dictUri) {
    return (dictUri && localStorage.getItem("style." + dictUri)) || defaultStyle;
  };

  // Adds, replaces, or - for the synthetic "Default" sentinel, which
  // doesn't correspond to any real titled <link> (see
  // showStyleOptions() below) - removes the "style" query parameter
  // in a URL, preserving any other query params and any fragment.
  //
  // "Default" is deliberately never sent to the server at all: the
  // server's natural, unmodified rendering already *is* that (see
  // Slobber's StylePreference, which does nothing when the param is
  // absent), so sending it as a real parameter would only cost a
  // wasted parse on every single article load for an identical
  // result.
  //
  // url is always a path relative to this page's own origin (see
  // Slobber.mkContentURL()), so it needs a base to parse as a URL -
  // this page's own location works for every caller, including the
  // one that passes the content iframe's location, since both share
  // the same origin. The result is an absolute URL rather than a
  // relative path, but every caller only ever sets it as an href/src
  // attribute, which browsers resolve identically either way.
  var applyStylePref = function (url, styleTitle) {
    var parsed = new URL(url, window.location.href);
    if (styleTitle === defaultStyle) {
      parsed.searchParams.delete("style");
    } else {
      parsed.searchParams.set("style", styleTitle);
    }
    return parsed.href;
  };

  var withStylePref = function (url, dictUri) {
    return applyStylePref(url, getStylePref(dictUri));
  };

  // Populates the style dropdown for the article currently on screen,
  // and remembers dictUri (on the select element itself, same idiom
  // this code already used for slobId) so the change handler below
  // knows which dictionary's preference to persist.
  var showStyleOptions = function (dictUri) {
    $styleSelect.attr("data-dict-uri", dictUri || "");
    $styleSelect.empty();
    try {
      var titles = $styleSwitcher.getTitles($content.contents()[0]) || [];
      if (titles.length === 0 && userStyles.length === 0) {
        $styleSelect.hide();
        return;
      }
      $styleSelect.append($("<option>").val(defaultStyle).text(defaultStyle));
      titles.forEach(function (title) {
        $styleSelect.append($("<option>").val(title).text(title));
      });
      // User styles are global (offered for every article); value is the file
      // name, label the same with the ".css" extension stripped.
      userStyles.forEach(function (name) {
        $styleSelect.append(
          $("<option>").val(name).text(name.replace(/\.css$/, ""))
        );
      });
      $styleSelect.show();
      $styleSelect.val(getStylePref(dictUri)).trigger("change");
    } catch (x) {
      console.warn(x);
      $styleSelect.hide();
    }
  };

  $content.on("load", function () {
    try {
      var contentLocation = $content.contents().attr("location");
      if (contentLocation.href === "about:blank") {
        $contentHeader.hide();
        showStyleOptions(null);
        return;
      }

      var i,
        slobId,
        lookupKey,
        pathPart,
        pathParts = contentLocation.pathname.split("/");
      for (i = 0; i < pathParts.length; i++) {
        pathPart = pathParts[i];
        if (pathPart === "slob" && i + 1 < pathParts.length) {
          slobId = pathParts[i + 1];
          if (i + 2 < pathParts.length) {
            lookupKey = pathParts[i + 2];
          }
          break;
        }
      }
      $contentHeader.show();
      if (slobId) {
        $.getJSON("/slob/" + slobId, function (data) {
          var label = data.tags["label"] || data.id;
          $("#header-title").text(
            label + ": " + decodeURIComponent(lookupKey.replace(/\+/g, "%20"))
          );
          showStyleOptions(data.uri);
        });
      } else {
        $("#header-title").text(contentLocation.href);
        showStyleOptions(null);
      }
    } catch (x) {
      console.warn(x);
      $contentHeader.hide();
      showStyleOptions(null);
    }
  });

  $styleSelect.on("change", function () {
    var styleTitle = $styleSelect.val();
    var dictUri = $styleSelect.attr("data-dict-uri");
    var alreadyActive = getStylePref(dictUri) === styleTitle;
    if (dictUri) {
      localStorage.setItem("style." + dictUri, styleTitle);
    }
    if (alreadyActive) {
      // showStyleOptions() below sets the dropdown's value to match
      // what the server already rendered this page with, then
      // triggers this same "change" event just to run the branch
      // below once - but nothing actually changed, so there's nothing
      // to reload.
      return;
    }
    // The article on screen was served with whatever preference was
    // active *at that time*, including in its own internal links (see
    // Slobber's StylePreference), which only a fresh request can
    // re-bake - patching the loaded DOM in place would mean
    // duplicating that same logic here in JS, so just reload with the
    // new preference and let the server redo it consistently.
    var contentLocation = $content.contents().attr("location");
    var currentHref = contentLocation.pathname + contentLocation.search + contentLocation.hash;
    $content.attr("src", applyStylePref(currentHref, styleTitle));
  });

  var doLookup = function (dontClearContent) {
    var word = $word.val();
    console.log(word);
    $lookupResult.empty();
    if (!dontClearContent) {
      $content.attr("src", "");
    }

    if (!word) {
      return;
    }
    $.getJSON("/find/?key=" + encodeURIComponent(word), function (data) {
      if (!data || data.length == 0) {
        var $div = $("<div>").attr("align", "center").text("Nothing found");
        $lookupResult.append($div);
        return;
      }
      var $ul = $("<ul>");
      data.every(function (item) {
        var $li = $("<li>");
        var $label = $("<div>").append($("<strong>").text(item.label));
        var $dictLabel = $("<small>").text(item.dictLabel || "");
        var $a = $("<a>")
          .append($label)
          .append($dictLabel)
          .attr("href", withStylePref(item.url, item.dictUri))
          .attr("target", "content");
        $li.append($a);
        $ul.append($li);
        return true;
      });
      $lookupResult.append($ul);
    });
  };

  var onInputChange = function () {
    if (scheduledLookupID) {
      clearTimeout(scheduledLookupID);
    }
    scheduledLookupID = setTimeout(doLookup, 500);
  };

  $word.on("keyup", onInputChange);
  $word.on("search", onInputChange);

  $("#dict-link").on("click", function () {
    console.log("getting dict info");
    $content.attr("src", "");
    $content.empty();
    $.getJSON("/slob", function (data) {
      if (!data.slobs) {
        return;
      }
      var $body = $content.contents().find("body");

      data.slobs.forEach(function (info) {
        var $h1 = $("<h1>");
        $h1.text(info.tags["label"] || info.id);
        var $table = $("<table>");
        [
          "file",
          "id",
          "encoding",
          "compression",
          "refCount",
          "blobCount",
        ].forEach(function (name) {
          var $tr = $("<tr>");
          $("<td>").text(name).appendTo($tr);
          $("<td>").text(info[name]).appendTo($tr);
          $tr.appendTo($table);
        });
        var $tags = $("<table>");
        Object.keys(info.tags).forEach(function (key) {
          var $tr = $("<tr>");
          $("<td>").text(key).appendTo($tr);
          $("<td>").text(info.tags[key]).appendTo($tr);
          $tr.appendTo($tags);
        });

        var $contentTypes = $("<ul>");
        info.contentTypes.forEach(function (contentType) {
          $("<li>").text(contentType).appendTo($contentTypes);
        });

        $body.append($h1);
        $body.append($table);
        $body.append($("<h2>").text("Tags"));
        $body.append($tags);
        $body.append($("<h2>").text("Content Types"));
        $body.append($contentTypes);
        $("<hr>").appendTo($body);
      });
    });
  });

  $("#random-link").on("click", function () {
    console.log("getting random article");
    $content.attr("src", "");
    $content.empty();
    $.getJSON("/random", function (data) {
      $content.attr("src", withStylePref(data.url, data.dictUri));
      $word.val(data.label);
      doLookup(true);
    });
  });
});
