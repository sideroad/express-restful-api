module.exports = {
  error: function(res, err){
    res
      .status(err.code || 500)
      .json({
        msg: err.message
      })
      .end();
  },
  accessControl: function(res, req){
    var header = req.method === 'OPTIONS' ||
                 req.method === 'POST'    ||
                 req.method === 'PUT' ? {
                  'Access-Control-Allow-Origin': req.get('origin'),
                  'Access-Control-Allow-Methods':'POST, GET, OPTIONS',
                  'Access-Control-Allow-Headers':'Origin, X-Requested-With, Content-Type, Accept, X-PINGOTHER',
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