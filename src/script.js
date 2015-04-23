$(
  function() {

    var scheduledLookupID;

    var $word = $('#word');
    var $lookupResult = $('#lookup-result');
    var $content = $('#content');
    var $styleSelect = $('#dictionary-style');
    var $contentHeader = $('#content-header');

    $contentHeader.hide();

    var defaultStyle = 'Default';
    $content.on('load', function(){
      try {
        var contentLocation = $content.contents().attr('location');
        if (contentLocation.href === 'about:blank') {
          $contentHeader.hide();
        }
        else {
          var i, slobId, lookupKey,
              pathPart, pathParts = contentLocation.pathname.split('/');
          for (i = 0; i < pathParts.length; i++) {
            pathPart = pathParts[i];
            if (pathPart === 'slob' && i+1 < pathParts.length) {
              slobId = pathParts[i+1];
              if (i+2 < pathParts.length) {
                lookupKey = pathParts[i+2];
              }
              break;
            }
          }
          if (slobId) {
            $styleSelect.attr('data-slob-id', slobId);
            $.getJSON('/slob/'+slobId, function(data) {
              var label = data.tags['label'] || data.id;
              $('#header-title').text(
                label + ': ' +
                  decodeURIComponent(
                    lookupKey.replace(/\+/g, '%20')));
            });
          } else {
            $('#header-title').text(contentLocation.href);
          }
          $contentHeader.show();
        }
      }
      catch (x) {
        console.warn(x);
        $contentHeader.hide();
      }

      $styleSelect.empty();
      try {
        var titles = $styleSwitcher.getTitles($content.contents()[0]);
        if (!titles || titles.length === 0) {
          $styleSelect.hide();
        }
        else {
          $styleSelect.append($('<option>').val(defaultStyle).text(defaultStyle));
          titles.every(function(title) {
            $styleSelect.append($('<option>').val(title).text(title));
          });
          $styleSelect.show();

          var styleTitle = localStorage.getItem('style.'+slobId);
          if (!styleTitle) {
            styleTitle = defaultStyle;
          }
          $styleSelect.val(styleTitle).trigger('change');
        }
      }
      catch(x) {
        console.warn(x);
        $styleSelect.hide();
      }
    });

    $styleSelect.on('change', function(e) {
      var slobId = $styleSelect.attr('data-slob-id');
      var styleTitle = $styleSelect.val();
      localStorage.setItem('style.'+slobId, styleTitle);
      $styleSwitcher.setStyle(styleTitle, $content.contents()[0]);
    });

    var doLookup = function(dontClearContent) {
      var word = $word.val();
      console.log(word);
      $lookupResult.empty();
      if (!dontClearContent) {
        $content.attr('src', '');
      }

      if (!word) {
        return;
      }
      $.getJSON('/find/?key='+encodeURIComponent(word), function(data) {
        if (!data || data.length == 0) {
          var $div = $('<div>').attr('align', 'center').text('Nothing found');
          $lookupResult.append($div);
          return;
        }
        var $ul = $('<ul>');
        data.every(function(item) {
          var $li = $('<li>');
          var $label = $('<div>').append($('<strong>').text(item.label));
          var $dictLabel = $('<small>').text(item.dictLabel || '');
          var $a = $('<a>')
                .append($label)
                .append($dictLabel)
                .attr('href', item.url)
                .attr('target', 'content');
          $li.append($a);
          $ul.append($li);
          return true;
        });
        $lookupResult.append($ul);
      });
    };

    var onInputChange = function() {
      if (scheduledLookupID) {
        clearTimeout(scheduledLookupID);
      }
      scheduledLookupID = setTimeout(doLookup, 500);
    };

    $word.on('keyup', onInputChange);
    $word.on('search', onInputChange);

    $('#dict-link').on('click', function() {
      console.log('getting dict info');
      $content.attr('src', '');
      $content.empty();
      $.getJSON('/slob', function(data) {
        if (!data.slobs) {
          return;
        }
        var $body = $content.contents().find('body');

        data.slobs.forEach(function(info) {
          var $h1 = $('<h1>');
          $h1.text(info.tags['label'] || info.id);
          var $table = $('<table>');
          ['file', 'id', 'encoding', 'compression',
           'refCount', 'blobCount'].forEach(
             function(name) {
               var $tr = $('<tr>');
               $('<td>').text(name).appendTo($tr);
               $('<td>').text(info[name]).appendTo($tr);
               $tr.appendTo($table);
             }
           );
          var $tags = $('<table>');
          Object.keys(info.tags).forEach(
            function(key) {
               var $tr = $('<tr>');
               $('<td>').text(key).appendTo($tr);
               $('<td>').text(info.tags[key]).appendTo($tr);
               $tr.appendTo($tags);
            });

          var $contentTypes = $('<ul>');
          info.contentTypes.forEach(function(contentType) {
            $('<li>').text(contentType).appendTo($contentTypes);
          });

          $body.append($h1);
          $body.append($table);
          $body.append($('<h2>').text('Tags'));
          $body.append($tags);
          $body.append($('<h2>').text('Content Types'));
          $body.append($contentTypes);
          $('<hr>').appendTo($body);
        });
      });

    });

    $('#random-link').on('click', function() {
      console.log('getting random article');
      $content.attr('src', '');
      $content.empty();
      $.getJSON('/random', function(data) {
        $content.attr('src', data.url);
        $word.val(data.label);
        doLookup(true);
      });
    });

  }
);
