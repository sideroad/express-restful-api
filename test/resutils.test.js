import resutils from '../lib/resutils';

describe('error', () => {
  it('should send error', (done) => {
    resutils.error({
      status: (code) => {
        code.should.equal(500);
        return {
          json: (results) => {
            results.should.have.property('msg', 'error');
            return {
              end: () => {},
            };
          },
        };
      },
    }, {
      message: 'error',
    });

    resutils.error({
      status: (code) => {
        code.should.equal(400);
        return {
          json: (results) => {
            results.should.have.property('msg', 'error');
            return {
              end: () => {},
            };
          },
        };
      },
    }, {
      code: 400,
      message: 'error',
    });

    done();
  });
});
