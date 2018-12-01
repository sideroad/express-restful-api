module.exports = {
  error: (res, err) => {
    res
      .status(err.code || 500)
      .json(
        err.err
          ? err.err
          : {
            msg: err.message
          }
      )
      .end();
  }
};
