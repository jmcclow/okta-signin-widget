define([
  'okta',
  '@okta/okta-auth-js',
  'helpers/mocks/Util',
  'helpers/dom/PollingForm',
  'helpers/util/Expect',
  'LoginRouter',
  'sandbox',
  'helpers/xhr/POLLING',
  'helpers/xhr/CANCEL',
  'helpers/xhr/SUCCESS'
],
function (Okta, OktaAuth, Util, PollingForm, Expect, Router, $sandbox, resPolling, resCancel, resSuccess) {

  var { _, $ } = Okta;
  var itp = Expect.itp;

  function setup (settings, res) {
    settings || (settings = {});
    var successSpy = jasmine.createSpy('successSpy');
    var setNextResponse = Util.mockAjax();
    var baseUrl = window.location.origin;
    var authClient = new OktaAuth({issuer: baseUrl});
    var router = new Router(_.extend({
      el: $sandbox,
      baseUrl: baseUrl,
      authClient: authClient,
      globalSuccessFn: successSpy
    }, settings));
    Util.registerRouter(router);
    Util.mockRouterNavigate(router);
    Util.mockJqueryCss();
    setNextResponse(res || [resPolling, resPolling, resPolling]);
    router.refreshAuthState('polling-token');
    settings = {
      router: router,
      successSpy: successSpy,
      form: new PollingForm($sandbox),
      ac: authClient,
      setNextResponse: setNextResponse
    };
    return Expect.waitForPoll(settings);
  }

  // TODO: fix loop. PollController renders when transaction.poll resolves. This starts another polling loop  on top of the previous one.
  // https://github.com/okta/okta-signin-widget/blame/master/src/PollController.js#L50
  // https://github.com/okta/okta-signin-widget/blob/master/src/util/RouterUtil.js#L140
  // https://github.com/okta/okta-signin-widget/blob/master/src/util/RouterUtil.js#L236
  // https://github.com/okta/okta-signin-widget/blob/master/src/LoginRouter.js#L227

  xdescribe('Polling', function () {
    describe('PollingForm Content', function () {
      itp('shows the correct content on load', function () {
        return setup().then(function (test) {
          const title = 'There are too many users trying to sign in right now. We will automatically retry in 2 seconds.';
          expect(test.form.pageTitle().text().trim()).toBe(title);
        });
      });
      itp('has the cancel button', function () {
        return setup().then(function (test) {
          expect(test.form.cancelButton()).toExist();
          expect(test.form.cancelButton().attr('value')).toBe('Cancel');
          expect(test.form.cancelButton().attr('class')).toBe('button button-primary');
        });
      });
      itp('cancel button click cancels the current stateToken and calls the cancel function', function () {
        return setup({}, [resPolling, resPolling, resPolling, resCancel]).then(function (test) {
          $.ajax.calls.reset();
          test.setNextResponse(resCancel);
          test.form.cancelButton().click();
          return Expect.wait(function () {
            return $.ajax.calls.count() > 0;
          }, test);
        })
          .then(function () {
            expect($.ajax.calls.count()).toBe(1);
            Expect.isJsonPost($.ajax.calls.argsFor(0), {
              url: 'https://example.okta.com/api/v1/authn/cancel',
              data: {
                stateToken: '00_J1qxqyLs-6ZutUUWfbqm-1nqnW6n2o5z2wnBRHs'
              }
            });
          });
      });
    });
  });

  xdescribe('Polling', function () {
    describe('API', function () {
      itp('starts polling on load', function () {
        return setup({}, [resPolling, resPolling, resPolling, resSuccess]).then(function (test) {
          return Expect.wait(function () {
            return $.ajax.calls.count() > 3;
          }, test);
        })
          .then(function () {
            // first call is for refresh-auth
            expect($.ajax).toHaveBeenCalledTimes(4);
            // 1st poll
            Expect.isJsonPost($.ajax.calls.argsFor(1), {
              url: 'https://example.okta.com/api/v1/authn/factors/okta-poll/poll',
              data: {
                stateToken: '00_J1qxqyLs-6ZutUUWfbqm-1nqnW6n2o5z2wnBRHs'
              }
            });
            // 2nd poll
            Expect.isJsonPost($.ajax.calls.argsFor(2), {
              url: 'https://example.okta.com/api/v1/authn/factors/okta-poll/poll',
              data: {
                stateToken: '00_J1qxqyLs-6ZutUUWfbqm-1nqnW6n2o5z2wnBRHs'
              }
            });
            // 3rd poll
            Expect.isJsonPost($.ajax.calls.argsFor(3), {
              url: 'https://example.okta.com/api/v1/authn/factors/okta-poll/poll',
              data: {
                stateToken: '00_J1qxqyLs-6ZutUUWfbqm-1nqnW6n2o5z2wnBRHs'
              }
            });
          });
      });
    });
  });
});