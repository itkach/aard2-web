if (!window.$styleSwitcher) {
  window.$styleSwitcher = function() {

    var getAvailable = function(root) {
      if (!root) {
        root = document;
      }
      var result = [];
      var links = root.getElementsByTagName('link');
      if (!links) {
        return result;
      }
      var i, link, rel, title;
      for (i = 0; i < links.length; i++) {
        link = links[i];
        title = link.getAttribute('title');
        if (!title) {
          continue;
        }
        rel = link.getAttribute('rel');
        if (rel) {
          var rels = rel.split(' ');
          if (rels.indexOf('stylesheet') < 0) {
            continue;
          }
          result.push(link);
        }
      }
      return result;
    };

    document.addEventListener("DOMContentLoaded", function(event) {
      console.log("DOM fully loaded and parsed, available styles: "
                  + getAvailable());
    });

    return {

      getTitles: function(root) {
        var styles = getAvailable(root),
            i, result = [];
        for (i = 0; i < styles.length; i++) {
          result.push(styles[i].title);
        }
        return result;
      },

      setStyle: function(title, root) {
        var styles = getAvailable(root), i, style, rel;
        for (i = 0; i < styles.length; i++) {
          style = styles[i];
          style.disabled = true;
          if (style.getAttribute('title') === title) {
            style.disabled = false;
          }
        }
      }
    };

  }();
}
