var pungClient = angular.module('pung-client', ['ngRoute', 'ngMaterial', 'ngMessages']);

pungClient.filter('filefrompath', function () {
    return function (input) {
        var path = (input + "").split('/');
        return path[path.length - 1];
    };
});

pungClient.factory('cmStore', function() {
    var cm = null;
    return {
        store: function (val) {
            cm = val;
        },
        load: function () {
            return cm;
        }
    };
});

pungClient.controller('UIController', function ($scope) {
    console.log("UIController");
});

pungClient.controller('LoginController', function ($scope, cmStore, $mdDialog, $location, $timeout) {
    console.log("LoginController");
    $scope.keyfile = "key file";

    $scope.selectFile = function () {
        var chooser = document.querySelector("#loginFileChooser");
        var listener = function (evt) {
            var path = this.value;
            $scope.$apply(function () {
                $scope.keyfile = path || "key file";
            });
            chooser.removeEventListener("change", listener);
        };

        chooser.addEventListener("change", listener);

        chooser.click();
    };

    $scope.resetFileChooser = function () {
        $scope.keyfile = "key file";
        document.querySelector("#loginFileChooser").value = null;
    };

    $scope.errorDialog = function (message) {
        $mdDialog.show(
            $mdDialog.alert()
                .title('Error')
                .content(message)
                .ariaLabel('Error')
                .ok('ok')
        );
    };

    $scope.showLoginErrors = false;
    $scope.tryLogin = function () {
        if ($scope.loginForm.$valid) {
            var rsaKey = null;
            try {
                var utils = require('./utils');
                rsaKey = utils.loadRsaKey($scope.keyfile);
            } catch (e) {
                $scope.resetFileChooser();
                $scope.errorDialog('Cannot load or parse given keyfile.');
                $scope.showLoginErrors = false;
            }
            $scope.loginProcedure($scope.username, rsaKey);
        } else {
            $scope.showLoginErrors = true;
        }
    };

    $scope.notLoading = true;
    $scope.loginProcedure = function (username, rsaKey) {
        $scope.notLoading = false;

        var Kefir = require("kefir").Kefir;
        var procs = require('./procedures');
        var tlsStream = require("./tlsStream");
        var cu = require('./connUtils');

        var usernameList = username.split('@');
        var user = usernameList[0];
        var host = usernameList[1];

        tlsStream.create(host, 24948, 2000)
            .onValue(function (stream) {
                var cm = cu.ConnectionManager(stream);

                procs.login(cm, user, rsaKey)
                    .onError(function (error) {
                        console.error(error);
                        $timeout(function () {
                            $scope.errorDialog("Login procedure with server failed: " + error);
                            $scope.notLoading = true;
                        });
                    })
                    .onValue(function () {
                        $timeout(function () {
                            cmStore.store(cm);
                            $location.path('/communicator');
                        });
                    });
            })
            .onError(function (error) {
                console.error(error);
                $timeout(function () {
                    $scope.errorDialog("Cannot establish secure connection with server");
                    $scope.notLoading = true;
                });
            });
    };
});

pungClient.controller('SignUpController', function ($scope, cmStore, $location) {
    console.log("SignUpController");
});

pungClient.controller('CommunicatorController', function ($scope, cmStore, $location) {
    console.log("CommunicatorController");

    var cm = cmStore.load();
    cm.close();
});

pungClient.config(function($routeProvider, $locationProvider) {
    $routeProvider
        .when('/login', {
            templateUrl: 'view/login.html',
            controller: 'LoginController',
        })
        .when('/signup', {
            templateUrl: 'view/signup.html',
            controller: 'SignUpController'
        })
        .when('/communicator', {
            templateUrl: 'view/communicator.html',
            controller: 'CommunicatorController'
        })
        .otherwise({
            redirectTo: '/login'
        });

    $locationProvider.html5Mode(true);
});
