module.exports = {
  error: function(res, err){
    res.send(err.code || 500, {
      msg: err.message
    });
  },
  accessControl: function(res, req){
    var header = req.method === 'OPTIONS' ||
                 req.method === 'POST'    ||
                 req.method === 'PUT' ? {
                  'Access-Control-Allow-Origin': req.get('origin'),
                  'Access-Control-Allow-Methods':'POST, GET, OPTIONS',
                  'Access-Control-Allow-Headers':'Origin, X-Requested-With, Content-Type, Accept',
                  'Access-Control-Allow-Credentials': true
                 } : {
                  'Access-Control-Allow-Origin': req.get('origin'),
                  'Access-Control-Allow-Methods':'POST, GET, OPTIONS',
                  'Access-Control-Allow-Headers':'*',
                  'Access-Control-Allow-Credentials': true          
                 };
    res.set(header);
  }
};