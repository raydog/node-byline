/*
 * Mocha tests, run with `mocha -R spec`
 * (c) 2013 John Hewson
 * MIT License
 */

var assert = require("assert"),
    stream = require('stream'),
    util = require('util'),
    fs = require('fs'),
    byline = require('../lib');

describe('byline', function() {
  
  it('should pipe a small file', function(done) {
    var input = fs.createReadStream('LICENSE');
    var lineStream = byline(input); // convinience API
    var output = fs.createWriteStream('test.txt');
    lineStream.pipe(output);
    output.on('close', function() {
      var out = fs.readFileSync('test.txt', 'utf8');
      var in_ = fs.readFileSync('LICENSE', 'utf8').replace(/\n/g, '');
      assert.equal(in_, out);
      fs.unlinkSync('test.txt');
      done();
    });
  });
  
  it('should ignore empty lines by default', function(done) {
    var input = fs.createReadStream('test/empty.txt');
    var lineStream = byline(input);
    lineStream.setEncoding('utf8');
    
    var lines1 = [];
    lineStream.on('data', function(line) {
      lines1.push(line);
    });
    
    lineStream.on('end', function() {
      var lines2 = fs.readFileSync('test/empty.txt', 'utf8').split(/\r\n|\r|\n/g);
      lines2 = lines2.filter(function(line) {
        return line.length > 0;
      });
      assert.deepEqual(lines2, lines1);
      done();
    });
  });

  it('should keep empty lines when keepEmptyLines is true', function(done) {
    var input = fs.createReadStream('test/empty.txt');
    var lineStream = byline(input, { keepEmptyLines: true });
    lineStream.setEncoding('utf8');
    
    var lines = [];
    lineStream.on('data', function(line) {
      lines.push(line);
    });
    
    lineStream.on('end', function() {
      assert.deepEqual([ '', '', '', '', '', 'Line 6' ], lines);
      done();
    });
  });
    
  it('should read a large file', function(done) {
    var input = fs.createReadStream('test/rfc.txt');
    var lineStream = byline(input);
    lineStream.setEncoding('utf8');

    var lines2 = fs.readFileSync('test/rfc.txt', 'utf8').split(/\r\n|\r|\n/g);
    lines2 = lines2.filter(function(line) {
      return line.length > 0;
    });
    
    var lines1 = [];
    var i = 0;
    lineStream.on('data', function(line) {
      lines1.push(line);
      if (line != lines2[i]) {
        console.log('EXPECTED:', lines2[i]);
        console.log('     GOT:', line);
        assert.fail(null, null, 'difference at line ' + (i + 1));
      }
      i++;
    });
    
    lineStream.on('end', function() {
      assert.equal(lines2.length, lines1.length);
      assert.deepEqual(lines2, lines1);
      done();
    });
  });

  it('should read a VERY long stream correctly, even with buffering', function(done) {
    
    var NUM_EMITS = 1000;

    // A simple readable stream that generates TONS of lols:
    function LolStream() {
      stream.Readable.call(this);
      this._counter = 0;
      this._max_lols = NUM_EMITS;
    }

    util.inherits(LolStream, stream.Readable);
    
    LolStream.prototype._read = function LolRead(size) {
      this._counter ++;
      if (this._counter <= this._max_lols) {
        // Emit 18 lols:
        this.push( "LOL\nLOL\nLOL\nLOL\nLOL\nLOL\nLOL\nLOL\nLOL\nLOL\nLOL\nLOL\nLOL\nLOL\nLOL\nLOL\nLOL\nLOL\n", "utf8");
      } else {
        // EOF:
        this.push(null);
      }
    };

    var our_stream = new LolStream({lolCount: 1024});
    var line_stream = byline(our_stream);
    var count = 0;
    var was_paused = false;
    line_stream.on('data', function (d, encoding) {
      // We trigger a pause immediately, so that we can trigger the buffer overrun
      // bug:
      if (!was_paused) {
        was_paused = true;
        line_stream.pause();
        
        // Give the underlying stream a full second to run uncapped:
        setTimeout(function () {
          line_stream.resume();
        }, 500);
      }

      // Validate + count the packets that we've seen:
      assert.equal(d.toString(encoding), "LOL");
      count ++;
    });
    line_stream.on('end', function () {
      assert.equal(count, NUM_EMITS * 18);
      done();
    })
  });
  
  it('should pause() and resume()', function(done) {
    var input = fs.createReadStream('LICENSE');
    var lineStream = byline(input);
    lineStream.setEncoding('utf8');

    var lines2 = fs.readFileSync('LICENSE', 'utf8').split(/\r\n|\r|\n/g);
    lines2 = lines2.filter(function(line) {
      return line.length > 0;
    });
    
    var lines1 = [];
    var i = 0;
    lineStream.on('data', function(line) {
      lines1.push(line);
      if (line != lines2[i]) {
        console.log('EXPECTED:', lines2[i]);
        console.log('     GOT:', line);
        assert.fail(null, null, 'difference at line ' + (i + 1));
      }
      i++;
      
      // pause/resume
      lineStream.pause();
      setTimeout(function() {
        lineStream.resume();
      }, 0);
    });
    
    lineStream.on('end', function() {
      assert.equal(lines2.length, lines1.length);
      assert.deepEqual(lines2, lines1);
      done();
    });
  });

  it('should handle encoings like fs', function(done) {
    areStreamsEqualTypes(null, function() {
      areStreamsEqualTypes({ encoding: 'utf8' }, function() {
        done();
      });
    });
  });

  function areStreamsEqualTypes(options, callback) {
    var fsStream = fs.createReadStream('LICENSE', options);
    var lineStream = byline(fs.createReadStream('LICENSE', options));
    fsStream.on('data', function(data1) {
      lineStream.on('data', function(data2) {
        assert.equal(Buffer.isBuffer(data1), Buffer.isBuffer(data2));
      });
      lineStream.on('end', function() {
        callback();
      });
    });
  }
  
});