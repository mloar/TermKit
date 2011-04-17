(function ($) {

var tc = termkit.client;

/**
 * NodeKit shell representation.
 */
tc.shell = function (client, environment, success) {
  var that = this;
  
  this.client = client;
  this.environment = environment;
  this.id = null;
  
  this.counter = 1;
  
  this.frames = {};
  this.views = {};

  this.query('session.open.shell', { }, function (message) {
    that.id = message.args.session;

    that.client.add(that);

    that.query('shell.environment', { }, function (message) {
      that.environment = message.args;
      success();
    });
    
  });

};

tc.shell.prototype = {
  close: function () {
    this.process.stdin.end();
  },
  
  query: function (method, args, callback) {
    this.client.protocol.query(method, args, { session: this.id }, callback);
  },

  notify: function (method, args) {
    this.client.protocol.notify(method, args, { session: this.id });
  },
  
  dispatch: function (method, args) {
    var that = this;
    
    switch (method) {
      case 'view.open':
        var frame = this.frames[args.rel];

        // Allocate views.
        if (frame) {
          // Add views to viewstream list.
          frame.allocate(args.views.length);
          for (i in args.views) (function (id) {
            view = frame.get(+i);
            view.callback(function (method, args) {
              // Lock callback to this view.
              args.view = id;

              that.notify(method, args);
            });

            that.views[id] = view;
          })(args.views[i]);
        }
        break;

      case 'view.close':
        // Remove views from active viewstream list.
        for (i in args.views) {
          delete this.views[args.views[i]];
        }
        break;
      
      default:
        var view;
        if (args.view && (view = this.views[args.view])) {
          view.dispatch(method, args);
        }
    }
  },
  
  run: function (tokens, frame, exit) {
    var that = this,
        rel = this.counter++,
        callback = function (message) {
          if (message.environment) {
            that.environment = message.environment;
          }

          delete that.frames[rel];

          exit(message.success, message.args, message);
        };
    
    this.frames[rel] = frame;

    this.query('shell.run', {
      tokens: tokens,
      rel: rel,
    }, callback);
  },
};

})();

