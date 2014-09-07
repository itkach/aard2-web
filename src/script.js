$(
  function() {

    var scheduledLookupID;

    var $word = $('#word');
    var $lookupResult = $('#lookup-result');
    var $content = $('#content');

    var doLookup = function() {
      var word = $word.val();
      console.log(word);
      $lookupResult.empty();
      $content.attr('src', '');

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
          var $a = $('<a>').text(item.label)
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
  }
);
