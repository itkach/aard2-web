$(function () {
  var scheduledLookupID;

  var $word = $("#word");
  var $lookupResult = $("#lookup-result");
  var $content = $("#content");
  var $styleSelect = $("#dictionary-style");
  var $stylePicker = $("#style-picker");
  var $headerTitle = $("#header-title");
  var $root = $(document.documentElement);
  var $sidebarToggle = $("#sidebar-toggle");

  // The header and its toolbar are always shown; its article part - title and
  // style picker - only while an article (or other page) is open.
  var showHeaderTitle = function (dictLabel, title) {
    $("#header-dict").text(dictLabel || "");
    $("#header-sep").toggle(!!dictLabel);
    $("#header-article").text(title);
    $headerTitle.show();
  };

  var hideHeaderTitle = function () {
    $headerTitle.hide();
    $stylePicker.hide();
  };

  hideHeaderTitle();

  var defaultStyle = "Default";

  // User styles are global .css files Slobber serves under /user-styles and
  // applies (as an injected <link>) when ?style=<name> asks for one. Fetch the
  // list once so the picker can offer them alongside each article's own
  // built-in alternate stylesheets; the file name (extension included) is the
  // value, shown with ".css" stripped.
  var userStyles = [];
  $.getJSON("/user-styles", function (data) {
    userStyles = data || [];
    // An article that loaded before the list arrived got a picker without the
    // user styles; refill it.
    if ($headerTitle.is(":visible")) {
      showStyleOptions($styleSelect.attr("data-dict-uri") || null);
    }
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
        $stylePicker.hide();
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
      $stylePicker.show();
      // Only shows the saved style; nothing changes, so no "change" event. A
      // saved style this article doesn't offer (a deleted user style, a
      // built-in one this article lacks) shows as Default - what the server
      // renders for it - but stays saved for articles that do offer it.
      var preferred = getStylePref(dictUri);
      var offered = $styleSelect.find("option").filter(function () {
        return this.value === preferred;
      }).length;
      $styleSelect.val(offered ? preferred : defaultStyle);
    } catch (x) {
      console.warn(x);
      $stylePicker.hide();
    }
  };

  // A lookup result and an article location match when they're the same
  // article: same path and blob (the style or a fragment don't matter).
  var articleKey = function (href) {
    var url = new URL(href, window.location.href);
    return url.pathname + "?blob=" + (url.searchParams.get("blob") || "");
  };

  // The result selected with the arrow keys whose article hasn't loaded yet
  // (see selectResult). It stays highlighted meanwhile, rather than the
  // highlight jumping back to the article still on screen.
  var $pendingResult = null;

  var markCurrent = function ($a) {
    $lookupResult
      .find("a[data-url]")
      .removeClass("current")
      .attr("aria-selected", "false");
    if ($a) {
      $a.addClass("current").attr("aria-selected", "true");
      $word.attr("aria-activedescendant", $a.attr("id"));
    } else {
      $word.removeAttr("aria-activedescendant");
    }
  };

  // Highlights the lookup result for the article on screen, if it's listed.
  var highlightCurrentResult = function () {
    var current = null;
    try {
      var href = $content.contents().attr("location").href;
      if (href !== "about:blank") {
        current = articleKey(href);
      }
    } catch (x) {
      // No article document to read (yet).
    }
    if ($pendingResult) {
      if (current !== articleKey($pendingResult.attr("data-url"))) {
        return;
      }
      $pendingResult = null;
    }
    var $current = $lookupResult.find("a[data-url]").filter(function () {
      return current !== null && articleKey($(this).attr("data-url")) === current;
    });
    markCurrent($current.length ? $current.first() : null);
  };

  $content.on("load", function () {
    try {
      var contentLocation = $content.contents().attr("location");
      if (previewHref && articleKey(contentLocation.href) !== articleKey(previewHref)) {
        // Something other than arrow-key browsing loaded this page (a link in
        // the article, Back, ...): the next arrow key starts a new entry.
        previewHref = null;
      }
      listenForKeysIn($content.contents()[0]);
      highlightCurrentResult();
      if (contentLocation.href === "about:blank") {
        showStyleOptions(null);
        hideHeaderTitle();
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
      if (slobId) {
        $.getJSON("/slob/" + slobId, function (data) {
          // The article can arrive in a style other than this dictionary's
          // current preference, e.g. via Back to a page loaded before the
          // style was switched. Reload it in the preferred style, in place of
          // the current history entry, rather than show a dropdown that
          // doesn't match what's on screen.
          var preferred = getStylePref(data.uri);
          var rendered =
            new URL(contentLocation.href).searchParams.get("style") || defaultStyle;
          if (rendered !== preferred) {
            contentLocation.replace(applyStylePref(contentLocation.href, preferred));
            return;
          }
          var label = data.tags["label"] || data.id;
          showHeaderTitle(
            label,
            decodeURIComponent(lookupKey.replace(/\+/g, "%20"))
          );
          showStyleOptions(data.uri);
        });
      } else {
        showHeaderTitle(null, contentLocation.href);
        showStyleOptions(null);
      }
    } catch (x) {
      console.warn(x);
      showStyleOptions(null);
      hideHeaderTitle();
    }
  });

  $styleSelect.on("change", function () {
    var styleTitle = $styleSelect.val();
    var dictUri = $styleSelect.attr("data-dict-uri");
    if (dictUri) {
      localStorage.setItem("style." + dictUri, styleTitle);
    }
    // Lookup result links for this dictionary still carry the previous style
    // in their URLs; point them at the new one.
    $lookupResult.find("a[data-url]").each(function () {
      var $a = $(this);
      if ($a.attr("data-dict-uri") === dictUri) {
        $a.attr("href", applyStylePref($a.attr("data-url"), styleTitle));
      }
    });
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

  // The text the current results were looked up for.
  var lookedUp = null;

  // The /find request still in flight, if any. A new lookup aborts it, so a
  // superseded response (which can arrive after the new lookup has started)
  // never adds its results to the list.
  var lookupRequest = null;

  var doLookup = function (dontClearContent, onResults) {
    var word = $word.val();
    console.log(word);
    lookedUp = word;
    clearTimeout(scheduledLookupID);
    scheduledLookupID = null;
    clearTimeout(selectionLoadID);
    $pendingResult = null;
    previewHref = null;
    $word.removeAttr("aria-activedescendant").attr("aria-expanded", "false");
    if (lookupRequest) {
      lookupRequest.abort();
      lookupRequest = null;
    }
    $lookupResult.empty();
    if (!dontClearContent) {
      $content.attr("src", "");
    }

    if (!word) {
      return;
    }
    lookupRequest = $.getJSON("/find/?key=" + encodeURIComponent(word), function (data) {
      lookupRequest = null;
      if (!data || data.length == 0) {
        var $div = $("<div>").attr("align", "center").text("Nothing found");
        $lookupResult.append($div);
        return;
      }
      var $ul = $("<ul>").attr("role", "none");
      data.every(function (item, i) {
        var $li = $("<li>").attr("role", "none");
        var $label = $("<div>").append($("<strong>").text(item.label));
        var $dictLabel = $("<small>").text(item.dictLabel || "");
        // The unstyled URL and dictionary are kept on the link so a style
        // change can re-point it (see the style select's change handler).
        // Out of the Tab order: the arrow keys in the lookup field move
        // through the results (see the field's keydown handler).
        var $a = $("<a>")
          .append($label)
          .append($dictLabel)
          .attr("id", "result-" + i)
          .attr("role", "option")
          .attr("aria-selected", "false")
          .attr("tabindex", "-1")
          .attr("data-url", item.url)
          .attr("data-dict-uri", item.dictUri)
          .attr("href", withStylePref(item.url, item.dictUri))
          .attr("target", "content");
        $li.append($a);
        $ul.append($li);
        return true;
      });
      $lookupResult.append($ul);
      $word.attr("aria-expanded", "true");
      highlightCurrentResult();
      if (onResults) {
        onResults();
      }
    });
  };

  // "input" fires only when the text actually changes (typing, pasting, the
  // field's clear button), unlike key events, which also fire for arrows,
  // Enter or Tab and used to redo the lookup - rebuilding the result list,
  // and losing keyboard focus that was in it - for no change at all.
  var onInputChange = function () {
    clearTimeout(scheduledLookupID);
    scheduledLookupID = null;
    if ($word.val() !== lookedUp) {
      scheduledLookupID = setTimeout(doLookup, 500);
    }
  };

  $word.on("input", onInputChange);

  // Keyboard: focus stays in the lookup field (so typing can always refine the
  // lookup) while the arrow keys move through the results, each shown in the
  // article pane after a short pause - holding a key doesn't load every result
  // passed. Enter opens the first result if none is selected yet, otherwise
  // moves focus into the article (to scroll it by keyboard); Escape or "/"
  // there comes back to the field.

  var selectionLoadID = null;

  // href last shown by arrow-key browsing. Articles shown while browsing
  // share one history entry - the first adds it, the rest replace it - so
  // Back returns to where browsing started instead of through every result.
  var previewHref = null;

  var showResult = function ($a) {
    clearTimeout(selectionLoadID);
    selectionLoadID = null;
    var href = new URL($a.attr("href"), window.location.href).href;
    var contentWindow = $content[0].contentWindow;
    if (
      previewHref &&
      articleKey(contentWindow.location.href) === articleKey(previewHref)
    ) {
      contentWindow.location.replace(href);
    } else {
      contentWindow.location.assign(href);
    }
    previewHref = href;
  };

  var selectResult = function ($a, loadNow) {
    $pendingResult = $a;
    markCurrent($a);
    $a[0].scrollIntoView({ block: "nearest" });
    clearTimeout(selectionLoadID);
    if (loadNow) {
      showResult($a);
    } else {
      selectionLoadID = setTimeout(function () {
        showResult($a);
      }, 150);
    }
  };

  // Results that fit in the list's visible height, for Page Up/Down.
  var resultsPerPage = function ($results) {
    var itemHeight = $results.first().outerHeight() || 1;
    return Math.max(1, Math.floor($lookupResult.innerHeight() / itemHeight) - 1);
  };

  var moveSelection = function (delta) {
    var $results = $lookupResult.find("a[data-url]");
    if (!$results.length) {
      return;
    }
    var index = $results.index($results.filter(".current"));
    var next;
    if (index < 0) {
      next = delta > 0 ? 0 : $results.length - 1;
    } else {
      next = Math.min(Math.max(index + delta, 0), $results.length - 1);
    }
    if (next !== index) {
      selectResult($results.eq(next));
    }
  };

  var openFirstResult = function () {
    var $first = $lookupResult.find("a[data-url]").first();
    if ($first.length) {
      selectResult($first, true);
    }
  };

  var openOrEnterArticle = function () {
    if (scheduledLookupID || $word.val() !== lookedUp) {
      // Typed faster than the lookup's delay: the results on screen (and any
      // highlighted one) are still for the previous text. Look up now, then
      // open. Without clearing the article pane first - its blank page could
      // otherwise arrive after, and replace, the result being opened.
      doLookup(true, openFirstResult);
      return;
    }
    var $current = $lookupResult.find("a.current");
    if ($current.length) {
      if (selectionLoadID) {
        showResult($current);
      }
      $content[0].contentWindow.focus();
      return;
    }
    openFirstResult();
  };

  $word.on("keydown", function (e) {
    switch (e.key) {
      case "ArrowDown":
        moveSelection(1);
        break;
      case "ArrowUp":
        moveSelection(-1);
        break;
      case "PageDown":
        moveSelection(resultsPerPage($lookupResult.find("a[data-url]")));
        break;
      case "PageUp":
        moveSelection(-resultsPerPage($lookupResult.find("a[data-url]")));
        break;
      case "Enter":
        openOrEnterArticle();
        break;
      default:
        return;
    }
    e.preventDefault();
  });

  // A click on a result navigates by itself (it's a link into the article
  // pane); it just supersedes any arrow-key selection still waiting to load.
  $lookupResult.on("click", "a[data-url]", function () {
    clearTimeout(selectionLoadID);
    selectionLoadID = null;
    $pendingResult = null;
    previewHref = null;
  });

  var focusLookup = function () {
    if ($root.hasClass("sidebar-collapsed")) {
      $sidebarToggle.trigger("click");
    }
    $word.trigger("focus").trigger("select");
  };

  var isTextInput = function (el) {
    return (
      el &&
      (el.isContentEditable || /^(input|textarea|select)$/i.test(el.tagName))
    );
  };

  // "/" outside a text field focuses the lookup field; in the article, so does
  // Escape.
  var onKeydownOutsideField = function (e, inArticle) {
    if (e.ctrlKey || e.metaKey || e.altKey || isTextInput(e.target)) {
      return;
    }
    if (e.key === "/" || (inArticle && e.key === "Escape")) {
      e.preventDefault();
      focusLookup();
    }
  };

  $(document).on("keydown", function (e) {
    onKeydownOutsideField(e, false);
  });

  // Articles are separate documents (from the same server), so their key
  // events don't reach this page's handlers; listen in each as it loads.
  var listenForKeysIn = function (doc) {
    if (doc && !doc.aard2KeysHandled) {
      doc.aard2KeysHandled = true;
      doc.addEventListener("keydown", function (e) {
        onKeydownOutsideField(e, true);
      });
    }
  };

  var syncSidebarToggle = function () {
    var shown = !$root.hasClass("sidebar-collapsed");
    var title = shown ? "Hide lookup" : "Show lookup";
    $sidebarToggle
      .attr("aria-pressed", String(shown))
      .attr("title", title)
      .attr("aria-label", title);
  };

  $sidebarToggle.on("click", function () {
    $root.toggleClass("sidebar-collapsed");
    var collapsed = $root.hasClass("sidebar-collapsed");
    localStorage.setItem("sidebarCollapsed", String(collapsed));
    syncSidebarToggle();
    if (!collapsed) {
      $word.trigger("focus");
    }
  });

  syncSidebarToggle();

  // "auto" follows the system's light/dark setting (no data-theme attribute,
  // see style.css); "light" and "dark" override it. The saved choice is
  // applied by index.html before the page is drawn.
  var themes = ["auto", "light", "dark"];
  var themeTitles = {
    auto: "Theme: automatic (follows system)",
    light: "Theme: light",
    dark: "Theme: dark",
  };
  var $themeToggle = $("#theme-toggle");

  var currentTheme = function () {
    return $root.attr("data-theme") || "auto";
  };

  var syncThemeToggle = function () {
    var theme = currentTheme();
    $themeToggle
      .attr("title", themeTitles[theme])
      .attr("aria-label", themeTitles[theme]);
    $themeToggle.find(".icon").attr("class", "icon icon-theme-" + theme);
  };

  $themeToggle.on("click", function () {
    var next = themes[(themes.indexOf(currentTheme()) + 1) % themes.length];
    if (next === "auto") {
      $root.removeAttr("data-theme");
      localStorage.removeItem("theme");
    } else {
      $root.attr("data-theme", next);
      localStorage.setItem("theme", next);
    }
    syncThemeToggle();
  });

  syncThemeToggle();

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
